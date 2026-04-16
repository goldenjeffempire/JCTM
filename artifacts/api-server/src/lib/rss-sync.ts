/**
 * rss-sync.ts — Quota-free YouTube channel sync via Atom RSS feed.
 *
 * YouTube publishes a public Atom feed for every channel that lists the 15
 * most recent videos.  This feed requires no API key and has no daily quota.
 * We use it as a lightweight, always-on sync layer that runs every 5 minutes
 * and keeps the latest videos up-to-date even when the YouTube Data API v3
 * quota is exhausted.
 *
 * What it does:
 *  • Fetches https://www.youtube.com/xml/feeds/videos.xml?channel_id=<CHANNEL_ID>
 *  • Parses the Atom XML (no third-party parser — simple regex extraction)
 *  • Upserts each entry into `sermon_data`:
 *      – INSERT new videos (with RSS-quality thumbnail as placeholder)
 *      – UPDATE title + published_at for existing videos (metadata drift fix)
 *      – Never overwrites higher-quality fields set by the API sync
 *        (thumbnail, duration, viewCount, isLive, broadcastEndedAt)
 *
 * Integration points:
 *  • Called by cron.ts every 5 minutes (RSS_INTERVAL_MS)
 *  • Completely independent of YOUTUBE_API_KEY — always runs
 *  • After an upsert the caller can optionally broadcast a sync_complete SSE
 */

import { db, sermonsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { classifyTitle, CHANNEL_ID } from "./youtube-sync.js";
import type { Logger } from "pino";

// ─── Constants ────────────────────────────────────────────────────────────────

export const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
export const RSS_INTERVAL_MS = 5 * 60 * 1_000; // 5 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RSSEntry {
  videoId:      string;
  title:        string;
  published:    string; // ISO 8601
  thumbnailUrl: string;
  description:  string;
}

export interface RSSSyncResult {
  inserted:         number;
  updated:          number;
  total:            number;
  insertedVideoIds: string[];
}

// ─── XML Parser ───────────────────────────────────────────────────────────────

/**
 * Extract text content from a simple XML tag (non-nested, single match).
 * Returns null when the tag is absent.
 */
function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1]!.trim() : null;
}

/**
 * Extract an attribute value from a self-closing or opening XML tag.
 * e.g. extractAttr(xml, "media:thumbnail", "url")
 */
function extractAttr(xml: string, tag: string, attr: string): string | null {
  const escapedTag = tag.replace(":", "\\:");
  const re = new RegExp(`<${escapedTag}[^>]+${attr}="([^"]+)"`, "i");
  const m = xml.match(re);
  return m ? m[1]! : null;
}

/**
 * Decode HTML entities that YouTube sometimes uses in RSS titles/descriptions.
 */
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Parse a YouTube Atom RSS feed and return structured entries.
 * Handles both `<yt:videoId>` and `<id>yt:video:…</id>` formats.
 */
export function parseRSSFeed(xml: string): RSSEntry[] {
  const entries: RSSEntry[] = [];

  // Split on <entry> blocks — each video is one entry
  const entryBlocks = xml.split(/<entry[\s>]/).slice(1); // first chunk is the feed header

  for (const block of entryBlocks) {
    // Video ID — try yt:videoId first, then id tag
    let videoId = extractTag(block, "yt:videoId");
    if (!videoId) {
      const idTag = extractTag(block, "id");
      const idMatch = idTag?.match(/yt:video:([A-Za-z0-9_-]{11})/);
      videoId = idMatch?.[1] ?? null;
    }
    if (!videoId || videoId.length !== 11) continue;

    // Title — first <title> inside entry (skip the channel title at feed root)
    const rawTitle = extractTag(block, "title");
    if (!rawTitle) continue;
    const title = decodeEntities(rawTitle);

    // Published date
    const published = extractTag(block, "published");
    if (!published) continue;

    // Validate date
    const publishedDate = new Date(published);
    if (isNaN(publishedDate.getTime())) continue;

    // Thumbnail from media:thumbnail url attribute
    const thumbnailUrl =
      extractAttr(block, "media:thumbnail", "url") ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // Description from media:description (may be absent or empty)
    const rawDesc = extractTag(block, "media:description") ?? "";
    const description = decodeEntities(rawDesc).slice(0, 1000);

    entries.push({ videoId, title, published, thumbnailUrl, description });
  }

  return entries;
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchRSS(log?: Logger): Promise<string> {
  const res = await fetch(RSS_URL, {
    signal: AbortSignal.timeout(12_000),
    headers: {
      Accept: "application/atom+xml, application/xml, text/xml, */*",
      "User-Agent": "JCTM-Platform/1.0 RSS-Sync",
    },
  });

  if (!res.ok) {
    throw new Error(`RSS fetch failed: HTTP ${res.status} ${res.statusText}`);
  }

  return res.text();
}

// ─── Main sync function ───────────────────────────────────────────────────────

/**
 * Fetch the channel RSS feed and upsert each entry into `sermon_data`.
 *
 * Strategy:
 *  • New video  → full INSERT (title, thumbnail, published_at, description, isFeatured)
 *  • Existing   → UPDATE title + published_at only
 *                 (preserves API-quality thumbnail, duration, viewCount, isLive set by
 *                  the API sync or manual writes)
 *
 * Returns counts of inserted and updated rows.
 */
export async function syncFromRSS(log?: Logger): Promise<RSSSyncResult> {
  const xml = await fetchRSS(log);
  const entries = parseRSSFeed(xml);

  if (entries.length === 0) {
    log?.info("RSS feed returned no entries — skipping upsert");
    return { inserted: 0, updated: 0, total: 0, insertedVideoIds: [] };
  }

  let inserted = 0;
  let updated  = 0;
  const insertedVideoIds: string[] = [];

  for (const entry of entries) {
    const { isFeatured, isLive } = classifyTitle(entry.title);

    const result = await db
      .insert(sermonsTable)
      .values({
        videoId:      entry.videoId,
        title:        entry.title,
        thumbnailUrl: entry.thumbnailUrl,
        description:  entry.description,
        publishedAt:  new Date(entry.published),
        isFeatured,
        isLive,
      })
      .onConflictDoUpdate({
        target: sermonsTable.videoId,
        // For existing rows: refresh the title (YouTube allows title edits) and
        // the published_at timestamp.  Leave everything else untouched so the
        // higher-quality data written by the API sync or livestream route is
        // preserved (thumbnail, duration, viewCount, isLive, broadcastEndedAt).
        set: {
          title:       sql`CASE WHEN sermon_data.title != EXCLUDED.title THEN EXCLUDED.title ELSE sermon_data.title END`,
          publishedAt: sql`CASE WHEN sermon_data.published_at < EXCLUDED.published_at THEN EXCLUDED.published_at ELSE sermon_data.published_at END`,
          isFeatured:  sql`sermon_data.is_featured OR ${isFeatured}`,
        },
      })
      .returning({ videoId: sermonsTable.videoId, createdAt: sermonsTable.createdAt });

    // Determine if this was a fresh insert or an update
    // A newly inserted row has createdAt very close to now
    const row = result[0];
    if (row) {
      const ageMs = Date.now() - new Date(row.createdAt).getTime();
      if (ageMs < 5_000) {
        inserted++;
        insertedVideoIds.push(entry.videoId);
      } else {
        updated++;
      }
    }
  }

  log?.info({ inserted, updated, total: entries.length }, "RSS sync complete");
  return { inserted, updated, total: entries.length, insertedVideoIds };
}

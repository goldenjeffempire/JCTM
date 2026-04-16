import { db, sermonsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import type { Logger } from "pino";

export const CHANNEL_ID = "UCPFFvkE-KGpR37qJgvYriJg";
// Uploads playlist = UU + channel_id without the leading UC
export const UPLOADS_PLAYLIST_ID = "UUPFFvkE-KGpR37qJgvYriJg";

const FEATURED_KEYWORDS = ["live", "sunday service", "prophetic", "live now", "special service", "breaking"];

interface PlaylistItem {
  snippet: {
    resourceId: { videoId: string };
    title: string;
    description: string;
    publishedAt: string;
    thumbnails: {
      maxres?: { url: string };
      standard?: { url: string };
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
}

interface VideoDetail {
  id: string;
  contentDetails: { duration: string };
  statistics: { viewCount?: string };
  snippet?: {
    liveBroadcastContent?: string;
    thumbnails?: {
      maxres?:   { url: string };
      standard?: { url: string };
      high?:     { url: string };
    };
    title?: string;
  };
}

export function iso8601ToSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] ?? "0") * 3600) + (parseInt(match[2] ?? "0") * 60) + parseInt(match[3] ?? "0");
}

export function bestThumbnail(thumbnails: PlaylistItem["snippet"]["thumbnails"], videoId: string): string {
  return (
    thumbnails.maxres?.url ??
    thumbnails.standard?.url ??
    thumbnails.high?.url ??
    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
  );
}

export function classifyTitle(title: string): { isFeatured: boolean; isLive: boolean } {
  const lower = title.toLowerCase();
  const isLive = lower.includes("live") || lower.includes("live now") || lower.includes("live stream");
  const isFeatured =
    isLive ||
    FEATURED_KEYWORDS.some(kw => lower.includes(kw));
  return { isFeatured, isLive };
}

export class QuotaExceededError extends Error {
  constructor() {
    super("YouTube API quota exceeded for today");
    this.name = "QuotaExceededError";
  }
}

// ─── Fetch with retry, timeout, and structured quota detection ─────────────────

/**
 * Parse a YouTube API error body and determine whether the error is due to
 * quota exhaustion.  YouTube always returns a JSON error envelope like:
 *   { "error": { "code": 403, "errors": [{ "reason": "quotaExceeded" }] } }
 * but the body is parsed defensively so any parse failure falls back to the
 * plain text heuristic.
 */
function isQuotaError(status: number, body: string): boolean {
  if (status !== 403 && status !== 429) return false;
  // Fast path: plain-text heuristic
  const lower = body.toLowerCase();
  if (lower.includes("quota") || lower.includes("dailylimit")) return true;
  // Structured path: parse JSON reason codes
  try {
    const json = JSON.parse(body) as { error?: { errors?: { reason?: string }[] } };
    const reasons = json.error?.errors?.map(e => e.reason ?? "") ?? [];
    return reasons.some(r => r === "quotaExceeded" || r === "dailyLimitExceeded" || r === "rateLimitExceeded");
  } catch {
    return false;
  }
}

async function fetchWithRetry<T>(
  url: string,
  retries = 2,
  delayMs = 1500
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
      });

      if (res.status === 403 || res.status === 429) {
        const body = await res.text();
        if (isQuotaError(res.status, body)) throw new QuotaExceededError();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
      }

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
      }
      return await res.json() as T;
    } catch (err) {
      if (err instanceof QuotaExceededError) throw err;
      // Abort errors (timeout) are not retried with backoff — rethrow fast
      if (err instanceof DOMException && err.name === "TimeoutError") throw err;
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr;
}

// ─── YouTube API helpers ──────────────────────────────────────────────────────

/**
 * Fetch playlist items from the channel uploads playlist.
 * @param apiKey     YouTube Data API v3 key
 * @param maxPages   0 = paginate through all results (for harvest); N = stop after N pages.
 *                   Each page returns up to 50 items, so maxPages=1 gives the 50 most recent.
 */
async function fetchPlaylistItems(apiKey: string, maxPages = 0): Promise<PlaylistItem[]> {
  const items: PlaylistItem[] = [];
  let pageToken: string | undefined;
  let page = 0;

  while (true) {
    const params = new URLSearchParams({
      key: apiKey,
      playlistId: UPLOADS_PLAYLIST_ID,
      part: "snippet",
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });

    const data = await fetchWithRetry<{
      items?: PlaylistItem[];
      nextPageToken?: string;
      error?: { message: string };
    }>(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`);

    if (data.error) throw new Error(`YouTube API: ${data.error.message}`);
    if (!data.items || data.items.length === 0) break;

    items.push(...data.items);
    page++;
    pageToken = data.nextPageToken;

    if (!pageToken) break;
    if (maxPages > 0 && page >= maxPages) break;
  }

  return items;
}

async function fetchVideoDetails(apiKey: string, videoIds: string[]): Promise<VideoDetail[]> {
  const details: VideoDetail[] = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      key: apiKey,
      id: batch.join(","),
      part: "contentDetails,statistics,snippet",
    });

    const data = await fetchWithRetry<{
      items?: VideoDetail[];
      error?: { message: string };
    }>(`https://www.googleapis.com/youtube/v3/videos?${params}`);

    if (data.error) throw new Error(`YouTube API: ${data.error.message}`);
    if (data.items) details.push(...data.items);
  }

  return details;
}

// ─── Upsert helper ────────────────────────────────────────────────────────────

async function upsertSermon(item: {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  description: string;
  publishedAt: Date;
  viewCount: number | null;
  duration: string;
  isFeatured: boolean;
  isLive: boolean;
  actuallyLive?: boolean;
}): Promise<void> {
  const { actuallyLive, ...values } = item;
  const liveValue = actuallyLive ?? item.isLive;

  await db
    .insert(sermonsTable)
    .values({ ...values, isLive: liveValue })
    .onConflictDoUpdate({
      target: sermonsTable.videoId,
      set: {
        title:            values.title,
        thumbnailUrl:     values.thumbnailUrl,
        description:      values.description,
        publishedAt:      values.publishedAt,
        viewCount:        values.viewCount,
        duration:         values.duration,
        isFeatured:       values.isFeatured,
        isLive:           liveValue,
        broadcastEndedAt: sql`CASE WHEN sermon_data.is_live = true AND ${liveValue} = false THEN NOW() ELSE sermon_data.broadcast_ended_at END`,
      },
    });
}

export interface SyncResult {
  synced: number;
  featured: number;
  live: number;
  message: string;
}

// ─── Full harvest ─────────────────────────────────────────────────────────────

/**
 * Full harvest: fetches the entire channel upload history and atomically
 * replaces the existing sermon catalogue.
 *
 * Safety: all API data is fetched BEFORE touching the database.  The
 * database is updated inside a transaction so that if any write fails the
 * existing data is fully preserved — no partial or empty state.
 */
export async function harvestAll(apiKey: string, log?: Logger): Promise<SyncResult> {
  log?.info("Starting full harvest (purge + repopulate)");

  // ── Step 1: Fetch everything from YouTube — DB is still intact ─────────────
  const playlistItems = await fetchPlaylistItems(apiKey, 0); // 0 = all pages
  if (playlistItems.length === 0) {
    return { synced: 0, featured: 0, live: 0, message: "No videos on channel" };
  }

  const videoIds = playlistItems.map(i => i.snippet.resourceId.videoId);
  const detailMap = new Map<string, VideoDetail>();
  const details = await fetchVideoDetails(apiKey, videoIds);
  for (const d of details) detailMap.set(d.id, d);

  const validVideos = playlistItems.filter(item => {
    const detail = detailMap.get(item.snippet.resourceId.videoId);
    if (!detail) return false;
    return iso8601ToSeconds(detail.contentDetails.duration) > 60;
  });

  if (validVideos.length === 0) {
    return { synced: 0, featured: 0, live: 0, message: "No valid sermons found (all were Shorts)" };
  }

  let featured = 0;
  let live = 0;
  const inserts = validVideos.map(item => {
    const videoId = item.snippet.resourceId.videoId;
    const detail = detailMap.get(videoId)!;
    const { isFeatured, isLive } = classifyTitle(item.snippet.title);
    if (isFeatured) featured++;
    if (isLive) live++;
    return {
      videoId,
      title:        item.snippet.title,
      thumbnailUrl: bestThumbnail(item.snippet.thumbnails, videoId),
      description:  item.snippet.description.slice(0, 1000),
      publishedAt:  new Date(item.snippet.publishedAt),
      viewCount:    detail.statistics?.viewCount ? parseInt(detail.statistics.viewCount) : null,
      duration:     detail.contentDetails.duration,
      isFeatured,
      isLive,
    };
  });

  // ── Step 2: Atomically replace catalogue in a single transaction ───────────
  // All API data is already in memory — if any DB write fails, the transaction
  // rolls back and the existing catalogue remains fully intact.
  await db.transaction(async (tx) => {
    await tx.delete(sermonsTable);
    for (let i = 0; i < inserts.length; i += 100) {
      await tx.insert(sermonsTable).values(inserts.slice(i, i + 100));
    }
  });

  log?.info({ synced: inserts.length, featured, live }, "Full harvest complete");
  return {
    synced: inserts.length,
    featured,
    live,
    message: `Harvested ${inserts.length} sermons from full channel history (${featured} featured, ${live} live)`,
  };
}

// ─── Incremental sync (full — for manual sync / first run) ────────────────────

/**
 * Full incremental upsert: fetches the entire uploads playlist and upserts
 * into the DB (insert-or-update, never deletes).  Used for the first run and
 * manual admin-triggered syncs.  Filters out Shorts (<= 60s).
 */
export async function syncIncremental(apiKey: string, log?: Logger): Promise<SyncResult> {
  log?.info("Starting incremental YouTube sync (full playlist)");

  const playlistItems = await fetchPlaylistItems(apiKey, 0);
  if (playlistItems.length === 0) {
    return { synced: 0, featured: 0, live: 0, message: "No videos on channel" };
  }

  return _upsertPlaylistItems(playlistItems, apiKey, log);
}

// ─── Recent incremental sync (for 30-minute cron) ────────────────────────────

/**
 * Lightweight incremental sync that only inspects the most recent videos.
 * Used by the automatic 30-minute cron — fetches only the first playlist page
 * (up to 50 newest videos) to minimise quota consumption.
 *
 * For channels with consistent publishing cadences this is sufficient to catch
 * all new uploads between cron runs.  A full syncIncremental will be triggered
 * automatically on the first-ever run (empty DB).
 */
export async function syncRecentIncremental(apiKey: string, log?: Logger): Promise<SyncResult> {
  log?.info("Starting recent incremental YouTube sync (first page only)");

  const playlistItems = await fetchPlaylistItems(apiKey, 1); // first page = 50 newest
  if (playlistItems.length === 0) {
    return { synced: 0, featured: 0, live: 0, message: "No videos on channel" };
  }

  return _upsertPlaylistItems(playlistItems, apiKey, log);
}

// ─── Shared upsert core ───────────────────────────────────────────────────────

async function _upsertPlaylistItems(
  playlistItems: PlaylistItem[],
  apiKey: string,
  log?: Logger,
): Promise<SyncResult> {
  const videoIds = playlistItems.map(i => i.snippet.resourceId.videoId);
  const detailMap = new Map<string, VideoDetail>();
  const details = await fetchVideoDetails(apiKey, videoIds);
  for (const d of details) detailMap.set(d.id, d);

  const validVideos = playlistItems.filter(item => {
    const detail = detailMap.get(item.snippet.resourceId.videoId);
    if (!detail) return false;
    return iso8601ToSeconds(detail.contentDetails.duration) > 60;
  });

  let featured = 0;
  let live = 0;

  for (const item of validVideos) {
    const videoId = item.snippet.resourceId.videoId;
    const detail = detailMap.get(videoId)!;
    const { isFeatured, isLive } = classifyTitle(item.snippet.title);

    if (isFeatured) featured++;
    if (isLive) live++;

    const liveStatus = detail.snippet?.liveBroadcastContent;
    const actuallyLive = isLive || liveStatus === "live";

    await upsertSermon({
      videoId,
      title:        item.snippet.title,
      thumbnailUrl: bestThumbnail(item.snippet.thumbnails, videoId),
      description:  item.snippet.description.slice(0, 1000),
      publishedAt:  new Date(item.snippet.publishedAt),
      viewCount:    detail.statistics?.viewCount ? parseInt(detail.statistics.viewCount) : null,
      duration:     detail.contentDetails.duration,
      isFeatured,
      isLive,
      actuallyLive,
    });
  }

  const result = {
    synced:   validVideos.length,
    featured,
    live,
    message: `Synced ${validVideos.length} sermons (${featured} featured, ${live} live)`,
  };

  log?.info(result, "Incremental sync complete");
  return result;
}

// ─── Single video sync (WebSub) ───────────────────────────────────────────────

/**
 * Sync a single video by ID.  Used by WebSub push notifications.
 * Returns null when the video should be ignored (wrong channel, Short, etc).
 */
export async function syncSingleVideo(apiKey: string, videoId: string, log?: Logger): Promise<void> {
  log?.info({ videoId }, "Syncing single video from WebSub notification");

  const params = new URLSearchParams({
    key: apiKey,
    id: videoId,
    part: "snippet,contentDetails,statistics",
  });

  const data = await fetchWithRetry<{
    items?: Array<{
      id: string;
      snippet: {
        title: string;
        description: string;
        publishedAt: string;
        thumbnails: PlaylistItem["snippet"]["thumbnails"];
        liveBroadcastContent?: string;
        channelId: string;
      };
      contentDetails: { duration: string };
      statistics: { viewCount?: string };
    }>;
  }>(`https://www.googleapis.com/youtube/v3/videos?${params}`);

  if (!data.items || data.items.length === 0) {
    log?.warn({ videoId }, "Video not found via API");
    return;
  }

  const item = data.items[0];
  if (item.snippet.channelId !== CHANNEL_ID) {
    log?.warn({ videoId }, "Video not from JCTM channel, skipping");
    return;
  }

  const durationSecs = iso8601ToSeconds(item.contentDetails.duration);
  if (durationSecs > 0 && durationSecs <= 60) {
    log?.info({ videoId }, "Skipping Short video");
    return;
  }

  const { isFeatured, isLive } = classifyTitle(item.snippet.title);
  const actuallyLive = isLive || item.snippet.liveBroadcastContent === "live";

  await upsertSermon({
    videoId,
    title:        item.snippet.title,
    thumbnailUrl: bestThumbnail(item.snippet.thumbnails, videoId),
    description:  item.snippet.description.slice(0, 1000),
    publishedAt:  new Date(item.snippet.publishedAt),
    viewCount:    item.statistics?.viewCount ? parseInt(item.statistics.viewCount) : null,
    duration:     item.contentDetails.duration,
    isFeatured,
    isLive,
    actuallyLive,
  });

  log?.info({ videoId, isFeatured, isLive: actuallyLive }, "Single video synced");
}

// ─── RSS enrichment ───────────────────────────────────────────────────────────

/**
 * Enrich a specific list of video IDs with full YouTube API metadata
 * (duration, view count, live status, high-quality thumbnail).
 *
 * Used to immediately fill in metadata for videos inserted by RSS sync
 * so they appear in the Moments feed without waiting for the 30-min cron.
 *
 * Only calls the API for videos that are genuinely missing duration data to
 * avoid wasting quota on already-enriched records.
 *
 * Returns the count of rows actually updated.
 */
export async function enrichVideoIds(
  apiKey: string,
  videoIds: string[],
  log?: Logger,
): Promise<number> {
  if (videoIds.length === 0) return 0;

  // Only enrich videos that are missing duration — saves quota on already-complete records
  const existing = await db
    .select({ videoId: sermonsTable.videoId, duration: sermonsTable.duration })
    .from(sermonsTable)
    .where(
      sql`${sermonsTable.videoId} = ANY(ARRAY[${sql.raw(videoIds.map(id => `'${id.replace(/'/g, "''")}'`).join(","))}]::text[])`,
    );

  const needEnrichment = existing
    .filter(r => !r.duration)
    .map(r => r.videoId);

  // Also include any IDs not yet in the DB at all (race: RSS inserted but not returned yet)
  const knownIds = new Set(existing.map(r => r.videoId));
  const unknownIds = videoIds.filter(id => !knownIds.has(id));
  const toEnrich = [...new Set([...needEnrichment, ...unknownIds])];

  if (toEnrich.length === 0) {
    log?.info({ requested: videoIds.length }, "All RSS videos already enriched — skipping API call");
    return 0;
  }

  log?.info({ enriching: toEnrich.length, skipping: videoIds.length - toEnrich.length }, "Enriching RSS videos via YouTube API");

  const details = await fetchVideoDetails(apiKey, toEnrich);
  let enriched = 0;

  for (const detail of details) {
    const durationSecs = iso8601ToSeconds(detail.contentDetails.duration);

    // Exclude Shorts (≤ 60 s)
    if (durationSecs > 0 && durationSecs <= 60) {
      log?.info({ videoId: detail.id }, "Skipping Short video during RSS enrichment");
      continue;
    }

    const apiThumbnail =
      detail.snippet?.thumbnails?.maxres?.url ??
      detail.snippet?.thumbnails?.standard?.url ??
      detail.snippet?.thumbnails?.high?.url ??
      null;

    const liveFromApi = detail.snippet?.liveBroadcastContent === "live";

    await db
      .update(sermonsTable)
      .set({
        duration:  detail.contentDetails.duration,
        viewCount: detail.statistics?.viewCount ? parseInt(detail.statistics.viewCount) : null,
        ...(apiThumbnail ? { thumbnailUrl: apiThumbnail } : {}),
        isLive:           sql`CASE WHEN sermon_data.is_live = true AND ${liveFromApi} = false THEN false ELSE (sermon_data.is_live OR ${liveFromApi}) END`,
        broadcastEndedAt: sql`CASE WHEN sermon_data.is_live = true AND ${liveFromApi} = false THEN NOW() ELSE sermon_data.broadcast_ended_at END`,
      })
      .where(eq(sermonsTable.videoId, detail.id));

    enriched++;
  }

  log?.info({ enriched, requested: toEnrich.length }, "RSS video enrichment complete");
  return enriched;
}

// ─── WebSub subscription ──────────────────────────────────────────────────────

/**
 * Subscribe to YouTube PubSubHubbub (WebSub) for push notifications.
 * Call once on server startup.
 */
export async function subscribeToWebSub(callbackUrl: string, log?: Logger): Promise<void> {
  const HUB   = "https://pubsubhubbub.appspot.com/subscribe";
  const TOPIC = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

  const body = new URLSearchParams({
    "hub.callback":      callbackUrl,
    "hub.mode":          "subscribe",
    "hub.topic":         TOPIC,
    "hub.verify":        "async",
    "hub.lease_seconds": "86400",
  });

  try {
    const res = await fetch(HUB, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
      signal:  AbortSignal.timeout(15_000),
    });

    if (res.status === 202 || res.status === 200) {
      log?.info({ callbackUrl }, "WebSub subscription submitted successfully");
    } else {
      const text = await res.text();
      log?.warn({ status: res.status, text }, "WebSub subscription returned unexpected status");
    }
  } catch (err) {
    log?.warn({ err }, "WebSub subscription failed (non-fatal)");
  }
}

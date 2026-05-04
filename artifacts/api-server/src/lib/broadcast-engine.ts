/**
 * Broadcast Automation Engine — Zero External API
 *
 * Central intelligence layer for JCTM Temple TV's automated broadcast system.
 * Manages:
 *  - Smart rebroadcast content curation (fully algorithmic, no OpenAI)
 *  - Sermon scoring and selection
 *  - Broadcast lifecycle event hooks
 *  - Automatic rebroadcast queue building
 *  - Broadcast state persistence helpers
 */

import { db, sermonsTable } from "@workspace/db";
import { desc, ne, sql, and, isNotNull } from "drizzle-orm";
import { pool } from "@workspace/db";
import type { Logger } from "pino";
import { ingestSermonSummary } from "./knowledge-ingestion.js";
import { autoTag, categorize, scoreTrending } from "./local-content-intelligence.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RebroadcastCandidate {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  viewCount: number | null;
  score: number;
  reason: string;
}

export interface SmartRebroadcastSelection {
  primary: RebroadcastCandidate;
  queue: RebroadcastCandidate[];
  curatedAt: string;
  strategy: "ai" | "algorithmic" | "fallback";
}

// ─── Scoring Algorithm ────────────────────────────────────────────────────────

const FEATURED_KEYWORDS = [
  "correction mandate", "holiness", "sunday service", "prophetic", "apostolic",
  "primitive christianity", "end time", "holy spirit", "salvation", "repentance",
  "water baptism", "five fold", "kingdom", "revival", "righteousness",
];

function scoreSermon(sermon: {
  title: string;
  viewCount: number | null;
  publishedAt: Date | string;
  isFeatured: boolean;
}): number {
  let score = 0;
  const titleLower = sermon.title.toLowerCase();

  const ageMs = Date.now() - new Date(sermon.publishedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < 30) score += 30;
  else if (ageDays < 90) score += 20;
  else if (ageDays < 180) score += 10;
  else if (ageDays < 365) score += 5;

  const views = sermon.viewCount ?? 0;
  if (views > 10000) score += 25;
  else if (views > 5000) score += 20;
  else if (views > 1000) score += 15;
  else if (views > 500) score += 10;
  else if (views > 100) score += 5;

  if (sermon.isFeatured) score += 15;

  const matchingKeywords = FEATURED_KEYWORDS.filter(kw => titleLower.includes(kw));
  score += Math.min(matchingKeywords.length * 5, 20);

  if (titleLower.includes("sunday") || titleLower.includes("service")) score += 10;

  return score;
}

// ─── Smart Rebroadcast Queue ──────────────────────────────────────────────────

export async function buildSmartRebroadcastQueue(
  excludeVideoId: string | null,
  log?: Logger,
): Promise<SmartRebroadcastSelection> {
  const fallbackAt = new Date().toISOString();

  try {
    const sermonPool = await db
      .select()
      .from(sermonsTable)
      .where(
        excludeVideoId
          ? and(ne(sermonsTable.videoId, excludeVideoId), isNotNull(sermonsTable.videoId))
          : isNotNull(sermonsTable.videoId),
      )
      .orderBy(desc(sermonsTable.publishedAt))
      .limit(60);

    if (sermonPool.length === 0) {
      throw new Error("No sermons available for rebroadcast queue");
    }

    const scored: RebroadcastCandidate[] = sermonPool.map(s => {
      const trendScore = scoreTrending({
        title: s.title,
        viewCount: s.viewCount ?? 0,
        publishedAt: s.publishedAt,
        isFeatured: s.isFeatured ?? false,
      });

      const algoScore = scoreSermon({
        title: s.title,
        viewCount: s.viewCount,
        publishedAt: s.publishedAt,
        isFeatured: s.isFeatured ?? false,
      });

      return {
        videoId: s.videoId,
        title: s.title,
        thumbnailUrl: s.thumbnailUrl,
        publishedAt:
          s.publishedAt instanceof Date
            ? s.publishedAt.toISOString()
            : String(s.publishedAt),
        viewCount: s.viewCount,
        score: algoScore + trendScore.score,
        reason: trendScore.reasons[0] ?? "algorithmic",
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const primary = scored[0]!;
    primary.reason = "top-ranked (local AI)";
    const queue = scored.slice(0, 8);

    log?.info(
      { videoId: primary.videoId, title: primary.title, score: primary.score },
      "Local AI rebroadcast primary selected",
    );

    return {
      primary,
      queue,
      curatedAt: fallbackAt,
      strategy: "algorithmic",
    };
  } catch (err) {
    log?.error({ err }, "Smart rebroadcast selection failed — using fallback");

    try {
      const [latest] = await db
        .select()
        .from(sermonsTable)
        .orderBy(desc(sermonsTable.publishedAt))
        .limit(1);

      if (latest) {
        const candidate: RebroadcastCandidate = {
          videoId: latest.videoId,
          title: latest.title,
          thumbnailUrl: latest.thumbnailUrl,
          publishedAt:
            latest.publishedAt instanceof Date
              ? latest.publishedAt.toISOString()
              : String(latest.publishedAt),
          viewCount: latest.viewCount,
          score: 0,
          reason: "fallback-latest",
        };
        return { primary: candidate, queue: [candidate], curatedAt: fallbackAt, strategy: "fallback" };
      }
    } catch {
      // Ignore
    }

    throw new Error("Unable to build rebroadcast queue — no sermons in database");
  }
}

// ─── Auto-Metadata Generation (fully local) ───────────────────────────────────

export interface AutoMetadata {
  tags: string[];
  summary: string;
  category: string;
}

export async function generateSermonMetadata(
  title: string,
  log?: Logger,
): Promise<AutoMetadata | null> {
  try {
    const tags = autoTag(title, 8);
    const category = categorize(title);
    const { summarizeSermon } = await import("./local-content-intelligence.js");
    const result = summarizeSermon(title, title);

    const summary = result.summary.slice(0, 200);

    return { tags, summary, category };
  } catch (err) {
    log?.warn({ err, title }, "Local metadata generation failed");
    return null;
  }
}

// ─── Auto-Enrichment Pipeline ─────────────────────────────────────────────────

export async function enrichNextSermonBatch(
  batchSize = 5,
  log?: Logger,
): Promise<number> {
  try {
    const unenriched = await pool.query<{
      id: number;
      video_id: string;
      title: string;
      description: string | null;
    }>(
      `SELECT id, video_id, title, description FROM sermon_data
       WHERE metadata_generated_at IS NULL
       ORDER BY published_at DESC
       LIMIT $1`,
      [batchSize],
    );

    if (unenriched.rows.length === 0) return 0;

    let count = 0;
    for (const sermon of unenriched.rows) {
      const metadata = await generateSermonMetadata(
        `${sermon.title} ${sermon.description ?? ""}`.slice(0, 300),
        log,
      );
      if (!metadata) continue;

      await pool.query(
        `UPDATE sermon_data
         SET ai_summary = $1,
             tags = $2,
             category = $3,
             metadata_generated_at = now()
         WHERE id = $4`,
        [metadata.summary, metadata.tags, metadata.category, sermon.id],
      );

      ingestSermonSummary({
        videoId: sermon.video_id,
        title: sermon.title,
        summary: metadata.summary,
        category: metadata.category,
        tags: metadata.tags,
        log,
      }).catch(err => {
        log?.warn({ err, videoId: sermon.video_id }, "Sermon knowledge ingestion failed (non-fatal)");
      });

      count++;
    }

    return count;
  } catch (err) {
    log?.warn({ err }, "Sermon batch enrichment failed (non-fatal)");
    return 0;
  }
}

// ─── Recommendation Engine ────────────────────────────────────────────────────

export interface SermonRecommendation {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number | null;
  category: string;
  tags: string[];
  aiSummary: string | null;
  score: number;
  reason: string;
}

export async function getSermonRecommendations(opts: {
  excludeVideoId?: string;
  category?: string;
  limit?: number;
  log?: Logger;
}): Promise<SermonRecommendation[]> {
  const { excludeVideoId, category, limit = 8, log } = opts;

  try {
    const result = await pool.query<{
      video_id: string;
      title: string;
      thumbnail_url: string;
      published_at: Date;
      view_count: number | null;
      category: string;
      tags: string[];
      ai_summary: string | null;
    }>(
      `SELECT video_id, title, thumbnail_url, published_at, view_count,
              COALESCE(category, 'sermon') as category,
              COALESCE(tags, '{}') as tags,
              ai_summary
       FROM sermon_data
       WHERE is_live = false
       ${excludeVideoId ? `AND video_id != '${excludeVideoId.replace(/'/g, "''")}'` : ""}
       ${category && category !== "all" ? `AND category ILIKE '%${category.replace(/'/g, "''")}%'` : ""}
       ORDER BY published_at DESC
       LIMIT 80`,
    );

    if (result.rows.length === 0) return [];

    const scored: SermonRecommendation[] = result.rows.map(s => ({
      videoId: s.video_id,
      title: s.title,
      thumbnailUrl: s.thumbnail_url,
      publishedAt: s.published_at instanceof Date ? s.published_at.toISOString() : String(s.published_at),
      viewCount: s.view_count,
      category: s.category,
      tags: Array.isArray(s.tags) ? s.tags : [],
      aiSummary: s.ai_summary,
      score: scoreSermon({
        title: s.title,
        viewCount: s.view_count,
        publishedAt: s.published_at,
        isFeatured: false,
      }),
      reason: s.ai_summary ? "ai-enriched" : "algorithmic",
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  } catch (err) {
    log?.error({ err }, "Sermon recommendation engine failed");
    return [];
  }
}

export async function getSermonCategories(): Promise<string[]> {
  try {
    const result = await pool.query<{ category: string }>(
      `SELECT DISTINCT category FROM sermon_data
       WHERE category IS NOT NULL AND category != 'sermon'
       ORDER BY category`,
    );
    return result.rows.map(r => r.category);
  } catch {
    return [];
  }
}

// ─── Broadcast Stats ──────────────────────────────────────────────────────────

export async function getBroadcastStats(log?: Logger): Promise<{
  totalSermons: number;
  lastSyncedAt: string | null;
  avgViewCount: number;
  topSermons: { videoId: string; title: string; viewCount: number }[];
}> {
  try {
    const [countRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(sermonsTable);

    const [statsRow] = await db
      .select({
        avgViews: sql<number>`cast(coalesce(avg(view_count), 0) as int)`,
        maxDate: sql<string>`max(created_at)::text`,
      })
      .from(sermonsTable);

    const topSermons = await db
      .select({
        videoId: sermonsTable.videoId,
        title: sermonsTable.title,
        viewCount: sermonsTable.viewCount,
      })
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.viewCount))
      .limit(5);

    return {
      totalSermons: countRow?.count ?? 0,
      lastSyncedAt: statsRow?.maxDate ?? null,
      avgViewCount: statsRow?.avgViews ?? 0,
      topSermons: topSermons.map(s => ({
        videoId: s.videoId,
        title: s.title,
        viewCount: s.viewCount ?? 0,
      })),
    };
  } catch (err) {
    log?.error({ err }, "Failed to fetch broadcast stats");
    return { totalSermons: 0, lastSyncedAt: null, avgViewCount: 0, topSermons: [] };
  }
}

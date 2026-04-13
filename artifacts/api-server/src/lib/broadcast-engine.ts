/**
 * Broadcast Automation Engine
 *
 * Central intelligence layer for JCTM Temple TV's automated broadcast system.
 * Manages:
 *  - AI-powered rebroadcast content curation
 *  - Smart sermon scoring and selection
 *  - Broadcast lifecycle event hooks
 *  - Automatic rebroadcast queue building
 *  - Broadcast state persistence helpers
 */

import { db, sermonsTable } from "@workspace/db";
import { desc, ne, sql, and, isNotNull, isNull, eq } from "drizzle-orm";
import { pool } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import type { Logger } from "pino";

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
  "water baptism", "five fold", "kingdom", "revival", "righteousness"
];

/**
 * Score a sermon algorithmically for rebroadcast suitability.
 * Higher = better candidate.
 */
function scoreSermon(sermon: {
  title: string;
  viewCount: number | null;
  publishedAt: Date | string;
  isFeatured: boolean;
}): number {
  let score = 0;
  const titleLower = sermon.title.toLowerCase();

  // Recency bonus — newer sermons score higher (max 30 points)
  const ageMs = Date.now() - new Date(sermon.publishedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < 30) score += 30;
  else if (ageDays < 90) score += 20;
  else if (ageDays < 180) score += 10;
  else if (ageDays < 365) score += 5;

  // View count bonus (max 25 points)
  const views = sermon.viewCount ?? 0;
  if (views > 10000) score += 25;
  else if (views > 5000) score += 20;
  else if (views > 1000) score += 15;
  else if (views > 500) score += 10;
  else if (views > 100) score += 5;

  // Featured flag bonus
  if (sermon.isFeatured) score += 15;

  // Keyword relevance bonus (max 20 points)
  const matchingKeywords = FEATURED_KEYWORDS.filter(kw => titleLower.includes(kw));
  score += Math.min(matchingKeywords.length * 5, 20);

  // Sunday service boost (landmark content)
  if (titleLower.includes("sunday") || titleLower.includes("service")) score += 10;

  return score;
}

// ─── Smart Selection ──────────────────────────────────────────────────────────

/**
 * Build an AI-curated rebroadcast queue from the sermon library.
 * Falls back to algorithmic scoring if AI is unavailable.
 */
export async function buildSmartRebroadcastQueue(
  excludeVideoId: string | null,
  log?: Logger
): Promise<SmartRebroadcastSelection> {
  const fallbackAt = new Date().toISOString();

  try {
    // Fetch a pool of recent sermons for selection
    const pool = await db
      .select()
      .from(sermonsTable)
      .where(
        excludeVideoId
          ? and(ne(sermonsTable.videoId, excludeVideoId), isNotNull(sermonsTable.videoId))
          : isNotNull(sermonsTable.videoId)
      )
      .orderBy(desc(sermonsTable.publishedAt))
      .limit(60);

    if (pool.length === 0) {
      throw new Error("No sermons available for rebroadcast queue");
    }

    // Score all candidates algorithmically
    const scored: RebroadcastCandidate[] = pool.map(s => ({
      videoId: s.videoId,
      title: s.title,
      thumbnailUrl: s.thumbnailUrl,
      publishedAt: s.publishedAt instanceof Date ? s.publishedAt.toISOString() : String(s.publishedAt),
      viewCount: s.viewCount,
      score: scoreSermon(s),
      reason: "algorithmic",
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Try AI curation for top-20 candidates
    if (process.env.OPENAI_API_KEY) {
      try {
        const top20 = scored.slice(0, 20);
        const titlesJson = top20.map((s, i) => `${i + 1}. [${s.videoId}] ${s.title}`).join("\n");

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 300,
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                "You are the Temple TV content director for JCTM (Jesus Christ Temple Ministry). " +
                "Select the single best sermon for a post-Sunday-service rebroadcast. " +
                "Prioritize: Correction Mandate teachings, holiness doctrine, foundational apostolic messages, " +
                "high-impact prophetic words. Return ONLY the video ID of your top pick, nothing else.",
            },
            {
              role: "user",
              content: `Select the best sermon for rebroadcast from this list:\n${titlesJson}\n\nReturn only the YouTube video ID (e.g. "dQw4w9WgXcQ").`,
            },
          ],
        });

        const aiPick = response.choices[0]?.message?.content?.trim().replace(/['"]/g, "");
        if (aiPick && aiPick.length >= 6 && aiPick.length <= 20) {
          const aiIdx = top20.findIndex(s => s.videoId === aiPick);
          if (aiIdx >= 0) {
            const primary = { ...top20[aiIdx]!, reason: "AI-curated", score: top20[aiIdx]!.score + 50 };
            const rest = scored.filter(s => s.videoId !== primary.videoId).slice(0, 7);
            log?.info({ videoId: primary.videoId, title: primary.title }, "AI selected rebroadcast primary");
            return {
              primary,
              queue: [primary, ...rest],
              curatedAt: new Date().toISOString(),
              strategy: "ai",
            };
          }
        }
      } catch (aiErr) {
        log?.warn({ err: aiErr }, "AI curation failed — falling back to algorithmic selection");
      }
    }

    // Algorithmic fallback
    const primary = scored[0]!;
    primary.reason = "top-ranked";
    const queue = scored.slice(0, 8);

    log?.info({ videoId: primary.videoId, title: primary.title }, "Algorithmic rebroadcast primary selected");
    return {
      primary,
      queue,
      curatedAt: fallbackAt,
      strategy: "algorithmic",
    };
  } catch (err) {
    log?.error({ err }, "Smart rebroadcast selection failed — using fallback");

    // Emergency fallback: just get the latest sermon
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
          publishedAt: latest.publishedAt instanceof Date ? latest.publishedAt.toISOString() : String(latest.publishedAt),
          viewCount: latest.viewCount,
          score: 0,
          reason: "fallback-latest",
        };
        return {
          primary: candidate,
          queue: [candidate],
          curatedAt: fallbackAt,
          strategy: "fallback",
        };
      }
    } catch {
      // Ignore
    }

    throw new Error("Unable to build rebroadcast queue — no sermons in database");
  }
}

// ─── Auto-Metadata Generation ────────────────────────────────────────────────

export interface AutoMetadata {
  tags: string[];
  summary: string;
  category: string;
}

/**
 * Auto-generate tags, summary, and category for a sermon using AI.
 */
export async function generateSermonMetadata(
  title: string,
  log?: Logger
): Promise<AutoMetadata | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 200,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are a metadata assistant for JCTM (Jesus Christ Temple Ministry). " +
            "Given a sermon title, return a JSON object with: " +
            '{"tags": ["tag1","tag2","tag3","tag4","tag5"], "summary": "2-sentence summary", "category": "one of: Correction Mandate|Holiness|Apostolic|End Times|Prayer|Revival|Doctrine|Sunday Service|Prophetic|Other"}',
        },
        { role: "user", content: `Sermon title: "${title}"` },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { tags?: string[]; summary?: string; category?: string };
      return {
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
        summary: parsed.summary ?? "",
        category: parsed.category ?? "Other",
      };
    }
  } catch (err) {
    log?.warn({ err, title }, "Auto-metadata generation failed");
  }

  return null;
}

// ─── Auto-Enrichment Pipeline ─────────────────────────────────────────────────

/**
 * Enrich the next batch of sermons that have no AI-generated metadata.
 * Called by the cron every 10 minutes. Returns count of sermons enriched.
 */
export async function enrichNextSermonBatch(
  batchSize: number = 5,
  log?: Logger
): Promise<number> {
  if (!process.env.OPENAI_API_KEY) return 0;

  try {
    const unenriched = await pool.query<{
      id: number;
      video_id: string;
      title: string;
    }>(
      `SELECT id, video_id, title FROM sermon_data
       WHERE metadata_generated_at IS NULL
       ORDER BY published_at DESC
       LIMIT $1`,
      [batchSize]
    );

    if (unenriched.rows.length === 0) return 0;

    let count = 0;
    for (const sermon of unenriched.rows) {
      const metadata = await generateSermonMetadata(sermon.title, log);
      if (!metadata) continue;

      await pool.query(
        `UPDATE sermon_data
         SET ai_summary = $1,
             tags = $2,
             category = $3,
             metadata_generated_at = now()
         WHERE id = $4`,
        [metadata.summary, metadata.tags, metadata.category, sermon.id]
      );
      count++;
    }

    return count;
  } catch (err) {
    log?.warn({ err }, "Sermon batch enrichment failed (non-fatal)");
    return 0;
  }
}

// ─── AI Recommendation Engine ─────────────────────────────────────────────────

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

/**
 * Get AI-powered sermon recommendations based on category affinity and scoring.
 * Falls back to pure algorithmic scoring if AI is unavailable.
 */
export async function getSermonRecommendations(opts: {
  excludeVideoId?: string;
  category?: string;
  limit?: number;
  log?: Logger;
}): Promise<SermonRecommendation[]> {
  const { excludeVideoId, category, limit = 8, log } = opts;

  try {
    let query = `
      SELECT id, video_id, title, thumbnail_url, published_at, view_count,
             COALESCE(category, 'sermon') as category,
             COALESCE(tags, '{}') as tags,
             ai_summary
      FROM sermon_data
      WHERE is_live = false
      ${excludeVideoId ? `AND video_id != '${excludeVideoId.replace(/'/g, "''")}'` : ""}
      ${category && category !== "all" ? `AND category ILIKE '%${category.replace(/'/g, "''")}%'` : ""}
      ORDER BY published_at DESC
      LIMIT 80
    `;

    const result = await pool.query<{
      id: number;
      video_id: string;
      title: string;
      thumbnail_url: string;
      published_at: Date;
      view_count: number | null;
      category: string;
      tags: string[];
      ai_summary: string | null;
    }>(query);

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

/**
 * Get distinct sermon categories from the DB for filtering.
 */
export async function getSermonCategories(): Promise<string[]> {
  try {
    const result = await pool.query<{ category: string }>(
      `SELECT DISTINCT category FROM sermon_data
       WHERE category IS NOT NULL AND category != 'sermon'
       ORDER BY category`
    );
    return result.rows.map(r => r.category);
  } catch {
    return [];
  }
}

// ─── Broadcast Lifecycle Statistics ──────────────────────────────────────────

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
    return {
      totalSermons: 0,
      lastSyncedAt: null,
      avgViewCount: 0,
      topSermons: [],
    };
  }
}

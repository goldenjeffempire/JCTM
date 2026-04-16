import { Router, type IRouter } from "express";
import { eq, desc, ilike, or, sql } from "drizzle-orm";
import { db, sermonsTable } from "@workspace/db";
import {
  ListSermonsQueryParams,
  ListSermonsResponse,
  GetSermonParams,
  GetSermonResponse,
  GetFeaturedSermonResponse,
  GetSermonStatsResponse,
  SyncSermonsResponse,
} from "@workspace/api-zod";
import { syncIncremental, harvestAll, iso8601ToSeconds, QuotaExceededError } from "../lib/youtube-sync.js";
import { syncFromRSS } from "../lib/rss-sync.js";
import { isQuotaPaused, getQuotaResetTime, setQuotaPaused } from "../lib/cron.js";
import { sseBroadcaster } from "../lib/sse-broadcaster.js";
import { randomUUID } from "crypto";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAdminRole } from "../lib/adminAuth.js";

// ── In-memory sermon summary cache (survives restarts only in dev) ─────────────
const summaryCache = new Map<number, { summary: string; keyPoints: string[]; generatedAt: string }>();

const router: IRouter = Router();

const PINNED_INTRO_TITLES = new Set([
  "the generation of the evil one and the generation of the saint",
]);

function normalizeTitle(title: string | null | undefined): string {
  return (title ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isPinnedIntroTitle(title: string | null | undefined): boolean {
  return PINNED_INTRO_TITLES.has(normalizeTitle(title));
}

// ──────────────────────────────────────────────────────
// GET /sermons/stream  — Server-Sent Events for real-time updates
// ──────────────────────────────────────────────────────
router.get("/sermons/stream", (req, res): void => {
  const clientId = randomUUID();
  req.log.info({ clientId, total: sseBroadcaster.size() + 1 }, "SSE client connected");
  sseBroadcaster.add(clientId, res);

  req.on("close", () => {
    req.log.info({ clientId }, "SSE client disconnected");
  });
});

// ──────────────────────────────────────────────────────
// GET /sermons  — list sermons
// ──────────────────────────────────────────────────────
router.get("/sermons", async (req, res): Promise<void> => {
  const parsed = ListSermonsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 20, offset = 0, search } = parsed.data;
  const conditions = search ? [ilike(sermonsTable.title, `%${search}%`)] : [];

  const sermons = await db
    .select()
    .from(sermonsTable)
    .where(conditions.length > 0 ? or(...conditions) : undefined)
    .orderBy(desc(sermonsTable.publishedAt))
    .limit(limit)
    .offset(offset);

  const serialized = sermons.map(s => ({
    ...s,
    publishedAt: s.publishedAt instanceof Date ? s.publishedAt.toISOString() : s.publishedAt,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  }));
  res.json(ListSermonsResponse.parse(serialized));
});

// ──────────────────────────────────────────────────────
// GET /sermons/shorts  — Videos up to 30 minutes long (Moments / Reels feed)
// Fetches a large pool, filters by duration ≤ 1800 s in JS (ISO 8601 stored).
// Falls back to the latest 50 sermons if none have duration metadata.
// ──────────────────────────────────────────────────────
router.get("/sermons/shorts", async (_req, res): Promise<void> => {
  const MAX_SECONDS = 30 * 60; // 30 minutes
  const RECENT_ENRICH_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Pull a large pool ordered newest-first
  const pool = await db
    .select()
    .from(sermonsTable)
    .orderBy(desc(sermonsTable.publishedAt))
    .limit(200);

  // Filter criteria:
  //   1. Videos with a known duration within the 30-min cap, OR
  //   2. Videos with no duration yet published within the last 24 h —
  //      these are brand-new uploads that RSS sync just inserted and whose
  //      metadata is being enriched in the background. Including them here
  //      means they appear in Moments immediately (within the 5-min RSS cycle)
  //      rather than waiting up to 30 min for the full API sync.
  let shorts = pool.filter(s => {
    if (s.duration) {
      const secs = iso8601ToSeconds(s.duration);
      return secs > 0 && secs <= MAX_SECONDS;
    }
    // No duration yet — include if published recently (likely still being enriched)
    if (s.publishedAt) {
      const ageMs = Date.now() - new Date(s.publishedAt).getTime();
      return ageMs <= RECENT_ENRICH_WINDOW_MS;
    }
    return false;
  });

  // Fallback: no videos have any duration or recent publish date — show latest 50
  if (shorts.length === 0) {
    shorts = pool.slice(0, 50);
  }

  const serialized = shorts.map(s => ({
    ...s,
    publishedAt: s.publishedAt instanceof Date ? s.publishedAt.toISOString() : s.publishedAt,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  }));
  res.json(ListSermonsResponse.parse(serialized));
});

// ──────────────────────────────────────────────────────
// GET /sermons/featured  — latest / featured sermon
// ──────────────────────────────────────────────────────
router.get("/sermons/featured", async (req, res): Promise<void> => {
  // Prefer the most recently published sermon (always show the latest upload)
  const [sermon] = await db
    .select()
    .from(sermonsTable)
    .orderBy(desc(sermonsTable.publishedAt))
    .limit(1);

  if (!sermon) {
    res.status(404).json({ error: "No sermons found" });
    return;
  }

  res.json(GetFeaturedSermonResponse.parse({
    ...sermon,
    publishedAt: sermon.publishedAt instanceof Date ? sermon.publishedAt.toISOString() : sermon.publishedAt,
    createdAt: sermon.createdAt instanceof Date ? sermon.createdAt.toISOString() : sermon.createdAt,
  }));
});

// ──────────────────────────────────────────────────────
// GET /sermons/stats
// ──────────────────────────────────────────────────────
router.get("/sermons/stats", async (req, res): Promise<void> => {
  const [result] = await db
    .select({
      total: sql<number>`cast(count(*) as int)`,
      totalViews: sql<number>`cast(sum(${sermonsTable.viewCount}) as int)`,
      latestDate: sql<string>`max(${sermonsTable.publishedAt})::text`,
    })
    .from(sermonsTable);

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.json(GetSermonStatsResponse.parse({
    total: result?.total ?? 0,
    totalViews: result?.totalViews ?? null,
    latestDate: result?.latestDate ?? null,
  }));
});

// ──────────────────────────────────────────────────────
// GET /sermons/intro  — Full Teaching feed: strictly 50 min–1h10min videos.
// Excludes Shorts, clips, and anything outside the 50–70 minute window.
// Scans the full sermon archive (newest first) for maximum coverage.
// Supports pagination via ?offset=0&limit=30 query params.
// Falls back to best available sermons closest to the target range only if
// none qualify strictly, so the page never shows an empty state.
// ──────────────────────────────────────────────────────
router.get("/sermons/intro", async (req, res): Promise<void> => {
  const MIN_SECONDS = 50 * 60;        // 50 minutes — strict lower bound
  const MAX_SECONDS = 70 * 60;        // 1 hour 10 minutes — strict upper bound
  const FALLBACK_MIN = 40 * 60;       // Fallback: 40 min if nothing in strict range
  const FALLBACK_MAX = 90 * 60;       // Fallback: 90 min
  const limit  = Math.min(Math.max(parseInt(String(req.query.limit  ?? "20")), 1), 100);
  const offset = Math.max(parseInt(String(req.query.offset ?? "0")), 0);

  // Keywords whose presence in a title disqualifies a video from the Intro feed
  const EXCLUDED_TITLE_PATTERNS = [
    /deliverance/i,
    /testimon/i,
  ];

  // Exact titles explicitly excluded from the Intro feed (case-insensitive, trimmed)
  const EXCLUDED_EXACT_TITLES = new Set([
    "26-7-23 first wednesday service program",
    "a must-watch!!!!! what did the bible say about baptism in the name of jesus christ",
    "5-6-22 holy ghost sunday service",
    "2nd january 2022 1st sunday service",
    "28-10-21 abraka crusade day 1",
    "18-4-21 super sunday service",
    "31-1-21 sunday service",
    "24-1-21 super sunday service",
    "3-1-21 thanksgiving service",
    "okpe isoko crusade day 2",
    "30-8-20 super sunday service",
    "16-8-20 super sunday service",
    "19-1-20 sunday service",
    "25-12-19 christmas service",
    "prayer of the holy spirit",
    "16-8-19 family liberation program day 3",
    "21-7-19 super sunday live service",
    "13-3-19 wednesday live service",
    "6-3-19 wednesday live service",
    "27-1-19 sunday live service",
    "16-12-18 sunday live service",
    "25-11-18 sunday live service (holy ghost service)",
    "7-11-18 wednesday live service",
    "16-9-18 sunday live service",
    "22-8-18 wednesday service",
    "day 1, no one can stop me jesus is alive 10-8-18 friday service (temple tv live stream)",
    "25-7-18 wednesday service (temple tv live stream)",
    "10-6-18 sunday service( prophetic declaration)",
    "3-6-18",
    "27-5-18 day 5 (oh lord show me mercy)",
    "24-5-18 day 2 (oh lord show me mercy)",
    "23-5-18 day 1 (oh lord show me mercy)",
    "6-5-18 sunday service praise & worship",
    "8-8-18 sunday service",
    "14th march 2018 wednesday service",
    "21 febraury 2018 mass prayer time.",
    "4th feb 2018, mass prayer",
    "cross over service",
    "meditate in the life you live as a christian.",
    "don't put your trust in man.",
    "watch how a demon entered a girl who was sleeping in the church",
    "we are saved by the grace of god part i",
    "watch how this woman delivered in the church during a mass prayer day 2",
    "punishment is coming for the sinners",
  ]);

  const isExcluded = (title: string | null) => {
    if (title == null) return false;
    if (EXCLUDED_TITLE_PATTERNS.some(re => re.test(title))) return true;
    if (EXCLUDED_EXACT_TITLES.has(title.trim().toLowerCase())) return true;
    return false;
  };

  // Scan every sermon in the archive, newest first
  const pool = await db
    .select()
    .from(sermonsTable)
    .orderBy(desc(sermonsTable.publishedAt))
    .limit(5000);

  const pinnedIntros = pool.filter(s => isPinnedIntroTitle(s.title));
  const pinnedVideoIds = new Set(pinnedIntros.map(s => s.videoId));

  // Strict filter: 50–70 min, must have duration, exclude Shorts (< 60s), exclude deliverance/testimony.
  // Pinned ministry-required intro videos are merged in above even if YouTube duration enrichment
  // has not completed yet.
  let intros = pool.filter(s => {
    if (pinnedVideoIds.has(s.videoId)) return false;
    if (!s.duration) return false;
    if (isExcluded(s.title)) return false;
    const secs = iso8601ToSeconds(s.duration);
    if (secs < 60) return false; // exclude Shorts
    return secs >= MIN_SECONDS && secs <= MAX_SECONDS;
  });

  intros = [...pinnedIntros, ...intros];

  // Fallback: broaden duration to 40–90 min (still exclude deliverance/testimony)
  if (intros.length === 0) {
    intros = pool.filter(s => {
      if (pinnedVideoIds.has(s.videoId)) return false;
      if (!s.duration) return false;
      if (isExcluded(s.title)) return false;
      const secs = iso8601ToSeconds(s.duration);
      if (secs < 60) return false;
      return secs >= FALLBACK_MIN && secs <= FALLBACK_MAX;
    });
    intros = [...pinnedIntros, ...intros];
  }

  // Last resort: most recent with any duration, still applying exclusions
  if (intros.length === 0) {
    intros = [
      ...pinnedIntros,
      ...pool
      .filter(s => s.duration && iso8601ToSeconds(s.duration) > 60 && !isExcluded(s.title))
      .filter(s => !pinnedVideoIds.has(s.videoId))
      .slice(0, 20),
    ];
  }

  const total   = intros.length;
  const page    = intros.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  const serialized = page.map(s => ({
    ...s,
    publishedAt: s.publishedAt instanceof Date ? s.publishedAt.toISOString() : s.publishedAt,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  }));

  res.json({ videos: serialized, total, hasMore, offset, limit });
});

// ──────────────────────────────────────────────────────
// GET /sermons/:id
// ──────────────────────────────────────────────────────
router.get("/sermons/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSermonParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [sermon] = await db
    .select()
    .from(sermonsTable)
    .where(eq(sermonsTable.id, params.data.id));

  if (!sermon) {
    res.status(404).json({ error: "Sermon not found" });
    return;
  }

  res.json(GetSermonResponse.parse({
    ...sermon,
    publishedAt: sermon.publishedAt instanceof Date ? sermon.publishedAt.toISOString() : sermon.publishedAt,
    createdAt: sermon.createdAt instanceof Date ? sermon.createdAt.toISOString() : sermon.createdAt,
  }));
});

// ──────────────────────────────────────────────────────
// GET /sermons/:id/summary  — AI-generated sermon summary (cached)
// Used for SEO: Google can index this text content on the sermon detail page.
// ──────────────────────────────────────────────────────
router.get("/sermons/:id/summary", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSermonParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const cached = summaryCache.get(params.data.id);
  if (cached) {
    res.json(cached);
    return;
  }

  const [sermon] = await db
    .select()
    .from(sermonsTable)
    .where(eq(sermonsTable.id, params.data.id));

  if (!sermon) {
    res.status(404).json({ error: "Sermon not found" });
    return;
  }

  try {
    const prompt = `You are a biblical scholar summarizing a sermon by Prophet Amos Evomobor of Jesus Christ Temple Ministry (JCTM), Warri, Nigeria.

Sermon title: "${sermon.title}"
${sermon.description ? `Description: ${sermon.description.slice(0, 500)}` : ""}

Write a 200-250 word sermon summary in plain, engaging English. Cover: the main scriptural theme, key teachings, and a practical takeaway for the listener. Then list exactly 5 bullet-point key points from the sermon. Format your response as JSON: { "summary": "...", "keyPoints": ["...", "...", "...", "...", "..."] }`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
    });

    const raw_content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw_content) as { summary?: string; keyPoints?: string[] };

    const result = {
      summary: parsed.summary ?? "Summary unavailable.",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 5) : [],
      generatedAt: new Date().toISOString(),
    };

    summaryCache.set(params.data.id, result);
    res.json(result);
  } catch (err) {
    req.log.warn({ err }, "Sermon summary generation failed");
    res.status(503).json({ error: "Summary generation unavailable" });
  }
});

// ──────────────────────────────────────────────────────
// GET /sermons/youtube-stats/:videoId
// Fetches live like / comment / view counts from YouTube Data API.
// Returns cached DB view count as fallback if no API key is set.
// ──────────────────────────────────────────────────────
router.get("/sermons/youtube-stats/:videoId", async (req, res): Promise<void> => {
  const videoId = String(req.params.videoId ?? "").trim();
  if (!videoId) { res.status(400).json({ error: "videoId required" }); return; }

  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

  if (!YOUTUBE_API_KEY) {
    // Fallback: return stored view count from DB, no likes/comments available
    const [row] = await db
      .select({ viewCount: sermonsTable.viewCount })
      .from(sermonsTable)
      .where(eq(sermonsTable.videoId, videoId));
    res.json({ likeCount: null, commentCount: null, viewCount: row?.viewCount ?? 0 });
    return;
  }

  try {
    const url =
      `https://www.googleapis.com/youtube/v3/videos` +
      `?part=statistics&id=${encodeURIComponent(videoId)}&key=${YOUTUBE_API_KEY}`;
    const ytRes = await fetch(url);
    if (!ytRes.ok) {
      // Quota exceeded or API error — fall back to stored data gracefully
      const [row] = await db
        .select({ viewCount: sermonsTable.viewCount })
        .from(sermonsTable)
        .where(eq(sermonsTable.videoId, videoId));
      res.json({ likeCount: null, commentCount: null, viewCount: row?.viewCount ?? 0 });
      return;
    }
    const data = await ytRes.json() as {
      items?: { statistics?: { likeCount?: string; commentCount?: string; viewCount?: string } }[]
    };
    const stats = data.items?.[0]?.statistics ?? {};
    res.json({
      likeCount: stats.likeCount != null ? parseInt(stats.likeCount) : null,
      commentCount: stats.commentCount != null ? parseInt(stats.commentCount) : null,
      viewCount: stats.viewCount != null ? parseInt(stats.viewCount) : 0,
    });
  } catch (err) {
    req.log.warn({ err }, "YouTube stats unavailable — returning stored data");
    // Always return stored view count rather than a 500
    const [row] = await db
      .select({ viewCount: sermonsTable.viewCount })
      .from(sermonsTable)
      .where(eq(sermonsTable.videoId, videoId));
    res.json({ likeCount: null, commentCount: null, viewCount: row?.viewCount ?? 0 });
  }
});

// ──────────────────────────────────────────────────────
// POST /sermons  — incremental sync (sermon-admin only)
// POST /sermons?harvest=true  — full purge + repopulate
// ──────────────────────────────────────────────────────
router.post("/sermons", requireAdminRole("sermon"), async (req, res): Promise<void> => {
  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  const isHarvest = req.query.harvest === "true";

  // ── Helper: run RSS fallback sync ──────────────────────────────────────────
  async function runRSSFallback(reason: string): Promise<void> {
    req.log.info({ reason }, "Manual sync falling back to RSS feed");
    try {
      const rssResult = await syncFromRSS(req.log);
      if (rssResult.total > 0) {
        sseBroadcaster.broadcast({ type: "sync_complete", data: { synced: rssResult.inserted, source: "rss" } });
      }
      const resetTime = getQuotaResetTime();
      const resetMsg = resetTime
        ? ` YouTube API quota resets at ${resetTime.toUTCString()}.`
        : "";
      res.status(503).json({
        error: reason,
        fallback: "rss",
        rssResult: { inserted: rssResult.inserted, updated: rssResult.updated, total: rssResult.total },
        message: `YouTube API unavailable — RSS fallback ran instead (${rssResult.total} videos checked, ${rssResult.inserted} new).${resetMsg}`,
      });
    } catch (rssErr) {
      req.log.error({ rssErr }, "RSS fallback also failed");
      res.status(503).json({ error: reason, message: "Both YouTube API and RSS fallback failed." });
    }
  }

  // ── No API key: run RSS only ───────────────────────────────────────────────
  if (!YOUTUBE_API_KEY) {
    await runRSSFallback("YouTube API key not configured. Set YOUTUBE_API_KEY environment variable.");
    return;
  }

  // ── Quota paused: run RSS fallback immediately without hitting the API ─────
  if (isQuotaPaused()) {
    const resetTime = getQuotaResetTime();
    const resetMsg = resetTime ? ` Quota resets at ${resetTime.toUTCString()}.` : "";
    await runRSSFallback(`YouTube API quota exceeded.${resetMsg}`);
    return;
  }

  // ── Normal API sync ────────────────────────────────────────────────────────
  try {
    const result = isHarvest
      ? await harvestAll(YOUTUBE_API_KEY, req.log)
      : await syncIncremental(YOUTUBE_API_KEY, req.log);

    sseBroadcaster.broadcast({
      type: "sync_complete",
      data: { synced: result.synced, featured: result.featured },
    });

    res.json(SyncSermonsResponse.parse({ synced: result.synced, message: result.message }));
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      // Quota just got exhausted — record it in the shared cron state so the
      // automatic 30-min sync also respects the pause, then fall back to RSS.
      const nowMs = Date.now();
      const now = new Date();
      const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const pauseMs = midnight.getTime() - nowMs;
      setQuotaPaused(nowMs + pauseMs);
      req.log.warn({ resumesInHours: Math.round(pauseMs / 3600000) }, "Manual sync hit YouTube quota — pausing until UTC midnight");
      await runRSSFallback(`YouTube API quota exceeded. Quota resets at ${midnight.toUTCString()}.`);
    } else {
      req.log.error({ err }, "YouTube sync failed");
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: "Failed to sync sermons from YouTube", details: message });
    }
  }
});

export default router;

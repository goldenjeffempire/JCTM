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
import { syncIncremental, harvestAll, iso8601ToSeconds } from "../lib/youtube-sync.js";
import { sseBroadcaster } from "../lib/sse-broadcaster.js";
import { randomUUID } from "crypto";

const router: IRouter = Router();

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

  // Pull a large pool ordered newest-first
  const pool = await db
    .select()
    .from(sermonsTable)
    .orderBy(desc(sermonsTable.publishedAt))
    .limit(200);

  // Filter to those with duration metadata within the 30-min cap
  let shorts = pool.filter(s => {
    if (!s.duration) return false;
    const secs = iso8601ToSeconds(s.duration);
    return secs > 0 && secs <= MAX_SECONDS;
  });

  // Fallback: channel may not have duration populated yet — show latest 50
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

  res.json(GetSermonStatsResponse.parse({
    total: result?.total ?? 0,
    totalViews: result?.totalViews ?? null,
    latestDate: result?.latestDate ?? null,
  }));
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
    if (!ytRes.ok) throw new Error(`YouTube API error: ${ytRes.status}`);
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
    req.log.error({ err }, "Failed to fetch YouTube stats");
    res.status(500).json({ error: "Failed to fetch YouTube stats" });
  }
});

// ──────────────────────────────────────────────────────
// POST /sermons  — incremental sync (manual trigger)
// POST /sermons?harvest=true  — full purge + repopulate
// ──────────────────────────────────────────────────────
router.post("/sermons", async (req, res): Promise<void> => {
  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

  if (!YOUTUBE_API_KEY) {
    res.status(503).json({ error: "YouTube API key not configured. Set YOUTUBE_API_KEY environment variable." });
    return;
  }

  const isHarvest = req.query.harvest === "true";

  try {
    const result = isHarvest
      ? await harvestAll(YOUTUBE_API_KEY, req.log)
      : await syncIncremental(YOUTUBE_API_KEY, req.log);

    // Broadcast sync complete event to any connected SSE clients
    sseBroadcaster.broadcast({
      type: "sync_complete",
      data: { synced: result.synced, featured: result.featured },
    });

    res.json(SyncSermonsResponse.parse({ synced: result.synced, message: result.message }));
  } catch (err) {
    req.log.error({ err }, "YouTube sync failed");
    res.status(500).json({ error: "Failed to sync sermons from YouTube" });
  }
});

export default router;

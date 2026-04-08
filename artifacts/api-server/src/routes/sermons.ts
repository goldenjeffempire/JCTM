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
import { syncIncremental, harvestAll } from "../lib/youtube-sync.js";
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
// GET /sermons/shorts  — YouTube Shorts / Reels-style clips
// Searches for videos with "#shorts", "short", "#short" or "clip" in title.
// Falls back to latest 25 sermons if none found.
// ──────────────────────────────────────────────────────
router.get("/sermons/shorts", async (_req, res): Promise<void> => {
  const keywords = ["%#shorts%", "%#short%", "% short %", "%clip%", "% reel%"];
  const conditions = keywords.map(k => ilike(sermonsTable.title, k));

  let shorts = await db
    .select()
    .from(sermonsTable)
    .where(or(...conditions))
    .orderBy(desc(sermonsTable.publishedAt))
    .limit(50);

  // Fallback: return latest 25 if channel has no labelled shorts yet
  if (shorts.length === 0) {
    shorts = await db
      .select()
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.publishedAt))
      .limit(25);
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

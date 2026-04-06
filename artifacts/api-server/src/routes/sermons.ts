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

const router: IRouter = Router();

router.get("/sermons", async (req, res): Promise<void> => {
  const parsed = ListSermonsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 20, offset = 0, search } = parsed.data;

  const conditions = search
    ? [ilike(sermonsTable.title, `%${search}%`)]
    : [];

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

router.get("/sermons/featured", async (req, res): Promise<void> => {
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

router.post("/sermons", async (req, res): Promise<void> => {
  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  const CHANNEL_ID = "UCPFFvkE-KGpR37qJgvYriJg";

  if (!YOUTUBE_API_KEY) {
    res.status(503).json({ error: "YouTube API key not configured. Set YOUTUBE_API_KEY environment variable." });
    return;
  }

  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${CHANNEL_ID}&part=snippet&order=date&maxResults=20&type=video`;
    const response = await fetch(searchUrl);
    const data = await response.json() as {
      items?: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          description: string;
          publishedAt: string;
          thumbnails: { high?: { url: string }; default?: { url: string } };
        };
      }>;
    };

    if (!data.items || data.items.length === 0) {
      res.json(SyncSermonsResponse.parse({ synced: 0, message: "No videos found" }));
      return;
    }

    await db.delete(sermonsTable);

    const inserts = data.items.map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      thumbnailUrl: item.snippet.thumbnails.high?.url ?? item.snippet.thumbnails.default?.url ?? "",
      description: item.snippet.description,
      publishedAt: new Date(item.snippet.publishedAt),
    }));

    await db.insert(sermonsTable).values(inserts);

    res.json(SyncSermonsResponse.parse({ synced: inserts.length, message: `Synced ${inserts.length} sermons from Temple TV` }));
  } catch (err) {
    req.log.error({ err }, "YouTube sync failed");
    res.status(500).json({ error: "Failed to sync sermons from YouTube" });
  }
});

export default router;

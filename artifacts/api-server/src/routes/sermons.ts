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

const CHANNEL_ID = "UCPFFvkE-KGpR37qJgvYriJg";
// The uploads playlist for a channel is always UU + channel_id minus the leading UC
const UPLOADS_PLAYLIST_ID = "UUPFFvkE-KGpR37qJgvYriJg";

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
}

function iso8601DurationToSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? "0");
  const minutes = parseInt(match[2] ?? "0");
  const seconds = parseInt(match[3] ?? "0");
  return hours * 3600 + minutes * 60 + seconds;
}

function bestThumbnail(thumbnails: PlaylistItem["snippet"]["thumbnails"], videoId: string): string {
  // Prefer maxresdefault, fallback to hqdefault via direct URL, then API thumbnails
  return (
    thumbnails.maxres?.url ??
    thumbnails.standard?.url ??
    thumbnails.high?.url ??
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  );
}

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

  if (!YOUTUBE_API_KEY) {
    res.status(503).json({ error: "YouTube API key not configured. Set YOUTUBE_API_KEY environment variable." });
    return;
  }

  try {
    // Step 1: Fetch from the channel uploads playlist — this reliably returns ALL uploads
    // including livestream archives, unlike the search endpoint which caps results
    const playlistItems: PlaylistItem[] = [];
    let pageToken: string | undefined;

    // Fetch enough to have a pool to filter from (Shorts exclusion), targeting 20 valid videos
    while (playlistItems.length < 50) {
      const params = new URLSearchParams({
        key: YOUTUBE_API_KEY,
        playlistId: UPLOADS_PLAYLIST_ID,
        part: "snippet",
        maxResults: "50",
        ...(pageToken ? { pageToken } : {}),
      });

      const playlistRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?${params}`
      );
      const playlistData = await playlistRes.json() as {
        items?: PlaylistItem[];
        nextPageToken?: string;
        error?: { message: string };
      };

      if (playlistData.error) {
        req.log.error({ error: playlistData.error }, "YouTube playlist API error");
        res.status(502).json({ error: `YouTube API error: ${playlistData.error.message}` });
        return;
      }

      if (!playlistData.items || playlistData.items.length === 0) break;

      playlistItems.push(...playlistData.items);
      pageToken = playlistData.nextPageToken;
      if (!pageToken) break;
    }

    if (playlistItems.length === 0) {
      res.json(SyncSermonsResponse.parse({ synced: 0, message: "No videos found on channel" }));
      return;
    }

    // Step 2: Get video IDs from the first batch to fetch content details
    const videoIds = playlistItems.map(item => item.snippet.resourceId.videoId);
    const batchSize = 50;
    const videoDetails: VideoDetail[] = [];

    for (let i = 0; i < videoIds.length; i += batchSize) {
      const batch = videoIds.slice(i, i + batchSize);
      const detailParams = new URLSearchParams({
        key: YOUTUBE_API_KEY,
        id: batch.join(","),
        part: "contentDetails,statistics",
      });

      const detailRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${detailParams}`
      );
      const detailData = await detailRes.json() as {
        items?: VideoDetail[];
        error?: { message: string };
      };

      if (detailData.error) {
        req.log.error({ error: detailData.error }, "YouTube videos API error");
        res.status(502).json({ error: `YouTube API error: ${detailData.error.message}` });
        return;
      }

      if (detailData.items) {
        videoDetails.push(...detailData.items);
      }
    }

    // Build a lookup map for video details
    const detailMap = new Map<string, VideoDetail>();
    for (const detail of videoDetails) {
      detailMap.set(detail.id, detail);
    }

    // Step 3: Filter out Shorts (duration <= 60 seconds) and pick the 20 most recent
    const validVideos = playlistItems
      .filter(item => {
        const videoId = item.snippet.resourceId.videoId;
        const detail = detailMap.get(videoId);
        if (!detail) return false;
        const durationSeconds = iso8601DurationToSeconds(detail.contentDetails.duration);
        // Exclude Shorts (≤ 60s) but keep everything else including livestream archives
        return durationSeconds > 60;
      })
      .slice(0, 20);

    if (validVideos.length === 0) {
      res.json(SyncSermonsResponse.parse({ synced: 0, message: "No valid sermon videos found" }));
      return;
    }

    // Step 4: Purge existing data
    await db.delete(sermonsTable);

    // Step 5: Insert new records
    const inserts = validVideos.map(item => {
      const videoId = item.snippet.resourceId.videoId;
      const detail = detailMap.get(videoId);
      return {
        videoId,
        title: item.snippet.title,
        thumbnailUrl: bestThumbnail(item.snippet.thumbnails, videoId),
        description: item.snippet.description.slice(0, 1000),
        publishedAt: new Date(item.snippet.publishedAt),
        viewCount: detail?.statistics?.viewCount
          ? parseInt(detail.statistics.viewCount)
          : null,
        duration: detail?.contentDetails?.duration ?? null,
      };
    });

    await db.insert(sermonsTable).values(inserts);

    res.json(SyncSermonsResponse.parse({
      synced: inserts.length,
      message: `Synced ${inserts.length} sermons from Temple TV`,
    }));
  } catch (err) {
    req.log.error({ err }, "YouTube sync failed");
    res.status(500).json({ error: "Failed to sync sermons from YouTube" });
  }
});

export default router;

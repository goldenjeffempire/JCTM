import { Router, type IRouter } from "express";
import {
  GetLivestreamStatusResponse,
  GetRebroadcastStatusResponse,
  UpdateLivestreamStatusBody,
  UpdateLivestreamStatusResponse,
} from "@workspace/api-zod";
import { db, sermonsTable } from "@workspace/db";
import { desc, gte } from "drizzle-orm";

const router: IRouter = Router();

type LivestreamState = {
  isLive: boolean;
  isUpcoming: boolean;
  title: string | null;
  streamUrl: string | null;
  videoId: string | null;
  startedAt: string | null;
  scheduledStartTime: string | null;
};

let livestreamState: LivestreamState = {
  isLive: false,
  isUpcoming: false,
  title: null,
  streamUrl: null,
  videoId: null,
  startedAt: null,
  scheduledStartTime: null,
};

type YouTubeCheckResult = {
  isLive: boolean;
  isUpcoming: boolean;
  title: string | null;
  videoId: string | null;
  scheduledStartTime: string | null;
};

let youtubeCheckCache: (YouTubeCheckResult & { checkedAt: number }) | null = null;
const CACHE_TTL_MS = 30_000;

const JCTM_CHANNEL_ID = "UCkiRQ9lHdRZ2_p3hRe0UQBQ";

async function fetchWithRetry(url: string, retries = 3, delayMs = 1000): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr;
}

async function checkYouTubeLive(): Promise<YouTubeCheckResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return { isLive: false, isUpcoming: false, title: null, videoId: null, scheduledStartTime: null };

  if (youtubeCheckCache && Date.now() - youtubeCheckCache.checkedAt < CACHE_TTL_MS) {
    return {
      isLive: youtubeCheckCache.isLive,
      isUpcoming: youtubeCheckCache.isUpcoming,
      title: youtubeCheckCache.title,
      videoId: youtubeCheckCache.videoId,
      scheduledStartTime: youtubeCheckCache.scheduledStartTime,
    };
  }

  const empty: YouTubeCheckResult = { isLive: false, isUpcoming: false, title: null, videoId: null, scheduledStartTime: null };

  try {
    const liveUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${JCTM_CHANNEL_ID}&eventType=live&type=video&key=${apiKey}`;
    const liveRes = await fetchWithRetry(liveUrl);

    if (liveRes.ok) {
      const liveData = await liveRes.json() as {
        items?: { id?: { videoId?: string }; snippet?: { title?: string } }[];
      };
      const liveItems = liveData.items ?? [];
      if (liveItems.length > 0) {
        const first = liveItems[0]!;
        const result: YouTubeCheckResult = {
          isLive: true,
          isUpcoming: false,
          title: first.snippet?.title ?? "Live Now on Temple TV",
          videoId: first.id?.videoId ?? null,
          scheduledStartTime: null,
        };
        youtubeCheckCache = { ...result, checkedAt: Date.now() };
        return result;
      }
    }

    const upcomingUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${JCTM_CHANNEL_ID}&eventType=upcoming&type=video&key=${apiKey}&maxResults=1`;
    const upcomingRes = await fetchWithRetry(upcomingUrl);

    if (upcomingRes.ok) {
      const upcomingData = await upcomingRes.json() as {
        items?: {
          id?: { videoId?: string };
          snippet?: { title?: string; liveBroadcastContent?: string };
        }[];
      };
      const upcomingItems = upcomingData.items ?? [];
      if (upcomingItems.length > 0) {
        const first = upcomingItems[0]!;
        const videoId = first.id?.videoId ?? null;

        let scheduledStartTime: string | null = null;
        if (videoId) {
          try {
            const detailUrl = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${videoId}&key=${apiKey}`;
            const detailRes = await fetchWithRetry(detailUrl);
            if (detailRes.ok) {
              const detailData = await detailRes.json() as {
                items?: {
                  liveStreamingDetails?: { scheduledStartTime?: string };
                  snippet?: { title?: string };
                }[];
              };
              scheduledStartTime = detailData.items?.[0]?.liveStreamingDetails?.scheduledStartTime ?? null;
            }
          } catch {
            // Non-critical — proceed without scheduled time
          }
        }

        const result: YouTubeCheckResult = {
          isLive: false,
          isUpcoming: true,
          title: first.snippet?.title ?? "Upcoming Service on Temple TV",
          videoId,
          scheduledStartTime,
        };
        youtubeCheckCache = { ...result, checkedAt: Date.now() };
        return result;
      }
    }

    youtubeCheckCache = { ...empty, checkedAt: Date.now() };
    return empty;
  } catch {
    return empty;
  }
}

router.get("/livestream/status", async (_req, res): Promise<void> => {
  const ytStatus = await checkYouTubeLive();

  if (ytStatus.isLive) {
    livestreamState = {
      isLive: true,
      isUpcoming: false,
      title: ytStatus.title,
      streamUrl: ytStatus.videoId
        ? `https://www.youtube.com/watch?v=${ytStatus.videoId}`
        : "https://www.youtube.com/templetvjctm",
      videoId: ytStatus.videoId,
      startedAt: livestreamState.isLive ? livestreamState.startedAt : new Date().toISOString(),
      scheduledStartTime: null,
    };
  } else if (ytStatus.isUpcoming) {
    livestreamState = {
      isLive: false,
      isUpcoming: true,
      title: ytStatus.title,
      streamUrl: ytStatus.videoId
        ? `https://www.youtube.com/watch?v=${ytStatus.videoId}`
        : null,
      videoId: ytStatus.videoId,
      startedAt: null,
      scheduledStartTime: ytStatus.scheduledStartTime,
    };
  } else if (!process.env.YOUTUBE_API_KEY) {
    // No API key — leave manual in-memory state untouched
  } else {
    // API available, nothing live or upcoming — clear unless manually set
    if ((livestreamState.isLive || livestreamState.isUpcoming) && !livestreamState.startedAt?.includes("manual")) {
      livestreamState = {
        isLive: false,
        isUpcoming: false,
        title: null,
        streamUrl: null,
        videoId: null,
        startedAt: null,
        scheduledStartTime: null,
      };
    }
  }

  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
  res.json(GetLivestreamStatusResponse.parse(livestreamState));
});

router.post("/livestream/status", async (req, res): Promise<void> => {
  const parsed = UpdateLivestreamStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { isLive, title, streamUrl } = parsed.data;
  const now = new Date();
  const manualTimestamp = `${now.toISOString()}_manual`;

  const videoIdMatch = streamUrl?.match(/[?&]v=([^&]+)/);
  const extractedVideoId = videoIdMatch ? (videoIdMatch[1] ?? null) : null;

  livestreamState = {
    isLive,
    isUpcoming: false,
    title: title ?? null,
    streamUrl: streamUrl ?? null,
    videoId: extractedVideoId,
    startedAt: isLive ? (livestreamState.isLive ? livestreamState.startedAt : manualTimestamp) : null,
    scheduledStartTime: null,
  };

  youtubeCheckCache = null;

  res.json(UpdateLivestreamStatusResponse.parse(livestreamState));
});

const REBROADCAST_TTL_MS = 3.5 * 24 * 60 * 60 * 1000;

router.get("/livestream/rebroadcast", async (_req, res): Promise<void> => {
  try {
    const cutoff = new Date(Date.now() - REBROADCAST_TTL_MS);

    const rows = await db
      .select()
      .from(sermonsTable)
      .where(gte(sermonsTable.broadcastEndedAt, cutoff))
      .orderBy(desc(sermonsTable.broadcastEndedAt))
      .limit(1);

    if (rows.length === 0 || !rows[0]) {
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
      res.json(GetRebroadcastStatusResponse.parse({ available: false }));
      return;
    }

    const sermon = rows[0];
    const endedAt = sermon.broadcastEndedAt!;
    const expiresAt = new Date(endedAt.getTime() + REBROADCAST_TTL_MS);

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    res.json(GetRebroadcastStatusResponse.parse({
      available: true,
      videoId: sermon.videoId,
      title: sermon.title,
      thumbnailUrl: sermon.thumbnailUrl,
      broadcastEndedAt: endedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }));
  } catch {
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    res.json(GetRebroadcastStatusResponse.parse({ available: false }));
  }
});

export default router;

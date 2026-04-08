import { Router, type IRouter } from "express";
import {
  GetLivestreamStatusResponse,
  UpdateLivestreamStatusBody,
  UpdateLivestreamStatusResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// In-memory livestream state (persists for the server process lifetime)
let livestreamState = {
  isLive: false,
  title: null as string | null,
  streamUrl: null as string | null,
  startedAt: null as string | null,
};

// YouTube API auto-detection cache
let youtubeCheckCache: { isLive: boolean; title: string | null; videoId: string | null; checkedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // re-check every 60 seconds

const JCTM_CHANNEL_ID = "UCkiRQ9lHdRZ2_p3hRe0UQBQ"; // @TEMPLETVJCTM channel

async function checkYouTubeLive(): Promise<{ isLive: boolean; title: string | null; videoId: string | null }> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return { isLive: false, title: null, videoId: null };

  // Use cache if fresh
  if (youtubeCheckCache && Date.now() - youtubeCheckCache.checkedAt < CACHE_TTL_MS) {
    return { isLive: youtubeCheckCache.isLive, title: youtubeCheckCache.title, videoId: youtubeCheckCache.videoId };
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${JCTM_CHANNEL_ID}&eventType=live&type=video&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      youtubeCheckCache = { isLive: false, title: null, videoId: null, checkedAt: Date.now() };
      return { isLive: false, title: null, videoId: null };
    }
    const data = await res.json() as { items?: { id?: { videoId?: string }; snippet?: { title?: string } }[] };
    const items = data.items ?? [];
    if (items.length > 0) {
      const first = items[0]!;
      const result = {
        isLive: true,
        title: first.snippet?.title ?? "Live Now on Temple TV",
        videoId: first.id?.videoId ?? null,
      };
      youtubeCheckCache = { ...result, checkedAt: Date.now() };
      return result;
    }
    youtubeCheckCache = { isLive: false, title: null, videoId: null, checkedAt: Date.now() };
    return { isLive: false, title: null, videoId: null };
  } catch {
    return { isLive: false, title: null, videoId: null };
  }
}

router.get("/livestream/status", async (_req, res): Promise<void> => {
  // Always try YouTube API first (cached)
  const ytStatus = await checkYouTubeLive();

  if (ytStatus.isLive) {
    // YouTube detected live — override in-memory state
    if (!livestreamState.isLive) {
      livestreamState = {
        isLive: true,
        title: ytStatus.title,
        streamUrl: ytStatus.videoId ? `https://www.youtube.com/watch?v=${ytStatus.videoId}` : "https://www.youtube.com/templetvjctm",
        startedAt: new Date().toISOString(),
      };
    }
  } else if (!process.env.YOUTUBE_API_KEY) {
    // No API key — fall back to manual in-memory state
  } else {
    // API key present, not live on YouTube — clear live state if set by YouTube
    if (livestreamState.isLive && !livestreamState.startedAt?.includes("manual")) {
      livestreamState = { isLive: false, title: null, streamUrl: null, startedAt: null };
    }
  }

  res.json(GetLivestreamStatusResponse.parse(livestreamState));
});

router.post("/livestream/status", async (req, res): Promise<void> => {
  const parsed = UpdateLivestreamStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { isLive, title, streamUrl } = parsed.data;

  // Mark manual overrides so we don't auto-clear them
  const now = new Date();
  const manualTimestamp = `${now.toISOString()}_manual`;

  livestreamState = {
    isLive,
    title: title ?? null,
    streamUrl: streamUrl ?? null,
    startedAt: isLive ? (livestreamState.isLive ? livestreamState.startedAt : manualTimestamp) : null,
  };

  // Invalidate YouTube cache so next GET re-checks
  youtubeCheckCache = null;

  res.json(UpdateLivestreamStatusResponse.parse(livestreamState));
});

export default router;

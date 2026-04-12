import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetLivestreamStatusResponse,
  GetRebroadcastStatusResponse,
  UpdateLivestreamStatusBody,
  UpdateLivestreamStatusResponse,
} from "@workspace/api-zod";
import { db, sermonsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

// ─── State ────────────────────────────────────────────────────────────────────

type LivestreamState = {
  isLive: boolean;
  isUpcoming: boolean;
  title: string | null;
  streamUrl: string | null;
  videoId: string | null;
  startedAt: string | null;
  scheduledStartTime: string | null;
};

const LIVE_VIDEO_ID = "f7TOxaM2Mq4";

let livestreamState: LivestreamState = {
  isLive: false,
  isUpcoming: false,
  title: null,
  streamUrl: null,
  videoId: null,
  startedAt: null,
  scheduledStartTime: null,
};

// ─── SSE status broadcaster ───────────────────────────────────────────────────
//
// All connected clients subscribe to /api/livestream/stream.
// Whenever the state changes (YouTube poll, manual override), we push the
// new state to every connected client — no polling needed on the client side.

const statusSessions = new Map<string, Response>();

/** Flush a payload to a single SSE response, bypassing any compression buffer. */
function sseWrite(res: Response, payload: string): void {
  res.write(payload);
  (res as unknown as { flush?: () => void }).flush?.();
}

/** Push the current livestream state to all connected SSE clients. */
function broadcastStatus(state: LivestreamState): void {
  const payload = `data: ${JSON.stringify({ type: "status", ...state })}\n\n`;
  for (const [sid, res] of statusSessions) {
    try {
      sseWrite(res, payload);
    } catch {
      statusSessions.delete(sid);
    }
  }
}

// Keepalive heartbeat — prevents proxies killing idle SSE connections
const statusHeartbeat = setInterval(() => {
  for (const [sid, res] of statusSessions) {
    try {
      sseWrite(res, ": keepalive\n\n");
    } catch {
      statusSessions.delete(sid);
    }
  }
}, 25_000);
statusHeartbeat.unref();

// ─── YouTube live check ───────────────────────────────────────────────────────

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

async function fetchWithRetry(url: string, retries = 3, delayMs = 1000): Promise<globalThis.Response> {
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

// ─── Server-side background polling ──────────────────────────────────────────
//
// Proactively checks YouTube every 30 seconds and broadcasts status changes
// to all connected SSE clients.  This ensures every viewer sees the live
// banner appear within 30 seconds of a service starting — without any
// client-side polling.

async function pollAndBroadcast(): Promise<void> {
  if (!process.env.YOUTUBE_API_KEY) return;

  // Bust the client-side cache so we always get a fresh result
  youtubeCheckCache = null;

  try {
    const ytStatus = await checkYouTubeLive();
    let newState: LivestreamState;

    if (ytStatus.isLive) {
      newState = {
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
      newState = {
        isLive: false,
        isUpcoming: true,
        title: ytStatus.title,
        streamUrl: ytStatus.videoId ? `https://www.youtube.com/watch?v=${ytStatus.videoId}` : null,
        videoId: ytStatus.videoId,
        startedAt: null,
        scheduledStartTime: ytStatus.scheduledStartTime,
      };
    } else {
      // Nothing live or upcoming — clear unless manually overridden
      if ((livestreamState.isLive || livestreamState.isUpcoming) && !livestreamState.startedAt?.includes("manual")) {
        newState = {
          isLive: false,
          isUpcoming: false,
          title: null,
          streamUrl: null,
          videoId: null,
          startedAt: null,
          scheduledStartTime: null,
        };
      } else {
        return; // No change — manual override stays, don't broadcast
      }
    }

    // Only broadcast if something actually changed
    const changed =
      newState.isLive !== livestreamState.isLive ||
      newState.isUpcoming !== livestreamState.isUpcoming ||
      newState.videoId !== livestreamState.videoId ||
      newState.title !== livestreamState.title;

    livestreamState = newState;

    if (changed) {
      broadcastStatus(livestreamState);
    }
  } catch {
    // Non-fatal — silently skip this poll cycle
  }
}

// Start background poll immediately and then every 30 seconds
setImmediate(() => { pollAndBroadcast().catch(() => {}); });
const pollInterval = setInterval(() => { pollAndBroadcast().catch(() => {}); }, 30_000);
pollInterval.unref();

// ─── GET /api/livestream/stream — real-time SSE status subscription ───────────

router.get("/livestream/stream", (req: Request, res: Response): void => {
  const sid = typeof req.query.sid === "string" && req.query.sid.length > 0
    ? req.query.sid.slice(0, 64)
    : `status-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Deduplicate: close any existing connection for this sid
  const existing = statusSessions.get(sid);
  if (existing) {
    try { existing.end(); } catch { /* already gone */ }
    statusSessions.delete(sid);
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send current state immediately so the client doesn't wait
  sseWrite(res, `data: ${JSON.stringify({ type: "status", ...livestreamState })}\n\n`);

  statusSessions.set(sid, res);

  req.on("close", () => {
    if (statusSessions.get(sid) === res) {
      statusSessions.delete(sid);
    }
  });
});

// ─── GET /api/livestream/status — REST fallback (used by SSR / robots) ────────

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

  // Push updated state to all SSE subscribers
  broadcastStatus(livestreamState);

  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
  res.json(GetLivestreamStatusResponse.parse(livestreamState));
});

// ─── POST /api/livestream/status — manual override ────────────────────────────

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

  // Immediately push the manual override to all SSE subscribers
  broadcastStatus(livestreamState);

  res.json(UpdateLivestreamStatusResponse.parse(livestreamState));
});

// ─── GET /api/livestream/rebroadcast ──────────────────────────────────────────
//
// Always returns the most recent completed sermon as a rebroadcast.
// No TTL restriction — rebroadcast is always available when not live.

router.get("/livestream/rebroadcast", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.broadcastEndedAt))
      .limit(1);

    if (rows.length === 0 || !rows[0] || !rows[0].videoId) {
      // Fall back to the known default sermon video so rebroadcast is always available
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
      res.json(GetRebroadcastStatusResponse.parse({
        available: true,
        videoId: LIVE_VIDEO_ID,
        title: "Holy Spirit Sunday Service — Temple TV",
        thumbnailUrl: `https://i.ytimg.com/vi/${LIVE_VIDEO_ID}/hqdefault.jpg`,
        broadcastEndedAt: null,
        expiresAt: null,
      }));
      return;
    }

    const sermon = rows[0];
    const endedAt = sermon.broadcastEndedAt ?? null;

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    res.json(GetRebroadcastStatusResponse.parse({
      available: true,
      videoId: sermon.videoId,
      title: sermon.title,
      thumbnailUrl: sermon.thumbnailUrl,
      broadcastEndedAt: endedAt ? endedAt.toISOString() : null,
      expiresAt: null,
    }));
  } catch {
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    res.json(GetRebroadcastStatusResponse.parse({
      available: true,
      videoId: LIVE_VIDEO_ID,
      title: "Holy Spirit Sunday Service — Temple TV",
      thumbnailUrl: `https://i.ytimg.com/vi/${LIVE_VIDEO_ID}/hqdefault.jpg`,
      broadcastEndedAt: null,
      expiresAt: null,
    }));
  }
});

export default router;

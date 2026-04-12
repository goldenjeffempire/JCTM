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

// ─── Constants ────────────────────────────────────────────────────────────────

const LIVE_VIDEO_ID = "f7TOxaM2Mq4";
const REBROADCAST_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days exactly
const JCTM_CHANNEL_ID = "UCkiRQ9lHdRZ2_p3hRe0UQBQ";
const CACHE_TTL_MS = 30_000;

// ─── Live State ───────────────────────────────────────────────────────────────

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

// ─── Rebroadcast Lifecycle State ──────────────────────────────────────────────
//
// Tracks the 3-day post-service rebroadcast window.
// Primary source: in-memory (updated when live→offline transition is detected).
// Startup: initialized from DB so server restarts don't lose rebroadcast state.

type RebroadcastLifecycle = {
  available: boolean;
  videoId: string | null;
  title: string | null;
  thumbnailUrl: string | null;
  startedAt: string | null;  // ISO — when the live stream ended
  expiresAt: string | null;  // ISO — startedAt + 3 days
};

let rebroadcastLifecycle: RebroadcastLifecycle = {
  available: false,
  videoId: null,
  title: null,
  thumbnailUrl: null,
  startedAt: null,
  expiresAt: null,
};

/** Compute whether the rebroadcast window is currently active. */
function isRebroadcastActive(rb: RebroadcastLifecycle): boolean {
  if (!rb.available || !rb.expiresAt) return false;
  return Date.now() < new Date(rb.expiresAt).getTime();
}

/** Expire rebroadcast if its 3-day window has passed. */
function checkRebroadcastExpiry(): void {
  if (rebroadcastLifecycle.available && !isRebroadcastActive(rebroadcastLifecycle)) {
    rebroadcastLifecycle = {
      available: false,
      videoId: null,
      title: null,
      thumbnailUrl: null,
      startedAt: null,
      expiresAt: null,
    };
  }
}

/** Initialize rebroadcast state from DB on startup (handles server restarts). */
async function initRebroadcastFromDB(): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.broadcastEndedAt))
      .limit(1);

    if (!rows.length || !rows[0]) return;
    const sermon = rows[0];
    const endedAt = sermon.broadcastEndedAt;
    if (!endedAt) return;

    const startedAt = endedAt.toISOString();
    const expiresAt = new Date(endedAt.getTime() + REBROADCAST_DURATION_MS).toISOString();

    if (Date.now() > new Date(expiresAt).getTime()) return; // Already expired

    rebroadcastLifecycle = {
      available: true,
      videoId: sermon.videoId,
      title: sermon.title,
      thumbnailUrl: sermon.thumbnailUrl,
      startedAt,
      expiresAt,
    };
  } catch {
    // Non-critical — continue without rebroadcast state
  }
}

// Run DB initialization immediately (non-blocking)
setImmediate(() => { initRebroadcastFromDB().catch(() => {}); });

// ─── SSE status broadcaster ───────────────────────────────────────────────────

const statusSessions = new Map<string, Response>();

function sseWrite(res: Response, payload: string): void {
  res.write(payload);
  (res as unknown as { flush?: () => void }).flush?.();
}

/** Build the full status payload including rebroadcast lifecycle. */
function buildStatusPayload(): string {
  checkRebroadcastExpiry();
  const rb = isRebroadcastActive(rebroadcastLifecycle) ? rebroadcastLifecycle : {
    available: false,
    videoId: null,
    title: null,
    thumbnailUrl: null,
    startedAt: null,
    expiresAt: null,
  };
  return JSON.stringify({ type: "status", ...livestreamState, rebroadcast: rb });
}

/** Push the current livestream + rebroadcast state to all connected SSE clients. */
function broadcastStatus(state: LivestreamState): void {
  livestreamState = state;
  const payload = `data: ${buildStatusPayload()}\n\n`;
  for (const [sid, res] of statusSessions) {
    try {
      sseWrite(res, payload);
    } catch {
      statusSessions.delete(sid);
    }
  }
}

// Keepalive heartbeat
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

  const empty: YouTubeCheckResult = {
    isLive: false,
    isUpcoming: false,
    title: null,
    videoId: null,
    scheduledStartTime: null,
  };

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
            // Non-critical
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

// ─── Sunday Service Window Detection ─────────────────────────────────────────
//
// Every Sunday between 7:50 AM – 9:30 AM US Eastern time, the system polls
// every 5 seconds for near-instant live detection.  Outside this window, the
// standard 30-second background poll runs as usual.

function isSundayServiceWindow(): boolean {
  const now = new Date();
  // Eastern Time: UTC-5 (EST) / UTC-4 (EDT). Use UTC-5 conservatively so we
  // start polling a bit early even during daylight saving.
  const estMs = now.getTime() - 5 * 60 * 60 * 1000;
  const est = new Date(estMs);
  const dayOfWeek = est.getUTCDay(); // 0 = Sunday
  const totalMinutes = est.getUTCHours() * 60 + est.getUTCMinutes();
  return dayOfWeek === 0 && totalMinutes >= 7 * 60 + 50 && totalMinutes <= 9 * 60 + 30;
}

// ─── Background poll ──────────────────────────────────────────────────────────

async function pollAndBroadcast(): Promise<void> {
  if (!process.env.YOUTUBE_API_KEY) return;

  // Expire rebroadcast if window has closed
  checkRebroadcastExpiry();

  // Bust the client-side cache so we always get a fresh result
  youtubeCheckCache = null;

  try {
    const ytStatus = await checkYouTubeLive();
    const wasLive = livestreamState.isLive;
    let newState: LivestreamState;

    if (ytStatus.isLive) {
      // If we're transitioning INTO live, clear any active rebroadcast
      if (!wasLive && rebroadcastLifecycle.available) {
        rebroadcastLifecycle = {
          available: false,
          videoId: null,
          title: null,
          thumbnailUrl: null,
          startedAt: null,
          expiresAt: null,
        };
      }

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
      // Nothing live or upcoming
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

        // Transition: live → offline — activate rebroadcast window
        if (wasLive) {
          const endedVideoId = livestreamState.videoId;
          const endedTitle = livestreamState.title;
          const startedAt = new Date().toISOString();
          const expiresAt = new Date(Date.now() + REBROADCAST_DURATION_MS).toISOString();

          rebroadcastLifecycle = {
            available: true,
            videoId: endedVideoId,
            title: endedTitle,
            thumbnailUrl: endedVideoId
              ? `https://i.ytimg.com/vi/${endedVideoId}/hqdefault.jpg`
              : null,
            startedAt,
            expiresAt,
          };
        }
      } else {
        return; // No change — manual override stays, don't broadcast
      }
    }

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

// Standard 30-second background poll
setImmediate(() => { pollAndBroadcast().catch(() => {}); });
const pollInterval = setInterval(() => { pollAndBroadcast().catch(() => {}); }, 30_000);
pollInterval.unref();

// Sunday service window: poll every 5 seconds (7:50 AM – 9:30 AM EST)
// so the live banner appears within seconds of the stream going live.
const sundayPollInterval = setInterval(() => {
  if (isSundayServiceWindow()) {
    youtubeCheckCache = null; // Always bust cache in service window
    pollAndBroadcast().catch(() => {});
  }
}, 5_000);
sundayPollInterval.unref();

// ─── GET /api/livestream/stream — real-time SSE status subscription ───────────

router.get("/livestream/stream", (req: Request, res: Response): void => {
  const sid = typeof req.query.sid === "string" && req.query.sid.length > 0
    ? req.query.sid.slice(0, 64)
    : `status-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

  // Send current state immediately (includes rebroadcast lifecycle)
  sseWrite(res, `data: ${buildStatusPayload()}\n\n`);

  statusSessions.set(sid, res);

  req.on("close", () => {
    if (statusSessions.get(sid) === res) {
      statusSessions.delete(sid);
    }
  });
});

// ─── GET /api/livestream/status — REST fallback ───────────────────────────────

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
      streamUrl: ytStatus.videoId ? `https://www.youtube.com/watch?v=${ytStatus.videoId}` : null,
      videoId: ytStatus.videoId,
      startedAt: null,
      scheduledStartTime: ytStatus.scheduledStartTime,
    };
  } else if (!process.env.YOUTUBE_API_KEY) {
    // No API key — leave manual in-memory state untouched
  } else {
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

  broadcastStatus(livestreamState);

  res.json(UpdateLivestreamStatusResponse.parse(livestreamState));
});

// ─── GET /api/livestream/rebroadcast ──────────────────────────────────────────
//
// Returns the currently active rebroadcast (within the 3-day window after a
// live service ends).  Falls back to DB if in-memory state is not set.
// Returns available: false once the 3-day window expires.

router.get("/livestream/rebroadcast", async (_req, res): Promise<void> => {
  checkRebroadcastExpiry();

  // Use in-memory lifecycle if active
  if (isRebroadcastActive(rebroadcastLifecycle)) {
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    res.json(GetRebroadcastStatusResponse.parse({
      available: true,
      videoId: rebroadcastLifecycle.videoId,
      title: rebroadcastLifecycle.title,
      thumbnailUrl: rebroadcastLifecycle.thumbnailUrl,
      broadcastEndedAt: rebroadcastLifecycle.startedAt,
      expiresAt: rebroadcastLifecycle.expiresAt,
    }));
    return;
  }

  // Fall back to DB — useful when in-memory state isn't available yet
  try {
    const rows = await db
      .select()
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.broadcastEndedAt))
      .limit(1);

    if (rows.length === 0 || !rows[0] || !rows[0].videoId) {
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
      res.json(GetRebroadcastStatusResponse.parse({
        available: false,
        videoId: null,
        title: null,
        thumbnailUrl: null,
        broadcastEndedAt: null,
        expiresAt: null,
      }));
      return;
    }

    const sermon = rows[0];
    const endedAt = sermon.broadcastEndedAt;

    if (!endedAt) {
      // No broadcast end time recorded — not available
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
      res.json(GetRebroadcastStatusResponse.parse({
        available: false,
        videoId: null,
        title: null,
        thumbnailUrl: null,
        broadcastEndedAt: null,
        expiresAt: null,
      }));
      return;
    }

    const expiresAt = new Date(endedAt.getTime() + REBROADCAST_DURATION_MS);
    const isAvailable = Date.now() < expiresAt.getTime();

    // Sync in-memory state with DB if found and still valid
    if (isAvailable) {
      rebroadcastLifecycle = {
        available: true,
        videoId: sermon.videoId,
        title: sermon.title,
        thumbnailUrl: sermon.thumbnailUrl,
        startedAt: endedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
    }

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    res.json(GetRebroadcastStatusResponse.parse({
      available: isAvailable,
      videoId: isAvailable ? sermon.videoId : null,
      title: isAvailable ? sermon.title : null,
      thumbnailUrl: isAvailable ? sermon.thumbnailUrl : null,
      broadcastEndedAt: endedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }));
  } catch {
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    res.json(GetRebroadcastStatusResponse.parse({
      available: false,
      videoId: null,
      title: null,
      thumbnailUrl: null,
      broadcastEndedAt: null,
      expiresAt: null,
    }));
  }
});

export default router;

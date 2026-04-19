import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetLivestreamStatusResponse,
  GetRebroadcastStatusResponse,
  UpdateLivestreamStatusBody,
  UpdateLivestreamStatusResponse,
} from "@workspace/api-zod";
import { db, sermonsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { buildSmartRebroadcastQueue } from "../lib/broadcast-engine.js";
import {
  dispatchPushNotification,
  buildLiveServiceNotification,
  buildRebroadcastNotification,
} from "../lib/push-manager.js";
import { requireAdminRole } from "../lib/adminAuth.js";

const router: IRouter = Router();

// ─── Constants ────────────────────────────────────────────────────────────────

const REBROADCAST_DURATION_MS = 4 * 24 * 60 * 60 * 1000; // 4 days (Sunday → Thursday)
// Correct JCTM Temple TV channel ID (matches youtube-sync.ts & WebSub subscription)
const JCTM_CHANNEL_ID = "UCPFFvkE-KGpR37qJgvYriJg";
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

// ─── Continuous Fallback State ────────────────────────────────────────────────
//
// When there is no live stream and no active scheduled rebroadcast window,
// the platform serves this "always-on" fallback so users always see content —
// never a blank idle screen.  Initialized on startup and refreshed hourly.

type ContinuousFallback = {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
};

let continuousFallbackVideo: ContinuousFallback | null = null;

async function initContinuousFallback(): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.publishedAt))
      .limit(1);

    if (rows[0]) {
      continuousFallbackVideo = {
        videoId: rows[0].videoId,
        title: rows[0].title ?? "Temple TV — Jesus Christ Temple Ministry",
        thumbnailUrl: rows[0].thumbnailUrl ?? `https://i.ytimg.com/vi/${rows[0].videoId}/hqdefault.jpg`,
      };
    }
  } catch {
    // Non-critical — continuous fallback will remain as-is
  }
}

// Refresh continuous fallback every hour so it always points to the latest video
const continuousRefreshInterval = setInterval(() => {
  initContinuousFallback().catch(() => {});
}, 60 * 60 * 1000);
continuousRefreshInterval.unref();

// ─── Manual Override State ────────────────────────────────────────────────────
//
// When the admin manually controls the broadcast, automation is suspended so
// automated polling cannot silently undo their decision.  Both flags are
// independently cleared:
//   • manualOverrideLive       → cleared when admin stops the live stream
//   • manualOverrideRebroadcast → cleared when admin stops the rebroadcast
//   • DELETE /api/livestream/override clears both at once

let manualOverrideLive = false;
let manualOverrideRebroadcast = false;

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
    // Ensure continuous fallback is populated after the scheduled window closes
    if (!continuousFallbackVideo) {
      initContinuousFallback().catch(() => {});
    }
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

// Run DB initialization immediately (non-blocking).
// Both calls are fire-and-forget; failures are caught internally.
setImmediate(() => {
  initRebroadcastFromDB().catch(() => {});
  initContinuousFallback().catch(() => {});
});

// ─── SSE status broadcaster ───────────────────────────────────────────────────

const statusSessions = new Map<string, Response>();

function sseWrite(res: Response, payload: string): void {
  res.write(payload);
  (res as unknown as { flush?: () => void }).flush?.();
}

/** Build the full status payload including rebroadcast lifecycle and manual override flags.
 *
 * Priority order for rebroadcast field:
 *   1. Active scheduled rebroadcast window (mode: "scheduled")
 *   2. Continuous fallback — always-on latest video (mode: "continuous")
 *   3. Nothing (available: false) — only when library is empty
 *
 * This guarantees the frontend always has content to show.
 */
function buildStatusPayload(): string {
  checkRebroadcastExpiry();

  let rb: (typeof rebroadcastLifecycle) & { mode?: "scheduled" | "continuous" };

  if (livestreamState.isLive) {
    // While live, suppress rebroadcast entirely
    rb = { available: false, videoId: null, title: null, thumbnailUrl: null, startedAt: null, expiresAt: null };
  } else if (isRebroadcastActive(rebroadcastLifecycle)) {
    rb = { ...rebroadcastLifecycle, mode: "scheduled" };
  } else if (continuousFallbackVideo) {
    // Always-on fallback — platform never goes blank
    rb = {
      available: true,
      videoId: continuousFallbackVideo.videoId,
      title: continuousFallbackVideo.title,
      thumbnailUrl: continuousFallbackVideo.thumbnailUrl,
      startedAt: null,
      expiresAt: null,
      mode: "continuous",
    };
  } else {
    rb = { available: false, videoId: null, title: null, thumbnailUrl: null, startedAt: null, expiresAt: null };
  }

  return JSON.stringify({
    type: "status",
    ...livestreamState,
    rebroadcast: rb,
    manualOverride: { live: manualOverrideLive, rebroadcast: manualOverrideRebroadcast },
  });
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
// JCTM is based in Warri, Nigeria — West Africa Time (WAT) = UTC+1.
// Sunday service is at 08:00 WAT. Poll every 5 seconds from 08:00–10:30 WAT
// so the platform scans YouTube right at service time. Outside this window the
// standard 30-second poll continues.

function isSundayServiceWindow(): boolean {
  const now = new Date();
  // WAT = UTC+1 (no DST)
  const watMs = now.getTime() + 1 * 60 * 60 * 1000;
  const wat = new Date(watMs);
  const dayOfWeek = wat.getUTCDay(); // 0 = Sunday
  const totalMinutes = wat.getUTCHours() * 60 + wat.getUTCMinutes();
  // 08:00 WAT → 480 min, 10:30 WAT → 630 min
  return dayOfWeek === 0 && totalMinutes >= 480 && totalMinutes <= 630;
}

// ─── Background poll ──────────────────────────────────────────────────────────

async function pollAndBroadcast(): Promise<void> {
  if (!process.env.YOUTUBE_API_KEY) return;

  // If admin has manually overridden any state, automation stands down.
  // The admin is in full control until they explicitly clear the override.
  if (manualOverrideLive || manualOverrideRebroadcast) return;

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

      // Send push notification to all subscribers on live→online transition
      if (!wasLive) {
        dispatchPushNotification(buildLiveServiceNotification(ytStatus.title ?? "Sunday Service")).catch(() => {});
      }
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

        // Transition: live → offline — activate AI-curated rebroadcast window
        if (wasLive) {
          try {
            const justEndedVideoId = livestreamState.videoId;
            const selection = await buildSmartRebroadcastQueue(justEndedVideoId);
            const primary = selection.primary;

            const startedAt = new Date().toISOString();
            const expiresAt = new Date(Date.now() + REBROADCAST_DURATION_MS).toISOString();

            rebroadcastLifecycle = {
              available: true,
              videoId: primary.videoId,
              title: primary.title,
              thumbnailUrl: primary.thumbnailUrl ??
                `https://i.ytimg.com/vi/${primary.videoId}/hqdefault.jpg`,
              startedAt,
              expiresAt,
            };

            // Notify all subscribers that rebroadcast is starting
            dispatchPushNotification(buildRebroadcastNotification(primary.title ?? "Sunday Service")).catch(() => {});
          } catch {
            // Fallback: use last known videoId or latest from DB
            let endedVideoId = livestreamState.videoId;
            let endedTitle = livestreamState.title;
            if (!endedVideoId) {
              try {
                const rows = await db.select().from(sermonsTable).orderBy(desc(sermonsTable.publishedAt)).limit(1);
                if (rows[0]) { endedVideoId = rows[0].videoId; endedTitle = endedTitle ?? rows[0].title; }
              } catch { /* ignore */ }
            }
            rebroadcastLifecycle = {
              available: true,
              videoId: endedVideoId,
              title: endedTitle,
              thumbnailUrl: endedVideoId ? `https://i.ytimg.com/vi/${endedVideoId}/hqdefault.jpg` : null,
              startedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + REBROADCAST_DURATION_MS).toISOString(),
            };

            // Notify subscribers of rebroadcast (fallback path)
            if (endedTitle) {
              dispatchPushNotification(buildRebroadcastNotification(endedTitle)).catch(() => {});
            }
          }
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

// Sunday service window: poll every 5 seconds from 8:00 AM WAT so the live
// banner appears within seconds of the stream going live.
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

// ─── POST /api/livestream/status — manual override (livestream-admin only) ───

router.post("/livestream/status", requireAdminRole("livestream"), async (req, res): Promise<void> => {
  const parsed = UpdateLivestreamStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { isLive, title, streamUrl } = parsed.data;
  const now = new Date();
  const manualTimestamp = `${now.toISOString()}_manual`;

  // Accept videoId from body directly (preferred) or extract from streamUrl
  const directVideoId = typeof req.body.videoId === "string" && req.body.videoId.trim()
    ? req.body.videoId.trim()
    : null;
  const videoIdMatch = streamUrl?.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  const extractedVideoId = directVideoId ?? (videoIdMatch ? (videoIdMatch[1] ?? null) : null);

  livestreamState = {
    isLive,
    isUpcoming: false,
    title: title ?? null,
    streamUrl: streamUrl ?? (extractedVideoId ? `https://www.youtube.com/watch?v=${extractedVideoId}` : null),
    videoId: extractedVideoId,
    startedAt: isLive ? (livestreamState.isLive ? livestreamState.startedAt : manualTimestamp) : null,
    scheduledStartTime: null,
  };

  // Track manual override so automation doesn't undo the admin's decision.
  // Going live → lock automation out. Stopping live → release the lock so
  // automation can resume normal detection.
  if (isLive) {
    manualOverrideLive = true;
    manualOverrideRebroadcast = false; // Live takes precedence over rebroadcast
    // Clear any active rebroadcast when going live
    rebroadcastLifecycle = {
      available: false, videoId: null, title: null,
      thumbnailUrl: null, startedAt: null, expiresAt: null,
    };
  } else {
    manualOverrideLive = false; // Release — automation may resume
  }

  youtubeCheckCache = null;

  broadcastStatus(livestreamState);

  res.json(UpdateLivestreamStatusResponse.parse(livestreamState));
});

// ─── POST /api/livestream/rebroadcast — manual rebroadcast (livestream-admin) ─
//
// Immediately activates rebroadcast mode for a given video (or the most recent
// sermon in the DB if no videoId is supplied).  Broadcasts the new state to all
// connected SSE clients so every viewer's banner updates in real time.

router.post("/livestream/rebroadcast", requireAdminRole("livestream"), async (req, res): Promise<void> => {
  let { videoId, title, thumbnailUrl } = req.body as {
    videoId?: string;
    title?: string;
    thumbnailUrl?: string;
  };

  // If no videoId supplied, fall back to the most recent sermon in the DB
  if (!videoId) {
    try {
      const rows = await db
        .select()
        .from(sermonsTable)
        .orderBy(desc(sermonsTable.publishedAt))
        .limit(1);
      if (rows[0]) {
        videoId     = rows[0].videoId;
        title       = title       ?? rows[0].title;
        thumbnailUrl = thumbnailUrl ?? rows[0].thumbnailUrl;
      }
    } catch {
      // continue with whatever we have
    }
  }

  if (!videoId) {
    res.status(400).json({ error: "No videoId supplied and no sermons found in database." });
    return;
  }

  const startedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + REBROADCAST_DURATION_MS).toISOString();

  rebroadcastLifecycle = {
    available: true,
    videoId,
    title:        title        ?? "Sunday Service — Jesus Christ Temple Ministry",
    thumbnailUrl: thumbnailUrl ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    startedAt,
    expiresAt,
  };

  // Make sure we're not showing "live" at the same time
  if (livestreamState.isLive) {
    livestreamState = {
      ...livestreamState,
      isLive: false,
      startedAt: null,
    };
  }

  // Mark this as an admin-controlled rebroadcast so automation doesn't override it
  manualOverrideRebroadcast = true;
  manualOverrideLive = false; // Rebroadcast and live are mutually exclusive

  // Push to every connected SSE client immediately
  broadcastStatus(livestreamState);

  res.json({
    success: true,
    rebroadcast: rebroadcastLifecycle,
  });
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

// ─── DELETE /api/livestream/rebroadcast — stop active rebroadcast ─────────────

router.delete("/livestream/rebroadcast", requireAdminRole("livestream"), (_req, res): void => {
  rebroadcastLifecycle = {
    available: false,
    videoId: null,
    title: null,
    thumbnailUrl: null,
    startedAt: null,
    expiresAt: null,
  };
  manualOverrideRebroadcast = false; // Release — automation may resume
  broadcastStatus(livestreamState);
  res.json({ success: true, message: "Rebroadcast stopped" });
});

// ─── DELETE /api/livestream/override — clear all manual overrides ─────────────
//
// Clears both live and rebroadcast manual overrides so the automated polling
// loop resumes full control.  The next poll cycle (within 30 s or 5 s on Sunday)
// will detect the real YouTube state and update all clients.

router.delete("/livestream/override", requireAdminRole("livestream"), (_req, res): void => {
  manualOverrideLive = false;
  manualOverrideRebroadcast = false;
  youtubeCheckCache = null; // Bust cache so next poll reads fresh data
  broadcastStatus(livestreamState);
  res.json({ success: true, message: "Manual overrides cleared — automation resumed" });
});

// ─── GET /api/livestream/validate-video — validate a YouTube video ID ─────────
//
// Admin-only.  Calls the YouTube Data API to check whether a specific video
// exists and whether it is currently live, upcoming, or a standard upload.
// Used by the admin UI to confirm a video ID before activating live / rebroadcast.

router.get("/livestream/validate-video", requireAdminRole("livestream"), async (req: Request, res: Response): Promise<void> => {
  const videoId = typeof req.query.videoId === "string" ? req.query.videoId.trim() : "";
  if (!videoId) {
    res.status(400).json({ error: "videoId query param is required" });
    return;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "YouTube API key not configured" });
    return;
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${encodeURIComponent(videoId)}&key=${apiKey}`;
    const ytRes = await fetchWithRetry(url);

    if (!ytRes.ok) {
      res.status(502).json({ error: "YouTube API request failed" });
      return;
    }

    const data = await ytRes.json() as {
      items?: {
        snippet?: {
          title?: string;
          liveBroadcastContent?: string;
          thumbnails?: { high?: { url?: string }; default?: { url?: string } };
          channelId?: string;
        };
        liveStreamingDetails?: { scheduledStartTime?: string };
      }[];
    };

    const item = data.items?.[0];
    if (!item) {
      res.json({ valid: false, isLive: false, isUpcoming: false, title: null, thumbnailUrl: null, scheduledStartTime: null });
      return;
    }

    const liveBroadcastContent = item.snippet?.liveBroadcastContent ?? "none";
    res.json({
      valid: true,
      isLive: liveBroadcastContent === "live",
      isUpcoming: liveBroadcastContent === "upcoming",
      title: item.snippet?.title ?? null,
      thumbnailUrl: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
      scheduledStartTime: item.liveStreamingDetails?.scheduledStartTime ?? null,
    });
  } catch {
    res.status(502).json({ error: "Failed to reach YouTube API" });
  }
});

// ─── GET /api/livestream/latest-uploads — latest videos from DB ───────────────
//
// Admin-only.  Returns the most recent videos from the sermon library so the
// admin can quickly pick one for manual rebroadcast without entering an ID.

router.get("/livestream/latest-uploads", requireAdminRole("livestream"), async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.publishedAt))
      .limit(20);

    res.json({
      videos: rows.map(r => ({
        videoId: r.videoId,
        title: r.title,
        thumbnailUrl: r.thumbnailUrl ?? `https://i.ytimg.com/vi/${r.videoId}/hqdefault.jpg`,
        publishedAt: r.publishedAt?.toISOString() ?? null,
        viewCount: r.viewCount ?? 0,
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch latest uploads" });
  }
});

export default router;

/**
 * youtube-analytics — Lightweight, ad-safe play-event tracker.
 *
 * Listens for postMessage events from monetized YouTube iframes and records:
 *   - impression: facade (or iframe) became visible in the viewport
 *   - play:      user pressed play (or autoplay started)
 *   - quartile:  25/50/75% watched
 *   - complete:  video reached the end
 *
 * Events are queued in-memory and flushed to /api/video-events:
 *   - on a 5-second debounce
 *   - on visibilitychange → hidden  (uses navigator.sendBeacon when available)
 *   - on pagehide
 *
 * NOTE: This file talks to the YouTube iframe via the public IFrame Player API
 * postMessage protocol — it never proxies, intercepts, or alters the playback
 * stream itself, so monetization eligibility is fully preserved.
 */

export type VideoEventKind =
  | "impression"
  | "play"
  | "pause"
  | "q25"
  | "q50"
  | "q75"
  | "complete";

interface VideoEvent {
  videoId: string;
  kind: VideoEventKind;
  page: string;
  ts: number;
}

const ENDPOINT = "/api/video-events";
const FLUSH_MS = 5_000;

let queue: VideoEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush(false);
  }, FLUSH_MS);
}

function flush(useBeacon: boolean) {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  const body = JSON.stringify({ events: batch });

  try {
    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {
      // Re-queue on transient failure so events aren't lost in this session
      queue = batch.concat(queue);
    });
  } catch {
    queue = batch.concat(queue);
  }
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => flush(true));
}

export function recordVideoEvent(videoId: string, kind: VideoEventKind, page?: string) {
  if (!videoId) return;
  queue.push({
    videoId,
    kind,
    page: page ?? (typeof window !== "undefined" ? window.location.pathname : "/"),
    ts: Date.now(),
  });
  // Cap queue to avoid unbounded growth on a long session
  if (queue.length > 200) queue.splice(0, queue.length - 200);
  scheduleFlush();
}

// ─── YouTube IFrame Player API helpers ──────────────────────────────────────

export type YTPlayerState = -1 | 0 | 1 | 2 | 3 | 5;
// -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued

interface YTMessage {
  event?: string;
  info?: number | { currentTime?: number; duration?: number };
}

/**
 * Subscribe to postMessage events from one specific iframe.
 *
 * Tracks: play/pause/end + 25/50/75 quartile thresholds (via polling
 * getCurrentTime). Returns an unsubscribe function.
 */
export function attachPlayerAnalytics(
  iframe: HTMLIFrameElement | null,
  videoId: string,
  page?: string,
): () => void {
  if (!iframe || typeof window === "undefined") return () => {};

  const cw = () => iframe.contentWindow;
  const seen = new Set<VideoEventKind>();
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let lastDuration = 0;

  const post = (func: string, args: unknown[] = []) => {
    try {
      cw()?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
    } catch { /* iframe gone */ }
  };

  // Tell YouTube to start sending us events
  const handshake = () => {
    try {
      cw()?.postMessage(JSON.stringify({ event: "listening", id: videoId }), "*");
    } catch { /* */ }
  };

  // Poll currentTime + duration to detect quartiles. Polling interval is a
  // gentle 2s — light enough to be invisible on the main thread, frequent
  // enough to catch quartile transitions accurately.
  const startPolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      try {
        cw()?.postMessage(JSON.stringify({ event: "command", func: "getCurrentTime", args: [] }), "*");
        cw()?.postMessage(JSON.stringify({ event: "command", func: "getDuration",    args: [] }), "*");
      } catch { /* */ }
    }, 2_000);
  };
  const stopPolling = () => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  };

  const handleQuartiles = (currentTime: number) => {
    if (lastDuration <= 0) return;
    const pct = currentTime / lastDuration;
    if (pct >= 0.25 && !seen.has("q25")) { seen.add("q25"); recordVideoEvent(videoId, "q25", page); }
    if (pct >= 0.50 && !seen.has("q50")) { seen.add("q50"); recordVideoEvent(videoId, "q50", page); }
    if (pct >= 0.75 && !seen.has("q75")) { seen.add("q75"); recordVideoEvent(videoId, "q75", page); }
  };

  const handleMessage = (e: MessageEvent) => {
    if (e.source !== cw()) return;
    if (e.origin !== "https://www.youtube.com") return;
    let data: YTMessage | null = null;
    try {
      data = typeof e.data === "string" ? JSON.parse(e.data) as YTMessage : e.data as YTMessage;
    } catch { return; }
    if (!data) return;

    if (data.event === "onReady") {
      handshake();
      post("addEventListener", ["onStateChange"]);
      return;
    }
    if (data.event === "onStateChange" && typeof data.info === "number") {
      const s = data.info as YTPlayerState;
      if (s === 1) {
        if (!seen.has("play")) { seen.add("play"); recordVideoEvent(videoId, "play", page); }
        startPolling();
      } else if (s === 2) {
        recordVideoEvent(videoId, "pause", page);
      } else if (s === 0) {
        if (!seen.has("complete")) { seen.add("complete"); recordVideoEvent(videoId, "complete", page); }
        stopPolling();
      }
      return;
    }
    if (data.event === "infoDelivery" || data.event === "onApiChange") {
      const info = data.info as { currentTime?: number; duration?: number } | undefined;
      if (info && typeof info.duration === "number" && info.duration > 0) lastDuration = info.duration;
      if (info && typeof info.currentTime === "number") handleQuartiles(info.currentTime);
      return;
    }
    if (typeof data.info === "object" && data.info !== null) {
      const info = data.info as { currentTime?: number; duration?: number };
      if (typeof info.duration === "number" && info.duration > 0) lastDuration = info.duration;
      if (typeof info.currentTime === "number") handleQuartiles(info.currentTime);
    }
  };

  window.addEventListener("message", handleMessage);
  // Re-run handshake once iframe has had time to register listeners
  const handshakeTimer = setTimeout(handshake, 1_000);

  return () => {
    window.removeEventListener("message", handleMessage);
    clearTimeout(handshakeTimer);
    stopPolling();
  };
}

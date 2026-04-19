/**
 * useLivestreamStatus — real-time livestream + rebroadcast lifecycle via SSE.
 *
 * Subscribes to /api/livestream/stream.  The server pushes a "status" event
 * whenever the live state changes (goes live, ends, rebroadcast activates,
 * rebroadcast expires, or a manual override is applied).
 *
 * The payload now includes a `rebroadcast` block so the client always knows:
 *  • isLive:              stream is currently live on YouTube
 *  • rebroadcast.available: within the 3-day post-service window
 *  • neither:             idle / outside any active window
 *
 * Reliability:
 *  • Exponential-backoff reconnect (1 s → 2 → 4 → 8 → 16 → 30 s cap)
 *  • Stable session-id per page load
 *  • SSE keepalive comments keep the socket alive through proxies
 *  • Falls back to last known state while reconnecting
 */

import { useSyncExternalStore } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface RebroadcastState {
  available: boolean;
  videoId: string | null;
  title: string | null;
  thumbnailUrl: string | null;
  startedAt: string | null;
  expiresAt: string | null;
  /** "scheduled" = post-service rebroadcast window (4 days).
   *  "continuous" = always-on fallback (latest upload, never expires). */
  mode?: "scheduled" | "continuous";
}

export interface ManualOverrideState {
  live: boolean;
  rebroadcast: boolean;
}

export interface LivestreamStatus {
  isLive: boolean;
  isUpcoming: boolean;
  title: string | null;
  streamUrl: string | null;
  videoId: string | null;
  startedAt: string | null;
  scheduledStartTime: string | null;
  rebroadcast: RebroadcastState;
  manualOverride: ManualOverrideState;
}

const DEFAULT_REBROADCAST: RebroadcastState = {
  available: false,
  videoId: null,
  title: null,
  thumbnailUrl: null,
  startedAt: null,
  expiresAt: null,
};

const DEFAULT_MANUAL_OVERRIDE: ManualOverrideState = { live: false, rebroadcast: false };

const DEFAULT_STATUS: LivestreamStatus = {
  isLive: false,
  isUpcoming: false,
  title: null,
  streamUrl: null,
  videoId: null,
  startedAt: null,
  scheduledStartTime: null,
  rebroadcast: DEFAULT_REBROADCAST,
  manualOverride: DEFAULT_MANUAL_OVERRIDE,
};

type SSEEvent = { type: "status" } & Omit<LivestreamStatus, "rebroadcast" | "manualOverride"> & {
  rebroadcast?: RebroadcastState;
  manualOverride?: ManualOverrideState;
};

const MAX_RETRY_DELAY_MS = 30_000;
const SNAPSHOT_TTL_MS = 8_000;

function normalizeStatus(data: Partial<SSEEvent>): LivestreamStatus {
  return {
    isLive:              data.isLive    ?? false,
    isUpcoming:          data.isUpcoming ?? false,
    title:               data.title     ?? null,
    streamUrl:           data.streamUrl  ?? null,
    videoId:             data.videoId    ?? null,
    startedAt:           data.startedAt  ?? null,
    scheduledStartTime:  data.scheduledStartTime ?? null,
    rebroadcast:         data.rebroadcast ?? DEFAULT_REBROADCAST,
    manualOverride:      data.manualOverride ?? DEFAULT_MANUAL_OVERRIDE,
  };
}

function getRetryDelayWithJitter(delay: number): number {
  return delay + Math.floor(Math.random() * Math.min(1_000, delay * 0.3));
}

type Listener = () => void;

let currentStatus = DEFAULT_STATUS;
let es: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 1_000;
let started = false;
let lastSnapshotAt = 0;
let snapshotPromise: Promise<void> | null = null;
const listeners = new Set<Listener>();
const sid = `status-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;

function emitStatus(next: LivestreamStatus) {
  currentStatus = next;
  listeners.forEach(listener => listener());
}

async function fetchSnapshot(signal?: AbortSignal) {
  if (Date.now() - lastSnapshotAt < SNAPSHOT_TTL_MS) return;
  if (snapshotPromise) return snapshotPromise;

  snapshotPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/api/livestream/status`, {
        cache: "no-store",
        signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json() as Partial<SSEEvent>;
      lastSnapshotAt = Date.now();
      emitStatus(normalizeStatus(data));
    } catch {
      undefined;
    } finally {
      snapshotPromise = null;
    }
  })();

  return snapshotPromise;
}

function clearRetryTimer() {
  if (!retryTimer) return;
  clearTimeout(retryTimer);
  retryTimer = null;
}

function closeStream() {
  clearRetryTimer();
  es?.close();
  es = null;
}

function connect() {
  if (!listeners.size) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  closeStream();

  es = new EventSource(`${BASE}/api/livestream/stream?sid=${encodeURIComponent(sid)}`);

  es.onopen = () => {
    retryDelay = 1_000;
  };

  es.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data as string) as SSEEvent;
      if (data.type === "status") {
        emitStatus(normalizeStatus(data));
      }
    } catch {
      undefined;
    }
  };

  es.onerror = () => {
    es?.close();
    es = null;
    const delay = retryDelay;
    retryDelay = Math.min(delay * 2, MAX_RETRY_DELAY_MS);
    retryTimer = setTimeout(connect, getRetryDelayWithJitter(delay));
  };
}

function reconnectNow() {
  fetchSnapshot();
  connect();
}

function handleVisibility() {
  if (document.visibilityState === "visible") {
    reconnectNow();
  } else {
    closeStream();
  }
}

function startStore() {
  if (started) return;
  started = true;
  fetchSnapshot();
  connect();
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("online", reconnectNow);
  window.addEventListener("focus", reconnectNow);
}

function stopStore() {
  if (!started || listeners.size) return;
  started = false;
  closeStream();
  document.removeEventListener("visibilitychange", handleVisibility);
  window.removeEventListener("online", reconnectNow);
  window.removeEventListener("focus", reconnectNow);
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  startStore();
  return () => {
    listeners.delete(listener);
    stopStore();
  };
}

function getSnapshot() {
  return currentStatus;
}

export function useLivestreamStatus(): LivestreamStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

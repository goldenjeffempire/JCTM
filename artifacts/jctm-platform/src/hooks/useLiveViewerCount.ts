import { useEffect, useRef, useState, useCallback } from "react";
import { safeSessionGet, safeSessionSet } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getPlayerSessionId(): string {
  const key = "jctm-live-player-sid";
  const stored = safeSessionGet(key);
  if (stored) return stored;
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  safeSessionSet(key, id);
  return id;
}

type ViewerEvent = {
  type: "viewer_count";
  count: number;
  live?: number;
  rebroadcast?: number;
  totals?: {
    live?: number;
    rebroadcast?: number;
    total?: number;
  };
};

type ViewerMode = "live" | "rebroadcast";

function selectModeCount(data: ViewerEvent | { count?: number; live?: number; rebroadcast?: number }, mode: ViewerMode): number {
  if (mode === "rebroadcast") return Math.max(0, data.rebroadcast ?? data.count ?? 0);
  return Math.max(0, data.live ?? data.count ?? 0);
}

export function useLiveViewerCount(countThisViewer = true, mode: ViewerMode = "live"): number {
  const [count, setCount] = useState(0);
  const sid = useRef(getPlayerSessionId()).current;

  // ── REST polling baseline (15-second fallback) ────────────────────────────
  // Always active — provides a reliable floor if the SSE connection is down.
  useEffect(() => {
    if (!countThisViewer) return;

    let cancelled = false;

    const fetchCurrent = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(`${BASE}/api/livestream/viewers`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json() as { count?: number; live?: number; rebroadcast?: number };
        if (!cancelled) setCount(selectModeCount(data, mode));
      } catch {
        undefined;
      }
    };

    fetchCurrent();
    const timer = setInterval(fetchCurrent, 15_000);
    document.addEventListener("visibilitychange", fetchCurrent);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", fetchCurrent);
      clearInterval(timer);
    };
  }, [countThisViewer, mode]);

  // ── SSE viewer presence stream with exponential-backoff reconnect ──────────
  // Matches the reconnect pattern in useLivestreamStatus.ts.
  // Backoff: 1 s → 2 → 4 → 8 → 16 → 30 s (cap).
  // The SSE is only opened when countThisViewer is true (player is open).
  const esRef         = useRef<EventSource | null>(null);
  const retryDelayRef = useRef(1_000);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectFnRef  = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (document.visibilityState === "hidden") return;
    if (navigator.onLine === false) return;

    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    if (esRef.current) { esRef.current.close(); esRef.current = null; }

    const es = new EventSource(
      `${BASE}/api/livestream/viewers/stream?sid=${encodeURIComponent(sid)}&mode=${mode}`,
    );
    esRef.current = es;

    es.onopen = () => {
      retryDelayRef.current = 1_000;
    };

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as ViewerEvent;
        if (data.type === "viewer_count") {
          setCount(selectModeCount(data, mode));
        }
      } catch {
        // Ignore malformed frames
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, 30_000);
      retryTimerRef.current = setTimeout(
        () => connectFnRef.current(),
        delay + Math.floor(Math.random() * Math.min(1_000, delay * 0.3)),
      );
    };
  }, [sid, mode]);

  connectFnRef.current = connect;

  useEffect(() => {
    if (!countThisViewer) {
      if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
      esRef.current?.close();
      esRef.current = null;
      retryDelayRef.current = 1_000;
      return;
    }

    connect();

    const reconnectNow = () => connectFnRef.current();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        reconnectNow();
      } else {
        if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
        esRef.current?.close();
        esRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", reconnectNow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", reconnectNow);
      if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
      esRef.current?.close();
      esRef.current = null;
      retryDelayRef.current = 1_000;
    };
  }, [countThisViewer, connect]);

  return count;
}

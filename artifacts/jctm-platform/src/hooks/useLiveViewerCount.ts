import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    let cancelled = false;

    const fetchCurrent = async () => {
      try {
        const res = await fetch(`${BASE}/api/livestream/viewers`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json() as { count?: number; live?: number; rebroadcast?: number };
        if (!cancelled) setCount(selectModeCount(data, mode));
      } catch {
        if (!cancelled) setCount(0);
      }
    };

    fetchCurrent();
    const timer = setInterval(fetchCurrent, 15_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [mode]);

  useEffect(() => {
    if (!countThisViewer) return;

    const es = new EventSource(`${BASE}/api/livestream/viewers/stream?sid=${encodeURIComponent(sid)}&mode=${mode}`);

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
    };

    return () => es.close();
  }, [countThisViewer, sid, mode]);

  return count;
}
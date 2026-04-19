import { useEffect, useRef, useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getPlayerSessionId(): string {
  const key = "jctm-live-player-sid";
  const stored = sessionStorage.getItem(key);
  if (stored) return stored;
  const id = crypto.randomUUID();
  sessionStorage.setItem(key, id);
  return id;
}

type ViewerEvent = {
  type: "viewer_count";
  count: number;
};

export function useLiveViewerCount(countThisViewer = true): number {
  const [count, setCount] = useState(0);
  const sid = useRef(getPlayerSessionId()).current;

  useEffect(() => {
    let cancelled = false;

    const fetchCurrent = async () => {
      try {
        const res = await fetch(`${BASE}/api/livestream/viewers`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json() as { count?: number };
        if (!cancelled) setCount(Math.max(0, data.count ?? 0));
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
  }, []);

  useEffect(() => {
    if (!countThisViewer) return;

    const es = new EventSource(`${BASE}/api/livestream/viewers/stream?sid=${encodeURIComponent(sid)}`);

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as ViewerEvent;
        if (data.type === "viewer_count") {
          setCount(Math.max(0, data.count));
        }
      } catch {
        // Ignore malformed frames
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => es.close();
  }, [countThisViewer, sid]);

  return count;
}
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

import { useState, useEffect, useRef, useCallback } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface RebroadcastState {
  available: boolean;
  videoId: string | null;
  title: string | null;
  thumbnailUrl: string | null;
  startedAt: string | null;
  expiresAt: string | null;
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
}

const DEFAULT_REBROADCAST: RebroadcastState = {
  available: false,
  videoId: null,
  title: null,
  thumbnailUrl: null,
  startedAt: null,
  expiresAt: null,
};

const DEFAULT_STATUS: LivestreamStatus = {
  isLive: false,
  isUpcoming: false,
  title: null,
  streamUrl: null,
  videoId: null,
  startedAt: null,
  scheduledStartTime: null,
  rebroadcast: DEFAULT_REBROADCAST,
};

type SSEEvent = { type: "status" } & Omit<LivestreamStatus, "rebroadcast"> & {
  rebroadcast?: RebroadcastState;
};

export function useLivestreamStatus(): LivestreamStatus {
  const [status, setStatus] = useState<LivestreamStatus>(DEFAULT_STATUS);

  const esRef         = useRef<EventSource | null>(null);
  const retryDelayRef = useRef(1_000);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectFnRef  = useRef<() => void>(() => {});
  const sid           = useRef(`status-${crypto.randomUUID()}`).current;

  const connect = useCallback(() => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    if (esRef.current) { esRef.current.close(); esRef.current = null; }

    const es = new EventSource(
      `${BASE}/api/livestream/stream?sid=${encodeURIComponent(sid)}`,
    );
    esRef.current = es;

    es.onopen = () => {
      retryDelayRef.current = 1_000;
    };

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as SSEEvent;
        if (data.type === "status") {
          setStatus({
            isLive:              data.isLive    ?? false,
            isUpcoming:          data.isUpcoming ?? false,
            title:               data.title     ?? null,
            streamUrl:           data.streamUrl  ?? null,
            videoId:             data.videoId    ?? null,
            startedAt:           data.startedAt  ?? null,
            scheduledStartTime:  data.scheduledStartTime ?? null,
            rebroadcast:         data.rebroadcast ?? DEFAULT_REBROADCAST,
          });
        }
      } catch {
        // Malformed frame — ignore
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, 30_000);
      retryTimerRef.current = setTimeout(() => connectFnRef.current(), delay);
    };
  }, [sid]);

  connectFnRef.current = connect;

  useEffect(() => {
    connect();
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);

  return status;
}

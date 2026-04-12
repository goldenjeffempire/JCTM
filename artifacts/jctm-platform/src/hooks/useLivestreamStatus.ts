/**
 * useLivestreamStatus — real-time livestream status via Server-Sent Events.
 *
 * Instead of polling REST every 30 seconds, this hook subscribes to the
 * /api/livestream/stream SSE endpoint.  The server pushes a "status" event
 * whenever the live state changes (service goes live, ends, or a manual
 * override is applied), so every connected client reacts within milliseconds.
 *
 * Reliability:
 *  • Exponential-backoff reconnect (1 s → 2 → 4 → 8 → 16 → 30 s cap)
 *  • Stable session-id per page load (avoids duplicate server-side sessions)
 *  • SSE keepalive comments from the server keep the socket alive through
 *    proxies that would otherwise close idle connections after 60–90 s
 *  • Falls back to the last known state while reconnecting — never flickers
 *    back to "not live" on a transient network blip
 */

import { useState, useEffect, useRef, useCallback } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface LivestreamStatus {
  isLive: boolean;
  isUpcoming: boolean;
  title: string | null;
  streamUrl: string | null;
  videoId: string | null;
  startedAt: string | null;
  scheduledStartTime: string | null;
}

const DEFAULT_STATUS: LivestreamStatus = {
  isLive: false,
  isUpcoming: false,
  title: null,
  streamUrl: null,
  videoId: null,
  startedAt: null,
  scheduledStartTime: null,
};

type SSEEvent = { type: "status" } & LivestreamStatus;

export function useLivestreamStatus(): LivestreamStatus {
  const [status, setStatus] = useState<LivestreamStatus>(DEFAULT_STATUS);

  const esRef             = useRef<EventSource | null>(null);
  const retryDelayRef     = useRef(1_000);
  const retryTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectFnRef      = useRef<() => void>(() => {});
  // Stable session-id for this page load — server uses it to deduplicate
  // reconnects and avoid inflating its own internal session count.
  const sid               = useRef(`status-${crypto.randomUUID()}`).current;

  const connect = useCallback(() => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    if (esRef.current) { esRef.current.close(); esRef.current = null; }

    const es = new EventSource(
      `${BASE}/api/livestream/stream?sid=${encodeURIComponent(sid)}`,
    );
    esRef.current = es;

    es.onopen = () => {
      // Reset backoff on successful connection
      retryDelayRef.current = 1_000;
    };

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as SSEEvent;
        if (data.type === "status") {
          setStatus({
            isLive:               data.isLive    ?? false,
            isUpcoming:           data.isUpcoming ?? false,
            title:                data.title     ?? null,
            streamUrl:            data.streamUrl  ?? null,
            videoId:              data.videoId    ?? null,
            startedAt:            data.startedAt  ?? null,
            scheduledStartTime:   data.scheduledStartTime ?? null,
          });
        }
      } catch {
        // Malformed frame — ignore
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      // Exponential backoff: 1 → 2 → 4 → 8 → 16 → 30 s (cap)
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

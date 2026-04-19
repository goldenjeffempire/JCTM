import { useEffect, useRef } from "react";
import { getOrCreateVisitorId } from "@/lib/visitorId";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Registers the current visitor with the server and sends a heartbeat every
 * 30 seconds so the admin dashboard can show accurate real-time active counts.
 *
 * Also registers a beforeunload beacon so the server removes the session
 * immediately when the tab is closed.
 */
export function useVisitorHeartbeat(): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const visitorId = getOrCreateVisitorId();

    const getPage = () => window.location.pathname;

    const sendHeartbeat = () => {
      try {
        navigator.sendBeacon(
          `${BASE}/api/visitors/heartbeat`,
          new Blob(
            [JSON.stringify({ visitorId, page: getPage() })],
            { type: "application/json" },
          ),
        );
      } catch {
        // Fallback to fetch (sendBeacon may be unavailable in some envs)
        fetch(`${BASE}/api/visitors/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId, page: getPage() }),
          keepalive: true,
        }).catch(() => null);
      }
    };

    const sendVisibleHeartbeat = () => {
      if (document.visibilityState === "visible") sendHeartbeat();
    };

    const sendLeave = () => {
      try {
        navigator.sendBeacon(
          `${BASE}/api/visitors/session/leave`,
          new Blob(
            [JSON.stringify({ visitorId })],
            { type: "application/json" },
          ),
        );
      } catch { /* best-effort */ }
    };

    // Initial track (counts as new visitor if first time)
    fetch(`${BASE}/api/visitors/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, page: getPage() }),
    }).catch(() => undefined);

    intervalRef.current = setInterval(sendVisibleHeartbeat, HEARTBEAT_INTERVAL_MS);

    document.addEventListener("visibilitychange", sendVisibleHeartbeat);
    window.addEventListener("beforeunload", sendLeave);
    window.addEventListener("pagehide", sendLeave);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", sendVisibleHeartbeat);
      window.removeEventListener("beforeunload", sendLeave);
      window.removeEventListener("pagehide", sendLeave);
    };
  }, []);
}

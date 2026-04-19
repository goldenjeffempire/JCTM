const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

let lastErrorAt = 0;

export function reportClientError(error: unknown, context: Record<string, unknown> = {}): void {
  const now = Date.now();
  if (now - lastErrorAt < 1000) return;
  lastErrorAt = now;

  const err = error instanceof Error ? error : new Error(String(error));
  const payload = {
    message: err.message,
    stack: err.stack,
    path: window.location.pathname,
    userAgent: navigator.userAgent,
    ...context,
  };

  try {
    navigator.sendBeacon(
      `${BASE}/api/client-errors`,
      new Blob([JSON.stringify(payload)], { type: "application/json" }),
    );
  } catch {
    fetch(`${BASE}/api/client-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  }
}

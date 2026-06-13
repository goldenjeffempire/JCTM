/**
 * keepalive.ts — Always-on dual-ping keepalive for JCTM Digital Sanctuary.
 *
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * Hosting platforms (Replit, Render, Fly.io) track activity at the *proxy*
 * layer. A localhost ping is invisible to that layer — the platform still
 * marks the app as idle and may suspend it. To stay alive, the server must
 * generate real HTTPS traffic through the public-facing domain.
 *
 * DUAL-PING STRATEGY
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Local ping  — http://127.0.0.1:{port}/api/ping every INTERVAL ms.
 *      Keeps the Node.js event loop, V8 JIT caches, and DB connection pool
 *      warm between requests. Sub-millisecond, allocation-free.
 *
 *   2. Public ping — https://{publicDomain}/api/ping every INTERVAL ms.
 *      Registers as real external traffic at the platform proxy level, which
 *      resets the idle timer and prevents the process from being suspended.
 *
 * RELIABILITY FEATURES
 * ─────────────────────────────────────────────────────────────────────────────
 *   • Each ping is retried once after RETRY_DELAY_MS on failure.
 *   • Consecutive-failure counter: a WARN is emitted after 3 successive
 *     failures and an ERROR after 6, so problems surface in logs fast.
 *   • Counters reset on the next successful ping pair.
 *   • Aborted with AbortController if the ping hangs > 8 s.
 *   • Handles the case where the public domain is not yet known (dev/test).
 *   • Timer is .unref()'d — does not prevent graceful shutdown.
 */

import { logger as rootLogger } from "./logger.js";
import type { Logger } from "pino";

// ── Constants ─────────────────────────────────────────────────────────────────

const PING_INTERVAL_MS  = 90_000;   // 90 s — well inside Replit's 2-min idle window
const PING_TIMEOUT_MS   = 8_000;    // abort if no response in 8 s
const RETRY_DELAY_MS    = 20_000;   // retry once, 20 s after failure
const WARN_THRESHOLD    = 3;        // WARN after this many consecutive failures
const ERROR_THRESHOLD   = 6;        // ERROR after this many consecutive failures

// ── State ─────────────────────────────────────────────────────────────────────

let intervalHandle:   ReturnType<typeof setInterval> | null = null;
let consecutiveFails  = 0;
let totalPings        = 0;
let totalFails        = 0;

// ── URL helpers ───────────────────────────────────────────────────────────────

function resolvePublicUrl(): string | null {
  // NOTE: REPLIT_DEV_DOMAIN is intentionally excluded here.
  // It is the sandboxed preview proxy URL and is NOT reachable via outbound
  // HTTP from within the same Replit container — pinging it causes nothing but
  // false-alarm FATAL log spam. When deployed (suggest_deploy), the production
  // domain will be present in REPLIT_DOMAINS or PUBLIC_URL instead.
  const domain =
    process.env.RENDER_EXTERNAL_URL ||
    process.env.PUBLIC_URL          ||
    process.env.APP_URL;
  if (!domain) return null;
  const base = domain.startsWith("http") ? domain : `https://${domain}`;
  return base.replace(/\/$/, "") + "/api/ping";
}

function resolveLocalUrl(): string {
  const port = process.env.PORT || "8080";
  return `http://127.0.0.1:${port}/api/ping`;
}

// ── Ping primitive ────────────────────────────────────────────────────────────

async function ping(url: string): Promise<{ ok: boolean; status?: number; ms: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "x-keepalive": "1",
        "Cache-Control": "no-cache",
      },
    });
    return { ok: res.ok, status: res.status, ms: Date.now() - t0 };
  } catch {
    return { ok: false, ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

async function pingWithRetry(url: string, log: Logger): Promise<boolean> {
  const first = await ping(url);
  if (first.ok) return true;

  // Retry once after a short delay
  await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
  const second = await ping(url);
  if (!second.ok) {
    log.debug({ url, firstMs: first.ms, retryMs: second.ms }, "Keepalive ping failed after retry");
  }
  return second.ok;
}

// ── Main cycle ────────────────────────────────────────────────────────────────

async function runPingCycle(log: Logger): Promise<void> {
  totalPings++;
  const localUrl  = resolveLocalUrl();
  const publicUrl = resolvePublicUrl();

  const [localOk, publicOk] = await Promise.all([
    pingWithRetry(localUrl, log),
    publicUrl ? pingWithRetry(publicUrl, log) : Promise.resolve(true),
  ]);

  const allOk = localOk && publicOk;

  if (allOk) {
    if (consecutiveFails >= WARN_THRESHOLD) {
      log.info({ consecutiveFails }, "Keepalive: pings recovered after consecutive failures");
    }
    consecutiveFails = 0;
    return;
  }

  totalFails++;
  consecutiveFails++;

  const ctx = {
    local: localOk,
    public: publicOk,
    publicUrl: publicUrl ?? "none",
    consecutiveFails,
    totalFails,
    totalPings,
  };

  if (consecutiveFails >= ERROR_THRESHOLD) {
    log.error(ctx, "Keepalive: repeated ping failures — platform may be degraded");
  } else if (consecutiveFails >= WARN_THRESHOLD) {
    log.warn(ctx, "Keepalive: multiple consecutive ping failures");
  } else {
    log.debug(ctx, "Keepalive: ping cycle had a failure (within tolerance)");
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the dual-ping keepalive loop.
 * Idempotent — safe to call multiple times; subsequent calls are no-ops.
 */
export function startKeepalive(log: Logger = rootLogger): void {
  if (intervalHandle) return;

  const localUrl  = resolveLocalUrl();
  const publicUrl = resolvePublicUrl();

  log.info(
    { intervalMs: PING_INTERVAL_MS, localUrl, publicUrl: publicUrl ?? "not configured", retryDelayMs: RETRY_DELAY_MS },
    "Keepalive started — dual-ping (local + public) every 90 s",
  );

  // Fire the first cycle immediately (after a short warm-up delay)
  const warmupTimer = setTimeout(() => {
    runPingCycle(log).catch(() => { /* already handled inside */ });
  }, 10_000);
  warmupTimer.unref();

  intervalHandle = setInterval(() => {
    runPingCycle(log).catch(() => { /* already handled inside */ });
  }, PING_INTERVAL_MS);

  // .unref() so the timer does not prevent graceful shutdown
  intervalHandle.unref();
}

/** Stop the keepalive loop. Call during graceful shutdown. */
export function stopKeepalive(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

/** Diagnostic snapshot — useful for admin health endpoints. */
export function getKeepaliveStatus(): {
  running:         boolean;
  intervalMs:      number;
  localUrl:        string;
  publicUrl:       string | null;
  consecutiveFails: number;
  totalFails:      number;
  totalPings:      number;
  uptimePercent:   number;
} {
  return {
    running:          !!intervalHandle,
    intervalMs:       PING_INTERVAL_MS,
    localUrl:         resolveLocalUrl(),
    publicUrl:        resolvePublicUrl(),
    consecutiveFails,
    totalFails,
    totalPings,
    uptimePercent: totalPings === 0
      ? 100
      : Math.round(((totalPings - totalFails) / totalPings) * 10_000) / 100,
  };
}

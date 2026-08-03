/**
 * Health routes — /api/healthz, /api/health, /api/ping
 *
 * ## Why the health handler must NEVER make live DB calls
 *
 * Root cause of Render health-check failures:
 *  1. The previous implementation did pool.connect() + SELECT 1 + two COUNT(*)
 *     queries on every probe.
 *  2. During heavy background work (AI ingestion, YouTube full-sync, media
 *     pre-processing) all 10 pool connections are busy.  pool.connect() then
 *     blocks up to connectionTimeoutMillis (10 s) waiting for a free slot.
 *  3. Render's health probe times out → marks instance unhealthy → restarts.
 *  4. The restarted instance immediately runs migrations + background jobs →
 *     pool saturated again → next probe times out → restart loop.
 *
 * ## Fix: background probe + in-memory cache
 *
 * A background interval runs the real DB checks every 30 s with hard 2 s
 * timeouts per query.  The health handler reads ONLY from this cache and
 * always returns within <5 ms regardless of DB state.
 *
 * The server always returns HTTP 200 (never 503 from health timeouts).
 * If the DB is genuinely broken for multiple consecutive probes the status
 * field reflects "degraded", but 200 is still returned so Render doesn't
 * restart (a restart can't fix an external DB outage and makes it worse by
 * creating new connections on a cold-start DB).
 *
 * ## Readiness gate
 *
 * setReadyState(true) is called by index.ts after runMigrations() completes.
 * Until then the handler returns status:"starting" which tells operators the
 * server is warming up, while still returning 200 so Render accepts the
 * instance immediately on deploy.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { getCronState } from "../lib/cron.js";
import { sseBroadcaster } from "../lib/sse-broadcaster.js";
import { getNeonQuotaStatus } from "../lib/neon-quota-monitor.js";
import { requireAdminRole } from "../lib/adminAuth.js";
import { getUptimeHistory } from "../lib/uptime-monitor.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ─── Probe timeouts ───────────────────────────────────────────────────────────

/** Hard wall-clock limit per DB query inside the background probe. */
const PROBE_QUERY_TIMEOUT_MS = 2_000;
/** How often the background probe runs. */
const PROBE_INTERVAL_MS = 30_000;
/** After this many milliseconds without a successful probe the cache is stale. */
const CACHE_STALE_AFTER_MS = 120_000; // 2 min = 4 missed probes

// ─── Readiness gate ───────────────────────────────────────────────────────────

/** Set to true by index.ts once runMigrations() completes. */
let _isReady = false;
export function setReadyState(ready: boolean): void {
  _isReady = ready;
}

// ─── Health cache ─────────────────────────────────────────────────────────────

interface ProbeResult {
  db: { ok: boolean; latencyMs: number; error?: string };
  sermonStats: { total: number; enriched: number; pending: number };
  pushSubscribers: number;
  probeAt: number;
}

let _cache: ProbeResult | null = null;
let _probeRunning = false;
let _consecutiveDbFailures = 0;
let _probeTimer: ReturnType<typeof setInterval> | null = null;

/** Race a promise against a timeout; return fallback on timeout. */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([
    p.then((v) => { clearTimeout(timer); return v; }),
    timeout,
  ]);
}

async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  let client;
  try {
    client = await pool.connect();
    await client.query("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: String(err) };
  } finally {
    client?.release();
  }
}

async function getSermonLibraryStats(): Promise<{
  total: number;
  enriched: number;
  pending: number;
}> {
  try {
    const result = await pool.query<{ total: string; enriched: string }>(
      `SELECT COUNT(*) AS total, COUNT(metadata_generated_at) AS enriched FROM sermon_data`,
    );
    const total    = parseInt(result.rows[0]?.total    ?? "0", 10);
    const enriched = parseInt(result.rows[0]?.enriched ?? "0", 10);
    return { total, enriched, pending: total - enriched };
  } catch {
    return { total: 0, enriched: 0, pending: 0 };
  }
}

async function getSubscriberCount(): Promise<number> {
  try {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM push_subscriptions WHERE is_active = true`,
    );
    return parseInt(result.rows[0]?.count ?? "0", 10);
  } catch {
    return 0;
  }
}

async function runProbe(): Promise<void> {
  if (_probeRunning) return;
  _probeRunning = true;
  try {
    const [db, sermonStats, pushSubscribers] = await Promise.all([
      withTimeout(
        checkDatabase(),
        PROBE_QUERY_TIMEOUT_MS,
        { ok: false, latencyMs: PROBE_QUERY_TIMEOUT_MS, error: "probe timeout" },
      ),
      withTimeout(
        getSermonLibraryStats(),
        PROBE_QUERY_TIMEOUT_MS,
        { total: 0, enriched: 0, pending: 0 },
      ),
      withTimeout(getSubscriberCount(), PROBE_QUERY_TIMEOUT_MS, 0),
    ]);

    _cache = { db, sermonStats, pushSubscribers, probeAt: Date.now() };
    _consecutiveDbFailures = db.ok ? 0 : _consecutiveDbFailures + 1;
  } catch (err) {
    _consecutiveDbFailures++;
    logger.warn({ err }, "Health probe failed");
  } finally {
    _probeRunning = false;
  }
}

/**
 * Start the background health probe.
 * Call once from index.ts after the server is listening.
 */
export function initHealthCache(): void {
  // Warm immediately so first health check has data
  runProbe().catch(() => {});
  _probeTimer = setInterval(() => { runProbe().catch(() => {}); }, PROBE_INTERVAL_MS);
  _probeTimer.unref(); // don't prevent clean shutdown
}

/**
 * Stop the background probe.
 * Call from the graceful-shutdown handler in index.ts.
 */
export function stopHealthCache(): void {
  if (_probeTimer) {
    clearInterval(_probeTimer);
    _probeTimer = null;
  }
}

// ─── Full health handler ──────────────────────────────────────────────────────

function healthHandler(_req: Request, res: Response): void {
  const now   = Date.now();
  const cache = _cache;

  // Cache age: Infinity if no probe has completed yet (startup)
  const cacheAgeMs = cache ? now - cache.probeAt : Infinity;
  const isCacheStale = cacheAgeMs > CACHE_STALE_AFTER_MS;

  // ── All in-memory reads — synchronous, zero I/O ──────────────────────────
  const cronState  = getCronState();
  const sseClients = sseBroadcaster.size();
  const neonQuota  = getNeonQuotaStatus();

  // ── Derived values from cache (optimistic defaults during startup) ────────
  const db             = cache?.db             ?? { ok: true, latencyMs: 0 };
  const sermonStats    = cache?.sermonStats    ?? { total: 0, enriched: 0, pending: 0 };
  const pushSubscribers = cache?.pushSubscribers ?? 0;

  const vapidConfigured      = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  const youtubeApiConfigured = !!process.env.YOUTUBE_API_KEY;

  // ── Status derivation ─────────────────────────────────────────────────────
  // "starting"  — server is up but migrations haven't finished yet
  // "ok"        — all systems nominal
  // "degraded"  — DB is failing but server is alive (stale cache or repeated failures)
  let status: "starting" | "ok" | "degraded";
  if (!_isReady) {
    status = "starting";
  } else if (isCacheStale || _consecutiveDbFailures >= 3) {
    status = "degraded";
  } else if (!db.ok || neonQuota.status === "quota-exceeded") {
    status = "degraded";
  } else {
    status = "ok";
  }

  const payload = {
    status,
    timestamp:  new Date().toISOString(),
    uptime:     Math.floor(process.uptime()),
    version:    process.env.npm_package_version ?? "1.0.0",
    cacheAgeMs: cache ? cacheAgeMs : null,
    services: {
      database: {
        status: db.ok ? "ok" : "error",
        latencyMs: db.latencyMs,
        ...(db.error && process.env.NODE_ENV !== "production" ? { error: db.error } : {}),
        neonQuota: {
          status:                    neonQuota.status,
          since:                     neonQuota.since,
          lastCheckAt:               neonQuota.lastCheckAt,
          lastRecoveryAt:            neonQuota.lastRecoveryAt,
          consecutiveQuotaErrors:    neonQuota.consecutiveQuotaErrors,
          ...(neonQuota.lastErrorMessage && process.env.NODE_ENV !== "production"
            ? { lastErrorMessage: neonQuota.lastErrorMessage }
            : {}),
        },
      },
      youtube: {
        status:          youtubeApiConfigured ? "configured" : "missing-key",
        apiSyncEnabled:  youtubeApiConfigured,
        quotaPaused:     cronState.youtube.quotaPaused,
        quotaResetsAt:   cronState.youtube.quotaResetsAt,
        lastAPISync:     cronState.youtube.lastAPISync,
        nextAPISync:     cronState.youtube.nextAPISync,
        lastRSSSync:     cronState.youtube.lastRSSSync,
        nextRSSSync:     cronState.youtube.nextRSSSync,
      },
      webSub: {
        status:      cronState.websub.lastRenewal ? "active" : "not-subscribed",
        lastRenewal: cronState.websub.lastRenewal,
        nextRenewal: cronState.websub.nextRenewal,
        callbackUrl: cronState.websub.callbackUrl,
      },
      ai: {
        status:              "active",
        engine:              "local",
        externalApiRequired: false,
      },
      push: {
        status:            vapidConfigured ? "configured" : "unconfigured",
        vapidConfigured,
        activeSubscribers: pushSubscribers,
      },
      sse: {
        status:           "active",
        connectedClients: sseClients,
      },
      cron: {
        status: "running",
        jobs:   cronState.running,
      },
    },
    library: {
      totalSermons:        sermonStats.total,
      aiEnrichedSermons:   sermonStats.enriched,
      pendingEnrichment:   sermonStats.pending,
      enrichmentProgress:  sermonStats.total > 0
        ? Math.round((sermonStats.enriched / sermonStats.total) * 100)
        : 0,
    },
  };

  // Always HTTP 200 — prevents Render restart loops.
  //
  // Rationale: returning 503 when the DB is slow or cold causes Render to
  // restart the instance, which creates more connections to an already-
  // overloaded DB, making the problem worse.  The "status" field in the
  // payload tells operators exactly what is wrong.  A genuine process crash
  // (uncaughtException) already stops the server, which Render correctly
  // detects as a health failure and restarts — that path is preserved.
  res.status(200).json(payload);
}

router.get("/healthz", healthHandler);
router.get("/health",  healthHandler);

// ─── Ultra-light ping ─────────────────────────────────────────────────────────
// This route is ALSO mounted before all middleware in app.ts for maximum speed.
// Mounting it here too ensures it works when the router is used standalone.
router.get("/ping", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.status(200).type("text/plain").send("ok");
});
router.head("/ping", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.status(200).end();
});

// ─── Neon DB quota: dedicated admin endpoint ──────────────────────────────────
router.get(
  "/admin/neon-quota",
  requireAdminRole(["gallery", "sermon", "livestream"]),
  (_req: Request, res: Response) => {
    const q = getNeonQuotaStatus();
    let summary: string;
    if (q.status === "quota-exceeded") {
      const sinceDisplay = q.since ? new Date(q.since).toUTCString() : "unknown time";
      summary =
        `Neon database is currently rejecting queries (compute quota exceeded since ${sinceDisplay}). ` +
        `Upgrade the Neon plan or wait for the quota reset, then refresh this page.`;
    } else if (q.status === "healthy") {
      summary = "Neon database is responding normally.";
    } else {
      summary = "Neon quota status not yet known — first probe pending.";
    }
    res.json({ ...q, summary });
  },
);

// ─── Uptime history endpoint ──────────────────────────────────────────────────
router.get(
  "/admin/uptime",
  requireAdminRole(["gallery", "sermon", "livestream"]),
  async (req: Request, res: Response) => {
    const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
    try {
      const history = await getUptimeHistory(days);
      res.json({
        ...history,
        summary: history.uptimePercent >= 99.9
          ? "Excellent — no significant downtime recorded."
          : history.downtimeEvents.length === 0
            ? "No downtime events recorded in this window."
            : `${history.downtimeEvents.length} downtime event(s) detected — uptime ${history.uptimePercent}% over the last ${days} day(s).`,
      });
    } catch {
      res.status(500).json({ error: "Failed to load uptime history" });
    }
  },
);

export default router;

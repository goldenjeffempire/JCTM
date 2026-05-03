import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { getCronState } from "../lib/cron.js";
import { getSubscriberCount } from "../lib/push-manager.js";
import { sseBroadcaster } from "../lib/sse-broadcaster.js";
import { getNeonQuotaStatus } from "../lib/neon-quota-monitor.js";
import { requireAdminRole } from "../lib/adminAuth.js";
import { getUptimeHistory } from "../lib/uptime-monitor.js";
import net from "node:net";

const router: IRouter = Router();

// ─── Sub-system health checks ─────────────────────────────────────────────────

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

function checkRedis(url: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const parsed = new URL(url);
      const port = parseInt(parsed.port || "6379", 10);
      const host = parsed.hostname;
      const socket = net.createConnection({ host, port, timeout: 3000 });
      socket.once("connect", () => { socket.destroy(); resolve({ ok: true, latencyMs: Date.now() - start }); });
      socket.once("timeout", () => { socket.destroy(); resolve({ ok: false, latencyMs: Date.now() - start, error: "connection timed out" }); });
      socket.once("error", (err) => { resolve({ ok: false, latencyMs: Date.now() - start, error: err.message }); });
    } catch (err) {
      resolve({ ok: false, latencyMs: Date.now() - start, error: String(err) });
    }
  });
}

async function getSermonLibraryStats(): Promise<{
  total: number;
  enriched: number;
  pending: number;
}> {
  try {
    const result = await pool.query<{
      total: string;
      enriched: string;
    }>(
      `SELECT
        COUNT(*) AS total,
        COUNT(metadata_generated_at) AS enriched
       FROM sermon_data`
    );
    const total = parseInt(result.rows[0]?.total ?? "0", 10);
    const enriched = parseInt(result.rows[0]?.enriched ?? "0", 10);
    return { total, enriched, pending: total - enriched };
  } catch {
    return { total: 0, enriched: 0, pending: 0 };
  }
}

// ─── Full health handler ──────────────────────────────────────────────────────

async function healthHandler(_req: Request, res: Response) {
  const [db, redis, sermonStats, pushSubscribers] = await Promise.all([
    checkDatabase(),
    process.env.REDIS_URL
      ? checkRedis(process.env.REDIS_URL)
      : Promise.resolve(null),
    getSermonLibraryStats(),
    getSubscriberCount(),
  ]);

  const cronState = getCronState();
  const sseClients = sseBroadcaster.size();
  const neonQuota = getNeonQuotaStatus();
  const vapidConfigured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  const youtubeApiConfigured = !!process.env.YOUTUBE_API_KEY;
  const aiConfigured = !!process.env.OPENAI_API_KEY;

  const allOk =
    db.ok &&
    (redis === null || redis.ok) &&
    neonQuota.status !== "quota-exceeded";

  const payload = {
    status: allOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version ?? "1.0.0",
    services: {
      database: {
        status: db.ok ? "ok" : "error",
        latencyMs: db.latencyMs,
        ...(db.error && process.env.NODE_ENV !== "production" ? { error: db.error } : {}),
        neonQuota: {
          status: neonQuota.status,
          since: neonQuota.since,
          lastCheckAt: neonQuota.lastCheckAt,
          lastRecoveryAt: neonQuota.lastRecoveryAt,
          consecutiveQuotaErrors: neonQuota.consecutiveQuotaErrors,
          ...(neonQuota.lastErrorMessage &&
          process.env.NODE_ENV !== "production"
            ? { lastErrorMessage: neonQuota.lastErrorMessage }
            : {}),
        },
      },
      ...(redis !== null ? {
        redis: {
          status: redis.ok ? "ok" : "error",
          latencyMs: redis.latencyMs,
          ...(redis.error && process.env.NODE_ENV !== "production" ? { error: redis.error } : {}),
        },
      } : {}),
      youtube: {
        status: youtubeApiConfigured ? "configured" : "missing-key",
        apiSyncEnabled: youtubeApiConfigured,
        quotaPaused: cronState.youtube.quotaPaused,
        quotaResetsAt: cronState.youtube.quotaResetsAt,
        lastAPISync: cronState.youtube.lastAPISync,
        nextAPISync: cronState.youtube.nextAPISync,
        lastRSSSync: cronState.youtube.lastRSSSync,
        nextRSSSync: cronState.youtube.nextRSSSync,
      },
      webSub: {
        status: cronState.websub.lastRenewal ? "active" : "not-subscribed",
        lastRenewal: cronState.websub.lastRenewal,
        nextRenewal: cronState.websub.nextRenewal,
        callbackUrl: cronState.websub.callbackUrl,
      },
      ai: {
        status: aiConfigured ? "configured" : "missing-key",
        openaiEnabled: aiConfigured,
      },
      push: {
        status: vapidConfigured ? "configured" : "unconfigured",
        vapidConfigured,
        activeSubscribers: pushSubscribers,
      },
      sse: {
        status: "active",
        connectedClients: sseClients,
      },
      cron: {
        status: "running",
        jobs: cronState.running,
      },
    },
    library: {
      totalSermons: sermonStats.total,
      aiEnrichedSermons: sermonStats.enriched,
      pendingEnrichment: sermonStats.pending,
      enrichmentProgress: sermonStats.total > 0
        ? Math.round((sermonStats.enriched / sermonStats.total) * 100)
        : 0,
    },
  };

  res.status(allOk ? 200 : 503).json(payload);
}

router.get("/healthz", healthHandler);
router.get("/health", healthHandler);

// ─── Ultra-light ping ─────────────────────────────────────────────────────────
// Zero-allocation 200 OK for upstream keep-alive checkers (Render health probe,
// Cloudflare worker, UptimeRobot, etc.). Does NOT touch DB/Redis/cron — its job
// is purely to prove the Node event loop is responsive. Sub-millisecond response.
router.get("/ping", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.status(200).type("text/plain").send("ok");
});
router.head("/ping", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.status(200).end();
});

// ─── Neon DB quota: dedicated admin endpoint ──────────────────────────────────
// Visible only to authenticated admins (any role). Returns the latest watcher
// state plus a short, human-readable summary suitable for an admin dashboard.
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
    res.json({
      ...q,
      summary,
    });
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
    } catch (err) {
      res.status(500).json({ error: "Failed to load uptime history" });
    }
  },
);

export default router;

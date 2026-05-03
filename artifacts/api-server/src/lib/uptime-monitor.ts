/**
 * uptime-monitor.ts — Heartbeat writer and downtime-recovery detector.
 *
 * Strategy (deadman's switch):
 *   • The server writes a row to `server_heartbeats` every 60 seconds.
 *   • On every startup it reads the most recent heartbeat timestamp.
 *   • If the gap between that timestamp and now exceeds DOWNTIME_THRESHOLD_MS
 *     (3 minutes), it records a `server_downtime_events` row and sends an
 *     email alert to the configured admin address.
 *   • Old heartbeat rows (>7 days) are pruned on startup to prevent table bloat.
 */

import { pool } from "@workspace/db";
import { logger } from "./logger.js";
import { sendUptimeAlertEmail } from "./email-engine.js";

const HEARTBEAT_INTERVAL_MS  = 60_000;       // write every 60 s
const DOWNTIME_THRESHOLD_MS  = 3 * 60_000;   // gap >3 min == downtime
const HEARTBEAT_RETENTION_MS = 7 * 24 * 60 * 60_000; // keep 7 days

let heartbeatHandle: ReturnType<typeof setInterval> | null = null;

// ── Internal helpers ──────────────────────────────────────────────────────────

async function writeHeartbeat(): Promise<void> {
  await pool.query(`INSERT INTO server_heartbeats (beat_at) VALUES (now())`);
}

async function pruneOldHeartbeats(): Promise<void> {
  const cutoff = new Date(Date.now() - HEARTBEAT_RETENTION_MS).toISOString();
  const res = await pool.query(
    `DELETE FROM server_heartbeats WHERE beat_at < $1`,
    [cutoff],
  );
  if ((res.rowCount ?? 0) > 0) {
    logger.debug({ deleted: res.rowCount }, "Uptime monitor: pruned old heartbeat rows");
  }
}

function resolveAlertEmail(): string {
  if (process.env.UPTIME_ALERT_EMAIL) return process.env.UPTIME_ALERT_EMAIL;
  const smtpFrom = process.env.SMTP_FROM ?? "";
  const match = smtpFrom.match(/<([^>]+)>/);
  if (match) return match[1];
  if (process.env.SMTP_USER) return process.env.SMTP_USER;
  return "info@jctm.org.ng";
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run once at server startup. Checks the most recent heartbeat and, if the
 * gap indicates downtime, records the event and sends an alert email.
 */
export async function checkUptimeOnStartup(): Promise<void> {
  try {
    await pruneOldHeartbeats();

    const result = await pool.query<{ beat_at: string }>(
      `SELECT beat_at FROM server_heartbeats ORDER BY beat_at DESC LIMIT 1`,
    );

    const now = new Date();

    if (result.rows.length === 0) {
      logger.info("Uptime monitor: first boot — no previous heartbeat found");
      return;
    }

    const lastBeat = new Date(result.rows[0].beat_at);
    const gapMs    = now.getTime() - lastBeat.getTime();

    if (gapMs <= DOWNTIME_THRESHOLD_MS) {
      logger.info(
        { lastBeatAt: lastBeat.toISOString(), gapMs },
        "Uptime monitor: clean restart — no downtime gap detected",
      );
      return;
    }

    const gapMinutes = Math.round(gapMs / 60_000);
    logger.warn(
      { lastBeatAt: lastBeat.toISOString(), gapMs, gapMinutes },
      "Uptime monitor: downtime detected — server was unreachable",
    );

    const insertRes = await pool.query<{ id: number }>(
      `INSERT INTO server_downtime_events (started_at, recovered_at, downtime_ms, alert_sent)
       VALUES ($1, $2, $3, false)
       RETURNING id`,
      [lastBeat.toISOString(), now.toISOString(), gapMs],
    );
    const eventId = insertRes.rows[0]?.id;

    const alertEmail = resolveAlertEmail();
    const sent = await sendUptimeAlertEmail({
      to: alertEmail,
      lastSeenAt: lastBeat.toISOString(),
      recoveredAt: now.toISOString(),
      downtimeMs: gapMs,
    }).catch((err) => {
      logger.warn({ err }, "Uptime monitor: failed to send alert email");
      return false;
    });

    if (eventId && sent) {
      await pool.query(
        `UPDATE server_downtime_events SET alert_sent = true WHERE id = $1`,
        [eventId],
      );
    }
  } catch (err) {
    logger.warn({ err }, "Uptime monitor: startup check failed (non-fatal)");
  }
}

/**
 * Start the background heartbeat writer. Call after the DB is ready.
 * Idempotent — safe to call multiple times.
 */
export function startHeartbeat(log = logger): void {
  if (heartbeatHandle) return;

  writeHeartbeat().catch((err) =>
    log.debug({ err }, "Uptime monitor: initial heartbeat write failed"),
  );

  heartbeatHandle = setInterval(() => {
    writeHeartbeat().catch((err) =>
      log.debug({ err }, "Uptime monitor: heartbeat write failed"),
    );
  }, HEARTBEAT_INTERVAL_MS);

  heartbeatHandle.unref();
  log.info({ intervalMs: HEARTBEAT_INTERVAL_MS }, "Uptime heartbeat started — writing to DB every 60 s");
}

/** Stop the heartbeat writer (call during graceful shutdown). */
export function stopHeartbeat(): void {
  if (heartbeatHandle) {
    clearInterval(heartbeatHandle);
    heartbeatHandle = null;
  }
}

/** Return uptime history for the admin dashboard. */
export async function getUptimeHistory(limitDays = 7): Promise<{
  downtimeEvents: { id: number; started_at: string; recovered_at: string; downtime_ms: number; alert_sent: boolean }[];
  recentHeartbeats: { beat_at: string }[];
  uptimePercent: number;
  windowDays: number;
}> {
  const since = new Date(Date.now() - limitDays * 24 * 60 * 60_000).toISOString();

  const [eventsRes, beatsRes] = await Promise.all([
    pool.query<{ id: number; started_at: string; recovered_at: string; downtime_ms: string; alert_sent: boolean }>(
      `SELECT id, started_at, recovered_at, downtime_ms, alert_sent
       FROM server_downtime_events WHERE started_at >= $1 ORDER BY started_at DESC`,
      [since],
    ),
    pool.query<{ beat_at: string }>(
      `SELECT beat_at FROM server_heartbeats
       WHERE beat_at >= $1 ORDER BY beat_at DESC LIMIT 200`,
      [since],
    ),
  ]);

  const windowMs        = limitDays * 24 * 60 * 60_000;
  const totalDowntimeMs = eventsRes.rows.reduce((s, r) => s + Number(r.downtime_ms), 0);
  const uptimeFraction  = Math.max(0, (windowMs - totalDowntimeMs) / windowMs);

  return {
    downtimeEvents: eventsRes.rows.map((r) => ({
      id: r.id,
      started_at:   r.started_at,
      recovered_at: r.recovered_at,
      downtime_ms:  Number(r.downtime_ms),
      alert_sent:   r.alert_sent,
    })),
    recentHeartbeats: beatsRes.rows,
    uptimePercent: Math.round(uptimeFraction * 10_000) / 100,
    windowDays: limitDays,
  };
}

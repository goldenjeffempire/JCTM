/**
 * media-abuse-guard.ts — Automatic IP blocking for abusive download behaviour.
 *
 * Runs every 15 minutes. Any IP that exceeds the HIGH threshold (configurable
 * via env vars ABUSE_HIGH_1H / ABUSE_HIGH_24H, defaulting to 10/30) is
 * automatically inserted into blocked_ips with blocked_by = 'auto-guard' and
 * cannot obtain new download tokens until manually unblocked by an admin.
 *
 * Thresholds mirror the ones used in the admin media-audit display so the
 * colour-coded risk badges and auto-block decisions are always consistent.
 */

import { pool } from "@workspace/db";
import pino from "pino";

const logger = pino({ name: "media-abuse-guard" });

// ─── Configurable thresholds ─────────────────────────────────────────────────

export const GUARD_HIGH_1H  = Number(process.env.ABUSE_HIGH_1H)  || 10;
export const GUARD_HIGH_24H = Number(process.env.ABUSE_HIGH_24H) || 30;

const GUARD_INTERVAL_MS = 15 * 60_000; // poll every 15 minutes

// ─── State ───────────────────────────────────────────────────────────────────

let guardHandle: ReturnType<typeof setInterval> | null = null;

// Tracks auto-blocks fired in the current process run (for reporting).
let autoBlockedTotal = 0;
let lastTickAt: Date | null = null;
let lastTickBlocked = 0;

export function getGuardStats() {
  return {
    running:          guardHandle !== null,
    autoBlockedTotal,
    lastTickAt:       lastTickAt?.toISOString() ?? null,
    lastTickBlocked,
    thresholds: { per1h: GUARD_HIGH_1H, per24h: GUARD_HIGH_24H },
  };
}

// ─── Core scan ───────────────────────────────────────────────────────────────

export async function runAbuseGuardTick(): Promise<{ blocked: number; ips: string[] }> {
  lastTickAt = new Date();

  // Find IPs that exceeded HIGH thresholds, are not already blocked, and
  // whose downloads come from actual file-serve events (not just job creation).
  const { rows } = await pool.query<{ ip: string; dl1h: string; dl24h: string }>(
    `SELECT ip,
            COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '1 hour')  AS dl1h,
            COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '24 hours') AS dl24h
       FROM media_audit_log
      WHERE event = 'download_served'
        AND ip NOT IN (SELECT ip FROM blocked_ips)
        AND ip != ''
        AND ip != 'unknown'
      GROUP BY ip
     HAVING COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '1 hour')  >= $1
         OR COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '24 hours') >= $2`,
    [GUARD_HIGH_1H, GUARD_HIGH_24H],
  );

  if (rows.length === 0) {
    lastTickBlocked = 0;
    return { blocked: 0, ips: [] };
  }

  const newlyBlocked: string[] = [];

  for (const row of rows) {
    const dl1h  = Number(row.dl1h);
    const dl24h = Number(row.dl24h);
    const reason = dl1h >= GUARD_HIGH_1H
      ? `Auto-blocked: ${dl1h} downloads in 1 hour (limit ${GUARD_HIGH_1H}/h)`
      : `Auto-blocked: ${dl24h} downloads in 24 hours (limit ${GUARD_HIGH_24H}/24h)`;

    try {
      const { rowCount } = await pool.query(
        `INSERT INTO blocked_ips (ip, reason, blocked_by, created_at)
         VALUES ($1, $2, 'auto-guard', now())
         ON CONFLICT (ip) DO NOTHING`,
        [row.ip, reason],
      );
      if ((rowCount ?? 0) > 0) {
        newlyBlocked.push(row.ip);
      }
    } catch (err) {
      logger.warn({ err, ip: row.ip }, "Auto-block insert failed (non-fatal)");
    }
  }

  lastTickBlocked  = newlyBlocked.length;
  autoBlockedTotal += newlyBlocked.length;

  if (newlyBlocked.length > 0) {
    logger.warn(
      { count: newlyBlocked.length, ips: newlyBlocked, per1h: GUARD_HIGH_1H, per24h: GUARD_HIGH_24H },
      "Media abuse guard: auto-blocked IPs for exceeding download threshold",
    );
  }

  return { blocked: newlyBlocked.length, ips: newlyBlocked };
}

// ─── Scheduler lifecycle ──────────────────────────────────────────────────────

export function startMediaAbuseGuard(): void {
  if (guardHandle) return;

  // First scan 30 seconds after startup to catch pre-existing abuse.
  const startupTimer = setTimeout(async () => {
    try {
      const { blocked, ips } = await runAbuseGuardTick();
      if (blocked > 0) {
        logger.warn({ blocked, ips }, "Media abuse guard: startup scan auto-blocked IPs");
      } else {
        logger.info("Media abuse guard: startup scan clean — no IPs to auto-block");
      }
    } catch (err) {
      logger.warn({ err }, "Media abuse guard startup scan failed (non-fatal)");
    }
  }, 30_000);
  startupTimer.unref();

  guardHandle = setInterval(async () => {
    try {
      await runAbuseGuardTick();
    } catch (err) {
      logger.warn({ err }, "Media abuse guard tick failed (non-fatal)");
    }
  }, GUARD_INTERVAL_MS);
  guardHandle.unref();

  logger.info(
    { intervalMs: GUARD_INTERVAL_MS, per1h: GUARD_HIGH_1H, per24h: GUARD_HIGH_24H },
    "Media abuse guard started (15-min interval)",
  );
}

export function stopMediaAbuseGuard(): void {
  if (guardHandle) {
    clearInterval(guardHandle);
    guardHandle = null;
  }
}

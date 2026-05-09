/**
 * AI Sync Scheduler — JCTM TempleBots v5
 *
 * Autonomous continuous intelligence sync that keeps the RAG knowledge base
 * fresh without manual intervention. Runs entirely in the background and never
 * blocks any request or HTTP response.
 *
 * Schedule:
 *  - Full sync (sermons + doctrine + shorts + activity) every 4 hours
 *  - Activity-only sync (events, devotionals, testimonies) every 45 minutes
 *
 * Resilience:
 *  - Exponential backoff on consecutive failures (cap 30 min)
 *  - Health metrics accessible via getSyncHealth()
 *  - All errors are logged but never propagate
 */

import type { Logger } from "pino";
import { runFullContentSync, ingestActivityLearning } from "./knowledge-ingestion.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncHealth {
  status: "healthy" | "degraded" | "failing";
  lastFullSyncAt: Date | null;
  lastActivitySyncAt: Date | null;
  lastFullSyncSuccess: boolean | null;
  lastActivitySyncSuccess: boolean | null;
  consecutiveFullFailures: number;
  consecutiveActivityFailures: number;
  totalFullSyncs: number;
  totalActivitySyncs: number;
  nextFullSyncIn: number;   // ms until next full sync
  nextActivitySyncIn: number;
  uptimeMs: number;
}

// ─── State ────────────────────────────────────────────────────────────────────

const FULL_SYNC_INTERVAL_MS  = 4 * 60 * 60 * 1000;  // 4 hours
const ACTIVITY_SYNC_INTERVAL_MS = 45 * 60 * 1000;   // 45 minutes
const MAX_BACKOFF_MS = 30 * 60 * 1000;               // 30 minute cap on backoff

let fullSyncTimer: ReturnType<typeof setInterval> | null = null;
let activitySyncTimer: ReturnType<typeof setInterval> | null = null;
let startedAt: number | null = null;

const state = {
  lastFullSyncAt: null as Date | null,
  lastActivitySyncAt: null as Date | null,
  lastFullSyncSuccess: null as boolean | null,
  lastActivitySyncSuccess: null as boolean | null,
  consecutiveFullFailures: 0,
  consecutiveActivityFailures: 0,
  totalFullSyncs: 0,
  totalActivitySyncs: 0,
  nextFullSyncAt: 0,
  nextActivitySyncAt: 0,
  isFullSyncRunning: false,
  isActivitySyncRunning: false,
};

// ─── Full Sync Runner ─────────────────────────────────────────────────────────

async function runFullSync(logger: Logger): Promise<void> {
  if (state.isFullSyncRunning) {
    logger.debug("AI full sync already in progress — skipping");
    return;
  }
  state.isFullSyncRunning = true;
  const t0 = Date.now();
  try {
    logger.info("AI Sync Scheduler: starting full knowledge sync");
    await runFullContentSync(logger);
    state.lastFullSyncAt = new Date();
    state.lastFullSyncSuccess = true;
    state.consecutiveFullFailures = 0;
    state.totalFullSyncs++;
    logger.info({ durationMs: Date.now() - t0 }, "AI Sync Scheduler: full sync complete");
  } catch (err) {
    state.consecutiveFullFailures++;
    state.lastFullSyncSuccess = false;
    const backoffMs = Math.min(
      5_000 * Math.pow(2, state.consecutiveFullFailures - 1),
      MAX_BACKOFF_MS,
    );
    logger.warn(
      { err, consecutiveFailures: state.consecutiveFullFailures, backoffMs },
      "AI Sync Scheduler: full sync failed — will retry with backoff",
    );
  } finally {
    state.isFullSyncRunning = false;
  }
}

// ─── Activity Sync Runner ─────────────────────────────────────────────────────

async function runActivitySync(logger: Logger): Promise<void> {
  if (state.isActivitySyncRunning) {
    logger.debug("AI activity sync already in progress — skipping");
    return;
  }
  state.isActivitySyncRunning = true;
  const t0 = Date.now();
  try {
    await ingestActivityLearning(logger);
    state.lastActivitySyncAt = new Date();
    state.lastActivitySyncSuccess = true;
    state.consecutiveActivityFailures = 0;
    state.totalActivitySyncs++;
    logger.debug({ durationMs: Date.now() - t0 }, "AI Sync Scheduler: activity sync complete");
  } catch (err) {
    state.consecutiveActivityFailures++;
    state.lastActivitySyncSuccess = false;
    logger.warn({ err }, "AI Sync Scheduler: activity sync failed");
  } finally {
    state.isActivitySyncRunning = false;
  }
}

// ─── Scheduler Lifecycle ──────────────────────────────────────────────────────

export function startAISyncScheduler(logger: Logger): void {
  if (fullSyncTimer || activitySyncTimer) {
    logger.warn("AI Sync Scheduler already running — ignoring duplicate start");
    return;
  }

  startedAt = Date.now();
  logger.info(
    { fullSyncIntervalHours: 4, activitySyncIntervalMin: 45 },
    "AI Sync Scheduler: starting",
  );

  // Schedule recurring full sync every 4 hours
  state.nextFullSyncAt = Date.now() + FULL_SYNC_INTERVAL_MS;
  fullSyncTimer = setInterval(() => {
    state.nextFullSyncAt = Date.now() + FULL_SYNC_INTERVAL_MS;
    runFullSync(logger).catch(() => {});
  }, FULL_SYNC_INTERVAL_MS);
  fullSyncTimer.unref();

  // Schedule recurring activity sync every 45 minutes (staggered 5 min after start)
  const activityDelay = 5 * 60 * 1000;
  state.nextActivitySyncAt = Date.now() + activityDelay;
  setTimeout(() => {
    runActivitySync(logger).catch(() => {});
    state.nextActivitySyncAt = Date.now() + ACTIVITY_SYNC_INTERVAL_MS;
    activitySyncTimer = setInterval(() => {
      state.nextActivitySyncAt = Date.now() + ACTIVITY_SYNC_INTERVAL_MS;
      runActivitySync(logger).catch(() => {});
    }, ACTIVITY_SYNC_INTERVAL_MS);
    if (activitySyncTimer) activitySyncTimer.unref();
  }, activityDelay).unref();
}

export function stopAISyncScheduler(): void {
  if (fullSyncTimer)    { clearInterval(fullSyncTimer);    fullSyncTimer    = null; }
  if (activitySyncTimer){ clearInterval(activitySyncTimer); activitySyncTimer = null; }
}

// ─── Health Metrics ───────────────────────────────────────────────────────────

export function getSyncHealth(): SyncHealth {
  const now = Date.now();
  const isFullOk = state.consecutiveFullFailures === 0;
  const isActivityOk = state.consecutiveActivityFailures < 3;
  const status: SyncHealth["status"] =
    !isFullOk && state.consecutiveFullFailures >= 3 ? "failing" :
    (!isFullOk || !isActivityOk) ? "degraded" : "healthy";

  return {
    status,
    lastFullSyncAt: state.lastFullSyncAt,
    lastActivitySyncAt: state.lastActivitySyncAt,
    lastFullSyncSuccess: state.lastFullSyncSuccess,
    lastActivitySyncSuccess: state.lastActivitySyncSuccess,
    consecutiveFullFailures: state.consecutiveFullFailures,
    consecutiveActivityFailures: state.consecutiveActivityFailures,
    totalFullSyncs: state.totalFullSyncs,
    totalActivitySyncs: state.totalActivitySyncs,
    nextFullSyncIn: Math.max(0, state.nextFullSyncAt - now),
    nextActivitySyncIn: Math.max(0, state.nextActivitySyncAt - now),
    uptimeMs: startedAt ? now - startedAt : 0,
  };
}

// ─── Manual Trigger ───────────────────────────────────────────────────────────

export async function triggerFullSyncNow(logger: Logger): Promise<void> {
  return runFullSync(logger);
}

export async function triggerActivitySyncNow(logger: Logger): Promise<void> {
  return runActivitySync(logger);
}

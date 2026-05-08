/**
 * Content Sync Scheduler — Continuous AI Knowledge Sync
 *
 * Runs periodic background jobs that keep the TempleBots knowledge base
 * continuously updated with all platform content:
 *
 *   • Sermons          — every 30 min (after YouTube sync window)
 *   • Activity         — every 15 min (testimonies, prayer, blog, events)
 *   • Devotionals      — every 60 min (new daily devotion each midnight)
 *   • Live stream      — every 5  min (is it live right now?)
 *   • Conference data  — every 30 min (promotions + registrations)
 *   • Ministry Shorts  — every 60 min (new short videos indexed)
 *   • Ministry FAQs    — every 24 hr  (static, only re-ingests on version bump)
 *
 * All operations are idempotent — safe to run at any frequency.
 * Each job is independent; a failure in one does not block the others.
 */

import type { Logger } from "pino";
import {
  ingestAllSermons,
  ingestActivityLearning,
  ingestDailyDevotionals,
  ingestLiveStreamContext,
  ingestConferenceData,
  ingestMinistryShorts,
  ingestMinistryFAQs,
} from "./knowledge-ingestion.js";
import { logger as rootLogger } from "./logger.js";

// ─── Intervals ────────────────────────────────────────────────────────────────

const SERMON_SYNC_MS       = 30 * 60 * 1000;  // 30 min
const ACTIVITY_SYNC_MS     = 15 * 60 * 1000;  // 15 min
const DEVOTION_SYNC_MS     = 60 * 60 * 1000;  // 60 min
const LIVESTREAM_SYNC_MS   =  5 * 60 * 1000;  //  5 min
const CONFERENCE_SYNC_MS   = 30 * 60 * 1000;  // 30 min
const SHORTS_SYNC_MS       = 60 * 60 * 1000;  // 60 min
const FAQ_SYNC_MS          = 24 * 60 * 60 * 1000; // 24 hr

// ─── State ────────────────────────────────────────────────────────────────────

const handles: ReturnType<typeof setInterval>[] = [];

const syncStats: Record<string, { lastRun: Date | null; runs: number; errors: number }> = {
  sermons:      { lastRun: null, runs: 0, errors: 0 },
  activity:     { lastRun: null, runs: 0, errors: 0 },
  devotionals:  { lastRun: null, runs: 0, errors: 0 },
  livestream:   { lastRun: null, runs: 0, errors: 0 },
  conferences:  { lastRun: null, runs: 0, errors: 0 },
  shorts:       { lastRun: null, runs: 0, errors: 0 },
  faqs:         { lastRun: null, runs: 0, errors: 0 },
};

// ─── Runner helper ────────────────────────────────────────────────────────────

async function runSync(
  name: string,
  fn: (log: Logger) => Promise<void>,
  log: Logger,
): Promise<void> {
  const stat = syncStats[name]!;
  try {
    await fn(log);
    stat.runs++;
    stat.lastRun = new Date();
    log.debug({ job: name, runs: stat.runs }, "Content sync job complete");
  } catch (err) {
    stat.errors++;
    log.warn({ err, job: name, errors: stat.errors }, "Content sync job failed (non-fatal)");
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startContentSyncScheduler(log: Logger = rootLogger): void {
  if (handles.length > 0) {
    log.warn("Content sync scheduler already running — ignoring duplicate start");
    return;
  }

  log.info("Starting continuous AI content sync scheduler...");

  // ── Sermons (30 min) ─────────────────────────────────────────────────────
  const sermonHandle = setInterval(
    () => runSync("sermons", l => ingestAllSermons(l), log),
    SERMON_SYNC_MS,
  );
  sermonHandle.unref();
  handles.push(sermonHandle);

  // ── Activity (15 min) ────────────────────────────────────────────────────
  const activityHandle = setInterval(
    () => runSync("activity", l => ingestActivityLearning(l), log),
    ACTIVITY_SYNC_MS,
  );
  activityHandle.unref();
  handles.push(activityHandle);

  // ── Devotionals (60 min) ─────────────────────────────────────────────────
  const devotionHandle = setInterval(
    () => runSync("devotionals", l => ingestDailyDevotionals(l), log),
    DEVOTION_SYNC_MS,
  );
  devotionHandle.unref();
  handles.push(devotionHandle);

  // ── Live stream status (5 min) ───────────────────────────────────────────
  const livestreamHandle = setInterval(
    () => runSync("livestream", l => ingestLiveStreamContext(l), log),
    LIVESTREAM_SYNC_MS,
  );
  livestreamHandle.unref();
  handles.push(livestreamHandle);

  // ── Conference data (30 min) ─────────────────────────────────────────────
  const conferenceHandle = setInterval(
    () => runSync("conferences", l => ingestConferenceData(l), log),
    CONFERENCE_SYNC_MS,
  );
  conferenceHandle.unref();
  handles.push(conferenceHandle);

  // ── Ministry Shorts (60 min) ─────────────────────────────────────────────
  const shortsHandle = setInterval(
    () => runSync("shorts", l => ingestMinistryShorts(l), log),
    SHORTS_SYNC_MS,
  );
  shortsHandle.unref();
  handles.push(shortsHandle);

  // ── Ministry FAQs (24 hr, only re-ingests on version change) ────────────
  const faqHandle = setInterval(
    () => runSync("faqs", l => ingestMinistryFAQs(l), log),
    FAQ_SYNC_MS,
  );
  faqHandle.unref();
  handles.push(faqHandle);

  log.info(
    {
      jobs: Object.keys(syncStats).length,
      intervals: {
        sermons: `${SERMON_SYNC_MS / 60000}min`,
        activity: `${ACTIVITY_SYNC_MS / 60000}min`,
        devotionals: `${DEVOTION_SYNC_MS / 60000}min`,
        livestream: `${LIVESTREAM_SYNC_MS / 60000}min`,
        conferences: `${CONFERENCE_SYNC_MS / 60000}min`,
        shorts: `${SHORTS_SYNC_MS / 60000}min`,
        faqs: `${FAQ_SYNC_MS / 3600000}hr`,
      },
    },
    "AI content sync scheduler started — all content types will sync continuously",
  );
}

export function stopContentSyncScheduler(): void {
  for (const handle of handles) clearInterval(handle);
  handles.length = 0;
  rootLogger.info("AI content sync scheduler stopped");
}

export function getContentSyncStats(): typeof syncStats {
  return { ...syncStats };
}

/**
 * Media Pre-processor — JCTM Digital Sanctuary
 *
 * Background scheduler that pre-converts sermon content to MP3
 * so users get instant downloads instead of waiting 30–60 seconds.
 *
 * Strategy:
 *  • At startup (30-second delay):  scan all featured sermons, queue
 *    any that don't yet have a cached MP3 ready.
 *  • After each YouTube sync:       queue MP3 jobs for any newly synced
 *    sermons (featured first, then recent).
 *  • Every 6 hours:                 re-scan for featured sermons whose
 *    cached MP3 has expired (24-hour TTL).
 *
 * All jobs use "high" quality (256 kbps) for a good balance of speed
 * and audio fidelity — ultra quality would be overkill for caching.
 *
 * The scheduler is intentionally conservative: at most 3 background
 * pre-process jobs run concurrently so it doesn't crowd out user-
 * initiated conversions (which go into the same 5-slot queue).
 */

import pino from "pino";
import { pool } from "@workspace/db";
import { findDuplicateJob, createJob, isYtDlpAvailable } from "./media-processor.js";

const logger = pino({ name: "media-preprocess" });

// ─── Config ───────────────────────────────────────────────────────────────────

/** Max sermons to pre-process in a single sweep (avoids drowning the queue). */
const BATCH_SIZE = 3;

/** Rescan interval: 6 hours. */
const RESCAN_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Startup delay: wait 30 s after migrations complete so the DB is warm. */
const STARTUP_DELAY_MS = 30_000;

// ─── DB query helpers ─────────────────────────────────────────────────────────

interface SermonRow {
  video_id:      string;
  title:         string;
  thumbnail_url: string;
  duration:      string | null;
}

/**
 * Returns up to `limit` featured sermons that have no ready MP3 job cached.
 * Featured sermons are highest priority; remaining slots filled by most-recent.
 */
async function getFeaturedWithoutCache(limit: number): Promise<SermonRow[]> {
  try {
    // Featured sermons first, then fill with recent ones
    const { rows } = await pool.query<SermonRow>(
      `SELECT s.video_id, s.title, s.thumbnail_url, s.duration
       FROM sermons s
       WHERE s.is_featured = true
         AND (s.is_live IS NULL OR s.is_live = false)
         AND NOT EXISTS (
           SELECT 1 FROM media_download_jobs j
           WHERE j.source_id = s.video_id
             AND j.format    = 'mp3'
             AND j.quality   = 'high'
             AND j.status    = 'ready'
             AND j.expires_at > now()
         )
       ORDER BY s.published_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows;
  } catch (err) {
    logger.warn({ err }, "Failed to query featured sermons for pre-processing");
    return [];
  }
}

/**
 * Returns recently synced sermons (by video ID list) that have no cached MP3.
 */
async function getRecentWithoutCache(videoIds: string[], limit: number): Promise<SermonRow[]> {
  if (videoIds.length === 0) return [];
  try {
    const placeholders = videoIds.map((_, i) => `$${i + 2}`).join(", ");
    const { rows } = await pool.query<SermonRow>(
      `SELECT s.video_id, s.title, s.thumbnail_url, s.duration
       FROM sermons s
       WHERE s.video_id IN (${placeholders})
         AND (s.is_live IS NULL OR s.is_live = false)
         AND NOT EXISTS (
           SELECT 1 FROM media_download_jobs j
           WHERE j.source_id = s.video_id
             AND j.format    = 'mp3'
             AND j.quality   = 'high'
             AND (j.status   = 'ready' OR j.status = 'processing' OR j.status = 'queued')
             AND j.expires_at > now()
         )
       ORDER BY s.published_at DESC
       LIMIT $1`,
      [limit, ...videoIds],
    );
    return rows;
  } catch (err) {
    logger.warn({ err }, "Failed to query recent sermons for pre-processing");
    return [];
  }
}

// ─── Core pre-process logic ───────────────────────────────────────────────────

/**
 * Queue MP3 pre-processing jobs for the given sermon rows.
 * Skips any sermon that already has an active/ready job (deduplication).
 * Returns the number of new jobs created.
 */
async function queuePreprocessJobs(sermons: SermonRow[], source: string): Promise<number> {
  let created = 0;
  for (const sermon of sermons) {
    try {
      // Double-check deduplication via the processor's own cache check
      const existing = await findDuplicateJob({
        type:     "youtube_audio",
        sourceId: sermon.video_id,
        format:   "mp3",
        quality:  "high",
      });

      if (existing) {
        logger.debug(
          { videoId: sermon.video_id, existingJobId: existing.id, status: existing.status },
          "Pre-process: skipping — cached job exists",
        );
        continue;
      }

      await createJob({
        type:         "youtube_audio",
        sourceId:     sermon.video_id,
        format:       "mp3",
        quality:      "high",
        title:        sermon.title,
        thumbnailUrl: sermon.thumbnail_url,
        duration:     sermon.duration ? parseInt(sermon.duration, 10) || undefined : undefined,
      }, { background: true });

      created++;
      logger.debug({ videoId: sermon.video_id, title: sermon.title, source }, "Pre-process: job queued");

      // Small stagger between queues to avoid thundering herd at startup
      await new Promise(r => setTimeout(r, 150));
    } catch (err) {
      logger.warn({ err, videoId: sermon.video_id }, "Pre-process: failed to queue job");
    }
  }
  return created;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scan all featured sermons and queue MP3 jobs for any without a cached file.
 * Called on startup and every 6 hours.
 * No-ops silently when yt-dlp is not installed on this host.
 */
export async function preprocessFeaturedSermons(): Promise<void> {
  if (!isYtDlpAvailable()) {
    logger.debug("Pre-process sweep: yt-dlp not available on this host — skipping");
    return;
  }
  try {
    const sermons = await getFeaturedWithoutCache(BATCH_SIZE);
    if (sermons.length === 0) {
      logger.debug("Pre-process sweep: all featured sermons already cached");
      return;
    }
    const created = await queuePreprocessJobs(sermons, "scheduled-sweep");
    if (created > 0) {
      logger.info({ created, total: sermons.length }, "Pre-process sweep: queued MP3 jobs for featured sermons");
    }
  } catch (err) {
    logger.warn({ err }, "Pre-process sweep failed");
  }
}

/**
 * Queue MP3 jobs for specific video IDs (called after a YouTube sync).
 * Featured sermons within the list are prioritised.
 * No-ops silently when yt-dlp is not installed on this host.
 */
export async function preprocessNewSermons(videoIds: string[]): Promise<void> {
  if (videoIds.length === 0) return;
  if (!isYtDlpAvailable()) return;
  try {
    const sermons = await getRecentWithoutCache(videoIds, Math.min(videoIds.length, BATCH_SIZE));
    if (sermons.length === 0) return;
    const created = await queuePreprocessJobs(sermons, "post-sync");
    if (created > 0) {
      logger.info({ created, videoIds: videoIds.slice(0, 5) }, "Pre-process: queued jobs for newly synced sermons");
    }
  } catch (err) {
    logger.warn({ err }, "Post-sync pre-process failed");
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

let rescanTimer: ReturnType<typeof setInterval> | null = null;
let startupTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Start the background pre-processing scheduler.
 * - Fires a first sweep 30 seconds after startup.
 * - Repeats every 6 hours to catch expiring cached files.
 */
export function startPreprocessScheduler(): void {
  if (rescanTimer) return; // idempotent

  // Delayed startup sweep — don't compete with migrations and seeding
  startupTimer = setTimeout(async () => {
    logger.info("Starting initial featured-sermon MP3 pre-processing sweep");
    await preprocessFeaturedSermons();
  }, STARTUP_DELAY_MS);

  // Periodic re-scan (unref so it doesn't prevent clean shutdown)
  rescanTimer = setInterval(async () => {
    logger.debug("Periodic MP3 pre-process sweep starting");
    await preprocessFeaturedSermons();
  }, RESCAN_INTERVAL_MS);
  rescanTimer.unref();
}

/**
 * Stop the scheduler (called during graceful shutdown).
 */
export function stopPreprocessScheduler(): void {
  if (startupTimer) { clearTimeout(startupTimer); startupTimer = null; }
  if (rescanTimer)  { clearInterval(rescanTimer);  rescanTimer  = null; }
}

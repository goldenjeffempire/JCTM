/**
 * event-notification-queue.ts — Persistent FIFO work queue for the
 * event-notification system.
 *
 * The 30-min scheduler enqueues one row per (event × bucket × channel) using
 * `enqueueJobs(...)`. The dedicated worker (`event-notification-worker.ts`)
 * polls every few seconds, claims a batch via `claimNextBatch(...)`, performs
 * the actual dispatch, and then either:
 *
 *   • `markCompleted(...)`  — terminal success, status = 'completed'
 *   • `scheduleRetry(...)`  — increment attempts, set scheduled_at = now + backoff
 *   • `moveToDeadLetter(...)` — when attempts >= max_attempts
 *
 * Backoff schedule (seconds): 30, 120, 600, 1800, 7200 (capped).
 *
 * Idempotency: the unique (event_id, bucket_key, channel) constraint means
 * `enqueueJobs` is safe to call repeatedly for the same slot — duplicates
 * are silently swallowed by ON CONFLICT DO NOTHING.
 */

import { pool } from "@workspace/db";
import type { Logger } from "pino";

export const QUEUE_MAX_ATTEMPTS = 5;
export const RETRY_BACKOFF_SECONDS = [30, 120, 600, 1800, 7200] as const;

export type QueueChannel = "push" | "email" | "sse";
export type QueueKind = "milestone" | "pulse" | "live_pulse";
export type QueueStatus = "pending" | "processing" | "completed" | "dead";

export interface EnqueueJob {
  eventId: number;
  eventTitle: string;
  bucketKey: string;
  milestoneHours: number;
  channel: QueueChannel;
  kind: QueueKind;
  leadLabel: string;
  /** Defaults to now(). Use to schedule a future fire (rare). */
  scheduledAt?: Date;
}

export interface QueueRow {
  id: number;
  eventId: number;
  eventTitle: string;
  bucketKey: string;
  milestoneHours: number;
  channel: QueueChannel;
  kind: QueueKind;
  leadLabel: string;
  status: QueueStatus;
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date;
  claimedAt: Date | null;
  completedAt: Date | null;
  lastError: string | null;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  createdAt: Date;
}

export interface DeadLetterRow {
  id: number;
  queueId: number | null;
  eventId: number;
  eventTitle: string;
  bucketKey: string;
  milestoneHours: number;
  channel: QueueChannel;
  kind: QueueKind;
  leadLabel: string;
  attempts: number;
  lastError: string | null;
  firstFailedAt: Date | null;
  movedAt: Date;
  resolvedAt: Date | null;
  resolution: string | null;
}

interface RawQueueRow {
  id: string | number;
  event_id: number;
  event_title: string;
  bucket_key: string;
  milestone_hours: number;
  channel: string;
  kind: string;
  lead_label: string;
  status: string;
  attempts: number;
  max_attempts: number;
  scheduled_at: Date;
  claimed_at: Date | null;
  completed_at: Date | null;
  last_error: string | null;
  recipient_count: number;
  success_count: number;
  failure_count: number;
  created_at: Date;
}

interface RawDlqRow {
  id: string | number;
  queue_id: string | number | null;
  event_id: number;
  event_title: string;
  bucket_key: string;
  milestone_hours: number;
  channel: string;
  kind: string;
  lead_label: string;
  attempts: number;
  last_error: string | null;
  first_failed_at: Date | null;
  moved_at: Date;
  resolved_at: Date | null;
  resolution: string | null;
}

function toQueueRow(r: RawQueueRow): QueueRow {
  return {
    id: Number(r.id),
    eventId: r.event_id,
    eventTitle: r.event_title,
    bucketKey: r.bucket_key,
    milestoneHours: r.milestone_hours,
    channel: r.channel as QueueChannel,
    kind: r.kind as QueueKind,
    leadLabel: r.lead_label,
    status: r.status as QueueStatus,
    attempts: r.attempts,
    maxAttempts: r.max_attempts,
    scheduledAt: r.scheduled_at,
    claimedAt: r.claimed_at,
    completedAt: r.completed_at,
    lastError: r.last_error,
    recipientCount: r.recipient_count,
    successCount: r.success_count,
    failureCount: r.failure_count,
    createdAt: r.created_at,
  };
}

function toDlqRow(r: RawDlqRow): DeadLetterRow {
  return {
    id: Number(r.id),
    queueId: r.queue_id == null ? null : Number(r.queue_id),
    eventId: r.event_id,
    eventTitle: r.event_title,
    bucketKey: r.bucket_key,
    milestoneHours: r.milestone_hours,
    channel: r.channel as QueueChannel,
    kind: r.kind as QueueKind,
    leadLabel: r.lead_label,
    attempts: r.attempts,
    lastError: r.last_error,
    firstFailedAt: r.first_failed_at,
    movedAt: r.moved_at,
    resolvedAt: r.resolved_at,
    resolution: r.resolution,
  };
}

// ─── Enqueue ────────────────────────────────────────────────────────────────

/**
 * Bulk-insert queue rows. Duplicates (same event_id + bucket_key + channel)
 * are silently dropped via ON CONFLICT DO NOTHING — this is the dedup lock
 * that survives process restarts.
 *
 * Returns the number of rows actually inserted (excludes duplicates).
 */
export async function enqueueJobs(
  jobs: EnqueueJob[],
  log?: Logger,
): Promise<number> {
  if (jobs.length === 0) return 0;
  const now = new Date();
  let inserted = 0;
  for (const job of jobs) {
    try {
      const result = await pool.query<{ id: string | number }>(
        `INSERT INTO event_notification_queue
           (event_id, event_title, bucket_key, milestone_hours, channel,
            kind, lead_label, status, scheduled_at, max_attempts)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
         ON CONFLICT (event_id, bucket_key, channel) DO NOTHING
         RETURNING id`,
        [
          job.eventId,
          job.eventTitle,
          job.bucketKey,
          job.milestoneHours,
          job.channel,
          job.kind,
          job.leadLabel,
          job.scheduledAt ?? now,
          QUEUE_MAX_ATTEMPTS,
        ],
      );
      if (result.rows.length > 0) inserted += 1;
    } catch (err) {
      log?.warn(
        { err, eventId: job.eventId, bucketKey: job.bucketKey, channel: job.channel },
        "Queue enqueue failed for single job",
      );
    }
  }
  return inserted;
}

// ─── Re-enqueue (admin / DLQ requeue) ───────────────────────────────────────

/**
 * Force a single (event, bucket, channel) back into a pending state, even if
 * the queue row was completed or dead. Resets attempts to 0 so the worker
 * gets a clean retry budget. Used by the admin "Retry" button and by DLQ
 * requeue.
 */
export async function resetJobToPending(
  eventId: number,
  bucketKey: string,
  channel: QueueChannel,
  payload: {
    eventTitle: string;
    milestoneHours: number;
    kind: QueueKind;
    leadLabel: string;
  },
  log?: Logger,
): Promise<QueueRow | null> {
  try {
    const upsert = await pool.query<RawQueueRow>(
      `INSERT INTO event_notification_queue
         (event_id, event_title, bucket_key, milestone_hours, channel,
          kind, lead_label, status, scheduled_at, max_attempts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', now(), $8)
       ON CONFLICT (event_id, bucket_key, channel) DO UPDATE
         SET status = 'pending',
             attempts = 0,
             scheduled_at = now(),
             claimed_at = NULL,
             completed_at = NULL,
             last_error = NULL,
             event_title = EXCLUDED.event_title,
             milestone_hours = EXCLUDED.milestone_hours,
             kind = EXCLUDED.kind,
             lead_label = EXCLUDED.lead_label,
             max_attempts = GREATEST(event_notification_queue.max_attempts, EXCLUDED.max_attempts)
       RETURNING *`,
      [
        eventId,
        payload.eventTitle,
        bucketKey,
        payload.milestoneHours,
        channel,
        payload.kind,
        payload.leadLabel,
        QUEUE_MAX_ATTEMPTS,
      ],
    );
    return upsert.rows[0] ? toQueueRow(upsert.rows[0]) : null;
  } catch (err) {
    log?.warn(
      { err, eventId, bucketKey, channel },
      "Queue reset-to-pending failed",
    );
    return null;
  }
}

// ─── Claim a batch ──────────────────────────────────────────────────────────

/**
 * Atomically claim up to `limit` pending jobs whose scheduled_at <= now().
 * Uses FOR UPDATE SKIP LOCKED so multiple worker instances (or a single
 * worker reentering before the previous tick finished) never claim the same
 * row twice.
 *
 * Sets status = 'processing' and stamps claimed_at + increments attempts.
 */
export async function claimNextBatch(
  limit: number,
  log?: Logger,
): Promise<QueueRow[]> {
  const safeLimit = Math.max(1, Math.min(100, limit));
  try {
    const result = await pool.query<RawQueueRow>(
      `WITH claimed AS (
         SELECT id
         FROM event_notification_queue
         WHERE status = 'pending'
           AND scheduled_at <= now()
         ORDER BY scheduled_at ASC, id ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       UPDATE event_notification_queue q
       SET status = 'processing',
           claimed_at = now(),
           attempts = q.attempts + 1
       FROM claimed
       WHERE q.id = claimed.id
       RETURNING q.*`,
      [safeLimit],
    );
    return result.rows.map(toQueueRow);
  } catch (err) {
    log?.error({ err }, "Queue claimNextBatch failed");
    return [];
  }
}

// ─── Mark results ───────────────────────────────────────────────────────────

export interface DispatchResult {
  recipients: number;
  sent: number;
  failed: number;
  error?: string | null;
}

export async function markCompleted(
  jobId: number,
  result: DispatchResult,
  log?: Logger,
): Promise<void> {
  try {
    await pool.query(
      `UPDATE event_notification_queue
         SET status = 'completed',
             completed_at = now(),
             recipient_count = $2,
             success_count = $3,
             failure_count = $4,
             last_error = $5
       WHERE id = $1`,
      [jobId, result.recipients, result.sent, result.failed, result.error ?? null],
    );
  } catch (err) {
    log?.warn({ err, jobId }, "Queue markCompleted failed");
  }
}

export async function scheduleRetry(
  job: QueueRow,
  errorMessage: string,
  partial: { recipients: number; sent: number; failed: number },
  log?: Logger,
): Promise<{ retried: boolean; nextAttemptAt: Date | null }> {
  const nextAttemptIdx = job.attempts; // attempts has just been incremented at claim time, so 0-indexed lookup matches
  const backoffSec =
    RETRY_BACKOFF_SECONDS[Math.min(nextAttemptIdx, RETRY_BACKOFF_SECONDS.length - 1)];
  const nextAt = new Date(Date.now() + backoffSec * 1000);
  try {
    await pool.query(
      `UPDATE event_notification_queue
         SET status = 'pending',
             scheduled_at = $2,
             last_error = $3,
             recipient_count = $4,
             success_count = $5,
             failure_count = $6
       WHERE id = $1`,
      [job.id, nextAt, errorMessage.slice(0, 1000), partial.recipients, partial.sent, partial.failed],
    );
    return { retried: true, nextAttemptAt: nextAt };
  } catch (err) {
    log?.warn({ err, jobId: job.id }, "Queue scheduleRetry failed");
    return { retried: false, nextAttemptAt: null };
  }
}

export async function moveToDeadLetter(
  job: QueueRow,
  errorMessage: string,
  partial: { recipients: number; sent: number; failed: number },
  log?: Logger,
): Promise<DeadLetterRow | null> {
  try {
    const insert = await pool.query<RawDlqRow>(
      `INSERT INTO event_notification_dead_letter
         (queue_id, event_id, event_title, bucket_key, milestone_hours,
          channel, kind, lead_label, attempts, last_error, first_failed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        job.id,
        job.eventId,
        job.eventTitle,
        job.bucketKey,
        job.milestoneHours,
        job.channel,
        job.kind,
        job.leadLabel,
        job.attempts,
        errorMessage.slice(0, 2000),
        job.claimedAt ?? job.createdAt,
      ],
    );

    await pool.query(
      `UPDATE event_notification_queue
         SET status = 'dead',
             last_error = $2,
             recipient_count = $3,
             success_count = $4,
             failure_count = $5,
             completed_at = now()
       WHERE id = $1`,
      [job.id, errorMessage.slice(0, 1000), partial.recipients, partial.sent, partial.failed],
    );

    return insert.rows[0] ? toDlqRow(insert.rows[0]) : null;
  } catch (err) {
    log?.error({ err, jobId: job.id }, "Queue moveToDeadLetter failed");
    return null;
  }
}

// ─── Stats / inspection ─────────────────────────────────────────────────────

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  dead: number;
  oldestPendingAt: string | null;
  nextScheduledAt: string | null;
  deadLetterUnresolved: number;
  successRate: number; // 0..1, computed over completed + dead in last 24h
}

export async function getQueueStats(): Promise<QueueStats> {
  try {
    const [counts, dlqCount, slo] = await Promise.all([
      pool.query<{ status: string; n: string; oldest: Date | null; next: Date | null }>(
        `SELECT status,
                count(*)::text AS n,
                min(claimed_at) AS oldest,
                min(scheduled_at) FILTER (WHERE status = 'pending') AS next
         FROM event_notification_queue
         GROUP BY status`,
      ),
      pool.query<{ n: string }>(
        `SELECT count(*)::text AS n
         FROM event_notification_dead_letter
         WHERE resolved_at IS NULL`,
      ),
      pool.query<{ ok: string; total: string }>(
        `SELECT
           count(*) FILTER (WHERE status = 'completed' AND success_count > 0)::text AS ok,
           count(*) FILTER (WHERE status IN ('completed', 'dead'))::text AS total
         FROM event_notification_queue
         WHERE created_at > now() - interval '24 hours'`,
      ),
    ]);

    let pending = 0;
    let processing = 0;
    let completed = 0;
    let dead = 0;
    let oldestPending: Date | null = null;
    let nextScheduled: Date | null = null;
    for (const row of counts.rows) {
      const n = parseInt(row.n, 10);
      if (row.status === "pending") {
        pending = n;
        nextScheduled = row.next ?? null;
      } else if (row.status === "processing") {
        processing = n;
        oldestPending = row.oldest ?? null;
      } else if (row.status === "completed") completed = n;
      else if (row.status === "dead") dead = n;
    }

    const ok = parseInt(slo.rows[0]?.ok ?? "0", 10);
    const total = parseInt(slo.rows[0]?.total ?? "0", 10);
    const successRate = total > 0 ? ok / total : 1;

    return {
      pending,
      processing,
      completed,
      dead,
      oldestPendingAt: oldestPending ? oldestPending.toISOString() : null,
      nextScheduledAt: nextScheduled ? nextScheduled.toISOString() : null,
      deadLetterUnresolved: parseInt(dlqCount.rows[0]?.n ?? "0", 10),
      successRate,
    };
  } catch {
    return {
      pending: 0,
      processing: 0,
      completed: 0,
      dead: 0,
      oldestPendingAt: null,
      nextScheduledAt: null,
      deadLetterUnresolved: 0,
      successRate: 1,
    };
  }
}

export async function listQueueRows(
  status: QueueStatus | "all",
  limit = 50,
): Promise<QueueRow[]> {
  const safeLimit = Math.max(1, Math.min(200, limit));
  try {
    const result =
      status === "all"
        ? await pool.query<RawQueueRow>(
            `SELECT * FROM event_notification_queue
             ORDER BY scheduled_at DESC NULLS LAST, id DESC
             LIMIT $1`,
            [safeLimit],
          )
        : await pool.query<RawQueueRow>(
            `SELECT * FROM event_notification_queue
             WHERE status = $1
             ORDER BY scheduled_at ASC, id ASC
             LIMIT $2`,
            [status, safeLimit],
          );
    return result.rows.map(toQueueRow);
  } catch {
    return [];
  }
}

export async function listDeadLetter(
  unresolvedOnly = true,
  limit = 50,
): Promise<DeadLetterRow[]> {
  const safeLimit = Math.max(1, Math.min(200, limit));
  try {
    const result = unresolvedOnly
      ? await pool.query<RawDlqRow>(
          `SELECT * FROM event_notification_dead_letter
           WHERE resolved_at IS NULL
           ORDER BY moved_at DESC
           LIMIT $1`,
          [safeLimit],
        )
      : await pool.query<RawDlqRow>(
          `SELECT * FROM event_notification_dead_letter
           ORDER BY moved_at DESC
           LIMIT $1`,
          [safeLimit],
        );
    return result.rows.map(toDlqRow);
  } catch {
    return [];
  }
}

export async function getDeadLetterRow(id: number): Promise<DeadLetterRow | null> {
  try {
    const result = await pool.query<RawDlqRow>(
      `SELECT * FROM event_notification_dead_letter WHERE id = $1 LIMIT 1`,
      [id],
    );
    return result.rows[0] ? toDlqRow(result.rows[0]) : null;
  } catch {
    return null;
  }
}

export async function markDeadLetterResolved(
  id: number,
  resolution: "requeued" | "discarded",
): Promise<DeadLetterRow | null> {
  try {
    const result = await pool.query<RawDlqRow>(
      `UPDATE event_notification_dead_letter
         SET resolved_at = now(), resolution = $2
       WHERE id = $1 AND resolved_at IS NULL
       RETURNING *`,
      [id, resolution],
    );
    return result.rows[0] ? toDlqRow(result.rows[0]) : null;
  } catch {
    return null;
  }
}

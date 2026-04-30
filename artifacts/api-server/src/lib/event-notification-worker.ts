/**
 * event-notification-worker.ts — Background drainer for the event-notification
 * queue.
 *
 * Polls `event_notification_queue` every WORKER_POLL_MS, claims a batch of
 * pending jobs (atomic via FOR UPDATE SKIP LOCKED), executes each job via
 * the scheduler's `executeQueuedJob`, and then either:
 *
 *   • marks completed (success — including "all recipients failed once"),
 *   • schedules an exponential-backoff retry,
 *   • or moves the job to the dead-letter queue once max_attempts is reached.
 *
 * The worker is single-instance per process. It guards against overlap with
 * an in-memory `inFlight` flag so a slow batch doesn't queue up duplicates.
 */

import type { Logger } from "pino";
import { logger } from "./logger.js";
import { sseBroadcaster } from "./sse-broadcaster.js";
import { executeQueuedJob } from "./event-notification-scheduler.js";
import {
  claimNextBatch,
  markCompleted,
  scheduleRetry,
  moveToDeadLetter,
  QUEUE_MAX_ATTEMPTS,
  type QueueRow,
} from "./event-notification-queue.js";

const WORKER_POLL_MS = 10_000; // 10 seconds
const WORKER_BATCH_SIZE = 20;

interface WorkerState {
  isRunning: boolean;
  inFlight: boolean;
  startedAt: string | null;
  lastTickAt: string | null;
  lastTickClaimed: number;
  lastTickCompleted: number;
  lastTickRetried: number;
  lastTickDeadLettered: number;
  totalProcessed: number;
  totalCompleted: number;
  totalRetried: number;
  totalDeadLettered: number;
  pollIntervalMs: number;
}

const state: WorkerState = {
  isRunning: false,
  inFlight: false,
  startedAt: null,
  lastTickAt: null,
  lastTickClaimed: 0,
  lastTickCompleted: 0,
  lastTickRetried: 0,
  lastTickDeadLettered: 0,
  totalProcessed: 0,
  totalCompleted: 0,
  totalRetried: 0,
  totalDeadLettered: 0,
  pollIntervalMs: WORKER_POLL_MS,
};

let pollHandle: ReturnType<typeof setInterval> | null = null;

export function getEventNotificationWorkerState(): WorkerState {
  return { ...state };
}

export async function processQueueOnce(
  log: Logger = logger,
  batchSize: number = WORKER_BATCH_SIZE,
): Promise<{ claimed: number; completed: number; retried: number; deadLettered: number }> {
  if (state.inFlight) {
    log.debug("Worker tick already in flight — skipping");
    return { claimed: 0, completed: 0, retried: 0, deadLettered: 0 };
  }
  state.inFlight = true;

  let completed = 0;
  let retried = 0;
  let deadLettered = 0;

  try {
    const claimed = await claimNextBatch(batchSize, log);
    if (claimed.length === 0) {
      state.lastTickAt = new Date().toISOString();
      state.lastTickClaimed = 0;
      state.lastTickCompleted = 0;
      state.lastTickRetried = 0;
      state.lastTickDeadLettered = 0;
      return { claimed: 0, completed: 0, retried: 0, deadLettered: 0 };
    }

    log.info(
      { count: claimed.length, batchSize },
      "Event notification worker — claimed batch",
    );

    for (const job of claimed) {
      try {
        const result = await processSingle(job, log);
        if (result === "completed") completed += 1;
        else if (result === "retried") retried += 1;
        else if (result === "dead_lettered") deadLettered += 1;
      } catch (err) {
        // Defensive — processSingle should never throw, but if it does we
        // still need to terminally fail the row so it doesn't stick in
        // 'processing' forever.
        log.error(
          { err, jobId: job.id, eventId: job.eventId, channel: job.channel },
          "Worker processSingle threw — moving to DLQ",
        );
        const msg = err instanceof Error ? err.message : String(err);
        await moveToDeadLetter(job, `worker exception: ${msg}`, { recipients: 0, sent: 0, failed: 0 }, log);
        deadLettered += 1;
      }
    }

    state.totalProcessed += claimed.length;
    state.totalCompleted += completed;
    state.totalRetried += retried;
    state.totalDeadLettered += deadLettered;
    state.lastTickAt = new Date().toISOString();
    state.lastTickClaimed = claimed.length;
    state.lastTickCompleted = completed;
    state.lastTickRetried = retried;
    state.lastTickDeadLettered = deadLettered;

    sseBroadcaster.broadcast({
      type: "event_notification_worker_tick",
      data: {
        at: state.lastTickAt,
        claimed: claimed.length,
        completed,
        retried,
        deadLettered,
      },
    });

    return { claimed: claimed.length, completed, retried, deadLettered };
  } finally {
    state.inFlight = false;
  }
}

async function processSingle(
  job: QueueRow,
  log: Logger,
): Promise<"completed" | "retried" | "dead_lettered"> {
  const result = await executeQueuedJob(job, log);

  // Skipped (no subscribers / event deleted) is a terminal success — nothing
  // to retry.
  if (result.status === "skipped" || result.status === "sent") {
    await markCompleted(
      job.id,
      {
        recipients: result.recipients,
        sent: result.sent,
        failed: result.failed,
        error: result.error ?? null,
      },
      log,
    );
    return "completed";
  }

  // status === 'failed' — either retry or DLQ
  if (job.attempts >= QUEUE_MAX_ATTEMPTS) {
    log.warn(
      { jobId: job.id, eventId: job.eventId, channel: job.channel, attempts: job.attempts, error: result.error },
      "Queue job exhausted attempts — moving to dead-letter queue",
    );
    await moveToDeadLetter(
      job,
      result.error ?? "Unknown failure",
      { recipients: result.recipients, sent: result.sent, failed: result.failed },
      log,
    );
    return "dead_lettered";
  }

  const retry = await scheduleRetry(
    job,
    result.error ?? "Unknown failure",
    { recipients: result.recipients, sent: result.sent, failed: result.failed },
    log,
  );
  log.info(
    {
      jobId: job.id,
      eventId: job.eventId,
      channel: job.channel,
      attempts: job.attempts,
      nextAttemptAt: retry.nextAttemptAt?.toISOString() ?? null,
      error: result.error,
    },
    "Queue job failed — scheduled retry",
  );
  return "retried";
}

export function startEventNotificationWorker(log: Logger = logger): void {
  if (state.isRunning) {
    log.info("Event notification worker already running");
    return;
  }
  state.isRunning = true;
  state.startedAt = new Date().toISOString();
  state.pollIntervalMs = WORKER_POLL_MS;

  // Fire one tick immediately so jobs enqueued at startup don't wait the
  // full poll interval.
  processQueueOnce(log).catch((err) =>
    log.warn({ err }, "Event notification worker initial tick failed"),
  );

  pollHandle = setInterval(
    () =>
      processQueueOnce(log).catch((err) =>
        log.warn({ err }, "Event notification worker tick failed"),
      ),
    WORKER_POLL_MS,
  );
  pollHandle.unref();
  log.info(
    { pollIntervalMs: WORKER_POLL_MS, batchSize: WORKER_BATCH_SIZE, maxAttempts: QUEUE_MAX_ATTEMPTS },
    "Event notification worker started",
  );
}

export function stopEventNotificationWorker(): void {
  if (pollHandle) clearInterval(pollHandle);
  pollHandle = null;
  state.isRunning = false;
}

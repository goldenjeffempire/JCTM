/**
 * event-notification-scheduler.ts — Multi-channel reminder scheduler for
 * upcoming and live events in `event_calendar`.
 *
 * Runs every 30 minutes (registered from cron.ts). The scheduler's only job
 * is to ENQUEUE work into `event_notification_queue` — actual dispatch is
 * done asynchronously by the worker (`event-notification-worker.ts`), which
 * polls the queue every few seconds, performs the dispatch, retries with
 * exponential backoff, and moves terminal failures to the dead-letter queue.
 *
 * Three firing modes per event (configurable in the admin panel):
 *   1) MILESTONES — discrete lead-time fires at e.g. [24, 6, 1] hours
 *      before start. Default is the global DEFAULT_MILESTONES_HOURS, but each
 *      event row can override via `event_calendar.notification_milestones`.
 *   2) PULSE — every N minutes during the last M hours before start
 *      (`notification_pulse_minutes` + `notification_pulse_window_hours`).
 *      Slots are snapped to a UTC grid so a restart never re-fires the same slot.
 *   3) LIVE PULSE — every 30 minutes between event.start_date and
 *      (end_date or start + 6h). Sends "join the live event" reminders for
 *      events currently in progress.
 *
 * Idempotency:
 *   The queue table has a unique index on (event_id, bucket_key, channel).
 *   Calling enqueueJobs() repeatedly for the same slot is a no-op. The
 *   dispatch_log mirrors the queue's terminal state for audit/admin views.
 *
 * Pause / disable:
 *   Skip events where `notification_enabled = false` OR
 *   `notification_paused_until > now`.
 */

import { and, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import {
  db,
  pool,
  eventsTable,
  eventNotificationSubscribersTable,
  eventNotificationDispatchLogTable,
  type Event,
  type EventNotificationDispatchLog,
} from "@workspace/db";
import type { Logger } from "pino";
import { logger } from "./logger.js";
import {
  dispatchPushNotification,
  type NotificationPayload,
} from "./push-manager.js";
import { sendEventNotificationEmail, getPublicBaseUrl } from "./email-engine.js";
import { sseBroadcaster } from "./sse-broadcaster.js";
import {
  enqueueJobs,
  resetJobToPending,
  type EnqueueJob,
  type QueueChannel,
  type QueueKind,
  type QueueRow,
} from "./event-notification-queue.js";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
}

// ─── Configuration ───────────────────────────────────────────────────────────

export const DEFAULT_MILESTONES_HOURS = [24, 6, 1] as const;
export const MAX_ATTEMPTS = 3;
const CATCHUP_HOURS = 1;
const SCAN_HORIZON_HOURS = 25; // a hair over the largest milestone
const PULSE_SCAN_HORIZON_HOURS = 24 * 14; // pulses can be configured up to 14d out
const EMAIL_BATCH_SIZE = 50;

// Live-pulse tuning: while an event is currently happening, fire one push
// every LIVE_PULSE_MINUTES minutes. Without an end_date we assume an event
// runs for at most LIVE_PULSE_DEFAULT_DURATION_HOURS hours.
const LIVE_PULSE_MINUTES = 30;
const LIVE_PULSE_DEFAULT_DURATION_HOURS = 6;

// Backwards-compat alias (unchanged surface for other modules).
export const MILESTONES_HOURS = DEFAULT_MILESTONES_HOURS;

export type EventNotificationChannel = QueueChannel;
const CHANNELS: EventNotificationChannel[] = ["push", "email", "sse"];

// ─── Tick state (exposed to admin) ───────────────────────────────────────────

interface TickState {
  lastTickStartedAt: string | null;
  lastTickFinishedAt: string | null;
  lastTickResult: {
    eventsScanned: number;
    targetsFound: number;
    jobsEnqueued: number;
    durationMs: number;
  } | null;
  isRunning: boolean;
  intervalMs: number;
}

const state: TickState = {
  lastTickStartedAt: null,
  lastTickFinishedAt: null,
  lastTickResult: null,
  isRunning: false,
  intervalMs: 30 * 60 * 1000,
};

export function getEventNotificationState(): TickState {
  return { ...state };
}
export function setEventNotificationIntervalMs(ms: number): void {
  state.intervalMs = ms;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function effectiveMilestones(event: Event): number[] {
  const raw = event.notificationMilestones;
  if (Array.isArray(raw) && raw.length > 0) {
    return [...raw].filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => b - a);
  }
  return [...DEFAULT_MILESTONES_HOURS];
}

function isEventEnabled(event: Event, now: Date): boolean {
  if (event.notificationEnabled === false) return false;
  if (event.notificationPausedUntil && event.notificationPausedUntil.getTime() > now.getTime()) {
    return false;
  }
  return true;
}

function humaniseLeadTime(hoursBefore: number, minutesBefore?: number): string {
  if (minutesBefore !== undefined && minutesBefore < 60) {
    if (minutesBefore <= 5) return "starting any moment now";
    return `in about ${minutesBefore} minutes`;
  }
  if (hoursBefore <= 1) return "in about 1 hour";
  if (hoursBefore < 24) return `in ${hoursBefore} hours`;
  if (hoursBefore === 24) return "tomorrow";
  const days = Math.round(hoursBefore / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

function buildPushPayload(
  event: Event,
  lead: string,
  bucketKey: string,
  kind: QueueKind,
): NotificationPayload {
  const base = getPublicBaseUrl();
  const url = event.youtubeUrl || `${base}/events#event-${event.id}`;
  const title =
    kind === "live_pulse"
      ? `🔴 ${event.title} — happening now`
      : `⏰ ${event.title} — starts ${lead}`;
  const body =
    kind === "live_pulse"
      ? event.location
        ? `${event.location} · Tap to join the live broadcast.`
        : "Tap to join the live broadcast."
      : event.location
        ? `${event.location} · Tap for details and to set a reminder.`
        : "Tap for details and to set a reminder.";
  return {
    title,
    body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    url,
    tag: `event-notif-${event.id}-${bucketKey}`,
    data: {
      type: kind === "live_pulse" ? "event_live" : "event_notification",
      eventId: event.id,
      bucketKey,
      kind,
      timestamp: new Date().toISOString(),
    },
  };
}

async function dispatchExpoForEvent(
  event: Event,
  lead: string,
  bucketKey: string,
  kind: QueueKind,
  log: Logger,
): Promise<{ sent: number; failed: number; deactivated: number }> {
  let sent = 0;
  let failed = 0;
  let deactivated = 0;
  try {
    const result = await pool.query<{ token: string }>(
      `SELECT token FROM expo_push_tokens WHERE is_active = true ORDER BY created_at DESC LIMIT 1000`,
    );
    if (result.rows.length === 0) return { sent: 0, failed: 0, deactivated: 0 };

    const title =
      kind === "live_pulse"
        ? `🔴 ${event.title} — happening now`
        : `⏰ ${event.title} — starts ${lead}`;
    const body =
      kind === "live_pulse"
        ? event.location
          ? `${event.location} · Tap to join the live broadcast.`
          : "Tap to join the live broadcast."
        : event.location
          ? `${event.location} · Tap for details and to set a reminder.`
          : "Tap for details and to set a reminder.";

    const CHUNK = 100;
    for (let i = 0; i < result.rows.length; i += CHUNK) {
      const chunk = result.rows.slice(i, i + CHUNK);
      const tokens = chunk.map((c) => c.token);
      const messages: ExpoPushMessage[] = tokens.map((token) => ({
        to: token,
        title,
        body,
        data: { type: kind === "live_pulse" ? "event_live" : "event_notification", eventId: event.id, bucketKey, kind },
        sound: "default",
        priority: "high",
      }));
      try {
        const res = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Encoding": "gzip, deflate",
          },
          body: JSON.stringify(messages),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            data?: Array<{ status: string; details?: { error?: string } }>;
          };
          const tokensToDeactivate: string[] = [];
          json.data?.forEach((t, idx) => {
            if (t.status === "ok") {
              sent++;
            } else if (t.details?.error === "DeviceNotRegistered") {
              tokensToDeactivate.push(tokens[idx]);
              deactivated++;
            } else {
              failed++;
              log.warn(
                { eventId: event.id, bucketKey, expoError: t.details?.error ?? t.status },
                "Expo push individual message failed",
              );
            }
          });
          if (tokensToDeactivate.length > 0) {
            try {
              await pool.query(
                `UPDATE expo_push_tokens SET is_active = false, updated_at = now() WHERE token = ANY($1)`,
                [tokensToDeactivate],
              );
              log.info(
                { count: tokensToDeactivate.length, eventId: event.id },
                "Deactivated unregistered Expo tokens",
              );
            } catch (err) {
              log.warn({ err }, "Failed to deactivate unregistered Expo tokens");
            }
          }
        } else {
          const text = await res.text().catch(() => "");
          failed += chunk.length;
          log.warn(
            { eventId: event.id, bucketKey, status: res.status, body: text.slice(0, 200) },
            "Expo push chunk HTTP error",
          );
        }
      } catch (err) {
        log.warn({ err, eventId: event.id, bucketKey }, "Expo push chunk failed");
        failed += chunk.length;
      }
    }
  } catch (err) {
    log.warn({ err, eventId: event.id }, "Expo push lookup failed");
    throw err;
  }
  return { sent, failed, deactivated };
}

// ─── Dispatch log helpers ────────────────────────────────────────────────────

async function findLogRowByBucket(
  eventId: number,
  bucketKey: string,
  channel: EventNotificationChannel,
): Promise<EventNotificationDispatchLog | null> {
  const rows = await db
    .select()
    .from(eventNotificationDispatchLogTable)
    .where(
      and(
        eq(eventNotificationDispatchLogTable.eventId, eventId),
        eq(eventNotificationDispatchLogTable.bucketKey, bucketKey),
        eq(eventNotificationDispatchLogTable.channel, channel),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Upsert a dispatch_log row with the result of a worker dispatch. The unique
 * index on (event_id, bucket_key, channel) acts as the dedup key — calling
 * this multiple times for the same slot just updates the existing row.
 */
async function recordDispatchResult(
  job: QueueRow,
  result: {
    status: "sent" | "failed" | "skipped";
    recipients: number;
    sent: number;
    failed: number;
    error?: string | null;
  },
): Promise<EventNotificationDispatchLog | null> {
  const now = new Date();
  const inserted = await db
    .insert(eventNotificationDispatchLogTable)
    .values({
      eventId: job.eventId,
      eventTitle: job.eventTitle,
      milestoneHours: job.milestoneHours,
      bucketKey: job.bucketKey,
      channel: job.channel,
      status: result.status,
      attempts: job.attempts,
      firstAttemptAt: now,
      lastAttemptAt: now,
      completedAt: result.status === "sent" || result.status === "skipped" ? now : null,
      recipientCount: result.recipients,
      successCount: result.sent,
      failureCount: result.failed,
      lastError: result.error ?? null,
    })
    .onConflictDoNothing({
      target: [
        eventNotificationDispatchLogTable.eventId,
        eventNotificationDispatchLogTable.bucketKey,
        eventNotificationDispatchLogTable.channel,
      ],
    })
    .returning();

  if (inserted[0]) return inserted[0];

  const updated = await db
    .update(eventNotificationDispatchLogTable)
    .set({
      status: result.status,
      attempts: job.attempts,
      recipientCount: result.recipients,
      successCount: result.sent,
      failureCount: result.failed,
      lastError: result.error ?? null,
      lastAttemptAt: now,
      completedAt: result.status === "sent" || result.status === "skipped" ? now : null,
    })
    .where(
      and(
        eq(eventNotificationDispatchLogTable.eventId, job.eventId),
        eq(eventNotificationDispatchLogTable.bucketKey, job.bucketKey),
        eq(eventNotificationDispatchLogTable.channel, job.channel),
      ),
    )
    .returning();
  return updated[0] ?? null;
}

function emitDispatchSse(row: EventNotificationDispatchLog): void {
  sseBroadcaster.broadcast({
    type: "event_notification_dispatched",
    data: {
      logId: row.id,
      eventId: row.eventId,
      eventTitle: row.eventTitle,
      milestoneHours: row.milestoneHours,
      channel: row.channel as EventNotificationChannel,
      status: row.status as "pending" | "sent" | "failed" | "skipped",
      attempts: row.attempts,
      successCount: row.successCount,
      failureCount: row.failureCount,
      recipientCount: row.recipientCount,
      lastError: row.lastError,
      at: new Date().toISOString(),
    },
  });
}

// ─── Per-channel dispatchers (called by worker) ──────────────────────────────

async function dispatchPushChannel(
  event: Event,
  job: QueueRow,
  log: Logger,
): Promise<{ status: "sent" | "failed"; sent: number; failed: number; recipients: number; error?: string }> {
  try {
    const webPayload = buildPushPayload(event, job.leadLabel, job.bucketKey, job.kind);
    const [webResult, expoResult] = await Promise.all([
      dispatchPushNotification(
        webPayload,
        log,
        job.kind === "live_pulse" ? "event_live" : "event_notification",
      ),
      dispatchExpoForEvent(event, job.leadLabel, job.bucketKey, job.kind, log),
    ]);
    const sent = webResult.sent + expoResult.sent;
    const failed = webResult.failed + expoResult.failed;
    const deactivated = webResult.deactivated + expoResult.deactivated;
    const recipients = sent + failed + deactivated;
    if (recipients === 0) {
      // No subscribers at all — treat as sent (nothing to do).
      return { status: "sent", sent: 0, failed: 0, recipients: 0 };
    }
    if (sent === 0 && failed > 0) {
      return { status: "failed", sent, failed, recipients, error: "All push recipients failed" };
    }
    return { status: "sent", sent, failed, recipients };
  } catch (err) {
    return {
      status: "failed",
      sent: 0,
      failed: 0,
      recipients: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function dispatchEmailChannel(
  event: Event,
  job: QueueRow,
  log: Logger,
): Promise<{ status: "sent" | "failed" | "skipped"; sent: number; failed: number; recipients: number; error?: string }> {
  try {
    const subscribers = await db
      .select({
        id: eventNotificationSubscribersTable.id,
        email: eventNotificationSubscribersTable.email,
        unsubscribeToken: eventNotificationSubscribersTable.unsubscribeToken,
        timezone: eventNotificationSubscribersTable.timezone,
      })
      .from(eventNotificationSubscribersTable)
      .where(eq(eventNotificationSubscribersTable.isActive, true));

    if (subscribers.length === 0) {
      return { status: "skipped", sent: 0, failed: 0, recipients: 0 };
    }

    const base = getPublicBaseUrl();
    const eventForEmail = {
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      imageUrl: event.imageUrl,
      youtubeUrl: event.youtubeUrl,
      eventType: event.eventType,
    };

    let sent = 0;
    let failed = 0;
    for (let i = 0; i < subscribers.length; i += EMAIL_BATCH_SIZE) {
      const batch = subscribers.slice(i, i + EMAIL_BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (s) => {
          const unsubscribeUrl = `${base}/api/event-notifications/unsubscribe?token=${encodeURIComponent(s.unsubscribeToken)}`;
          const ok = await sendEventNotificationEmail(
            s.email,
            eventForEmail,
            job.milestoneHours,
            unsubscribeUrl,
            log,
            { timezone: s.timezone, leadLabel: job.leadLabel, isPulse: job.kind !== "milestone" },
          );
          return { ok, id: s.id };
        }),
      );
      const okIds: number[] = [];
      for (const r of results) {
        if (r.ok) {
          sent++;
          okIds.push(r.id);
        } else failed++;
      }
      if (okIds.length > 0) {
        await db
          .update(eventNotificationSubscribersTable)
          .set({ lastNotifiedAt: new Date() })
          .where(inArray(eventNotificationSubscribersTable.id, okIds));
      }
    }

    if (sent === 0 && failed > 0) {
      return { status: "failed", sent, failed, recipients: subscribers.length, error: "All email recipients failed" };
    }
    return { status: "sent", sent, failed, recipients: subscribers.length };
  } catch (err) {
    return {
      status: "failed",
      sent: 0,
      failed: 0,
      recipients: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function dispatchSseChannel(): { status: "sent"; sent: number; failed: number; recipients: number } {
  const recipients = sseBroadcaster.size();
  return { status: "sent", sent: recipients, failed: 0, recipients };
}

/**
 * Execute a single queued dispatch job. Called by the worker after it claims
 * a row from event_notification_queue. Returns the dispatch outcome AND
 * mirrors the result into event_notification_dispatch_log + emits SSE.
 *
 * The worker decides queue-row state (completed | retry | dead) based on the
 * returned `status`.
 */
export async function executeQueuedJob(
  job: QueueRow,
  log: Logger = logger,
): Promise<{ status: "sent" | "failed" | "skipped"; sent: number; failed: number; recipients: number; error?: string | null }> {
  // Look up the underlying event so we have the latest title, location, etc.
  const eventRows = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, job.eventId))
    .limit(1);
  const event = eventRows[0];
  if (!event) {
    log.warn({ jobId: job.id, eventId: job.eventId }, "Queued job for deleted event — skipping");
    const row = await recordDispatchResult(job, {
      status: "skipped",
      recipients: 0,
      sent: 0,
      failed: 0,
      error: "Event no longer exists",
    });
    if (row) emitDispatchSse(row);
    return { status: "skipped", sent: 0, failed: 0, recipients: 0, error: "Event no longer exists" };
  }

  if (!isEventEnabled(event, new Date())) {
    log.info(
      { jobId: job.id, eventId: event.id, bucketKey: job.bucketKey, channel: job.channel },
      "Notifications disabled/paused for event — skipping queued job",
    );
    const row = await recordDispatchResult(job, {
      status: "skipped",
      recipients: 0,
      sent: 0,
      failed: 0,
      error: "Notifications disabled or paused",
    });
    if (row) emitDispatchSse(row);
    return { status: "skipped", sent: 0, failed: 0, recipients: 0, error: "Notifications disabled or paused" };
  }

  let result: { status: "sent" | "failed" | "skipped"; sent: number; failed: number; recipients: number; error?: string };
  try {
    if (job.channel === "push") result = await dispatchPushChannel(event, job, log);
    else if (job.channel === "email") result = await dispatchEmailChannel(event, job, log);
    else result = dispatchSseChannel();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(
      { err, jobId: job.id, eventId: event.id, bucketKey: job.bucketKey, channel: job.channel },
      "Queued dispatch threw uncaught exception",
    );
    result = { status: "failed", sent: 0, failed: 0, recipients: 0, error: msg };
  }

  const row = await recordDispatchResult(job, {
    status: result.status,
    recipients: result.recipients,
    sent: result.sent,
    failed: result.failed,
    error: "error" in result ? (result.error ?? null) : null,
  });
  if (row) emitDispatchSse(row);

  log.info(
    {
      jobId: job.id,
      eventId: event.id,
      bucketKey: job.bucketKey,
      kind: job.kind,
      channel: job.channel,
      status: result.status,
      sent: result.sent,
      failed: result.failed,
      recipients: result.recipients,
      attempts: job.attempts,
      error: "error" in result ? result.error : null,
    },
    "Queued event notification dispatch result",
  );

  return {
    status: result.status,
    sent: result.sent,
    failed: result.failed,
    recipients: result.recipients,
    error: "error" in result ? (result.error ?? null) : null,
  };
}

// ─── Target generation (milestones + pulses + live pulses) ───────────────────

interface DispatchTarget {
  bucketKey: string;
  milestoneHours: number; // informational; 0 for pulses
  leadLabel: string;
  kind: "milestone" | "pulse" | "live_pulse";
}

function findDueTargets(event: Event, now: Date): DispatchTarget[] {
  const targets: DispatchTarget[] = [];
  const startMs = event.startDate.getTime();
  const nowMs = now.getTime();

  // ── Pre-start: milestones + pulse ──────────────────────────────────────────
  if (startMs > nowMs) {
    const milestones = effectiveMilestones(event);
    const catchupMs = CATCHUP_HOURS * 60 * 60 * 1000;
    for (const m of milestones) {
      const milestoneAtMs = startMs - m * 60 * 60 * 1000;
      if (nowMs >= milestoneAtMs - 60_000 && nowMs <= milestoneAtMs + catchupMs) {
        targets.push({
          bucketKey: `milestone_${m}h`,
          milestoneHours: m,
          leadLabel: humaniseLeadTime(m),
          kind: "milestone",
        });
      }
    }

    const pulseMin = event.notificationPulseMinutes ?? null;
    const pulseWindowH = event.notificationPulseWindowHours ?? null;
    if (pulseMin && pulseMin > 0 && pulseWindowH && pulseWindowH > 0) {
      const pulseMs = pulseMin * 60 * 1000;
      const windowStartMs = startMs - pulseWindowH * 60 * 60 * 1000;
      const slotMs = Math.floor(nowMs / pulseMs) * pulseMs;
      if (slotMs >= windowStartMs && slotMs < startMs) {
        const slotIso = new Date(slotMs).toISOString();
        const minutesUntilStart = Math.max(1, Math.round((startMs - slotMs) / 60_000));
        const hoursUntilStart = Math.max(1, Math.round((startMs - slotMs) / (60 * 60 * 1000)));
        targets.push({
          bucketKey: `pulse_${slotIso}`,
          milestoneHours: 0,
          leadLabel: humaniseLeadTime(hoursUntilStart, minutesUntilStart),
          kind: "pulse",
        });
      }
    }
  }

  // ── In-progress: live pulse every LIVE_PULSE_MINUTES minutes ──────────────
  const endMs = event.endDate
    ? event.endDate.getTime()
    : startMs + LIVE_PULSE_DEFAULT_DURATION_HOURS * 60 * 60 * 1000;
  if (nowMs >= startMs && nowMs < endMs) {
    const livePulseMs = LIVE_PULSE_MINUTES * 60 * 1000;
    const slotMs = Math.floor(nowMs / livePulseMs) * livePulseMs;
    // Only fire if we're inside the active window for this slot
    if (slotMs >= startMs - 60_000 && slotMs < endMs) {
      const slotIso = new Date(slotMs).toISOString();
      targets.push({
        bucketKey: `live_${slotIso}`,
        milestoneHours: 0,
        leadLabel: "happening now",
        kind: "live_pulse",
      });
    }
  }

  return targets;
}

// ─── Tick orchestration (enqueue-only) ──────────────────────────────────────

export async function runEventNotificationTick(
  log: Logger = logger,
): Promise<{
  eventsScanned: number;
  targetsFound: number;
  jobsEnqueued: number;
  durationMs: number;
}> {
  if (state.isRunning) {
    log.info("Event notification tick already running — skipping overlap");
    return {
      eventsScanned: 0,
      targetsFound: 0,
      jobsEnqueued: 0,
      durationMs: 0,
    };
  }

  state.isRunning = true;
  const startedAt = new Date();
  state.lastTickStartedAt = startedAt.toISOString();
  const t0 = Date.now();

  let eventsScanned = 0;
  let targetsFound = 0;
  let jobsEnqueued = 0;

  try {
    const horizonAt = new Date(
      startedAt.getTime() + Math.max(SCAN_HORIZON_HOURS, PULSE_SCAN_HORIZON_HOURS) * 60 * 60 * 1000,
    );
    const liveCutoff = new Date(
      startedAt.getTime() - LIVE_PULSE_DEFAULT_DURATION_HOURS * 60 * 60 * 1000,
    );
    // Scan upcoming AND in-progress events. "In progress" = start_date in the
    // last LIVE_PULSE_DEFAULT_DURATION_HOURS hours OR end_date > now.
    const events = await db
      .select()
      .from(eventsTable)
      .where(
        and(
          gt(eventsTable.startDate, liveCutoff),
          lte(eventsTable.startDate, horizonAt),
        ),
      );
    eventsScanned = events.length;

    const allJobs: EnqueueJob[] = [];
    for (const event of events) {
      if (!isEventEnabled(event, startedAt)) continue;
      const targets = findDueTargets(event, startedAt);
      targetsFound += targets.length;
      for (const target of targets) {
        for (const channel of CHANNELS) {
          allJobs.push({
            eventId: event.id,
            eventTitle: event.title,
            bucketKey: target.bucketKey,
            milestoneHours: target.milestoneHours,
            channel,
            kind: target.kind,
            leadLabel: target.leadLabel,
          });
        }
      }
    }

    jobsEnqueued = await enqueueJobs(allJobs, log);

    log.info(
      { eventsScanned, targetsFound, jobsEnqueued, jobsConsidered: allJobs.length },
      "Event notification tick — enqueued",
    );
  } catch (err) {
    log.error({ err }, "Event notification tick failed");
  } finally {
    const finishedAt = new Date();
    const durationMs = Date.now() - t0;
    state.lastTickFinishedAt = finishedAt.toISOString();
    state.lastTickResult = {
      eventsScanned,
      targetsFound,
      jobsEnqueued,
      durationMs,
    };
    state.isRunning = false;

    sseBroadcaster.broadcast({
      type: "event_notification_tick",
      data: {
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        eventsScanned,
        dispatchesAttempted: jobsEnqueued,
        dispatchesSucceeded: 0,
      },
    });
  }

  return state.lastTickResult!;
}

// ─── Admin actions ───────────────────────────────────────────────────────────

/**
 * Force a retry of a single dispatch_log row by re-enqueuing it (bypasses
 * the queue's max_attempts gate). Called by the admin "Retry" button.
 */
export async function retryDispatchLogRow(
  rowId: number,
  log: Logger = logger,
): Promise<EventNotificationDispatchLog | null> {
  const rows = await db
    .select()
    .from(eventNotificationDispatchLogTable)
    .where(eq(eventNotificationDispatchLogTable.id, rowId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const eventRows = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, row.eventId))
    .limit(1);
  const event = eventRows[0];
  if (!event) {
    log.warn({ rowId, eventId: row.eventId }, "Cannot retry — event no longer exists");
    return null;
  }

  const isPulse = row.bucketKey.startsWith("pulse_");
  const isLive = row.bucketKey.startsWith("live_");
  const kind: QueueKind = isLive ? "live_pulse" : isPulse ? "pulse" : "milestone";
  const leadLabel = isLive
    ? "happening now"
    : isPulse
      ? "very soon"
      : humaniseLeadTime(row.milestoneHours || 1);

  await resetJobToPending(
    row.eventId,
    row.bucketKey,
    row.channel as QueueChannel,
    {
      eventTitle: event.title,
      milestoneHours: row.milestoneHours,
      kind,
      leadLabel,
    },
    log,
  );

  // Mark the dispatch log back to pending so the admin sees the retry state.
  const now = new Date();
  await db
    .update(eventNotificationDispatchLogTable)
    .set({ status: "pending", lastAttemptAt: now })
    .where(eq(eventNotificationDispatchLogTable.id, row.id));

  return findLogRowByBucket(row.eventId, row.bucketKey, row.channel as EventNotificationChannel);
}

/** Recent dispatch log for the admin panel. */
export async function getRecentDispatchLog(limit = 50): Promise<EventNotificationDispatchLog[]> {
  return db
    .select()
    .from(eventNotificationDispatchLogTable)
    .orderBy(desc(eventNotificationDispatchLogTable.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}

/** Upcoming events with their milestone status, for admin dashboard. */
export async function getUpcomingWithMilestoneStatus(): Promise<
  Array<{
    event: Event;
    config: {
      enabled: boolean;
      paused: boolean;
      pausedUntil: string | null;
      milestonesHours: number[];
      pulseMinutes: number | null;
      pulseWindowHours: number | null;
    };
    milestones: Array<{
      hours: number;
      dueAt: string;
      isPast: boolean;
      channels: Record<
        EventNotificationChannel,
        Pick<EventNotificationDispatchLog, "id" | "status" | "attempts" | "successCount" | "failureCount" | "lastError"> | null
      >;
    }>;
    pulse: {
      lastSlotIso: string | null;
      lastChannelStatus: Record<EventNotificationChannel, EventNotificationDispatchLog | null>;
      totalPulseRows: number;
      sentPulseRows: number;
    };
  }>
> {
  const now = new Date();
  const horizonAt = new Date(now.getTime() + PULSE_SCAN_HORIZON_HOURS * 60 * 60 * 1000);
  const events = await db
    .select()
    .from(eventsTable)
    .where(and(gt(eventsTable.startDate, now), lte(eventsTable.startDate, horizonAt)));

  if (events.length === 0) return [];

  const eventIds = events.map((e) => e.id);
  const logRows = await db
    .select()
    .from(eventNotificationDispatchLogTable)
    .where(inArray(eventNotificationDispatchLogTable.eventId, eventIds));

  const milestoneMap = new Map<string, EventNotificationDispatchLog>();
  const pulseRowsByEvent = new Map<number, EventNotificationDispatchLog[]>();
  for (const r of logRows) {
    if (r.bucketKey.startsWith("pulse_") || r.bucketKey.startsWith("live_")) {
      const arr = pulseRowsByEvent.get(r.eventId) ?? [];
      arr.push(r);
      pulseRowsByEvent.set(r.eventId, arr);
    } else {
      milestoneMap.set(`${r.eventId}-${r.bucketKey}-${r.channel}`, r);
    }
  }

  return events
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .map((event) => {
      const milestonesH = effectiveMilestones(event);
      const milestones = milestonesH.map((hours) => {
        const dueAt = new Date(event.startDate.getTime() - hours * 60 * 60 * 1000);
        const channels = {} as Record<
          EventNotificationChannel,
          Pick<EventNotificationDispatchLog, "id" | "status" | "attempts" | "successCount" | "failureCount" | "lastError"> | null
        >;
        const bucket = `milestone_${hours}h`;
        for (const ch of CHANNELS) {
          const r = milestoneMap.get(`${event.id}-${bucket}-${ch}`);
          channels[ch] = r
            ? {
                id: r.id,
                status: r.status,
                attempts: r.attempts,
                successCount: r.successCount,
                failureCount: r.failureCount,
                lastError: r.lastError,
              }
            : null;
        }
        return { hours, dueAt: dueAt.toISOString(), isPast: dueAt.getTime() <= now.getTime(), channels };
      });

      const pulseRows = pulseRowsByEvent.get(event.id) ?? [];
      pulseRows.sort((a, b) => (a.bucketKey > b.bucketKey ? -1 : 1));
      const lastByChannel: Record<EventNotificationChannel, EventNotificationDispatchLog | null> = {
        push: null,
        email: null,
        sse: null,
      };
      let lastSlot: string | null = null;
      for (const r of pulseRows) {
        const ch = r.channel as EventNotificationChannel;
        if (!lastByChannel[ch]) lastByChannel[ch] = r;
        if (!lastSlot) lastSlot = r.bucketKey.replace(/^pulse_|^live_/, "");
      }

      return {
        event,
        config: {
          enabled: event.notificationEnabled !== false,
          paused: Boolean(
            event.notificationPausedUntil &&
              event.notificationPausedUntil.getTime() > now.getTime(),
          ),
          pausedUntil: event.notificationPausedUntil
            ? event.notificationPausedUntil.toISOString()
            : null,
          milestonesHours: milestonesH,
          pulseMinutes: event.notificationPulseMinutes ?? null,
          pulseWindowHours: event.notificationPulseWindowHours ?? null,
        },
        milestones,
        pulse: {
          lastSlotIso: lastSlot,
          lastChannelStatus: lastByChannel,
          totalPulseRows: pulseRows.length,
          sentPulseRows: pulseRows.filter((r) => r.status === "sent").length,
        },
      };
    });
}

/** Aggregate stats for the admin dashboard. */
export async function getDispatchStats(): Promise<{
  total: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  totalRecipients: number;
  totalSuccessSends: number;
  totalFailureSends: number;
  activeSubscribers: number;
  successRate: number;
}> {
  const [statsRow] = await db
    .select({
      total: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) filter (where status = 'sent')::int`,
      failed: sql<number>`count(*) filter (where status = 'failed')::int`,
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      skipped: sql<number>`count(*) filter (where status = 'skipped')::int`,
      totalRecipients: sql<number>`coalesce(sum(recipient_count), 0)::int`,
      totalSuccessSends: sql<number>`coalesce(sum(success_count), 0)::int`,
      totalFailureSends: sql<number>`coalesce(sum(failure_count), 0)::int`,
    })
    .from(eventNotificationDispatchLogTable);

  const [subsRow] = await db
    .select({ activeSubscribers: sql<number>`count(*)::int` })
    .from(eventNotificationSubscribersTable)
    .where(eq(eventNotificationSubscribersTable.isActive, true));

  const total = statsRow?.total ?? 0;
  const sent = statsRow?.sent ?? 0;
  const failed = statsRow?.failed ?? 0;
  const denom = sent + failed;
  const successRate = denom > 0 ? sent / denom : 1;

  return {
    total,
    sent,
    failed,
    pending: statsRow?.pending ?? 0,
    skipped: statsRow?.skipped ?? 0,
    totalRecipients: statsRow?.totalRecipients ?? 0,
    totalSuccessSends: statsRow?.totalSuccessSends ?? 0,
    totalFailureSends: statsRow?.totalFailureSends ?? 0,
    activeSubscribers: subsRow?.activeSubscribers ?? 0,
    successRate,
  };
}

// ─── Per-event config admin API ──────────────────────────────────────────────

export interface EventNotificationConfigPatch {
  enabled?: boolean;
  milestonesHours?: number[] | null;
  pulseMinutes?: number | null;
  pulseWindowHours?: number | null;
  pausedUntil?: string | null;
}

export async function updateEventNotificationConfig(
  eventId: number,
  patch: EventNotificationConfigPatch,
): Promise<Event | null> {
  const update: Partial<Event> = {};
  if (typeof patch.enabled === "boolean") update.notificationEnabled = patch.enabled;
  if (patch.milestonesHours !== undefined) {
    update.notificationMilestones = patch.milestonesHours === null
      ? null
      : patch.milestonesHours.filter((n) => Number.isFinite(n) && n > 0);
  }
  if (patch.pulseMinutes !== undefined) update.notificationPulseMinutes = patch.pulseMinutes;
  if (patch.pulseWindowHours !== undefined)
    update.notificationPulseWindowHours = patch.pulseWindowHours;
  if (patch.pausedUntil !== undefined) {
    update.notificationPausedUntil = patch.pausedUntil ? new Date(patch.pausedUntil) : null;
  }

  if (Object.keys(update).length === 0) {
    const [row] = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.id, eventId))
      .limit(1);
    return row ?? null;
  }

  const [row] = await db
    .update(eventsTable)
    .set(update)
    .where(eq(eventsTable.id, eventId))
    .returning();
  return row ?? null;
}

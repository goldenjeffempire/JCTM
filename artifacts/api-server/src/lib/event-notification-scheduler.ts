/**
 * event-notification-scheduler.ts — Multi-channel reminder dispatcher for
 * upcoming events in `event_calendar`.
 *
 * Runs every 30 minutes (registered from cron.ts).
 *
 * Two firing modes per event (configurable in the admin panel):
 *   1) MILESTONES — discrete lead-time fires at e.g. [24, 12, 6, 1] hours
 *      before start. Default is the global DEFAULT_MILESTONES_HOURS, but each
 *      event row can override via `event_calendar.notification_milestones`.
 *   2) PULSE — every N minutes during the last M hours before start
 *      (`notification_pulse_minutes` + `notification_pulse_window_hours`).
 *      Slots are snapped to a UTC grid so a restart never re-fires the same slot.
 *
 * Idempotency:
 *   `event_notification_dispatch_log` has a unique index on
 *   (event_id, bucket_key, channel). bucket_key is `milestone_<N>h` for
 *   milestone fires or `pulse_<UTC ISO slot>` for pulses. We INSERT … ON
 *   CONFLICT DO NOTHING to claim a slot, then mark sent/failed.
 *
 * Retries:
 *   Failed dispatches are retried up to MAX_ATTEMPTS times on subsequent ticks.
 *   Once exhausted, admin can trigger a manual retry from the dashboard.
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

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
}

// ─── Configuration ───────────────────────────────────────────────────────────

export const DEFAULT_MILESTONES_HOURS = [24, 12, 6, 1] as const;
export const MAX_ATTEMPTS = 3;
const CATCHUP_HOURS = 1;
const SCAN_HORIZON_HOURS = 25; // a hair over the largest milestone
const PULSE_SCAN_HORIZON_HOURS = 24 * 14; // pulses can be configured up to 14d out
const EMAIL_BATCH_SIZE = 50;

// Backwards-compat alias (unchanged surface for other modules).
export const MILESTONES_HOURS = DEFAULT_MILESTONES_HOURS;

export type EventNotificationChannel = "push" | "email" | "sse";
const CHANNELS: EventNotificationChannel[] = ["push", "email", "sse"];

// ─── Tick state (exposed to admin) ───────────────────────────────────────────

interface TickState {
  lastTickStartedAt: string | null;
  lastTickFinishedAt: string | null;
  lastTickResult: {
    eventsScanned: number;
    dispatchesAttempted: number;
    dispatchesSucceeded: number;
    dispatchesFailed: number;
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

function buildPushPayload(event: Event, lead: string, bucketKey: string): NotificationPayload {
  const base = getPublicBaseUrl();
  const url = event.youtubeUrl || `${base}/events#event-${event.id}`;
  return {
    title: `⏰ ${event.title} — starts ${lead}`,
    body: event.location
      ? `${event.location} · Tap for details and to set a reminder.`
      : "Tap for details and to set a reminder.",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    url,
    tag: `event-notif-${event.id}-${bucketKey}`,
    data: {
      type: "event_notification",
      eventId: event.id,
      bucketKey,
      timestamp: new Date().toISOString(),
    },
  };
}

async function dispatchExpoForEvent(
  event: Event,
  lead: string,
  bucketKey: string,
  log: Logger,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  try {
    const result = await pool.query<{ token: string }>(
      `SELECT token FROM expo_push_tokens WHERE is_active = true ORDER BY created_at DESC LIMIT 1000`,
    );
    if (result.rows.length === 0) return { sent: 0, failed: 0 };

    const title = `⏰ ${event.title} — starts ${lead}`;
    const body = event.location
      ? `${event.location} · Tap for details and to set a reminder.`
      : "Tap for details and to set a reminder.";

    const CHUNK = 100;
    for (let i = 0; i < result.rows.length; i += CHUNK) {
      const chunk = result.rows.slice(i, i + CHUNK);
      const messages: ExpoPushMessage[] = chunk.map(({ token }) => ({
        to: token,
        title,
        body,
        data: { type: "event_notification", eventId: event.id, bucketKey },
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
          json.data?.forEach((t) => {
            if (t.status === "ok") sent++;
            else failed++;
          });
        } else {
          failed += chunk.length;
        }
      } catch (err) {
        log.warn({ err, eventId: event.id }, "Expo push chunk failed");
        failed += chunk.length;
      }
    }
  } catch (err) {
    log.warn({ err, eventId: event.id }, "Expo push lookup failed");
  }
  return { sent, failed };
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

async function claimOrAdvanceLogRow(
  event: Event,
  target: DispatchTarget,
  channel: EventNotificationChannel,
): Promise<EventNotificationDispatchLog | null> {
  const now = new Date();
  const inserted = await db
    .insert(eventNotificationDispatchLogTable)
    .values({
      eventId: event.id,
      eventTitle: event.title,
      milestoneHours: target.milestoneHours,
      bucketKey: target.bucketKey,
      channel,
      status: "pending",
      attempts: 1,
      firstAttemptAt: now,
      lastAttemptAt: now,
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

  const existing = await findLogRowByBucket(event.id, target.bucketKey, channel);
  if (!existing) return null;
  if (existing.status === "sent") return existing;
  if (existing.attempts >= MAX_ATTEMPTS) return existing;

  const updated = await db
    .update(eventNotificationDispatchLogTable)
    .set({ status: "pending", attempts: existing.attempts + 1, lastAttemptAt: now })
    .where(eq(eventNotificationDispatchLogTable.id, existing.id))
    .returning();
  return updated[0] ?? existing;
}

async function markLogResult(
  rowId: number,
  result: {
    status: "sent" | "failed" | "skipped";
    recipientCount?: number;
    successCount?: number;
    failureCount?: number;
    lastError?: string | null;
  },
): Promise<EventNotificationDispatchLog | null> {
  const now = new Date();
  const updated = await db
    .update(eventNotificationDispatchLogTable)
    .set({
      status: result.status,
      recipientCount: result.recipientCount ?? 0,
      successCount: result.successCount ?? 0,
      failureCount: result.failureCount ?? 0,
      lastError: result.lastError ?? null,
      lastAttemptAt: now,
      completedAt: result.status === "sent" || result.status === "skipped" ? now : null,
    })
    .where(eq(eventNotificationDispatchLogTable.id, rowId))
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

// ─── Per-channel dispatchers ─────────────────────────────────────────────────

async function dispatchPushChannel(
  event: Event,
  target: DispatchTarget,
  log: Logger,
): Promise<{ status: "sent" | "failed"; sent: number; failed: number; recipients: number; error?: string }> {
  try {
    const webPayload = buildPushPayload(event, target.leadLabel, target.bucketKey);
    const [webResult, expoResult] = await Promise.all([
      dispatchPushNotification(webPayload, log, "event_notification"),
      dispatchExpoForEvent(event, target.leadLabel, target.bucketKey, log),
    ]);
    const sent = webResult.sent + expoResult.sent;
    const failed = webResult.failed + expoResult.failed + webResult.deactivated;
    const recipients = sent + failed;
    if (sent === 0 && recipients > 0) {
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
  target: DispatchTarget,
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
            target.milestoneHours,
            unsubscribeUrl,
            log,
            { timezone: s.timezone, leadLabel: target.leadLabel, isPulse: target.kind === "pulse" },
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

// ─── Target generation (milestones + pulses) ─────────────────────────────────

interface DispatchTarget {
  bucketKey: string;
  milestoneHours: number; // informational; 0 for pulses
  leadLabel: string;
  kind: "milestone" | "pulse";
}

function findDueTargets(event: Event, now: Date): DispatchTarget[] {
  const targets: DispatchTarget[] = [];
  const startMs = event.startDate.getTime();
  const nowMs = now.getTime();
  if (startMs <= nowMs) return targets;

  // ── Milestones ─────────────────────────────────────────────────────────────
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

  // ── Pulse ──────────────────────────────────────────────────────────────────
  const pulseMin = event.notificationPulseMinutes ?? null;
  const pulseWindowH = event.notificationPulseWindowHours ?? null;
  if (pulseMin && pulseMin > 0 && pulseWindowH && pulseWindowH > 0) {
    const pulseMs = pulseMin * 60 * 1000;
    const windowStartMs = startMs - pulseWindowH * 60 * 60 * 1000;
    // snap nowMs to slot grid (UTC, anchored at unix epoch)
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

  return targets;
}

// ─── Per-target dispatch orchestration ───────────────────────────────────────

async function dispatchTarget(
  event: Event,
  target: DispatchTarget,
  log: Logger,
): Promise<{ attempted: number; succeeded: number; failed: number }> {
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  for (const channel of CHANNELS) {
    const claim = await claimOrAdvanceLogRow(event, target, channel);
    if (!claim) continue;
    if (claim.status === "sent" || claim.status === "skipped") continue;
    if (claim.attempts > MAX_ATTEMPTS) continue;

    attempted++;
    try {
      let result;
      if (channel === "push") result = await dispatchPushChannel(event, target, log);
      else if (channel === "email") result = await dispatchEmailChannel(event, target, log);
      else result = dispatchSseChannel();

      const updated = await markLogResult(claim.id, {
        status: result.status,
        recipientCount: result.recipients,
        successCount: result.sent,
        failureCount: result.failed,
        lastError: "error" in result ? result.error : null,
      });

      if (updated) emitDispatchSse(updated);

      if (result.status === "sent" || result.status === "skipped") succeeded++;
      else failed++;

      log.info(
        {
          eventId: event.id,
          bucketKey: target.bucketKey,
          kind: target.kind,
          channel,
          status: result.status,
          sent: result.sent,
          failed: result.failed,
          attempts: claim.attempts,
        },
        "Event notification channel dispatch result",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const updated = await markLogResult(claim.id, { status: "failed", lastError: msg });
      if (updated) emitDispatchSse(updated);
      failed++;
      log.error(
        { err, eventId: event.id, bucketKey: target.bucketKey, channel },
        "Event notification channel dispatch threw",
      );
    }
  }

  return { attempted, succeeded, failed };
}

// ─── Tick orchestration ──────────────────────────────────────────────────────

export async function runEventNotificationTick(
  log: Logger = logger,
): Promise<{
  eventsScanned: number;
  dispatchesAttempted: number;
  dispatchesSucceeded: number;
  dispatchesFailed: number;
  durationMs: number;
}> {
  if (state.isRunning) {
    log.info("Event notification tick already running — skipping overlap");
    return {
      eventsScanned: 0,
      dispatchesAttempted: 0,
      dispatchesSucceeded: 0,
      dispatchesFailed: 0,
      durationMs: 0,
    };
  }

  state.isRunning = true;
  const startedAt = new Date();
  state.lastTickStartedAt = startedAt.toISOString();
  const t0 = Date.now();

  let eventsScanned = 0;
  let dispatchesAttempted = 0;
  let dispatchesSucceeded = 0;
  let dispatchesFailed = 0;

  try {
    // Scan a wider horizon than the largest milestone so we also catch pulses.
    const horizonAt = new Date(
      startedAt.getTime() + Math.max(SCAN_HORIZON_HOURS, PULSE_SCAN_HORIZON_HOURS) * 60 * 60 * 1000,
    );
    const events = await db
      .select()
      .from(eventsTable)
      .where(and(gt(eventsTable.startDate, startedAt), lte(eventsTable.startDate, horizonAt)));
    eventsScanned = events.length;

    let totalDue = 0;
    for (const event of events) {
      if (!isEventEnabled(event, startedAt)) continue;
      const targets = findDueTargets(event, startedAt);
      totalDue += targets.length;
      for (const target of targets) {
        const result = await dispatchTarget(event, target, log);
        dispatchesAttempted += result.attempted;
        dispatchesSucceeded += result.succeeded;
        dispatchesFailed += result.failed;
      }
    }

    log.info(
      { eventsScanned, dueCount: totalDue },
      "Event notification tick — scanning",
    );

    const r = await retryFailedDispatches(events, log);
    dispatchesAttempted += r.attempted;
    dispatchesSucceeded += r.succeeded;
    dispatchesFailed += r.failed;
  } catch (err) {
    log.error({ err }, "Event notification tick failed");
  } finally {
    const finishedAt = new Date();
    const durationMs = Date.now() - t0;
    state.lastTickFinishedAt = finishedAt.toISOString();
    state.lastTickResult = {
      eventsScanned,
      dispatchesAttempted,
      dispatchesSucceeded,
      dispatchesFailed,
      durationMs,
    };
    state.isRunning = false;

    sseBroadcaster.broadcast({
      type: "event_notification_tick",
      data: {
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        eventsScanned,
        dispatchesAttempted,
        dispatchesSucceeded,
      },
    });
  }

  return state.lastTickResult!;
}

async function retryFailedDispatches(
  upcomingEvents: Event[],
  log: Logger,
): Promise<{ attempted: number; succeeded: number; failed: number }> {
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  if (upcomingEvents.length === 0) return { attempted, succeeded, failed };

  const eventById = new Map(upcomingEvents.map((e) => [e.id, e] as const));
  const eventIds = upcomingEvents.map((e) => e.id);

  const failedRows = await db
    .select()
    .from(eventNotificationDispatchLogTable)
    .where(
      and(
        eq(eventNotificationDispatchLogTable.status, "failed"),
        sql`${eventNotificationDispatchLogTable.attempts} < ${MAX_ATTEMPTS}`,
        inArray(eventNotificationDispatchLogTable.eventId, eventIds),
      ),
    );

  for (const row of failedRows) {
    const event = eventById.get(row.eventId);
    if (!event) continue;
    if (!isEventEnabled(event, new Date())) continue;
    log.info(
      {
        eventId: row.eventId,
        bucketKey: row.bucketKey,
        channel: row.channel,
        attempts: row.attempts,
      },
      "Retrying failed event notification",
    );
    const result = await retryLogRow(row, event, log);
    attempted += 1;
    if (result === "sent" || result === "skipped") succeeded += 1;
    else failed += 1;
  }

  return { attempted, succeeded, failed };
}

function targetForRow(row: EventNotificationDispatchLog): DispatchTarget {
  const isPulse = row.bucketKey.startsWith("pulse_");
  // Best-effort lead label from stored milestoneHours; pulses just say "soon".
  const leadLabel = isPulse
    ? "very soon"
    : humaniseLeadTime(row.milestoneHours || 1);
  return {
    bucketKey: row.bucketKey || `milestone_${row.milestoneHours}h`,
    milestoneHours: row.milestoneHours,
    leadLabel,
    kind: isPulse ? "pulse" : "milestone",
  };
}

async function retryLogRow(
  row: EventNotificationDispatchLog,
  event: Event,
  log: Logger,
): Promise<"sent" | "failed" | "skipped"> {
  const channel = row.channel as EventNotificationChannel;
  const now = new Date();
  await db
    .update(eventNotificationDispatchLogTable)
    .set({
      status: "pending",
      attempts: row.attempts + 1,
      lastAttemptAt: now,
    })
    .where(eq(eventNotificationDispatchLogTable.id, row.id));

  const target = targetForRow(row);
  let result;
  if (channel === "push") result = await dispatchPushChannel(event, target, log);
  else if (channel === "email") result = await dispatchEmailChannel(event, target, log);
  else result = dispatchSseChannel();

  const updated = await markLogResult(row.id, {
    status: result.status,
    recipientCount: result.recipients,
    successCount: result.sent,
    failureCount: result.failed,
    lastError: "error" in result ? result.error : null,
  });
  if (updated) emitDispatchSse(updated);
  return result.status;
}

/** Force a retry of a single log row regardless of attempt count (admin action). */
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

  await retryLogRow(row, event, log);
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
  // Show events up to 14 days out so admins can preconfigure pulses.
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
    if (r.bucketKey.startsWith("pulse_")) {
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
      pulseRows.sort((a, b) => (a.bucketKey > b.bucketKey ? -1 : 1)); // newest slot first
      const lastByChannel: Record<EventNotificationChannel, EventNotificationDispatchLog | null> = {
        push: null,
        email: null,
        sse: null,
      };
      let lastSlot: string | null = null;
      for (const r of pulseRows) {
        const ch = r.channel as EventNotificationChannel;
        if (!lastByChannel[ch]) lastByChannel[ch] = r;
        if (!lastSlot) lastSlot = r.bucketKey.replace(/^pulse_/, "");
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

  return {
    total: statsRow?.total ?? 0,
    sent: statsRow?.sent ?? 0,
    failed: statsRow?.failed ?? 0,
    pending: statsRow?.pending ?? 0,
    skipped: statsRow?.skipped ?? 0,
    totalRecipients: statsRow?.totalRecipients ?? 0,
    totalSuccessSends: statsRow?.totalSuccessSends ?? 0,
    totalFailureSends: statsRow?.totalFailureSends ?? 0,
    activeSubscribers: subsRow?.activeSubscribers ?? 0,
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

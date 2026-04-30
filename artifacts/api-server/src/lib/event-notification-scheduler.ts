/**
 * event-notification-scheduler.ts — Multi-channel reminder dispatcher for
 * upcoming events in `event_calendar`.
 *
 * Runs every 30 minutes (registered from cron.ts). For each upcoming event in
 * the next 25 hours, fires a reminder across all enabled channels (web push,
 * Expo push, email, SSE) at four lead-time milestones: 24h, 12h, 6h, 1h.
 *
 * Idempotency:
 *   `event_notification_dispatch_log` has a unique index on
 *   (event_id, milestone_hours, channel). We INSERT … ON CONFLICT DO NOTHING
 *   to claim a slot, then mark sent/failed.
 *
 * Retries:
 *   Failed dispatches are retried up to MAX_ATTEMPTS times on subsequent ticks.
 *   Once exhausted, the row stays in status='failed' and won't be retried
 *   automatically (admin can trigger a manual retry).
 *
 * Catch-up:
 *   A milestone is considered "due" if `now` is within
 *   [start - milestoneHours - CATCHUP_HOURS, start - milestoneHours + buffer].
 *   With a 30-min cron we use a 1h catch-up so brief outages don't drop reminders.
 */

import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
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

// Local minimal type — Expo SDK is not a direct dependency; we hit the HTTP
// endpoint with a hand-built payload (matches the pattern used in cron.ts).
interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
}

// ─── Configuration ───────────────────────────────────────────────────────────

export const MILESTONES_HOURS = [24, 12, 6, 1] as const;
export const MAX_ATTEMPTS = 3;
const CATCHUP_HOURS = 1; // 30-min cron + a little slack
const SCAN_HORIZON_HOURS = 25; // a hair over the largest milestone
const EMAIL_BATCH_SIZE = 50;

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

function humaniseLeadTime(hoursBefore: number): string {
  if (hoursBefore <= 1) return "in about 1 hour";
  if (hoursBefore < 24) return `in ${hoursBefore} hours`;
  if (hoursBefore === 24) return "tomorrow";
  const days = Math.round(hoursBefore / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

function buildPushPayload(event: Event, hoursBefore: number): NotificationPayload {
  const lead = humaniseLeadTime(hoursBefore);
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
    tag: `event-notif-${event.id}-${hoursBefore}h`,
    data: {
      type: "event_notification",
      eventId: event.id,
      milestoneHours: hoursBefore,
      timestamp: new Date().toISOString(),
    },
  };
}

async function dispatchExpoForEvent(
  event: Event,
  hoursBefore: number,
  log: Logger,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  try {
    const result = await pool.query<{ token: string }>(
      `SELECT token FROM expo_push_tokens WHERE is_active = true ORDER BY created_at DESC LIMIT 1000`,
    );
    if (result.rows.length === 0) return { sent: 0, failed: 0 };

    const lead = humaniseLeadTime(hoursBefore);
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
        data: {
          type: "event_notification",
          eventId: event.id,
          milestoneHours: hoursBefore,
        },
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

async function findLogRow(
  eventId: number,
  milestoneHours: number,
  channel: EventNotificationChannel,
): Promise<EventNotificationDispatchLog | null> {
  const rows = await db
    .select()
    .from(eventNotificationDispatchLogTable)
    .where(
      and(
        eq(eventNotificationDispatchLogTable.eventId, eventId),
        eq(eventNotificationDispatchLogTable.milestoneHours, milestoneHours),
        eq(eventNotificationDispatchLogTable.channel, channel),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function claimOrAdvanceLogRow(
  event: Event,
  milestoneHours: number,
  channel: EventNotificationChannel,
): Promise<EventNotificationDispatchLog | null> {
  const now = new Date();
  // Try to insert; if it exists, increment attempts in place.
  const inserted = await db
    .insert(eventNotificationDispatchLogTable)
    .values({
      eventId: event.id,
      eventTitle: event.title,
      milestoneHours,
      channel,
      status: "pending",
      attempts: 1,
      firstAttemptAt: now,
      lastAttemptAt: now,
    })
    .onConflictDoNothing({
      target: [
        eventNotificationDispatchLogTable.eventId,
        eventNotificationDispatchLogTable.milestoneHours,
        eventNotificationDispatchLogTable.channel,
      ],
    })
    .returning();

  if (inserted[0]) return inserted[0];

  const existing = await findLogRow(event.id, milestoneHours, channel);
  if (!existing) return null;
  if (existing.status === "sent") return existing; // nothing to do
  if (existing.attempts >= MAX_ATTEMPTS) return existing; // exhausted

  const updated = await db
    .update(eventNotificationDispatchLogTable)
    .set({
      status: "pending",
      attempts: existing.attempts + 1,
      lastAttemptAt: now,
    })
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
  milestoneHours: number,
  log: Logger,
): Promise<{ status: "sent" | "failed"; sent: number; failed: number; recipients: number; error?: string }> {
  try {
    const webPayload = buildPushPayload(event, milestoneHours);
    const [webResult, expoResult] = await Promise.all([
      dispatchPushNotification(webPayload, log, "event_notification"),
      dispatchExpoForEvent(event, milestoneHours, log),
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
  milestoneHours: number,
  log: Logger,
): Promise<{ status: "sent" | "failed" | "skipped"; sent: number; failed: number; recipients: number; error?: string }> {
  try {
    const subscribers = await db
      .select({
        id: eventNotificationSubscribersTable.id,
        email: eventNotificationSubscribersTable.email,
        unsubscribeToken: eventNotificationSubscribersTable.unsubscribeToken,
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
            milestoneHours,
            unsubscribeUrl,
            log,
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
          .where(
            sql`${eventNotificationSubscribersTable.id} = ANY(${okIds}::int[])`,
          );
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

function dispatchSseChannel(
  event: Event,
  milestoneHours: number,
): { status: "sent"; sent: number; failed: number; recipients: number } {
  const recipients = sseBroadcaster.size();
  // The dispatch SSE event itself reaches connected admin clients; we also
  // broadcast a user-facing "event_notification_dispatched" of type:'sse'
  // which the website can listen for to surface a banner. The standard
  // channel-emit happens in markAndEmit below, so here we just count clients.
  return { status: "sent", sent: recipients, failed: 0, recipients };
}

// ─── Milestone dispatch orchestration ────────────────────────────────────────

async function dispatchMilestone(
  event: Event,
  milestoneHours: number,
  log: Logger,
): Promise<{ attempted: number; succeeded: number; failed: number }> {
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  for (const channel of CHANNELS) {
    const claim = await claimOrAdvanceLogRow(event, milestoneHours, channel);
    if (!claim) continue;
    if (claim.status === "sent" || claim.status === "skipped") continue;
    if (claim.attempts > MAX_ATTEMPTS) continue;

    attempted++;

    try {
      let result;
      if (channel === "push") {
        result = await dispatchPushChannel(event, milestoneHours, log);
      } else if (channel === "email") {
        result = await dispatchEmailChannel(event, milestoneHours, log);
      } else {
        result = dispatchSseChannel(event, milestoneHours);
      }

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
          milestoneHours,
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
      const updated = await markLogResult(claim.id, {
        status: "failed",
        lastError: msg,
      });
      if (updated) emitDispatchSse(updated);
      failed++;
      log.error(
        { err, eventId: event.id, milestoneHours, channel },
        "Event notification channel dispatch threw",
      );
    }
  }

  return { attempted, succeeded, failed };
}

// ─── Tick orchestration ──────────────────────────────────────────────────────

interface DueMilestone {
  event: Event;
  milestoneHours: number;
}

function findDueMilestones(events: Event[], now: Date): DueMilestone[] {
  const due: DueMilestone[] = [];
  for (const event of events) {
    const startMs = event.startDate.getTime();
    const nowMs = now.getTime();
    if (startMs <= nowMs) continue; // event already started/past
    for (const m of MILESTONES_HOURS) {
      const milestoneAtMs = startMs - m * 60 * 60 * 1000;
      const catchupMs = CATCHUP_HOURS * 60 * 60 * 1000;
      // due if we're at-or-after the milestone moment, within catchup window,
      // and still before the event start.
      if (nowMs >= milestoneAtMs - 60_000 && nowMs <= milestoneAtMs + catchupMs) {
        due.push({ event, milestoneHours: m });
      }
    }
  }
  return due;
}

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
    const horizonAt = new Date(startedAt.getTime() + SCAN_HORIZON_HOURS * 60 * 60 * 1000);
    const events = await db
      .select()
      .from(eventsTable)
      .where(
        and(
          gt(eventsTable.startDate, startedAt),
          lte(eventsTable.startDate, horizonAt),
        ),
      );
    eventsScanned = events.length;

    const due = findDueMilestones(events, startedAt);
    log.info(
      { eventsScanned, dueCount: due.length },
      "Event notification tick — scanning",
    );

    for (const { event, milestoneHours } of due) {
      const result = await dispatchMilestone(event, milestoneHours, log);
      dispatchesAttempted += result.attempted;
      dispatchesSucceeded += result.succeeded;
      dispatchesFailed += result.failed;
    }

    // Retry pass: any failed rows for upcoming events with attempts<MAX
    await retryFailedDispatches(events, log).then((r) => {
      dispatchesAttempted += r.attempted;
      dispatchesSucceeded += r.succeeded;
      dispatchesFailed += r.failed;
    });
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
        sql`${eventNotificationDispatchLogTable.eventId} = ANY(${eventIds}::int[])`,
      ),
    );

  for (const row of failedRows) {
    const event = eventById.get(row.eventId);
    if (!event) continue;
    log.info(
      { eventId: row.eventId, milestoneHours: row.milestoneHours, channel: row.channel, attempts: row.attempts },
      "Retrying failed event notification",
    );
    const result = await retryLogRow(row, event, log);
    attempted += 1;
    if (result === "sent" || result === "skipped") succeeded += 1;
    else failed += 1;
  }

  return { attempted, succeeded, failed };
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

  let result;
  if (channel === "push") result = await dispatchPushChannel(event, row.milestoneHours, log);
  else if (channel === "email") result = await dispatchEmailChannel(event, row.milestoneHours, log);
  else result = dispatchSseChannel(event, row.milestoneHours);

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
  return findLogRow(row.eventId, row.milestoneHours, row.channel as EventNotificationChannel);
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
    milestones: Array<{
      hours: number;
      dueAt: string;
      isPast: boolean;
      channels: Record<
        EventNotificationChannel,
        Pick<EventNotificationDispatchLog, "id" | "status" | "attempts" | "successCount" | "failureCount" | "lastError"> | null
      >;
    }>;
  }>
> {
  const now = new Date();
  const horizonAt = new Date(now.getTime() + (Math.max(...MILESTONES_HOURS) + 24) * 60 * 60 * 1000);
  const events = await db
    .select()
    .from(eventsTable)
    .where(
      and(
        gt(eventsTable.startDate, now),
        lte(eventsTable.startDate, horizonAt),
      ),
    );

  if (events.length === 0) return [];

  const eventIds = events.map((e) => e.id);
  const logRows = await db
    .select()
    .from(eventNotificationDispatchLogTable)
    .where(sql`${eventNotificationDispatchLogTable.eventId} = ANY(${eventIds}::int[])`);

  const byKey = new Map<string, EventNotificationDispatchLog>();
  for (const r of logRows) {
    byKey.set(`${r.eventId}-${r.milestoneHours}-${r.channel}`, r);
  }

  return events
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .map((event) => ({
      event,
      milestones: MILESTONES_HOURS.map((hours) => {
        const dueAt = new Date(event.startDate.getTime() - hours * 60 * 60 * 1000);
        const channels = {} as Record<
          EventNotificationChannel,
          Pick<EventNotificationDispatchLog, "id" | "status" | "attempts" | "successCount" | "failureCount" | "lastError"> | null
        >;
        for (const ch of CHANNELS) {
          const r = byKey.get(`${event.id}-${hours}-${ch}`);
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
        return {
          hours,
          dueAt: dueAt.toISOString(),
          isPast: dueAt.getTime() <= now.getTime(),
          channels,
        };
      }),
    }));
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

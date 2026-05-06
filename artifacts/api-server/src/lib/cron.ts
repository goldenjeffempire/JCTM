import { syncRecentIncremental, syncIncremental, harvestAll, QuotaExceededError, subscribeToWebSub, enrichVideoIds, refreshFeaturedSermon } from "./youtube-sync.js";
import { ingestAllSermons, ingestActivityLearning } from "./knowledge-ingestion.js";
import { syncFromRSS, RSS_INTERVAL_MS, RSSHttpError } from "./rss-sync.js";
import { sseBroadcaster } from "./sse-broadcaster.js";
import { enrichNextSermonBatch } from "./broadcast-engine.js";
import { dispatchPushNotification, buildServiceReminderNotification, buildDailyDevotionNotification, type NotificationPayload } from "./push-manager.js";
import { runEventNotificationTick, setEventNotificationIntervalMs } from "./event-notification-scheduler.js";
import { startEventNotificationWorker, stopEventNotificationWorker } from "./event-notification-worker.js";
import { ensureDevotionForDate } from "./devotion-engine.js";
import { sendDevotionEmail, isEmailConfigured, getPublicBaseUrl, verifyEmailTransport } from "./email-engine.js";
import { db, sermonsTable, devotionsTable, devotionSubscribersTable, eventPromotionsTable, pool } from "@workspace/db";
import { sql, eq, and, ne, isNull, or } from "drizzle-orm";
import type { Logger } from "pino";

const API_INTERVAL_MS       = 30 * 60 * 1000;       // 30 minutes
const FULL_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;  // 24 hours — full channel harvest
const WEBSUB_RENEWAL_MS     = 23 * 60 * 60 * 1000;  // 23 hours (before 24h lease expires)
const METADATA_INTERVAL_MS  = 10 * 60 * 1000;       // 10 minutes
const DAILY_MS              = 24 * 60 * 60 * 1000;  // 24 hours

let apiCronHandle:       ReturnType<typeof setInterval> | null = null;
let fullSyncCronHandle:  ReturnType<typeof setInterval> | null = null;
let rssCronHandle:       ReturnType<typeof setInterval> | null = null;
let websubCronHandle:    ReturnType<typeof setInterval> | null = null;
let metadataCronHandle:  ReturnType<typeof setInterval> | null = null;
let reminderCronHandle:  ReturnType<typeof setInterval> | null = null;
let apiStartupTimer: ReturnType<typeof setTimeout> | null = null;
let metadataStartupTimer: ReturnType<typeof setTimeout> | null = null;
let midnightTimer: ReturnType<typeof setTimeout> | null = null;
let dailyDevotionHandle: ReturnType<typeof setInterval> | null = null;
let eventNotificationHandle: ReturnType<typeof setInterval> | null = null;
let eventNotificationStartupTimer: ReturnType<typeof setTimeout> | null = null;
let lastFullSync: Date | null = null;

let quotaPausedUntil: number | null = null;
let rssBackoffUntil: number | null = null;
const RSS_404_BACKOFF_MS = 30 * 60 * 1000; // 30 min cooldown after 404 (hosting IP restriction)
let lastWebSubRenewal: Date | null = null;
let webSubCallbackUrl: string | null = null;
let lastRSSSync: Date | null = null;
let lastAPISync: Date | null = null;
let lastSyncError: { time: string; message: string; source: string } | null = null;
let serviceReminderSentAt: number | null = null;
let devotionNotificationSentDate: string | null = null; // ISO date string (YYYY-MM-DD)
let devotionEmailBroadcastDate: string | null = null;   // ISO date string (YYYY-MM-DD)

// ── Warri Crusade Day 2 hourly campaign broadcast ────────────────────────────
// Day 2 starts at 6:00 PM WAT (17:00 UTC) on May 1, 2026. The hourly cron
// fires throughout the day: "Starting Soon" messages before 6 PM and
// "LIVE NOW" messages once the event begins. Sends web push + inserts a
// broadcast_events row (SSE relay turns it into an in-app toast). Email is
// NOT sent here — handled by a separate daily devotion email path.
const WARRI_CRUSADE_START_MS = new Date("2026-05-01T17:00:00Z").getTime(); // 6 PM WAT
const WARRI_CRUSADE_END_MS   = new Date("2026-05-01T23:00:00Z").getTime(); // midnight WAT
const WARRI_CRUSADE_TITLE    = "Warri Crusade Day 2";
const WARRI_CRUSADE_URL      = "/crusade";
// Stable body string used as the dedup-key prefix in `broadcast_events.message`.
// It is intentionally short and constant so the unique-by-(type,title,message)
// idempotency check stays deterministic across process restarts.
const WARRI_CRUSADE_BODY    = "Warri Crusade 2026 broadcast";

// Pre-event "Starting Soon" messages — sent hourly before 6 PM WAT
const WARRI_CRUSADE_UPCOMING_MESSAGES = [
  "⏰ Warri Crusade Day 2 starts at 6 PM WAT tonight — get ready!",
  "🔔 Day 2 of the Warri Crusade is TONIGHT at 6 PM — don't miss it!",
  "🙏 Prepare your heart — Warri Crusade Day 2 begins tonight at 6 PM!",
  "🌍 Prophet Amos returns tonight for Day 2 of the Warri Crusade — be there!",
  "🕊️ Day 2 of the Warri City Crusade is tonight — Ighogbadu Primary School!",
  "📖 Join us at 6 PM WAT for Day 2 of the Crusade with Prophet Amos!",
  "🔥 Tonight at 6 PM — Day 2 of the most powerful crusade in Warri 2026!",
  "🙌 Invite someone to Day 2 of the Warri Crusade tonight — it starts at 6 PM!",
  "🛐 Come for healing and deliverance — Warri Crusade Day 2 starts at 6 PM!",
  "✝️ Jesus Christ is Lord — join Warri Crusade Day 2 at 6 PM tonight!",
  "🌟 Warri Crusade Day 2 is TONIGHT — Ighogbadu Primary School, 6 PM WAT!",
  "🔥 The move of God continues tonight at 6 PM — Day 2 of the Warri Crusade!",
] as const;

// Live event messages — sent hourly once the event is underway
const WARRI_CRUSADE_MESSAGES = [
  "🔥 Join the powerful move of God in Warri — miracles are happening now!",
  "⚡ Healings, deliverances, and salvation — Warri Crusade Day 2 is live!",
  "🙏 Don't miss the move of God in Warri City — join us now!",
  "🌍 Thousands are gathered in Warri — be part of history. Join now!",
  "🕊️ The Holy Spirit is moving in Warri — come experience the power of God!",
  "📖 Prophet Amos Jeffemuodafe is preaching the Word in Warri — join us!",
  "🔔 Warri Crusade Day 2 is ongoing — share this with your family!",
  "🙌 Miracles, signs and wonders on Day 2 — join the Crusade now!",
  "🛐 Deliverance and salvation at Warri Crusade Day 2 — invite someone now!",
  "✝️ Jesus Christ is Lord — Warri Crusade Day 2 is happening. Be there!",
  "🌟 Come be healed and set free at Warri Crusade Day 2 tonight!",
  "🔥 The fire of revival is burning in Warri on Day 2 — join us now!",
] as const;

// ── Expo Push Notification Dispatcher ────────────────────────────────────────
// Sends push notifications to mobile devices registered via expo-notifications.
// Uses the Expo Push API (https://exp.host/--/api/v2/push/send) — no SDK needed.
// Batched in chunks of 100 as per Expo's recommendations.

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  priority?: "default" | "normal" | "high";
}

async function dispatchExpoPush(
  title: string,
  body: string,
  data: Record<string, unknown>,
  log: Logger,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  try {
    const result = await pool.query<{ token: string }>(
      `SELECT token FROM expo_push_tokens WHERE is_active = true ORDER BY created_at DESC LIMIT 1000`,
    );
    if (result.rows.length === 0) return { sent: 0, failed: 0 };

    // Chunk into batches of 100 (Expo recommendation)
    const CHUNK = 100;
    for (let i = 0; i < result.rows.length; i += CHUNK) {
      const chunk = result.rows.slice(i, i + CHUNK);
      const messages: ExpoPushMessage[] = chunk.map(({ token }) => ({
        to: token,
        title,
        body,
        data,
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
          const json = await res.json() as {
            data?: Array<{ status: string; id?: string; details?: { error?: string } }>;
          };
          const invalid: string[] = [];
          const receiptRows: Array<[string, string, string]> = []; // [ticket_id, token, title]

          json.data?.forEach((ticket, idx) => {
            const token = chunk[idx]!.token;
            if (ticket.status === "ok" && ticket.id) {
              sent++;
              receiptRows.push([ticket.id, token, title]);
            } else {
              failed++;
              const errCode = ticket.details?.error;
              if (errCode === "DeviceNotRegistered") {
                invalid.push(token);
              }
            }
          });

          // Persist ticket IDs for receipt checking (15 min later)
          if (receiptRows.length > 0) {
            const placeholders = receiptRows
              .map((_, ri) => `($${ri * 3 + 1}, $${ri * 3 + 2}, $${ri * 3 + 3})`)
              .join(", ");
            await pool.query(
              `INSERT INTO expo_push_receipts (ticket_id, token, title) VALUES ${placeholders} ON CONFLICT (ticket_id) DO NOTHING`,
              receiptRows.flat(),
            );
          }

          if (invalid.length > 0) {
            await pool.query(
              `UPDATE expo_push_tokens SET is_active = false, updated_at = now() WHERE token = ANY($1)`,
              [invalid],
            );
          }
        } else {
          failed += chunk.length;
        }
      } catch {
        failed += chunk.length;
      }
    }
  } catch (err) {
    log.warn({ err }, "Expo push dispatch error");
  }
  return { sent, failed };
}

// ── Expo Receipt Checker ─────────────────────────────────────────────────────
// Polls the Expo receipts API for any pending ticket IDs that were sent more
// than 15 minutes ago. Marks each receipt as "ok" or "error", and deactivates
// any token that returns DeviceNotRegistered.
// Runs every 15 minutes; processes up to 300 pending receipts per run.

const RECEIPT_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const RECEIPT_MIN_AGE_MS        = 15 * 60 * 1000; // only check receipts > 15 min old
let receiptCheckerHandle: ReturnType<typeof setInterval> | null = null;
let selfWarmHandle: ReturnType<typeof setInterval> | null = null;

async function checkExpoPushReceipts(log: Logger): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - RECEIPT_MIN_AGE_MS).toISOString();
    const pending = await pool.query<{ id: number; ticket_id: string; token: string }>(
      `SELECT id, ticket_id, token FROM expo_push_receipts
       WHERE status = 'pending' AND sent_at < $1
       ORDER BY sent_at ASC LIMIT 300`,
      [cutoff],
    );
    if (pending.rows.length === 0) return;

    const ticketIds = pending.rows.map((r) => r.ticket_id);
    const res = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ ids: ticketIds }),
    });

    if (!res.ok) {
      log.warn({ status: res.status }, "Expo receipt check HTTP error");
      return;
    }

    const json = await res.json() as {
      data?: Record<string, { status: "ok" | "error"; details?: { error?: string; fault?: string } }>;
    };
    if (!json.data) return;

    const invalid: string[] = [];

    for (const row of pending.rows) {
      const receipt = json.data[row.ticket_id];
      if (!receipt) continue; // not ready yet — leave as pending

      const status = receipt.status === "ok" ? "ok" : "error";
      const errCode = receipt.details?.error ?? null;

      await pool.query(
        `UPDATE expo_push_receipts SET status = $1, error_code = $2, checked_at = now() WHERE id = $3`,
        [status, errCode, row.id],
      );

      if (errCode === "DeviceNotRegistered") {
        invalid.push(row.token);
      }
    }

    if (invalid.length > 0) {
      await pool.query(
        `UPDATE expo_push_tokens SET is_active = false, updated_at = now() WHERE token = ANY($1)`,
        [invalid],
      );
      log.info({ count: invalid.length }, "Expo receipt check — deactivated stale tokens");
    }

    const okCount    = pending.rows.filter((r) => json.data?.[r.ticket_id]?.status === "ok").length;
    const errCount   = pending.rows.filter((r) => json.data?.[r.ticket_id]?.status === "error").length;
    const pendStill  = pending.rows.filter((r) => !json.data?.[r.ticket_id]).length;

    log.info(
      { checked: pending.rows.length, ok: okCount, error: errCount, stillPending: pendStill },
      "Expo receipt check complete",
    );
  } catch (err) {
    log.warn({ err }, "Expo receipt check failed (non-fatal)");
  }
}

// ─── State exports (for health endpoint) ──────────────────────────────────────

export function isQuotaPaused(): boolean {
  return quotaPausedUntil !== null && Date.now() < quotaPausedUntil;
}

export function getQuotaResetTime(): Date | null {
  if (quotaPausedUntil === null || Date.now() >= quotaPausedUntil) return null;
  return new Date(quotaPausedUntil);
}

export function setQuotaPaused(until: number): void {
  quotaPausedUntil = until;
}

export function getCronState() {
  const now = Date.now();
  return {
    youtube: {
      quotaPaused:      quotaPausedUntil !== null && now < quotaPausedUntil,
      quotaResetsAt:    quotaPausedUntil && now < quotaPausedUntil ? new Date(quotaPausedUntil).toISOString() : null,
      lastRSSSync:      lastRSSSync?.toISOString() ?? null,
      nextRSSSync:      lastRSSSync ? new Date(lastRSSSync.getTime() + RSS_INTERVAL_MS).toISOString() : null,
      lastAPISync:      lastAPISync?.toISOString() ?? null,
      nextAPISync:      lastAPISync ? new Date(lastAPISync.getTime() + API_INTERVAL_MS).toISOString() : null,
      lastFullSync:     lastFullSync?.toISOString() ?? null,
      nextFullSync:     lastFullSync ? new Date(lastFullSync.getTime() + FULL_SYNC_INTERVAL_MS).toISOString() : null,
    },
    websub: {
      lastRenewal: lastWebSubRenewal?.toISOString() ?? null,
      nextRenewal: lastWebSubRenewal
        ? new Date(lastWebSubRenewal.getTime() + WEBSUB_RENEWAL_MS).toISOString()
        : null,
      callbackUrl: webSubCallbackUrl ?? null,
    },
    ai: {
      mode: "local",
      externalAIEnabled: false,
    },
    lastSyncError: lastSyncError ?? null,
    running: {
      rss:      rssCronHandle !== null,
      api:      apiCronHandle !== null,
      fullSync: fullSyncCronHandle !== null,
      websub:   websubCronHandle !== null,
      metadata: metadataCronHandle !== null,
      reminder: reminderCronHandle !== null,
    },
  };
}

export function setWebSubCallbackUrl(url: string): void {
  webSubCallbackUrl = url;
  if (!lastWebSubRenewal) lastWebSubRenewal = new Date();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msUntilUtcMidnight(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return midnight.getTime() - now.getTime();
}

function todayUTC(): string {
  return new Date().toISOString().split("T")[0]!;
}

function tomorrowUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0]!;
}

// ─── Midnight devotion pre-generation ─────────────────────────────────────────
// Fires at the next UTC midnight, then every 24 hours.
// Pre-generates tomorrow's devotion so the first morning visitor gets an
// instant response with no AI generation delay.

async function preGenerateTomorrowsDevotion(log: Logger): Promise<void> {
  const tomorrow = tomorrowUTC();
  try {
    log.info({ date: tomorrow }, "Midnight pre-generation: ensuring tomorrow's devotion exists");
    const { cached } = await ensureDevotionForDate(tomorrow, log);
    if (cached) {
      log.info({ date: tomorrow }, "Tomorrow's devotion already cached — skipping generation");
    } else {
      log.info({ date: tomorrow }, "Tomorrow's devotion pre-generated successfully");
    }
  } catch (err) {
    log.warn({ err, date: tomorrow }, "Midnight devotion pre-generation failed (non-fatal)");
  }
}

// ─── WAT Sunday Service Reminder ──────────────────────────────────────────────
// Sends a push notification 30 minutes before Sunday 8:00 AM WAT service

function checkAndSendServiceReminder(log: Logger): void {
  const now = new Date();
  const watMs = now.getTime() + (60 * 60 * 1000); // WAT = UTC+1
  const wat = new Date(watMs);

  const dayOfWeek = wat.getUTCDay();   // 0 = Sunday
  const hour      = wat.getUTCHours();
  const minute    = wat.getUTCMinutes();

  // Target: Sunday 7:30 AM WAT (30 min before 8:00 AM service)
  if (dayOfWeek !== 0 || hour !== 7 || minute < 28 || minute > 32) return;

  // Avoid duplicate sends — check if we already sent in the last 10 minutes
  const tenMinMs = 10 * 60 * 1000;
  if (serviceReminderSentAt && Date.now() - serviceReminderSentAt < tenMinMs) return;

  serviceReminderSentAt = Date.now();
  log.info("Sending Sunday service 30-minute reminder push notification");
  dispatchPushNotification(buildServiceReminderNotification(30), log).catch(err => {
    log.warn({ err }, "Service reminder push failed (non-fatal)");
  });
}

// ─── Daily Devotion Push Notification ────────────────────────────────────────
// Sends the daily devotion push at 6:00 AM WAT (= 5:00 AM UTC) every day.
// The devotion should already be pre-generated by the midnight cron.

function checkAndSendDevotionNotification(log: Logger): void {
  const now = new Date();
  const watMs = now.getTime() + (60 * 60 * 1000); // WAT = UTC+1
  const wat = new Date(watMs);

  const hour   = wat.getUTCHours();
  const minute = wat.getUTCMinutes();
  const today  = todayUTC();

  // Target: 6:00–6:04 AM WAT — only send once per day
  if (hour !== 6 || minute > 4) return;
  if (devotionNotificationSentDate === today) return;

  devotionNotificationSentDate = today;

  // Fetch today's devotion from DB (pre-generated at midnight) then push
  db.select({ title: devotionsTable.title, reference: devotionsTable.reference })
    .from(devotionsTable)
    .where(eq(devotionsTable.date, today))
    .limit(1)
    .then(async (rows) => {
      const row = rows[0];
      if (!row) {
        // No pre-generated devotion — generate on-the-fly then notify
        log.info({ date: today }, "6 AM WAT: devotion not pre-generated yet — generating now");
        try {
          const { devotion } = await ensureDevotionForDate(today, log);
          await dispatchPushNotification(
            buildDailyDevotionNotification(devotion.title, devotion.reference),
            log,
          );
        } catch (err) {
          log.warn({ err }, "Devotion on-demand generation for push notification failed (non-fatal)");
        }
        return;
      }
      log.info({ date: today, title: row.title }, "Sending daily devotion push notification");
      dispatchPushNotification(buildDailyDevotionNotification(row.title, row.reference), log).catch(err => {
        log.warn({ err }, "Daily devotion push failed (non-fatal)");
      });
    })
    .catch(err => {
      log.warn({ err }, "Failed to query today's devotion for push notification (non-fatal)");
    });
}

// ─── Event Promotion Lifecycle Engine ────────────────────────────────────────
// Per-minute scan that detects active promotions transitioning into their LIVE
// window (start_at crossed) and dispatches a one-shot push broadcast + logs
// the event to broadcast_events. push_sent_at acts as the lock so a transition
// is announced exactly once even across server restarts.
//
// Time-tolerance: we fire when start_at is within the last 5 minutes (to absorb
// short scheduler delays after a restart) and end_at is still in the future.

const EVENT_LIVE_FIRE_TOLERANCE_MS = 5 * 60 * 1000;
const EVENT_END_FIRE_TOLERANCE_MS = 5 * 60 * 1000;

function buildEventLiveNotification(title: string, location: string | null, ctaUrl: string): NotificationPayload {
  return {
    title: `🔴 ${title} — Now Live`,
    body: location ? `It's happening now — ${location}. Join us live.` : "It's happening now — join us live.",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    url: ctaUrl,
    tag: "event-live",
    requireInteraction: true,
    actions: [{ action: "open", title: "Join Now" }],
    data: { type: "event_live", timestamp: new Date().toISOString() },
  };
}

function buildEventStartingSoonNotification(title: string, minutesBefore: number, ctaUrl: string): NotificationPayload {
  return {
    title: `⏰ ${title} starts in ${minutesBefore} minutes`,
    body: "Get ready — the event begins shortly.",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    url: ctaUrl,
    tag: "event-starting-soon",
    data: { type: "event_starting_soon", minutesBefore, timestamp: new Date().toISOString() },
  };
}

// ─── Recurring 6-hour Event Reminder ─────────────────────────────────────────
// Fires across all enabled channels (push, in-app toast via SW relay,
// banner/sticky pulse via SSE broadcast_events row) at every 6-hour boundary
// before an upcoming event's start_at. Capped at 168 h (7 days) to avoid
// spamming users for far-future events. Per-boundary idempotency comes from
// an exact-match check against broadcast_events (type + title + message).

const REMINDER_BOUNDARIES_HOURS = [
  168, 144, 120, 96, 72, 60, 48, 42, 36, 30, 24, 18, 12, 6,
];
// Catch-up window: fire a missed boundary if we're within this many hours of
// it (covers brief outages without resurrecting day-old reminders).
const REMINDER_CATCHUP_MS = 6 * 60 * 60 * 1000;

function humaniseHours(hours: number): string {
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  if (hours === 24) return "in 24 hours";
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

function buildEventReminderNotification(
  title: string,
  hoursBefore: number,
  location: string | null,
  ctaUrl: string,
): NotificationPayload {
  const when = humaniseHours(hoursBefore);
  return {
    title: `⏰ ${title} starts ${when}`,
    body: location
      ? `Get ready — ${location}. Mark your calendar and prepare your heart.`
      : "Mark your calendar and prepare your heart — the event is approaching.",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    url: ctaUrl,
    tag: `event-reminder-${hoursBefore}h`,
    data: {
      type: "event_reminder",
      broadcastType: "event_reminder",
      hoursBefore,
      timestamp: new Date().toISOString(),
    },
  };
}

function checkAndSendEventReminders(log: Logger): void {
  const now = Date.now();

  db.select()
    .from(eventPromotionsTable)
    .where(eq(eventPromotionsTable.status, "active"))
    .then(async (rows) => {
      for (const row of rows) {
        const startMs = row.startAt.getTime();
        // Stop scheduling once event begins
        if (startMs <= now) continue;
        // Skip events more than 7 days out — no boundary could possibly fire
        if (startMs - now > 168 * 60 * 60 * 1000 + 60_000) continue;

        for (const hours of REMINDER_BOUNDARIES_HOURS) {
          const boundaryMs = startMs - hours * 60 * 60 * 1000;
          if (now < boundaryMs) continue;                         // not yet
          if (now - boundaryMs > REMINDER_CATCHUP_MS) continue;   // too stale

          const dedupMessage = `${row.title} starts ${humaniseHours(hours)}`;
          try {
            const recent = await pool.query<{ id: number }>(
              `SELECT id FROM broadcast_events
                WHERE type = 'event_reminder' AND title = $1 AND message = $2
                LIMIT 1`,
              [row.title, dedupMessage],
            );
            if (recent.rowCount && recent.rowCount > 0) continue;

            log.info(
              { slug: row.slug, hoursBefore: hours },
              "Event promotion → recurring reminder — dispatching push + broadcast",
            );
            await dispatchPushNotification(
              buildEventReminderNotification(row.title, hours, row.location, row.ctaUrl),
              log,
              "event_reminder",
            );
            await pool.query(
              `INSERT INTO broadcast_events (type, title, message, url)
               VALUES ($1, $2, $3, $4)`,
              ["event_reminder", row.title, dedupMessage, row.ctaUrl],
            );
          } catch (err) {
            log.warn(
              { err, slug: row.slug, hours },
              "Event recurring reminder failed (non-fatal)",
            );
          }
        }
      }
    })
    .catch((err) =>
      log.warn({ err }, "Event recurring reminder scan failed (non-fatal)"),
    );
}

function checkEventPromotionTransitions(log: Logger): void {
  const now = Date.now();
  const tolStart = new Date(now - EVENT_LIVE_FIRE_TOLERANCE_MS);

  db.select()
    .from(eventPromotionsTable)
    .where(
      and(
        eq(eventPromotionsTable.status, "active"),
        isNull(eventPromotionsTable.pushSentAt),
        // start_at crossed within the tolerance window AND end is still in the future
      ),
    )
    .then(async (rows) => {
      const ready = rows.filter(r =>
        r.startAt.getTime() <= now &&
        r.startAt.getTime() >= tolStart.getTime() - 60_000 && // include events whose start was up to ~6m ago
        r.endAt.getTime() > now
      );

      // Also catch events that started further in the past but never fired
      // (e.g. server was down at start time) — fire a one-shot late notification.
      const lateButLive = rows.filter(r =>
        r.startAt.getTime() < tolStart.getTime() - 60_000 &&
        r.endAt.getTime() > now
      );

      for (const row of [...ready, ...lateButLive]) {
        try {
          const notif = buildEventLiveNotification(row.title, row.location, row.ctaUrl);
          log.info({ slug: row.slug, title: row.title }, "Event promotion → LIVE — dispatching push + broadcast log");
          await dispatchPushNotification(notif, log, "event_live");
          await pool.query(
            `INSERT INTO broadcast_events (type, title, message, url) VALUES ($1, $2, $3, $4)`,
            ["event_live", row.title, `${row.title} is now live`, row.ctaUrl],
          );
          await db
            .update(eventPromotionsTable)
            .set({ pushSentAt: new Date(), updatedAt: new Date() })
            .where(eq(eventPromotionsTable.id, row.id));
        } catch (err) {
          log.warn({ err, slug: row.slug }, "Event promotion live transition failed");
        }
      }
    })
    .catch(err => log.warn({ err }, "Event promotion scan failed (non-fatal)"));

  // ── Optional: 30-min "starting soon" reminder, fired once per event ────────
  // Reuses pushSentAt's NULL state by NOT setting it — we use a separate window
  // check: we only fire if start_at is between now+28min and now+32min.
  // Idempotency comes from the broadcast_events table (we check for an existing
  // row with the same title in the last 10 minutes).
  db.select()
    .from(eventPromotionsTable)
    .where(eq(eventPromotionsTable.status, "active"))
    .then(async (rows) => {
      const upcoming = rows.filter(r => {
        const ms = r.startAt.getTime() - now;
        return ms >= 28 * 60 * 1000 && ms <= 32 * 60 * 1000;
      });
      for (const row of upcoming) {
        try {
          const recent = await pool.query<{ id: number }>(
            `SELECT id FROM broadcast_events
              WHERE type = 'event_starting_soon' AND title = $1
                AND fired_at > NOW() - INTERVAL '20 minutes' LIMIT 1`,
            [row.title],
          );
          if (recent.rowCount && recent.rowCount > 0) continue;
          log.info({ slug: row.slug }, "Event promotion → 30-min reminder — dispatching");
          await dispatchPushNotification(
            buildEventStartingSoonNotification(row.title, 30, row.ctaUrl),
            log,
            "event_starting_soon",
          );
          await pool.query(
            `INSERT INTO broadcast_events (type, title, message, url) VALUES ($1, $2, $3, $4)`,
            ["event_starting_soon", row.title, `${row.title} starts in 30 minutes`, row.ctaUrl],
          );
        } catch (err) {
          log.warn({ err, slug: row.slug }, "Event 30-min reminder failed");
        }
      }
    })
    .catch(err => log.warn({ err }, "Event 30-min reminder scan failed (non-fatal)"));
}

// ─── Warri Crusade Day 2 hourly multi-channel broadcast ───────────────────────
// Each hour bucket is identified by `YYYY-MM-DD-HH-00` (UTC). Idempotency is
// enforced by an exact-match check against `broadcast_events`
// (type + title + message), so a process restart inside the same hour will
// NOT re-send. Stops automatically once the event window ends. Inserts the
// broadcast_events row FIRST (acts as the lock) so concurrent ticks across
// multiple processes can never both fire for the same slot.

function halfHourBucketUTC(now: number = Date.now()): string {
  const d = new Date(now);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const half = d.getUTCMinutes() < 30 ? "00" : "30";
  return `${y}-${m}-${day}-${h}-${half}`;
}

function hourBucketUTC(now: number = Date.now()): string {
  const d = new Date(now);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${day}-${h}-00`;
}

function buildWarriCrusadeNotification(slotBucket: string): NotificationPayload {
  // Rotate through messages deterministically by hourly slot (hour index = 0–23).
  const parts = slotBucket.split("-");
  const hourNum = parseInt(parts[3] ?? "0", 10);

  // Phase-aware: "Starting Soon" before 6 PM WAT, "LIVE NOW" once started.
  const now = Date.now();
  const isLive = now >= WARRI_CRUSADE_START_MS && now < WARRI_CRUSADE_END_MS;
  const isUpcoming = now < WARRI_CRUSADE_START_MS;

  const messages = isUpcoming ? WARRI_CRUSADE_UPCOMING_MESSAGES : WARRI_CRUSADE_MESSAGES;
  const body = messages[hourNum % messages.length]!;

  const title = isLive
    ? "🔴 Warri Crusade Day 2 — LIVE NOW"
    : "⏰ Warri Crusade Day 2 — Starting at 6 PM (WAT)";

  return {
    title,
    body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    image: "/warri-crusade-flyer2.jpeg",
    url: WARRI_CRUSADE_URL,
    tag: "warri-crusade-2026",
    requireInteraction: isLive,
    actions: [
      { action: "open", title: isLive ? "Join Live Now" : isUpcoming ? "Join Tonight" : "Learn More" },
      { action: "share", title: "Share" },
    ],
    data: {
      type: "warri_crusade_promo",
      broadcastType: isUpcoming ? "event_reminder" : "live_service",
      isLive,
      isUpcoming,
      timestamp: new Date().toISOString(),
    },
  };
}

// ─── Scheduled Broadcasts processor ──────────────────────────────────────────
// Runs as part of the per-minute reminder cron tick. Polls the
// `scheduled_broadcasts` table for rows whose `scheduled_for` has elapsed and
// fires them via `dispatchPushNotification`. The "claim" step uses
// UPDATE...RETURNING to atomically transition `pending` → `processing`,
// guaranteeing at-most-once delivery across racing ticks. On dispatch
// completion we mark the row `sent` (or `failed` if the dispatcher throws) and
// record the delivery counts. Each row is also logged into `broadcast_events`
// so the SSE relay surfaces it as an in-app toast for connected clients.

async function processScheduledBroadcasts(log: Logger): Promise<void> {
  // Claim up to 10 due rows in one transaction. UPDATE ... RETURNING is
  // atomic, so two ticks running concurrently will partition the work
  // instead of double-firing it.
  const due = await pool.query<{
    id: number;
    title: string;
    body: string;
    url: string;
    require_interaction: boolean;
    scheduled_for: string;
  }>(
    `UPDATE scheduled_broadcasts
        SET status = 'processing'
      WHERE id IN (
        SELECT id FROM scheduled_broadcasts
         WHERE status = 'pending' AND scheduled_for <= now()
         ORDER BY scheduled_for ASC
         LIMIT 10
         FOR UPDATE SKIP LOCKED
      )
      RETURNING id, title, body, url, require_interaction, scheduled_for`,
  );

  if (due.rows.length === 0) return;

  log.info({ count: due.rows.length }, "Processing scheduled broadcasts");

  for (const row of due.rows) {
    try {
      // Log to broadcast_events so SSE/in-app toast picks it up
      await pool.query(
        `INSERT INTO broadcast_events (type, title, message, url) VALUES ($1, $2, $3, $4)`,
        ["admin_broadcast", row.title, row.body, row.url],
      );

      const result = await dispatchPushNotification(
        {
          title: row.title,
          body: row.body,
          icon: "/icons/icon-192x192.png",
          badge: "/icons/badge-72x72.png",
          url: row.url,
          tag: "admin-broadcast",
          requireInteraction: row.require_interaction,
          data: {
            type: "admin_broadcast",
            broadcastType: "admin_broadcast",
            scheduledId: row.id,
            timestamp: new Date().toISOString(),
          },
        },
        log,
        "admin_broadcast_scheduled",
      );

      await pool.query(
        `UPDATE scheduled_broadcasts
            SET status = 'sent',
                sent_at = now(),
                sent_count = $1,
                failed_count = $2,
                deactivated_count = $3
          WHERE id = $4`,
        [result.sent, result.failed, result.deactivated, row.id],
      );
      log.info(
        { id: row.id, title: row.title, sent: result.sent, failed: result.failed },
        "Scheduled broadcast delivered",
      );
    } catch (err) {
      log.error({ err, id: row.id }, "Scheduled broadcast failed");
      const message = err instanceof Error ? err.message : String(err);
      await pool.query(
        `UPDATE scheduled_broadcasts
            SET status = 'failed',
                error = $1,
                sent_at = now()
          WHERE id = $2`,
        [message.slice(0, 500), row.id],
      );
    }
  }
}

/**
 * Manual one-shot Warri Crusade broadcast trigger — used by the admin
 * "Send broadcast now" button. Idempotent within `cooldownMinutes` (default 5)
 * via a synthetic dedup key in `broadcast_events`. Returns the dispatch
 * result, or `{ skipped: true }` if a manual send already fired inside the
 * cooldown window.
 */
export async function broadcastWarriCrusadeManual(
  log: Logger,
  triggeredBy: string,
  cooldownMinutes = 5,
): Promise<
  | { skipped: true; reason: string; lastFiredAt: string }
  | { skipped: false; sent: number; failed: number; deactivated: number; total: number }
> {
  const now = Date.now();
  if (now >= WARRI_CRUSADE_END_MS) {
    return { skipped: true, reason: "Campaign has ended", lastFiredAt: new Date(WARRI_CRUSADE_END_MS).toISOString() };
  }

  // Look back `cooldownMinutes` for any manual send (synthetic [manual] tag).
  const cooldownAgo = new Date(now - cooldownMinutes * 60_000).toISOString();
  const recent = await pool.query<{ fired_at: string }>(
    `SELECT fired_at::text FROM broadcast_events
      WHERE type = 'warri_crusade_promo'
        AND message LIKE $1
        AND fired_at >= $2
      ORDER BY fired_at DESC
      LIMIT 1`,
    [`%[manual%`, cooldownAgo],
  );
  if (recent.rowCount && recent.rowCount > 0) {
    return {
      skipped: true,
      reason: `A manual broadcast was sent within the last ${cooldownMinutes} minutes`,
      lastFiredAt: recent.rows[0].fired_at,
    };
  }

  const manualMessage = `${WARRI_CRUSADE_BODY} [manual:${new Date(now).toISOString()}:${triggeredBy}]`;
  await pool.query(
    `INSERT INTO broadcast_events (type, title, message, url) VALUES ($1, $2, $3, $4)`,
    ["warri_crusade_promo", WARRI_CRUSADE_TITLE, manualMessage, WARRI_CRUSADE_URL],
  );

  log.info({ triggeredBy }, "Warri Crusade Day 2 manual broadcast — dispatching push + in-app toast");
  const notif = buildWarriCrusadeNotification(hourBucketUTC());
  const result = await dispatchPushNotification(notif, log, "warri_crusade_promo");
  log.info(
    { triggeredBy, sent: result.sent, failed: result.failed, deactivated: result.deactivated },
    "Warri Crusade manual broadcast complete",
  );
  return {
    skipped: false,
    sent: result.sent,
    failed: result.failed,
    deactivated: result.deactivated,
    total: result.sent + result.failed + result.deactivated,
  };
}

/**
 * "Crusade is NOW LIVE" dual-channel alert — admin triggered only.
 * Sends a specific LIVE message (not the rotating one) to both web push
 * subscribers and all active Expo mobile devices simultaneously.
 * Uses a 2-minute cooldown to prevent accidental double-fires.
 */
export async function broadcastWarriCrusadeLiveAlert(
  log: Logger,
  triggeredBy: string,
  cooldownMinutes = 2,
): Promise<
  | { skipped: true; reason: string; lastFiredAt: string }
  | { skipped: false; web: { sent: number; failed: number; deactivated: number }; expo: { sent: number; failed: number }; total: number }
> {
  const now = Date.now();
  if (now >= WARRI_CRUSADE_END_MS) {
    return { skipped: true, reason: "Campaign has ended", lastFiredAt: new Date(WARRI_CRUSADE_END_MS).toISOString() };
  }

  // Cooldown guard — look for a recent [live-alert] tag in broadcast_events
  const cooldownAgo = new Date(now - cooldownMinutes * 60_000).toISOString();
  const recent = await pool.query<{ fired_at: string }>(
    `SELECT fired_at::text FROM broadcast_events
      WHERE type = 'warri_crusade_promo'
        AND message LIKE $1
        AND fired_at >= $2
      ORDER BY fired_at DESC LIMIT 1`,
    [`%[live-alert%`, cooldownAgo],
  );
  if (recent.rowCount && recent.rowCount > 0) {
    return {
      skipped: true,
      reason: `A live alert was already sent within the last ${cooldownMinutes} minutes`,
      lastFiredAt: recent.rows[0].fired_at,
    };
  }

  const LIVE_TITLE = "🔴 Warri Crusade 2026 is LIVE NOW!";
  const LIVE_BODY = "The Warri City Crusade has just started — join us for miracles, healing, and the move of God!";

  // Persist to broadcast_events (drives in-app SSE toast on connected browsers)
  const liveMessage = `${LIVE_BODY} [live-alert:${new Date(now).toISOString()}:${triggeredBy}]`;
  await pool.query(
    `INSERT INTO broadcast_events (type, title, message, url) VALUES ($1, $2, $3, $4)`,
    ["warri_crusade_promo", LIVE_TITLE, liveMessage, WARRI_CRUSADE_URL],
  );

  log.info({ triggeredBy }, "Warri Crusade LIVE alert — dispatching web push + Expo mobile");

  // ── Web push (VAPID / service worker) ────────────────────────────────────────
  const webNotif: NotificationPayload = {
    title: LIVE_TITLE,
    body: LIVE_BODY,
    icon: "/icons/icon-512x512.png",
    badge: "/icons/badge-72x72.png",
    url: WARRI_CRUSADE_URL,
    tag: "warri-crusade-live",
    requireInteraction: true,
    data: { type: "warri_crusade_live", timestamp: new Date(now).toISOString() },
  };
  const webResult = await dispatchPushNotification(webNotif, log, "warri_crusade_promo");

  // ── Expo mobile push ─────────────────────────────────────────────────────────
  const expoResult = await dispatchExpoPush(LIVE_TITLE, LIVE_BODY, {
    url: WARRI_CRUSADE_URL,
    type: "warri_crusade_live",
    timestamp: new Date(now).toISOString(),
  }, log);

  log.info(
    { triggeredBy, web: webResult, expo: expoResult },
    "Warri Crusade LIVE alert dispatched (web + expo)",
  );

  return {
    skipped: false,
    web: { sent: webResult.sent, failed: webResult.failed, deactivated: webResult.deactivated },
    expo: expoResult,
    total: webResult.sent + expoResult.sent,
  };
}

async function checkAndBroadcastWarriCrusadeHourly(log: Logger): Promise<void> {
  const now = Date.now();
  if (now >= WARRI_CRUSADE_END_MS) return; // event finished — nothing to do

  // Only broadcast in the first 5 minutes of each hour (minutes 0–4 UTC) to
  // avoid drift / duplicate firings across the per-minute scheduler tick. The
  // dedup row guards against multiple ticks within the same window.
  const minutePastHour = new Date(now).getUTCMinutes();
  if (minutePastHour >= 5) return;

  const bucket = hourBucketUTC(now);
  const dedupMessage = `${WARRI_CRUSADE_BODY} [slot:${bucket}]`;

  try {
    // Atomic insert-or-skip via UNIQUE constraint check
    const existing = await pool.query<{ id: number }>(
      `SELECT id FROM broadcast_events
        WHERE type = 'warri_crusade_promo' AND title = $1 AND message = $2
        LIMIT 1`,
      [WARRI_CRUSADE_TITLE, dedupMessage],
    );
    if (existing.rowCount && existing.rowCount > 0) return;

    // Acquire the lock row first; if a parallel process beat us, the next
    // tick will short-circuit on the SELECT above.
    await pool.query(
      `INSERT INTO broadcast_events (type, title, message, url) VALUES ($1, $2, $3, $4)`,
      ["warri_crusade_promo", WARRI_CRUSADE_TITLE, dedupMessage, WARRI_CRUSADE_URL],
    );

    log.info(
      { bucket, isLive: now >= WARRI_CRUSADE_START_MS },
      "Warri Crusade Day 2 hourly broadcast — dispatching push + in-app toast",
    );

    const notif = buildWarriCrusadeNotification(bucket);
    const result = await dispatchPushNotification(notif, log, "warri_crusade_promo");

    // Also dispatch to Expo (mobile) push tokens
    const expoResult = await dispatchExpoPush(
      notif.title,
      notif.body,
      { url: notif.url, type: "warri_crusade_promo" },
      log,
    );

    log.info(
      {
        bucket,
        web: { sent: result.sent, failed: result.failed, deactivated: result.deactivated },
        expo: expoResult,
      },
      "Warri Crusade Day 2 hourly broadcast complete (web + expo)",
    );
  } catch (err) {
    log.warn({ err, bucket }, "Warri Crusade Day 2 hourly broadcast failed (non-fatal)");
  }
}

// ─── Generic Campaign Promotion Broadcast ─────────────────────────────────────
// For any active row in `event_promotions` with `broadcast_enabled = true`,
// the per-minute cron tick computes the current cadence slot, checks the
// trigger window (the first ≤5 minutes of each slot), and dispatches a push
// notification + in-app SSE toast. Idempotency comes from the
// broadcast_events unique-by-(type,title,message) check, where the message
// embeds both the slot bucket and the promotion id, so each promotion has its
// own independent dedup namespace per slot. Stops automatically once
// `end_at` has passed.
//
// Cadences:
//   • half_hourly  → fires at :00 and :30 (UTC), bucket "YYYY-MM-DD-HH-MM"
//   • hourly       → fires at :00 (UTC), bucket "YYYY-MM-DD-HH-00"
//   • daily        → fires at 00:00 UTC, bucket "YYYY-MM-DD"
//   • custom       → fires every N minutes (5–1440), bucket
//                    "YYYY-MM-DD-HH-MM-i<N>" aligned to the slot start
//
// Coexists safely with the dedicated Warri Crusade hardcoded broadcaster:
// they use different broadcast_events.type values ("campaign_promo" vs
// "warri_crusade_promo"), and the new column defaults to false so existing
// rows keep their current behaviour until an admin opts in.

interface CampaignPromotionRow {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  artworkUrl: string | null;
  ctaUrl: string;
  endAt: Date;
  broadcastEnabled: boolean;
  broadcastCadence: string;
  broadcastIntervalMinutes: number | null;
  broadcastMessages: string[];
  broadcastTitleOverride: string | null;
  broadcastImageUrl: string | null;
}

function computeBroadcastSlot(
  now: Date,
  cadence: string,
  intervalMinutes: number | null,
): { fire: boolean; bucket: string; slotIndex: number } {
  const m = now.getUTCMinutes();
  const h = now.getUTCHours();
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const hStr = String(h).padStart(2, "0");

  switch (cadence) {
    case "half_hourly": {
      const inFirst = m < 5;
      const inSecond = m >= 30 && m < 35;
      const half = m < 30 ? "00" : "30";
      const halfFlag = m < 30 ? 0 : 1;
      // slotIndex = day-of-year * 48 + hour*2 + halfFlag (deterministic)
      const slotIndex = h * 2 + halfFlag;
      return { fire: inFirst || inSecond, bucket: `${y}-${mo}-${d}-${hStr}-${half}`, slotIndex };
    }
    case "hourly": {
      return { fire: m < 5, bucket: `${y}-${mo}-${d}-${hStr}-00`, slotIndex: h };
    }
    case "daily": {
      // Day-of-year-ish index: use UTC day number relative to epoch to keep
      // the rotation rolling forward even across month/year boundaries.
      const epochDay = Math.floor(now.getTime() / 86_400_000);
      return { fire: h === 0 && m < 5, bucket: `${y}-${mo}-${d}`, slotIndex: epochDay };
    }
    case "custom": {
      const interval = Math.max(5, Math.min(1440, intervalMinutes ?? 30));
      const epochMin = Math.floor(now.getTime() / 60_000);
      const slotIdx = Math.floor(epochMin / interval);
      const minIntoSlot = epochMin - slotIdx * interval;
      const fire = minIntoSlot < Math.min(5, interval);
      const slotStart = new Date(slotIdx * interval * 60_000);
      const sy = slotStart.getUTCFullYear();
      const smo = String(slotStart.getUTCMonth() + 1).padStart(2, "0");
      const sd = String(slotStart.getUTCDate()).padStart(2, "0");
      const sh = String(slotStart.getUTCHours()).padStart(2, "0");
      const sm = String(slotStart.getUTCMinutes()).padStart(2, "0");
      return { fire, bucket: `${sy}-${smo}-${sd}-${sh}-${sm}-i${interval}`, slotIndex: slotIdx };
    }
    default:
      return { fire: false, bucket: "", slotIndex: 0 };
  }
}

function pickCampaignBody(row: CampaignPromotionRow, slotIndex: number): string {
  const messages = Array.isArray(row.broadcastMessages) ? row.broadcastMessages.filter(s => typeof s === "string" && s.trim().length > 0) : [];
  if (messages.length > 0) {
    return messages[slotIndex % messages.length]!;
  }
  // Sensible default if the admin didn't supply any rotating messages.
  if (row.subtitle && row.subtitle.trim().length > 0) return row.subtitle.trim();
  return `${row.title} — don't miss it!`;
}

async function checkAndBroadcastCampaignPromotions(log: Logger): Promise<void> {
  const now = new Date();

  let rows: CampaignPromotionRow[];
  try {
    const result = await pool.query<{
      id: number;
      slug: string;
      title: string;
      subtitle: string | null;
      artwork_url: string | null;
      cta_url: string;
      end_at: Date;
      broadcast_enabled: boolean;
      broadcast_cadence: string;
      broadcast_interval_minutes: number | null;
      broadcast_messages: string[] | null;
      broadcast_title_override: string | null;
      broadcast_image_url: string | null;
    }>(
      `SELECT id, slug, title, subtitle, artwork_url, cta_url, end_at,
              broadcast_enabled, broadcast_cadence, broadcast_interval_minutes,
              broadcast_messages, broadcast_title_override, broadcast_image_url
         FROM event_promotions
        WHERE status = 'active'
          AND broadcast_enabled = true
          AND end_at > now()`,
    );
    rows = result.rows.map(r => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      subtitle: r.subtitle,
      artworkUrl: r.artwork_url,
      ctaUrl: r.cta_url,
      endAt: r.end_at,
      broadcastEnabled: r.broadcast_enabled,
      broadcastCadence: r.broadcast_cadence,
      broadcastIntervalMinutes: r.broadcast_interval_minutes,
      broadcastMessages: Array.isArray(r.broadcast_messages) ? r.broadcast_messages : [],
      broadcastTitleOverride: r.broadcast_title_override,
      broadcastImageUrl: r.broadcast_image_url,
    }));
  } catch (err) {
    log.warn({ err }, "Campaign promotion broadcast — query failed (non-fatal)");
    return;
  }

  if (rows.length === 0) return;

  for (const row of rows) {
    const { fire, bucket, slotIndex } = computeBroadcastSlot(
      now,
      row.broadcastCadence,
      row.broadcastIntervalMinutes,
    );
    if (!fire) continue;

    const effectiveTitle = (row.broadcastTitleOverride && row.broadcastTitleOverride.trim().length > 0)
      ? row.broadcastTitleOverride.trim()
      : row.title;
    const body = pickCampaignBody(row, slotIndex);
    // Embed both bucket and promotion id so each promotion has its own dedup
    // namespace per slot — two different campaigns can fire on the same slot.
    const dedupMessage = `${body} [slot:${bucket}:promo${row.id}]`;

    try {
      const existing = await pool.query<{ id: number }>(
        `SELECT id FROM broadcast_events
          WHERE type = 'campaign_promo' AND title = $1 AND message = $2
          LIMIT 1`,
        [effectiveTitle, dedupMessage],
      );
      if (existing.rowCount && existing.rowCount > 0) continue;

      // Acquire the lock row first; concurrent ticks short-circuit on the
      // SELECT above. The unique-by-(type,title,message) idempotency check
      // is the same pattern used by the Warri Crusade and event reminder
      // broadcasters, so behaviour is consistent across the codebase.
      await pool.query(
        `INSERT INTO broadcast_events (type, title, message, url) VALUES ($1, $2, $3, $4)`,
        ["campaign_promo", effectiveTitle, dedupMessage, row.ctaUrl],
      );

      const imageUrl = row.broadcastImageUrl ?? row.artworkUrl ?? undefined;
      const notif: NotificationPayload = {
        title: effectiveTitle,
        body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-72x72.png",
        ...(imageUrl ? { image: imageUrl } : {}),
        url: row.ctaUrl,
        tag: `campaign-promo-${row.id}`,
        data: {
          type: "campaign_promo",
          broadcastType: "campaign_promo",
          promotionId: row.id,
          slug: row.slug,
          cadence: row.broadcastCadence,
          slotBucket: bucket,
          timestamp: new Date().toISOString(),
        },
      };

      log.info(
        { promotionId: row.id, slug: row.slug, cadence: row.broadcastCadence, bucket },
        "Campaign promotion broadcast — dispatching push + in-app toast",
      );

      const result = await dispatchPushNotification(notif, log, "campaign_promo");
      const expoResult = await dispatchExpoPush(
        effectiveTitle,
        body,
        { url: row.ctaUrl, type: "campaign_promo", promotionId: row.id, slug: row.slug },
        log,
      );

      log.info(
        {
          promotionId: row.id,
          bucket,
          web: { sent: result.sent, failed: result.failed, deactivated: result.deactivated },
          expo: expoResult,
        },
        "Campaign promotion broadcast complete (web + expo)",
      );
    } catch (err) {
      log.warn({ err, promotionId: row.id, bucket }, "Campaign promotion broadcast failed (non-fatal)");
    }
  }
}

// ─── Daily Devotion Email Broadcast ───────────────────────────────────────────
// Sends today's devotion to all active subscribers between 6:00–6:14 AM WAT.
// Runs at most once per UTC day (guarded by `devotionEmailBroadcastDate`).
// Each successful send updates `last_sent_date` so a partial outage / restart
// can resume mid-broadcast without duplicating emails to recipients already
// served today.

async function broadcastDailyDevotionEmail(log: Logger): Promise<void> {
  const today = todayUTC();
  if (devotionEmailBroadcastDate === today) return;

  if (!isEmailConfigured()) {
    devotionEmailBroadcastDate = today; // skip silently for the rest of today
    log.info("Devotion email broadcast skipped — SMTP env vars not configured");
    return;
  }

  // Mark immediately so concurrent ticks (or restarts during the broadcast
  // window) don't fan out the whole list a second time. Per-row `last_sent_date`
  // still protects individual subscribers below.
  devotionEmailBroadcastDate = today;

  try {
    // Make sure today's devotion exists (normally pre-generated at midnight).
    const { devotion } = await ensureDevotionForDate(today, log);

    const subscribers = await db
      .select()
      .from(devotionSubscribersTable)
      .where(
        and(
          eq(devotionSubscribersTable.isActive, true),
          or(
            isNull(devotionSubscribersTable.lastSentDate),
            ne(devotionSubscribersTable.lastSentDate, today),
          ),
        ),
      );

    if (subscribers.length === 0) {
      log.info({ date: today }, "Devotion email broadcast: no eligible subscribers");
      return;
    }

    log.info(
      { date: today, recipients: subscribers.length },
      "Devotion email broadcast starting",
    );

    let sent = 0;
    let failed = 0;

    for (const sub of subscribers) {
      const unsubscribeUrl =
        `${getPublicBaseUrl()}/api/devotion/unsubscribe?token=${encodeURIComponent(sub.unsubscribeToken)}`;
      const ok = await sendDevotionEmail(sub.email, devotion, unsubscribeUrl, log);
      if (ok) {
        sent++;
        await db
          .update(devotionSubscribersTable)
          .set({ lastSentDate: today })
          .where(eq(devotionSubscribersTable.id, sub.id));
      } else {
        failed++;
      }
      // Light pacing to be polite to SMTP relays (especially Gmail) — 200ms
      // gap = ~5 emails/sec, well under standard provider rate limits.
      await new Promise((r) => setTimeout(r, 200));
    }

    log.info(
      { date: today, sent, failed, total: subscribers.length },
      "Devotion email broadcast complete",
    );
  } catch (err) {
    log.warn({ err, date: today }, "Devotion email broadcast failed");
  }
}

function checkAndBroadcastDevotionEmail(log: Logger): void {
  const now = new Date();
  const watMs = now.getTime() + (60 * 60 * 1000); // WAT = UTC+1
  const wat = new Date(watMs);

  const hour   = wat.getUTCHours();
  const minute = wat.getUTCMinutes();

  // Window: 6:00–6:14 AM WAT — wide enough that a missed minute won't skip
  // the entire day's broadcast. The per-day guard prevents repeats.
  if (hour !== 6 || minute > 14) return;

  broadcastDailyDevotionEmail(log).catch((err) =>
    log.warn({ err }, "Devotion email broadcast cron error"),
  );
}

// ─── API sync ─────────────────────────────────────────────────────────────────

async function runApiSync(apiKey: string, log: Logger): Promise<void> {
  if (quotaPausedUntil !== null && Date.now() < quotaPausedUntil) {
    const resumesIn = Math.round((quotaPausedUntil - Date.now()) / 60000);
    log.info({ resumesInMinutes: resumesIn }, "YouTube API sync skipped — quota paused until UTC midnight");
    return;
  }

  quotaPausedUntil = null;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(sermonsTable);

    // Empty DB → full harvest to populate from scratch.
    // Otherwise → lightweight recent-only sync (first playlist page, 50 videos)
    // to minimise daily quota consumption on the 30-minute cron.
    const result = count === 0
      ? await harvestAll(apiKey, log)
      : await syncRecentIncremental(apiKey, log);

    lastAPISync = new Date();
    log.info(result, "YouTube API sync complete");

    sseBroadcaster.broadcast({
      type: "sync_complete",
      data: { synced: result.synced, featured: result.featured },
    });

    // Auto-promote the newest video so Today's Highlights and Latest Broadcast
    // always reflect the most recent upload without manual intervention.
    await refreshFeaturedSermon(log);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      const pauseMs = msUntilUtcMidnight();
      quotaPausedUntil = Date.now() + pauseMs;
      log.warn(
        { resumesInHours: Math.round(pauseMs / 3600000) },
        "YouTube API quota exceeded — sync paused until UTC midnight",
      );
      lastSyncError = {
        time:    new Date().toISOString(),
        message: `YouTube quota exceeded — resumes at ${new Date(Date.now() + pauseMs).toUTCString()}`,
        source:  "api_cron",
      };
    } else {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err }, "YouTube API sync failed");
      lastSyncError = { time: new Date().toISOString(), message, source: "api_cron" };
    }
  }
}

// ─── Full channel sync (daily) ────────────────────────────────────────────────

/**
 * Runs a full incremental sync of the entire uploads playlist once per day.
 * This ensures every video ever published on the channel is present in the DB,
 * not just the 50 newest that the 30-minute recent sync covers.
 */
async function runFullSync(apiKey: string, log: Logger): Promise<void> {
  if (quotaPausedUntil !== null && Date.now() < quotaPausedUntil) {
    const resumesIn = Math.round((quotaPausedUntil - Date.now()) / 60000);
    log.info({ resumesInMinutes: resumesIn }, "Full channel sync skipped — YouTube quota paused");
    return;
  }

  try {
    log.info("Starting daily full channel sync (all uploaded videos)");
    const result = await syncIncremental(apiKey, log);
    lastFullSync = new Date();
    log.info(result, "Daily full channel sync complete");

    sseBroadcaster.broadcast({
      type: "sync_complete",
      data: { synced: result.synced, featured: result.featured, source: "full_sync" },
    });

    await refreshFeaturedSermon(log);

    // After successful full sync — trigger AI learning on the updated sermon DB
    ingestAllSermons(log).catch(err => log.warn({ err }, "Post-sync sermon ingestion failed (non-fatal)"));
    ingestActivityLearning(log).catch(err => log.warn({ err }, "Post-sync activity learning failed (non-fatal)"));
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      const pauseMs = msUntilUtcMidnight();
      quotaPausedUntil = Date.now() + pauseMs;
      log.warn(
        { resumesInHours: Math.round(pauseMs / 3600000) },
        "YouTube API quota exceeded during full sync — pausing until UTC midnight",
      );
      lastSyncError = {
        time:    new Date().toISOString(),
        message: `YouTube quota exceeded — resumes at ${new Date(Date.now() + pauseMs).toUTCString()}`,
        source:  "full_sync_cron",
      };
    } else {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err }, "Daily full channel sync failed");
      lastSyncError = { time: new Date().toISOString(), message, source: "full_sync_cron" };
    }
  }
}

// ─── RSS sync ─────────────────────────────────────────────────────────────────

async function runRSSSync(log: Logger, apiKey?: string): Promise<void> {
  // Back off after a 404 — YouTube refuses RSS from some hosting IPs; no
  // point hammering it every 5 minutes until the cooldown expires.
  if (rssBackoffUntil !== null && Date.now() < rssBackoffUntil) return;

  try {
    const result = await syncFromRSS(log);
    rssBackoffUntil = null; // clear any previous backoff on success
    lastRSSSync = new Date();

    // Always keep Today's Highlight and Latest Broadcast pointing to the newest
    // upload — runs on every RSS tick so home page sections stay current even
    // when no new video was inserted in this cycle.
    refreshFeaturedSermon(log).catch(err => {
      log.warn({ err }, "refreshFeaturedSermon after RSS sync failed (non-fatal)");
    });

    if (result.inserted > 0) {
      sseBroadcaster.broadcast({
        type: "sync_complete",
        data: { synced: result.inserted, source: "rss" },
      });

      if (apiKey && result.insertedVideoIds.length > 0 &&
          (quotaPausedUntil === null || Date.now() >= quotaPausedUntil)) {
        log.info(
          { videoIds: result.insertedVideoIds },
          "RSS found new videos — enriching immediately via YouTube API",
        );
        setTimeout(async () => {
          try {
            const enriched = await enrichVideoIds(apiKey, result.insertedVideoIds, log);
            if (enriched > 0) {
              sseBroadcaster.broadcast({
                type: "sync_complete",
                data: { synced: enriched, source: "rss_enrichment" },
              });
              log.info({ enriched }, "Immediate RSS enrichment broadcast sent");
            }
          } catch (err) {
            if (err instanceof QuotaExceededError) {
              const pauseMs = msUntilUtcMidnight();
              quotaPausedUntil = Date.now() + pauseMs;
              log.warn(
                { resumesInHours: Math.round(pauseMs / 3600000) },
                "YouTube API quota exceeded during RSS enrichment — pausing until UTC midnight",
              );
            } else {
              log.warn({ err }, "Immediate RSS enrichment failed (non-fatal) — will retry at next API sync");
            }
          }
        }, 4_000);
      }
    }
  } catch (err) {
    if (err instanceof RSSHttpError && err.status === 404) {
      // 404 most likely means YouTube is refusing the request from this
      // hosting provider's IP range.  Back off for 30 minutes so we don't
      // flood logs with repeated WARN entries on every 5-min tick.
      rssBackoffUntil = Date.now() + RSS_404_BACKOFF_MS;
      log.info(
        { status: 404, resumesInMinutes: 30 },
        "RSS feed returned 404 — likely IP-range restriction by YouTube; backing off for 30 min",
      );
    } else {
      const { recordDbError } = await import("./neon-quota-monitor.js");
      recordDbError(err);
      log.warn({ err }, "RSS sync failed (non-fatal)");
    }
  }
}

// ─── WebSub auto-renewal ──────────────────────────────────────────────────────

async function renewWebSub(log: Logger): Promise<void> {
  if (!webSubCallbackUrl) {
    log.warn("WebSub callback URL not configured — skipping renewal");
    return;
  }
  try {
    log.info({ callbackUrl: webSubCallbackUrl }, "Auto-renewing WebSub subscription (23h cycle)");
    await subscribeToWebSub(webSubCallbackUrl, log);
    lastWebSubRenewal = new Date();
    log.info("WebSub subscription renewed successfully");
  } catch (err) {
    log.error({ err }, "WebSub auto-renewal failed — will retry next 23h cycle");
  }
}

// ─── AI Metadata enrichment ───────────────────────────────────────────────────

async function runMetadataEnrichment(log: Logger): Promise<void> {
  try {
    const enriched = await enrichNextSermonBatch(5, log);
    if (enriched > 0) {
      log.info({ count: enriched }, "Local AI metadata enrichment batch complete");
    }
  } catch (err) {
    log.warn({ err }, "Metadata enrichment batch failed (non-fatal)");
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startCron(log: Logger, websubUrl?: string): void {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (websubUrl) {
    webSubCallbackUrl = websubUrl;
    lastWebSubRenewal = new Date();
  }

  // ── AI Learning — startup (delayed 90s to let DB settle after boot) ─────
  setTimeout(() => {
    ingestAllSermons(log).catch(err => log.warn({ err }, "Startup sermon ingestion failed (non-fatal)"));
    ingestActivityLearning(log).catch(err => log.warn({ err }, "Startup activity learning failed (non-fatal)"));
  }, 90_000);

  // ── RSS sync — always active, runs every 5 minutes ──────────────────────
  log.info({ intervalMs: RSS_INTERVAL_MS }, "Starting YouTube RSS sync (5-min, quota-free)");
  runRSSSync(log, apiKey).catch(err => log.warn({ err }, "RSS startup sync error"));
  rssCronHandle = setInterval(
    () => runRSSSync(log, apiKey).catch(err => log.warn({ err }, "RSS sync cron error")),
    RSS_INTERVAL_MS,
  );
  rssCronHandle.unref();

  // ── API sync — requires YOUTUBE_API_KEY ──────────────────────────────────
  if (!apiKey) {
    log.info("YOUTUBE_API_KEY not set — YouTube Data API sync disabled (RSS still active)");
  } else {
    log.info({ intervalMs: API_INTERVAL_MS }, "Starting YouTube API sync cron (30-min)");
    // Delay the first API sync by 35 seconds so RSS has time to complete its
    // startup run (and any immediate enrichment) before the API cron fires —
    // this avoids double-consuming quota in the first seconds after boot.
    apiStartupTimer = setTimeout(() => {
      runApiSync(apiKey, log).catch(err => log.warn({ err }, "API startup sync error"));
      apiCronHandle = setInterval(
        () => runApiSync(apiKey, log).catch(err => log.warn({ err }, "API sync cron error")),
        API_INTERVAL_MS,
      );
      if (apiCronHandle) apiCronHandle.unref();
    }, 35_000);

    // ── Full channel sync — runs once every 24 hours ────────────────────────
    // Ensures every video ever uploaded to the channel is in the DB, not just
    // the 50 newest that the 30-minute recent sync covers.
    // First run is delayed by 5 minutes to avoid competing with startup syncs.
    log.info({ intervalMs: FULL_SYNC_INTERVAL_MS }, "Starting daily full channel sync cron (24h)");
    setTimeout(() => {
      runFullSync(apiKey, log).catch(err => log.warn({ err }, "Full sync startup error"));
      fullSyncCronHandle = setInterval(
        () => runFullSync(apiKey, log).catch(err => log.warn({ err }, "Full sync cron error")),
        FULL_SYNC_INTERVAL_MS,
      );
      if (fullSyncCronHandle) fullSyncCronHandle.unref();
    }, 5 * 60 * 1000);
  }

  // ── WebSub auto-renewal — every 23 hours ────────────────────────────────
  log.info("Starting WebSub auto-renewal cron (23h cycle)");
  websubCronHandle = setInterval(
    () => renewWebSub(log).catch(err => log.warn({ err }, "WebSub renewal cron error")),
    WEBSUB_RENEWAL_MS,
  );
  websubCronHandle.unref();

  // ── AI Metadata enrichment — every 10 minutes (batch of 5) ──────────────
  log.info("Starting AI metadata enrichment cron (10-min, 5 sermons/batch)");
  metadataStartupTimer = setTimeout(() => {
    runMetadataEnrichment(log).catch(err => log.warn({ err }, "Metadata enrichment startup error"));
    metadataCronHandle = setInterval(
      () => runMetadataEnrichment(log).catch(err => log.warn({ err }, "Metadata enrichment cron error")),
      METADATA_INTERVAL_MS,
    );
    if (metadataCronHandle) metadataCronHandle.unref();
  }, 45_000);

  // ── Per-minute checks: service reminder + daily devotion push + email ───
  reminderCronHandle = setInterval(() => {
    try {
      checkAndSendServiceReminder(log);
      checkAndSendDevotionNotification(log);
      checkAndBroadcastDevotionEmail(log);
      checkEventPromotionTransitions(log);
      checkAndSendEventReminders(log);
      checkAndBroadcastWarriCrusadeHourly(log).catch(err =>
        log.warn({ err }, "Warri Crusade Day 2 hourly broadcast tick error"),
      );
      checkAndBroadcastCampaignPromotions(log).catch(err =>
        log.warn({ err }, "Campaign promotion broadcast tick error"),
      );
      processScheduledBroadcasts(log).catch(err =>
        log.warn({ err }, "Scheduled broadcasts tick error"),
      );
    } catch (err) {
      log.warn({ err }, "Service reminder/devotion check error");
    }
  }, 60_000);
  reminderCronHandle.unref();

  // ── Midnight devotion pre-generation ─────────────────────────────────────
  // Fires once at the next UTC midnight, then repeats every 24 hours
  const msToMidnight = msUntilUtcMidnight();
  log.info(
    { firesInMinutes: Math.round(msToMidnight / 60_000) },
    "Midnight devotion pre-generation scheduled",
  );
  midnightTimer = setTimeout(() => {
    preGenerateTomorrowsDevotion(log).catch(err => log.warn({ err }, "Midnight devotion generation error"));
    dailyDevotionHandle = setInterval(
      () => preGenerateTomorrowsDevotion(log).catch(err => log.warn({ err }, "Daily devotion cron error")),
      DAILY_MS,
    );
    dailyDevotionHandle.unref();
  }, msToMidnight);
  // Allow process to exit even if this timer is pending
  if (typeof midnightTimer === "object" && midnightTimer !== null && "unref" in midnightTimer) {
    (midnightTimer as ReturnType<typeof setTimeout> & { unref(): void }).unref();
  }

  // ── Event notification scheduler — every 30 minutes ─────────────────────────
  // Scans `event_calendar` for upcoming events and dispatches multi-channel
  // reminders (web push + Expo push + email + SSE) at 24h/12h/6h/1h milestones.
  // Idempotent + retrying via `event_notification_dispatch_log` (see
  // event-notification-scheduler.ts).
  const EVENT_NOTIFICATION_INTERVAL_MS = 30 * 60 * 1000;
  setEventNotificationIntervalMs(EVENT_NOTIFICATION_INTERVAL_MS);
  eventNotificationStartupTimer = setTimeout(() => {
    runEventNotificationTick(log).catch(err =>
      log.warn({ err }, "Event notification scheduler initial tick error"),
    );
    eventNotificationHandle = setInterval(
      () => runEventNotificationTick(log).catch(err =>
        log.warn({ err }, "Event notification scheduler tick error"),
      ),
      EVENT_NOTIFICATION_INTERVAL_MS,
    );
    eventNotificationHandle.unref();
    log.info(
      { intervalMs: EVENT_NOTIFICATION_INTERVAL_MS },
      "Event notification scheduler started (30-min interval)",
    );

    // Start the queue worker that drains enqueued jobs in the background.
    // Polls every 10s, claims a batch atomically, dispatches with
    // exponential-backoff retries and dead-letter handling.
    startEventNotificationWorker(log);

    // Verify SMTP credentials & TLS handshake on boot so the admin dashboard
    // shows a green/red light immediately. Fire-and-forget — verify failures
    // never block server startup or notification delivery.
    if (isEmailConfigured()) {
      verifyEmailTransport(log).catch(err =>
        log.warn({ err }, "Initial SMTP verify threw — will retry on first send"),
      );
    } else {
      log.warn("SMTP not configured — devotion + event-reminder emails will be skipped");
    }
  }, 30_000);
  eventNotificationStartupTimer.unref();

  // ── Expo receipt checker — runs every 15 minutes ────────────────────────────
  // First run is delayed by 15 minutes so we don't check receipts that were
  // sent only seconds ago (Expo needs time to process them).
  receiptCheckerHandle = setInterval(
    () => checkExpoPushReceipts(log).catch(err => log.warn({ err }, "Expo receipt check error")),
    RECEIPT_CHECK_INTERVAL_MS,
  );
  receiptCheckerHandle.unref();
  log.info({ intervalMs: RECEIPT_CHECK_INTERVAL_MS }, "Expo push receipt checker started (15-min interval)");

  // ── Self-warm pinger — keeps the Node event loop, V8 caches, and DB pool ────
  // hot between external requests. Hits the local /api/ping every 4 minutes so
  // even if the platform reaches an idle window the server never goes "cold".
  // The endpoint is sub-millisecond and allocation-free, so the overhead is nil.
  const SELF_WARM_INTERVAL_MS = 4 * 60 * 1000;
  const selfWarmPort = process.env.PORT || "8080";
  const selfWarmUrl = `http://127.0.0.1:${selfWarmPort}/api/ping`;
  selfWarmHandle = setInterval(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    fetch(selfWarmUrl, { signal: controller.signal, headers: { "x-self-warm": "1" } })
      .then((r) => {
        if (!r.ok) log.warn({ status: r.status, url: selfWarmUrl }, "Self-warm ping returned non-200");
      })
      .catch((err) => {
        // Swallow — failure here is best-effort; main health checks are elsewhere.
        log.debug({ err: String(err) }, "Self-warm ping skipped");
      })
      .finally(() => clearTimeout(timeout));
  }, SELF_WARM_INTERVAL_MS);
  selfWarmHandle.unref();
  log.info({ intervalMs: SELF_WARM_INTERVAL_MS, target: selfWarmUrl }, "Self-warm pinger started — keeps process hot between requests");

  log.info("Automation engine started: RSS | API (30-min recent) | Full channel sync (24h) | WebSub | AI metadata | Service reminders | Daily devotion push | Midnight pre-generation | Expo receipt checker | Self-warm");
}

export function stopCron(): void {
  stopEventNotificationWorker();
  [apiCronHandle, fullSyncCronHandle, rssCronHandle, websubCronHandle, metadataCronHandle, reminderCronHandle, receiptCheckerHandle, eventNotificationHandle, selfWarmHandle]
    .forEach(h => h && clearInterval(h));
  [apiStartupTimer, metadataStartupTimer, midnightTimer, eventNotificationStartupTimer]
    .forEach(h => h && clearTimeout(h));
  if (dailyDevotionHandle) clearInterval(dailyDevotionHandle);
  apiCronHandle = null;
  fullSyncCronHandle = null;
  rssCronHandle = null;
  websubCronHandle = null;
  metadataCronHandle = null;
  reminderCronHandle = null;
  receiptCheckerHandle = null;
  apiStartupTimer = null;
  metadataStartupTimer = null;
  midnightTimer = null;
  dailyDevotionHandle = null;
  eventNotificationHandle = null;
  eventNotificationStartupTimer = null;
}

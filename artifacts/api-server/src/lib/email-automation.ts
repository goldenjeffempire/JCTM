/**
 * email-automation.ts
 *
 * Conference email automation helpers:
 *  • WAT timezone utilities and conference day detection
 *  • HMAC-signed unsubscribe token generation/verification
 *  • Global opt-out list management (email_unsubscribes table)
 *  • email_send_log tracking (best-effort, never blocks delivery)
 *  • checkAndSendConferencePreReminder() — fires at 6:00–6:09 AM WAT on conference days
 *  • checkAndSendConferenceLiveEmail()   — cron fallback at 8:00–8:04 AM WAT
 *  • triggerConferenceLiveEmail()        — event-based, called when admin goes live
 */

import crypto from "crypto";
import { pool } from "@workspace/db";
import { logger } from "./logger.js";
import type { Logger } from "pino";

// ─── Conference constants ─────────────────────────────────────────────────────

/** WAT dates for Ministers Conference 2026 — Apostolic Fire */
const CONFERENCE_DATES = new Set(["2026-05-08", "2026-05-09", "2026-05-10"]);

/** Service starts at 8:00 AM WAT; reminder fires at 6:00 AM WAT (2 h before) */
const REMINDER_HOUR_WAT = 6;
const SERVICE_HOUR_WAT = 8;

const CONFERENCE = {
  title: "Ministers Conference 2026 — Apostolic Fire",
  tagline: "Come, receive your apostolic fire from the altar of God",
  timeStr: "8:00 AM WAT",
  location: "JCTM International Headquarters, Warri, Delta State, Nigeria",
} as const;

// ─── WAT time helpers ─────────────────────────────────────────────────────────

interface WatTime {
  dateStr: string; // "YYYY-MM-DD"
  hour: number;    // 0–23 in WAT
  minute: number;  // 0–59 in WAT
}

function getWatTime(): WatTime {
  const watMs = Date.now() + 60 * 60 * 1000; // UTC+1, no DST
  const d = new Date(watMs);
  return {
    dateStr: d.toISOString().slice(0, 10),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

export function isConferenceDay(): boolean {
  return CONFERENCE_DATES.has(getWatTime().dateStr);
}

// ─── HMAC unsubscribe token ───────────────────────────────────────────────────

function getHmacSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.JWT_SECRET ||
    "jctm-email-unsub-2026"
  );
}

/**
 * Generates a 32-character hex HMAC-SHA256 token for the given email address.
 * Used to create tamper-evident one-click unsubscribe links.
 */
export function generateUnsubToken(email: string): string {
  return crypto
    .createHmac("sha256", getHmacSecret())
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

/**
 * Verifies the token from an unsubscribe link using constant-time comparison
 * to prevent timing oracle attacks.
 */
export function verifyUnsubToken(email: string, token: string): boolean {
  const expected = generateUnsubToken(email.trim().toLowerCase());
  if (expected.length !== (token ?? "").length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

// ─── Global opt-out list ──────────────────────────────────────────────────────

export async function isGloballyUnsubscribed(email: string): Promise<boolean> {
  try {
    const r = await pool.query(
      "SELECT 1 FROM email_unsubscribes WHERE email = $1 LIMIT 1",
      [email.trim().toLowerCase()],
    );
    return r.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Adds email to the global opt-out list and deactivates any active
 * devotion/event subscriptions for that address.
 */
export async function addGlobalUnsubscribe(
  email: string,
  source: string = "campaign",
): Promise<void> {
  const e = email.trim().toLowerCase();
  await pool.query(
    `INSERT INTO email_unsubscribes (email, source)
     VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING`,
    [e, source],
  );
  // Deactivate opt-in subscriptions so routine emails stop too
  await Promise.allSettled([
    pool.query(
      "UPDATE devotion_subscribers SET is_active = false WHERE lower(trim(email)) = $1",
      [e],
    ),
    pool.query(
      "UPDATE event_notification_subscribers SET is_active = false WHERE lower(trim(email)) = $1",
      [e],
    ),
  ]);
}

// ─── Email send log ───────────────────────────────────────────────────────────

export interface EmailSendLogEntry {
  emailType: string;
  recipientEmail: string;
  campaignKey?: string | null;
  status: "sent" | "failed";
  error?: string | null;
}

/**
 * Best-effort delivery tracking — failures are silently swallowed so they
 * never block actual email dispatch.
 */
export async function logEmailSend(entry: EmailSendLogEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO email_send_log (email_type, recipient_email, campaign_key, status, error, sent_at)
       VALUES ($1, $2, $3, $4, $5, now())`,
      [
        entry.emailType,
        entry.recipientEmail.trim().toLowerCase(),
        entry.campaignKey ?? null,
        entry.status,
        entry.error?.slice(0, 500) ?? null,
      ],
    );
  } catch {
    // Non-fatal — tracking must never break delivery
  }
}

// ─── In-memory dedup guards (per server lifetime) ─────────────────────────────
// DB dedup is the authoritative source; these are a fast short-circuit so the
// per-minute tick doesn't hit the DB unnecessarily after first fire.

const firedReminders = new Set<string>(); // "reminder-2026-05-08"
const firedLiveNotifs = new Set<string>(); // "live-2026-05-08"

async function campaignAlreadyExists(key: string): Promise<boolean> {
  try {
    const r = await pool.query<{ id: number }>(
      `SELECT id FROM conference_campaigns
       WHERE campaign_key = $1 AND status != 'failed'
       LIMIT 1`,
      [key],
    );
    return r.rows.length > 0;
  } catch {
    return false;
  }
}

// ─── Conference pre-event reminder (6 AM WAT cron tick) ──────────────────────

/**
 * Called every minute from the cron tick.
 * Fires once at 6:00–6:09 AM WAT on each Ministers Conference day.
 * Deduplication is enforced by both in-memory flag and DB campaign record.
 */
export async function checkAndSendConferencePreReminder(
  log: Logger = logger,
): Promise<void> {
  if (!isConferenceDay()) return;

  const { dateStr, hour, minute } = getWatTime();
  if (hour !== REMINDER_HOUR_WAT || minute > 9) return;

  const memKey = `reminder-${dateStr}`;
  if (firedReminders.has(memKey)) return;

  const campaignKey = `conference-2026-day-reminder-${dateStr}`;
  if (await campaignAlreadyExists(campaignKey)) {
    firedReminders.add(memKey);
    return;
  }

  firedReminders.add(memKey); // Optimistic lock — prevent parallel launches from same process

  log.info({ dateStr, hour, minute }, "Firing automated Ministers Conference pre-event reminder");

  try {
    const { launchConferenceCampaign } = await import("./conference-campaign-engine.js");
    const { getPublicBaseUrl } = await import("./email-engine.js");
    const base = getPublicBaseUrl();

    const humanDate = new Date(`${dateStr}T07:00:00Z`).toLocaleDateString("en-NG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Africa/Lagos",
    });

    const result = await launchConferenceCampaign({
      campaignKey,
      conferenceTitle: CONFERENCE.title,
      tagline: CONFERENCE.tagline,
      dateStr: humanDate,
      timeStr: CONFERENCE.timeStr,
      location: CONFERENCE.location,
      registrationUrl: `${base}/conference`,
      livestreamUrl: `${base}/livestream`,
      log,
    });

    log.info({ campaignKey, ...result }, "Conference pre-event reminder launched automatically");
  } catch (err) {
    firedReminders.delete(memKey); // Allow retry on next minute
    log.error({ err, campaignKey }, "Automated conference pre-event reminder failed to launch");
  }
}

// ─── Conference live notification ─────────────────────────────────────────────

async function _launchLiveNotification(
  log: Logger,
  dateStr: string,
  title: string | null,
  streamUrl: string | null,
  videoId: string | null,
): Promise<void> {
  const { launchConferenceLiveNotification } = await import("./conference-campaign-engine.js");
  const { getPublicBaseUrl } = await import("./email-engine.js");
  const base = getPublicBaseUrl();

  const campaignKey = `conference-2026-live-${dateStr}`;
  const liveUrl =
    streamUrl ??
    (videoId ? `https://www.youtube.com/watch?v=${videoId}` : `${base}/livestream`);

  const result = await launchConferenceLiveNotification({
    campaignKey,
    conferenceTitle: CONFERENCE.title,
    serviceTitle: title ?? CONFERENCE.title,
    liveUrl,
    ministryWebsite: base,
    log,
  });

  log.info({ campaignKey, ...result }, "Conference live email notification launched");
}

/**
 * Event-based trigger — call this when the admin manually sets the stream live
 * on a conference day. Fire-and-forget from the caller.
 */
export async function triggerConferenceLiveEmail(
  log: Logger = logger,
  title: string | null,
  streamUrl: string | null,
  videoId: string | null,
): Promise<void> {
  if (!isConferenceDay()) return;

  const { dateStr } = getWatTime();
  const memKey = `live-${dateStr}`;
  if (firedLiveNotifs.has(memKey)) return;

  const campaignKey = `conference-2026-live-${dateStr}`;
  if (await campaignAlreadyExists(campaignKey)) {
    firedLiveNotifs.add(memKey);
    return;
  }

  firedLiveNotifs.add(memKey); // Optimistic lock

  log.info({ dateStr, title }, "Triggering Ministers Conference live email notification");

  try {
    await _launchLiveNotification(log, dateStr, title, streamUrl, videoId);
  } catch (err) {
    firedLiveNotifs.delete(memKey); // Allow retry
    log.error({ err }, "Conference live email notification failed to launch");
  }
}

/**
 * Cron fallback — fires at 8:00–8:04 AM WAT on conference days.
 * Handles the case where the admin went live before the server started,
 * or where no manual trigger was called. Same dedup ensures no double-send.
 */
export async function checkAndSendConferenceLiveEmail(
  log: Logger = logger,
): Promise<void> {
  if (!isConferenceDay()) return;

  const { hour, minute } = getWatTime();
  if (hour !== SERVICE_HOUR_WAT || minute > 4) return;

  const { dateStr } = getWatTime();
  await triggerConferenceLiveEmail(log, null, null, null).catch((err) =>
    log.warn({ err }, "Conference live cron fallback failed"),
  );
  log.debug({ dateStr }, "Conference live cron fallback check complete");
}

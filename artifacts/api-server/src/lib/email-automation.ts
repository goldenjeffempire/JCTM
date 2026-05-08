/**
 * email-automation.ts
 *
 * Conference email automation helpers:
 *  • WAT timezone utilities and conference day detection
 *  • HMAC-signed unsubscribe token generation/verification
 *  • Global opt-out list management (email_unsubscribes table)
 *  • email_send_log tracking (best-effort, never blocks delivery)
 *  • checkAndSendConferencePreReminder()       — fires at 6:00–6:09 AM WAT on conference days
 *  • checkAndSendConferenceLiveEmail()         — cron fallback at 8:00–8:04 AM WAT
 *  • triggerConferenceLiveEmail()              — event-based, called when admin goes live
 *  • checkAndSendConferenceMorningBulkEmail()  — fires at 7:00–7:09 AM WAT on Days 2 & 3
 *                                               (May 9–10) to all 104 ministry recipients
 */

import crypto from "crypto";
import { spawn } from "child_process";
import { resolve } from "path";
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
 * Adds email to the global opt-out list and deactivates the subscriber
 * across ALL tables: subscribers, devotion_subscribers,
 * event_notification_subscribers, and email_unsubscribes.
 */
export async function addGlobalUnsubscribe(
  email: string,
  source: string = "campaign",
): Promise<void> {
  const { deactivateSubscriber } = await import("./subscriber-manager.js");
  await deactivateSubscriber(email, source, logger);
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

// ─── Day 1 corrected-date midnight resend ─────────────────────────────────────
// The Day 1 bulk emails (May 8) showed "Invalid Date" in the devotion header.
// The fix is in send-bulk-emails.mjs. This one-shot cron fires at 23:00–23:09
// UTC on May 8 (= midnight WAT, after the SMTP daily quota resets) and resends
// both emails to all 104 recipients with the correct date.
// Dedup: in-memory flag + email_send_log campaign_key.

const firedDay1Resend = { done: false };

async function day1ResendAlreadySent(): Promise<boolean> {
  try {
    const r = await pool.query<{ id: number }>(
      `SELECT id FROM email_send_log
       WHERE campaign_key = 'conference-2026-day1-midnight-resend' AND status = 'sent'
       LIMIT 1`,
    );
    return r.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Fires once between 23:00–23:09 UTC on May 8, 2026 (= midnight WAT).
 * Resends the corrected devotion + conference emails to all 104 recipients
 * now that (a) the date fix is live and (b) the SMTP daily quota has reset.
 */
export async function checkAndResendDay1CorrectedEmail(
  log: Logger = logger,
): Promise<void> {
  const now = new Date();
  const utcDate = now.toISOString().slice(0, 10);
  const utcHour = now.getUTCHours();
  const utcMin  = now.getUTCMinutes();

  // Only on 2026-05-08 UTC, between 23:00–23:09
  if (utcDate !== "2026-05-08" || utcHour !== 23 || utcMin > 9) return;

  if (firedDay1Resend.done) return;
  if (await day1ResendAlreadySent()) { firedDay1Resend.done = true; return; }

  firedDay1Resend.done = true; // Optimistic lock

  log.info({ utcDate, utcHour, utcMin }, "Firing Day 1 midnight resend (corrected date, SMTP quota reset)");

  const workspaceRoot = process.cwd();
  const scriptPath = resolve(workspaceRoot, "send-bulk-emails.mjs");

  try {
    await new Promise<void>((res, rej) => {
      const child = spawn("node", [scriptPath], {
        cwd: workspaceRoot,
        stdio: "pipe",
        env: { ...process.env },
      });
      child.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) log.info({ script: "day1-resend", output: text }, "day1-resend stdout");
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) log.warn({ script: "day1-resend", output: text }, "day1-resend stderr");
      });
      child.on("close", (code: number | null) => {
        code === 0 ? res() : rej(new Error(`send-bulk-emails.mjs exited with code ${code}`));
      });
      child.on("error", rej);
    });

    await pool.query(
      `INSERT INTO email_send_log
         (email_type, recipient_email, campaign_key, status, sent_at)
       VALUES ('conference_bulk_day1_resend', 'all-recipients', 'conference-2026-day1-midnight-resend', 'sent', now())
       ON CONFLICT DO NOTHING`,
    );

    log.info("Day 1 midnight resend complete — all 104 recipients served with corrected date");
  } catch (err) {
    firedDay1Resend.done = false; // Allow retry on next minute
    log.error({ err, scriptPath }, "Day 1 midnight resend failed — will retry next minute");
  }
}

// ─── Conference morning bulk email — Days 2 & 3 auto-trigger ─────────────────
// Fires at 7:00–7:09 AM WAT on May 9 and May 10, 2026 (Days 2 and 3).
// Spawns send-bulk-emails.mjs from the workspace root, which sends both the
// daily devotion AND the conference reminder to all 104 ministry recipients.
// Deduplication: in-memory flag (fast path) + email_send_log campaign_key check
// (survives server restarts within the same day's 7 AM window).

/** WAT dates for Days 2 and 3 only — Day 1 was sent manually */
const CONFERENCE_BULK_DAYS = new Set(["2026-05-09", "2026-05-10"]);
const MORNING_BULK_HOUR_WAT = 7; // 7:00 AM WAT = 06:00 UTC

const firedBulkMorning = new Set<string>(); // "bulk-morning-2026-05-09"

async function bulkMorningAlreadySent(dateStr: string): Promise<boolean> {
  const campaignKey = `conference-2026-bulk-morning-${dateStr}`;
  try {
    const r = await pool.query<{ id: number }>(
      `SELECT id FROM email_send_log
       WHERE campaign_key = $1 AND status = 'sent'
       LIMIT 1`,
      [campaignKey],
    );
    return r.rows.length > 0;
  } catch {
    return false; // On DB error, let the spawn attempt proceed
  }
}

/**
 * Called every minute from the cron tick.
 * Fires once at 7:00–7:09 AM WAT on May 9 and May 10, 2026.
 * Spawns send-bulk-emails.mjs (all 104 recipients, no batch args = full list).
 */
export async function checkAndSendConferenceMorningBulkEmail(
  log: Logger = logger,
): Promise<void> {
  const { dateStr, hour, minute } = getWatTime();

  // Only on Days 2 and 3
  if (!CONFERENCE_BULK_DAYS.has(dateStr)) return;

  // Only during the 7:00–7:09 AM WAT window
  if (hour !== MORNING_BULK_HOUR_WAT || minute > 9) return;

  const memKey = `bulk-morning-${dateStr}`;
  if (firedBulkMorning.has(memKey)) return;

  // DB check — survives restarts within the same 10-min window
  if (await bulkMorningAlreadySent(dateStr)) {
    firedBulkMorning.add(memKey);
    return;
  }

  // Optimistic lock — prevents parallel ticks within the same process from
  // double-spawning. If the spawn fails, the memKey is removed so the next
  // minute tick can retry.
  firedBulkMorning.add(memKey);

  const campaignKey = `conference-2026-bulk-morning-${dateStr}`;
  log.info(
    { dateStr, hour, minute, campaignKey },
    "Firing scheduled Ministers Conference morning bulk email (Days 2 & 3)",
  );

  // The server is always started from the workspace root
  // (NODE_ENV=production node artifacts/api-server/dist/index.mjs),
  // so process.cwd() is the workspace root where send-bulk-emails.mjs lives.
  const workspaceRoot = process.cwd();
  const scriptPath = resolve(workspaceRoot, "send-bulk-emails.mjs");

  try {
    await new Promise<void>((res, rej) => {
      const child = spawn("node", [scriptPath], {
        cwd: workspaceRoot,
        stdio: "pipe",
        env: { ...process.env },
      });

      child.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) log.info({ script: "send-bulk-emails", output: text }, "bulk-email stdout");
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) log.warn({ script: "send-bulk-emails", output: text }, "bulk-email stderr");
      });

      child.on("close", (code: number | null) => {
        if (code === 0) {
          res();
        } else {
          rej(new Error(`send-bulk-emails.mjs exited with code ${code}`));
        }
      });

      child.on("error", rej);
    });

    // Write the dedup anchor to the DB so a restart within the same window
    // won't re-send. A single synthetic row represents the whole batch.
    await pool.query(
      `INSERT INTO email_send_log
         (email_type, recipient_email, campaign_key, status, sent_at)
       VALUES ('conference_bulk_morning', 'all-recipients', $1, 'sent', now())
       ON CONFLICT DO NOTHING`,
      [campaignKey],
    );

    log.info(
      { campaignKey, dateStr },
      "Ministers Conference morning bulk email broadcast complete — all recipients served",
    );
  } catch (err) {
    // Remove optimistic lock so the next minute tick can retry
    firedBulkMorning.delete(memKey);
    log.error(
      { err, campaignKey, scriptPath },
      "Ministers Conference morning bulk email broadcast failed — will retry next minute",
    );
  }
}

/**
 * conference-campaign-engine.ts
 *
 * Production-safe Ministers Conference email reminder campaign engine.
 *
 * Features:
 *  • Aggregates email addresses from ALL 8 database tables
 *  • RFC-compliant email validation
 *  • Case-insensitive deduplication
 *  • Full unsubscribe compliance (devotion_subscribers + event_notification_subscribers)
 *  • Persistent queue in DB (conference_campaign_recipients)
 *  • Background async processing — never blocks HTTP requests
 *  • Per-recipient retry tracking (up to 3 attempts)
 *  • Rate-limited SMTP dispatch via existing pooled transport
 *  • Timezone-aware event timing (8:00 AM WAT = UTC+1)
 *  • Branded responsive "Starting Today" reminder HTML template
 *  • Campaign-level sent / failed / skipped counters
 */

import crypto from "crypto";
import { pool } from "@workspace/db";
import {
  isEmailConfigured,
  getPublicBaseUrl,
  sendWithRetry,
} from "./email-engine.js";
import { logger } from "./logger.js";
import type { Logger } from "pino";
import nodemailer from "nodemailer";

// ─── Internal HMAC unsubscribe token ─────────────────────────────────────────
// Mirrors the logic in email-automation.ts but kept local to avoid circular deps.

function _buildUnsubToken(email: string): string {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.JWT_SECRET ||
    "jctm-email-unsub-2026";
  return crypto
    .createHmac("sha256", secret)
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** RFC 5322 simplified — rejects obvious garbage while allowing internationalised domains */
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/** Max length to reject obviously bogus addresses */
const EMAIL_MAX_LEN = 254;

/** Batch size for queue processing */
const PROCESS_BATCH = 10;

/** Milliseconds between batches — gives ~PROCESS_BATCH / 2 per second on top of SMTP pool rate limiting */
const BATCH_PAUSE_MS = 600;

/** Max per-recipient retry attempts before marking failed */
const MAX_ATTEMPTS = 3;

// ─── Email validation ─────────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length < 5 || trimmed.length > EMAIL_MAX_LEN) return false;
  return EMAIL_RE.test(trimmed);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CampaignRecipient {
  email: string;
  name: string | null;
  source: string;
}

export interface CampaignStatus {
  id: number;
  campaignKey: string;
  conferenceTitle: string;
  status: "pending" | "running" | "completed" | "failed";
  totalRecipients: number;
  sent: number;
  failed: number;
  skipped: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  createdAt: string;
  durationSeconds: number | null;
}

// ─── Unsubscribe registry ─────────────────────────────────────────────────────

/**
 * Returns a Set of lowercase emails that have actively opted out of JCTM
 * email communications. We check both subscriber tables.
 */
async function loadUnsubscribedEmails(): Promise<Set<string>> {
  const result = await pool.query<{ email: string }>(`
    SELECT lower(trim(email)) AS email
    FROM devotion_subscribers
    WHERE is_active = false AND email IS NOT NULL AND email != ''
    UNION
    SELECT lower(trim(email)) AS email
    FROM event_notification_subscribers
    WHERE is_active = false AND email IS NOT NULL AND email != ''
    UNION
    SELECT email
    FROM email_unsubscribes
    WHERE email IS NOT NULL AND email != ''
  `);
  return new Set(result.rows.map((r) => r.email));
}

// ─── Email aggregation ────────────────────────────────────────────────────────

/**
 * Queries every email source and returns a deduplicated Map keyed by
 * lowercase email → { name, source }.
 *
 * Priority order (first wins for source attribution; name is filled in if missing):
 *   0. subscribers (unified registry — primary source, includes ministry_list seed)
 *   1. event_notification_subscribers (active opt-in, legacy)
 *   2. devotion_subscribers (active opt-in, legacy)
 *   3. conference_registrations
 *   4. member_auth
 *   5. giving_logs (donors)
 *   6. testimonies (approved)
 *   7. member_directory
 *   8. sponsorship_inquiries
 */
export async function aggregateAllEmails(
  log: Logger = logger,
): Promise<Map<string, { name: string | null; source: string }>> {
  const emailMap = new Map<string, { name: string | null; source: string }>();

  function add(
    email: string | null | undefined,
    name: string | null,
    source: string,
  ) {
    if (!email) return;
    const key = email.trim().toLowerCase();
    if (!isValidEmail(key)) return;
    if (!emailMap.has(key)) {
      emailMap.set(key, { name, source });
    } else if (name && !emailMap.get(key)!.name) {
      emailMap.get(key)!.name = name;
    }
  }

  const queries = await Promise.allSettled([
    // 0. Unified subscriber registry (primary — includes ministry_list seed)
    pool.query<{ email: string; name: string | null; source: string }>(
      `SELECT lower(trim(email)) AS email, name, source
       FROM subscribers
       WHERE is_active = true AND email IS NOT NULL AND email != ''
       LIMIT 100000`,
    ),
    // 1. Event notification subscribers (active, legacy)
    pool.query<{ email: string }>(
      `SELECT lower(trim(email)) AS email
       FROM event_notification_subscribers
       WHERE is_active = true AND email IS NOT NULL AND email != ''
       LIMIT 50000`,
    ),
    // 2. Devotion subscribers (active, legacy)
    pool.query<{ email: string; name: string | null }>(
      `SELECT lower(trim(email)) AS email, name
       FROM devotion_subscribers
       WHERE is_active = true AND email IS NOT NULL AND email != ''
       LIMIT 50000`,
    ),
    // 3. Conference registrations (with names)
    pool.query<{ email: string; full_name: string | null }>(
      `SELECT lower(trim(email)) AS email, full_name
       FROM conference_registrations
       WHERE email IS NOT NULL AND email != ''
       LIMIT 50000`,
    ),
    // 4. Member auth
    pool.query<{ email: string; first_name: string | null; last_name: string | null }>(
      `SELECT lower(trim(email)) AS email, first_name, last_name
       FROM member_auth
       WHERE email IS NOT NULL AND email != ''
       LIMIT 50000`,
    ),
    // 5. Giving logs (donors)
    pool.query<{ email: string; donor_name: string | null }>(
      `SELECT lower(trim(donor_email)) AS email, donor_name
       FROM giving_logs
       WHERE donor_email IS NOT NULL AND donor_email != '' AND status = 'success'
       LIMIT 50000`,
    ),
    // 6. Testimonies (approved community members)
    pool.query<{ email: string; name: string | null }>(
      `SELECT lower(trim(email)) AS email, name
       FROM testimonies
       WHERE email IS NOT NULL AND email != '' AND approved = true
       LIMIT 50000`,
    ),
    // 7. Member directory
    pool.query<{ email: string; first_name: string | null; last_name: string | null }>(
      `SELECT lower(trim(email)) AS email, first_name, last_name
       FROM member_directory
       WHERE email IS NOT NULL AND email != ''
       LIMIT 50000`,
    ),
    // 8. Sponsorship inquiries
    pool.query<{ email: string; name: string | null }>(
      `SELECT lower(trim(email)) AS email, name
       FROM sponsorship_inquiries
       WHERE email IS NOT NULL AND email != ''
       LIMIT 50000`,
    ),
  ]);

  const [unified, evtSubs, devSubs, confReg, members, donors, testimonies, directory, sponsorships] = queries;

  // 0. Unified registry — primary source
  if (unified.status === "fulfilled") {
    for (const row of unified.value.rows) add(row.email, row.name, row.source ?? "subscribers");
  } else {
    log.warn({ err: unified.reason }, "Campaign: subscribers (unified) query failed");
  }

  if (evtSubs.status === "fulfilled") {
    for (const row of evtSubs.value.rows) add(row.email, null, "event_notification_subscribers");
  } else {
    log.warn({ err: evtSubs.reason }, "Campaign: event_notification_subscribers query failed");
  }

  if (devSubs.status === "fulfilled") {
    for (const row of devSubs.value.rows) add(row.email, row.name, "devotion_subscribers");
  } else {
    log.warn({ err: devSubs.reason }, "Campaign: devotion_subscribers query failed");
  }

  if (confReg.status === "fulfilled") {
    for (const row of confReg.value.rows) add(row.email, row.full_name, "conference_registrations");
  } else {
    log.warn({ err: confReg.reason }, "Campaign: conference_registrations query failed");
  }

  if (members.status === "fulfilled") {
    for (const row of members.value.rows) {
      const name = [row.first_name, row.last_name].filter(Boolean).join(" ") || null;
      add(row.email, name, "member_auth");
    }
  } else {
    log.warn({ err: members.reason }, "Campaign: member_auth query failed");
  }

  if (donors.status === "fulfilled") {
    for (const row of donors.value.rows) add(row.email, row.donor_name, "giving_logs");
  } else {
    log.warn({ err: donors.reason }, "Campaign: giving_logs query failed");
  }

  if (testimonies.status === "fulfilled") {
    for (const row of testimonies.value.rows) add(row.email, row.name, "testimonies");
  } else {
    log.warn({ err: testimonies.reason }, "Campaign: testimonies query failed");
  }

  if (directory.status === "fulfilled") {
    for (const row of directory.value.rows) {
      const name = [row.first_name, row.last_name].filter(Boolean).join(" ") || null;
      add(row.email, name, "member_directory");
    }
  } else {
    log.warn({ err: directory.reason }, "Campaign: member_directory query failed");
  }

  if (sponsorships.status === "fulfilled") {
    for (const row of sponsorships.value.rows) add(row.email, row.name, "sponsorship_inquiries");
  } else {
    log.warn({ err: sponsorships.reason }, "Campaign: sponsorship_inquiries query failed");
  }

  log.info(
    {
      unified: unified.status === "fulfilled" ? unified.value.rowCount : 0,
      evtSubs: evtSubs.status === "fulfilled" ? evtSubs.value.rowCount : 0,
      devSubs: devSubs.status === "fulfilled" ? devSubs.value.rowCount : 0,
      confReg: confReg.status === "fulfilled" ? confReg.value.rowCount : 0,
      members: members.status === "fulfilled" ? members.value.rowCount : 0,
      donors: donors.status === "fulfilled" ? donors.value.rowCount : 0,
      testimonies: testimonies.status === "fulfilled" ? testimonies.value.rowCount : 0,
      directory: directory.status === "fulfilled" ? directory.value.rowCount : 0,
      sponsorships: sponsorships.status === "fulfilled" ? sponsorships.value.rowCount : 0,
      uniqueAfterDedup: emailMap.size,
    },
    "Campaign: email aggregation complete",
  );

  return emailMap;
}

// ─── Reminder email template ──────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ConferenceReminderOpts {
  recipientName?: string | null;
  conferenceTitle: string;
  tagline: string;
  dateStr: string;
  timeStr: string;
  location: string;
  registrationUrl: string;
  livestreamUrl: string;
  unsubscribeUrl: string;
  ministryWebsite: string;
}

export function renderConferenceReminderEmail(opts: ConferenceReminderOpts): {
  subject: string;
  text: string;
  html: string;
} {
  const {
    recipientName,
    conferenceTitle,
    tagline,
    dateStr,
    timeStr,
    location,
    registrationUrl,
    livestreamUrl,
    unsubscribeUrl,
    ministryWebsite,
  } = opts;

  const greeting = recipientName
    ? `Dear ${escapeHtml(recipientName)},`
    : "Dear Beloved,";

  const subject = `🔥 ${conferenceTitle} — Starts Today at ${timeStr} | JCTM`;

  const text = [
    `${conferenceTitle}`,
    `"${tagline}"`,
    ``,
    greeting.replace(/&[a-z]+;/g, "").replace(/&#[0-9]+;/g, ""),
    ``,
    `The conference begins TODAY. We are believing God for a powerful encounter.`,
    ``,
    `📅 When: ${dateStr} · ${timeStr} (West Africa Time)`,
    `📍 Where: ${location}`,
    ``,
    `Join us in person: ${registrationUrl}`,
    `Watch online (live): ${livestreamUrl}`,
    ``,
    `Come expecting a fresh encounter with the Word, prophetic activation,`,
    `and an impartation that will mark your life and ministry.`,
    ``,
    `— Prophet Amos Evomobor & the JCTM Family`,
    `Jesus Christ Temple Ministry, Warri, Nigeria`,
    `Website: ${ministryWebsite}`,
    ``,
    `To unsubscribe from future emails: ${unsubscribeUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(conferenceTitle)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1e293b;-webkit-font-smoothing:antialiased;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:0;">
<tr><td>

  <!-- Urgency top-bar -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="background:#dc2626;padding:10px 24px;text-align:center;">
    <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#ffffff;">🔥 Starting Today — ${escapeHtml(timeStr)} West Africa Time</p>
  </td></tr>
  </table>

  <!-- Hero header -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="background:linear-gradient(160deg,#0f172a 0%,#1e3a5f 45%,#0f2744 100%);padding:44px 32px 36px;text-align:center;">
    <p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#93c5fd;font-weight:700;">Jesus Christ Temple Ministry · Warri, Nigeria</p>
    <h1 style="margin:0 0 12px 0;font-size:30px;font-weight:900;color:#ffffff;line-height:1.15;letter-spacing:-0.01em;">${escapeHtml(conferenceTitle)}</h1>
    <p style="margin:0;font-size:16px;color:#bfdbfe;font-style:italic;line-height:1.5;">&ldquo;${escapeHtml(tagline)}&rdquo;</p>
  </td></tr>
  </table>

</td></tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:0 16px 40px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- It starts TODAY badge -->
  <tr><td style="background:#fef2f2;border:2px solid #fca5a5;border-radius:0 0 14px 14px;padding:14px 24px;text-align:center;">
    <span style="display:inline-block;background:#dc2626;color:#ffffff;font-size:13px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;padding:8px 24px;border-radius:9999px;">🎺 The Conference Begins Today</span>
  </td></tr>

  <!-- Main card -->
  <tr><td style="background:#ffffff;border-radius:16px;margin-top:20px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.1);margin-top:20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

    <!-- Greeting -->
    <tr><td style="padding:32px 32px 8px 32px;">
      <p style="margin:0 0 16px 0;font-size:17px;line-height:1.6;color:#0f172a;font-weight:600;">${greeting}</p>
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.75;color:#374151;">
        The moment we have been believing God for is here. The <strong style="color:#0f172a;">${escapeHtml(conferenceTitle)}</strong> begins 
        <strong style="color:#dc2626;">today</strong> — and heaven is ready to move on your behalf.
      </p>
      <p style="margin:0 0 24px 0;font-size:15px;line-height:1.75;color:#374151;">
        Come expecting a fresh encounter with the Word, prophetic activation, and an impartation 
        through <strong>Prophet Amos Evomobor</strong> that will mark your life and ministry forever.
      </p>
    </td></tr>

    <!-- Event details box -->
    <tr><td style="padding:0 32px 24px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">

        <tr><td style="padding:18px 22px;border-bottom:1px solid #e2e8f0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="32" style="vertical-align:top;padding-top:2px;">
              <span style="font-size:22px;">📅</span>
            </td>
            <td style="padding-left:10px;">
              <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;font-weight:700;">Date &amp; Time</p>
              <p style="margin:4px 0 0 0;font-size:17px;font-weight:700;color:#0f172a;">${escapeHtml(dateStr)}</p>
              <p style="margin:2px 0 0 0;font-size:14px;color:#475569;">${escapeHtml(timeStr)} daily · <strong style="color:#b45309;">West Africa Time (UTC+1)</strong></p>
            </td>
          </tr>
          </table>
        </td></tr>

        <tr><td style="padding:18px 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="32" style="vertical-align:top;padding-top:2px;">
              <span style="font-size:22px;">📍</span>
            </td>
            <td style="padding-left:10px;">
              <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;font-weight:700;">Venue</p>
              <p style="margin:4px 0 0 0;font-size:17px;font-weight:700;color:#0f172a;">${escapeHtml(location)}</p>
            </td>
          </tr>
          </table>
        </td></tr>

      </table>
    </td></tr>

    <!-- Primary CTA -->
    <tr><td style="padding:0 32px 20px 32px;text-align:center;">
      <a href="${escapeHtml(registrationUrl)}"
         style="display:inline-block;background:linear-gradient(135deg,#1e3a5f 0%,#1e40af 100%);color:#ffffff;text-decoration:none;padding:15px 40px;border-radius:9999px;font-size:16px;font-weight:800;letter-spacing:0.02em;margin-bottom:12px;">
        Attend in Person →
      </a>
    </td></tr>

    <!-- Watch online box -->
    <tr><td style="padding:0 32px 28px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef9f0;border:1px solid #fed7aa;border-radius:12px;padding:18px 20px;">
      <tr><td>
        <p style="margin:0 0 6px 0;font-size:13px;font-weight:700;color:#92400e;">📺 Can't Join Us in Person?</p>
        <p style="margin:0 0 12px 0;font-size:14px;color:#78350f;line-height:1.6;">
          Watch the full conference live online — from anywhere in the world. No registration needed.
        </p>
        <a href="${escapeHtml(livestreamUrl)}"
           style="display:inline-block;background:#92400e;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:700;">
          Watch Live Stream →
        </a>
      </td></tr>
      </table>
    </td></tr>

    <!-- Prophetic declaration box -->
    <tr><td style="padding:0 32px 32px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;padding:22px 24px;">
      <tr><td>
        <p style="margin:0 0 10px 0;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;font-weight:600;">Declaration of Faith</p>
        <p style="margin:0 0 12px 0;font-size:16px;font-style:italic;font-weight:600;line-height:1.6;color:#f8fafc;">
          &ldquo;I will attend this conference in faith, and I will leave transformed by the Word and the power of the Holy Spirit.&rdquo;
        </p>
        <p style="margin:0;font-size:12px;color:#64748b;">— Speak this aloud. Agree with what God is about to do.</p>
      </td></tr>
      </table>
    </td></tr>

  </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 0 0 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:14px;padding:24px 28px;">
    <tr><td>
      <p style="margin:0 0 6px 0;font-size:14px;font-weight:700;color:#e2e8f0;">Jesus Christ Temple Ministry</p>
      <p style="margin:0 0 14px 0;font-size:12px;color:#94a3b8;line-height:1.7;">
        Ebrumede Roundabout, Effurun, Delta State, Nigeria<br>
        <a href="${escapeHtml(ministryWebsite)}" style="color:#93c5fd;text-decoration:none;">${escapeHtml(ministryWebsite.replace(/^https?:\/\//, ""))}</a>
        &nbsp;·&nbsp;
        <a href="${escapeHtml(ministryWebsite)}/sermons" style="color:#93c5fd;text-decoration:none;">Live Stream</a>
        &nbsp;·&nbsp;
        <a href="${escapeHtml(registrationUrl)}" style="color:#93c5fd;text-decoration:none;">Register</a>
      </p>
      <p style="margin:0;font-size:11px;color:#475569;line-height:1.7;">
        You received this because you are connected with Jesus Christ Temple Ministry.
        &nbsp;<a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
      </p>
    </td></tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>

</body></html>`;

  return { subject, text, html };
}

// ─── Campaign DB helpers ──────────────────────────────────────────────────────

interface RawCampaignRow {
  id: number | string;
  campaign_key: string;
  conference_title: string;
  status: string;
  total_recipients: number | string;
  sent: number | string;
  failed: number | string;
  skipped: number | string;
  started_at: Date | null;
  completed_at: Date | null;
  error: string | null;
  created_at: Date;
}

function toCampaignStatus(r: RawCampaignRow): CampaignStatus {
  const startedAt = r.started_at ? new Date(r.started_at) : null;
  const completedAt = r.completed_at ? new Date(r.completed_at) : null;
  const durationMs =
    startedAt && completedAt
      ? completedAt.getTime() - startedAt.getTime()
      : startedAt && r.status === "running"
        ? Date.now() - startedAt.getTime()
        : null;
  return {
    id: Number(r.id),
    campaignKey: r.campaign_key,
    conferenceTitle: r.conference_title,
    status: r.status as CampaignStatus["status"],
    totalRecipients: Number(r.total_recipients),
    sent: Number(r.sent),
    failed: Number(r.failed),
    skipped: Number(r.skipped),
    startedAt: startedAt ? startedAt.toISOString() : null,
    completedAt: completedAt ? completedAt.toISOString() : null,
    error: r.error,
    createdAt: new Date(r.created_at).toISOString(),
    durationSeconds: durationMs !== null ? Math.round(durationMs / 1000) : null,
  };
}

export async function createCampaign(
  campaignKey: string,
  conferenceTitle: string,
): Promise<number> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO conference_campaigns (campaign_key, conference_title, status)
     VALUES ($1, $2, 'pending')
     ON CONFLICT (campaign_key) DO UPDATE
       SET status = 'pending',
           sent = 0, failed = 0, skipped = 0, total_recipients = 0,
           started_at = NULL, completed_at = NULL, error = NULL
     RETURNING id`,
    [campaignKey, conferenceTitle],
  );
  return Number(result.rows[0]!.id);
}

export async function getCampaignByKey(
  key: string,
): Promise<CampaignStatus | null> {
  const result = await pool.query<RawCampaignRow>(
    `SELECT * FROM conference_campaigns WHERE campaign_key = $1 LIMIT 1`,
    [key],
  );
  return result.rows[0] ? toCampaignStatus(result.rows[0]) : null;
}

export async function listCampaigns(limit = 10): Promise<CampaignStatus[]> {
  const result = await pool.query<RawCampaignRow>(
    `SELECT * FROM conference_campaigns ORDER BY created_at DESC LIMIT $1`,
    [Math.min(limit, 50)],
  );
  return result.rows.map(toCampaignStatus);
}

async function updateCampaignStatus(
  id: number,
  updates: Partial<{
    status: string;
    totalRecipients: number;
    sent: number;
    failed: number;
    skipped: number;
    startedAt: Date;
    completedAt: Date;
    error: string | null;
  }>,
) {
  const sets: string[] = [];
  const vals: unknown[] = [id];
  let idx = 2;
  if (updates.status !== undefined) { sets.push(`status = $${idx++}`); vals.push(updates.status); }
  if (updates.totalRecipients !== undefined) { sets.push(`total_recipients = $${idx++}`); vals.push(updates.totalRecipients); }
  if (updates.sent !== undefined) { sets.push(`sent = $${idx++}`); vals.push(updates.sent); }
  if (updates.failed !== undefined) { sets.push(`failed = $${idx++}`); vals.push(updates.failed); }
  if (updates.skipped !== undefined) { sets.push(`skipped = $${idx++}`); vals.push(updates.skipped); }
  if (updates.startedAt !== undefined) { sets.push(`started_at = $${idx++}`); vals.push(updates.startedAt); }
  if (updates.completedAt !== undefined) { sets.push(`completed_at = $${idx++}`); vals.push(updates.completedAt); }
  if ("error" in updates) { sets.push(`error = $${idx++}`); vals.push(updates.error ?? null); }
  if (sets.length === 0) return;
  await pool.query(
    `UPDATE conference_campaigns SET ${sets.join(", ")} WHERE id = $1`,
    vals,
  );
}

async function bulkEnqueueRecipients(
  campaignId: number,
  recipients: CampaignRecipient[],
): Promise<void> {
  if (recipients.length === 0) return;
  // Insert in chunks of 500 to avoid huge parameter lists
  const CHUNK = 500;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const valuePlaceholders: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const r of chunk) {
      valuePlaceholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      values.push(campaignId, r.email, r.name ?? null, r.source);
    }
    await pool.query(
      `INSERT INTO conference_campaign_recipients (campaign_id, email, recipient_name, source)
       VALUES ${valuePlaceholders.join(", ")}
       ON CONFLICT DO NOTHING`,
      values,
    );
  }
}

// ─── Background worker ────────────────────────────────────────────────────────

/** Global set of currently-running campaign IDs to prevent double-processing */
const activeCampaigns = new Set<number>();

/**
 * Processes the campaign queue in the background.
 * Returns immediately — processing happens asynchronously.
 */
export function processCampaignInBackground(
  campaignId: number,
  reminderOpts: Omit<ConferenceReminderOpts, "recipientName" | "unsubscribeUrl">,
  log: Logger = logger,
): void {
  if (activeCampaigns.has(campaignId)) {
    log.warn({ campaignId }, "Campaign already running — skipping duplicate trigger");
    return;
  }

  activeCampaigns.add(campaignId);

  void (async () => {
    try {
      await updateCampaignStatus(campaignId, {
        status: "running",
        startedAt: new Date(),
      });

      log.info({ campaignId }, "Campaign worker started");

      let sent = 0;
      let failed = 0;
      let skipped = 0;
      let offset = 0;

      // Process in pages from the DB queue
      while (true) {
        // Claim a batch of pending recipients
        const batch = await pool.query<{
          id: string;
          email: string;
          recipient_name: string | null;
          source: string;
          attempts: number;
        }>(
          `UPDATE conference_campaign_recipients
             SET status = 'processing', attempts = attempts + 1
           WHERE id IN (
             SELECT id FROM conference_campaign_recipients
             WHERE campaign_id = $1 AND status = 'pending'
             ORDER BY id ASC
             LIMIT $2
             FOR UPDATE SKIP LOCKED
           )
           RETURNING id, email, recipient_name, source, attempts`,
          [campaignId, PROCESS_BATCH],
        );

        if (batch.rows.length === 0) break;

        const settledResults = await Promise.allSettled(
          batch.rows.map(async (row) => {
            const sig = _buildUnsubToken(row.email);
            const unsubUrl = `${reminderOpts.ministryWebsite}/api/unsubscribe?email=${encodeURIComponent(row.email)}&sig=${sig}`;
            const { subject, text, html } = renderConferenceReminderEmail({
              ...reminderOpts,
              recipientName: row.recipient_name,
              unsubscribeUrl: unsubUrl,
            });

            await sendWithRetry(
              {
                from: process.env.SMTP_FROM || "Jesus Christ Temple Ministry <info@jctm.org.ng>",
                to: row.email,
                subject,
                text,
                html,
                headers: {
                  "X-Mailer": "JCTM Digital Sanctuary",
                  "X-Campaign": `ministers-conference-2026`,
                  "List-Unsubscribe": `<${unsubUrl}>`,
                  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                },
                ...(process.env.SMTP_REPLY_TO ? { replyTo: process.env.SMTP_REPLY_TO } : {}),
              },
              log,
              `campaign:${campaignId}:${row.email}`,
            );

            return row.id;
          }),
        );

        // Update individual recipient statuses and tally counts
        const updatePromises: Promise<unknown>[] = [];
        for (let i = 0; i < batch.rows.length; i++) {
          const row = batch.rows[i]!;
          const result = settledResults[i]!;
          if (result.status === "fulfilled") {
            sent++;
            updatePromises.push(
              pool.query(
                `UPDATE conference_campaign_recipients
                   SET status = 'sent', sent_at = now()
                 WHERE id = $1`,
                [row.id],
              ).catch(() => null),
            );
          } else {
            const errMsg = result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
            if (row.attempts >= MAX_ATTEMPTS) {
              failed++;
              updatePromises.push(
                pool.query(
                  `UPDATE conference_campaign_recipients
                     SET status = 'failed', error = $2
                   WHERE id = $1`,
                  [row.id, errMsg.slice(0, 500)],
                ).catch(() => null),
              );
            } else {
              // Put back to pending for retry
              updatePromises.push(
                pool.query(
                  `UPDATE conference_campaign_recipients
                     SET status = 'pending', error = $2
                   WHERE id = $1`,
                  [row.id, errMsg.slice(0, 500)],
                ).catch(() => null),
              );
            }
          }
        }
        await Promise.allSettled(updatePromises);

        // Update campaign counters incrementally
        await pool.query(
          `UPDATE conference_campaigns
             SET sent = $2, failed = $3, skipped = $4
           WHERE id = $1`,
          [campaignId, sent, failed, skipped],
        ).catch(() => null);

        offset += batch.rows.length;
        log.info(
          { campaignId, offset, sent, failed, batchSize: batch.rows.length },
          "Campaign batch processed",
        );

        // Pace between batches to avoid SMTP saturation
        await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
      }

      // Mark complete
      await updateCampaignStatus(campaignId, {
        status: "completed",
        sent,
        failed,
        skipped,
        completedAt: new Date(),
        error: null,
      });

      log.info(
        { campaignId, sent, failed, skipped },
        "Campaign completed successfully",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ err, campaignId }, "Campaign worker fatal error");
      await updateCampaignStatus(campaignId, {
        status: "failed",
        completedAt: new Date(),
        error: msg.slice(0, 1000),
      }).catch(() => null);
    } finally {
      activeCampaigns.delete(campaignId);
    }
  })();
}

// ─── Public orchestrator ─────────────────────────────────────────────────────

export interface LaunchCampaignOpts {
  campaignKey: string;
  conferenceTitle: string;
  tagline: string;
  dateStr: string;
  timeStr: string;
  location: string;
  registrationUrl: string;
  livestreamUrl: string;
  log?: Logger;
}

/**
 * Full orchestration:
 *  1. Aggregate all emails from all tables
 *  2. Validate and deduplicate
 *  3. Filter unsubscribed
 *  4. Create/reset campaign row
 *  5. Bulk-insert recipient queue
 *  6. Kick off background worker
 *
 * Returns immediately after enqueuing — the actual sending is async.
 */
export async function launchConferenceCampaign(
  opts: LaunchCampaignOpts,
): Promise<{ campaignId: number; totalRecipients: number; skipped: number }> {
  const log = opts.log ?? logger;
  const base = getPublicBaseUrl();

  if (!isEmailConfigured()) {
    throw new Error("SMTP is not configured — cannot launch email campaign");
  }

  log.info({ campaignKey: opts.campaignKey }, "Launching conference email campaign");

  // 1. Aggregate all emails across all tables
  const emailMap = await aggregateAllEmails(log);

  // 2. Load unsubscribe list
  const unsubscribed = await loadUnsubscribedEmails();

  // 3. Filter, validate, and build recipient list
  const recipients: CampaignRecipient[] = [];
  let skippedCount = 0;
  for (const [email, { name, source }] of emailMap) {
    if (unsubscribed.has(email)) {
      skippedCount++;
      continue;
    }
    recipients.push({ email, name, source });
  }

  log.info(
    {
      campaignKey: opts.campaignKey,
      total: emailMap.size,
      afterUnsubFilter: recipients.length,
      unsubscribed: skippedCount,
    },
    "Campaign recipients filtered",
  );

  // 4. Create / reset campaign record
  const campaignId = await createCampaign(opts.campaignKey, opts.conferenceTitle);

  // 5. Bulk-insert recipient queue
  await bulkEnqueueRecipients(campaignId, recipients);

  // 6. Update total recipient count and skipped
  await updateCampaignStatus(campaignId, {
    totalRecipients: recipients.length,
    skipped: skippedCount,
  });

  // 7. Fire background worker
  processCampaignInBackground(
    campaignId,
    {
      conferenceTitle: opts.conferenceTitle,
      tagline: opts.tagline,
      dateStr: opts.dateStr,
      timeStr: opts.timeStr,
      location: opts.location,
      registrationUrl: opts.registrationUrl,
      livestreamUrl: opts.livestreamUrl,
      ministryWebsite: base,
    },
    log,
  );

  return { campaignId, totalRecipients: recipients.length, skipped: skippedCount };
}

// ─── Live notification template ───────────────────────────────────────────────

export interface ConferenceLiveEmailOpts {
  recipientName?: string | null;
  conferenceTitle: string;
  serviceTitle: string;
  liveUrl: string;
  unsubscribeUrl: string;
  ministryWebsite: string;
}

export function renderConferenceLiveEmail(opts: ConferenceLiveEmailOpts): {
  subject: string;
  text: string;
  html: string;
} {
  const { recipientName, conferenceTitle, serviceTitle, liveUrl, unsubscribeUrl } = opts;
  const greeting = recipientName ? `Dear ${escapeHtml(recipientName)},` : "Dear Beloved,";
  const subject = `🔴 WE ARE LIVE — ${conferenceTitle} | JCTM`;

  const text = [
    `🔴 WE ARE LIVE NOW`,
    ``,
    `${conferenceTitle}`,
    ``,
    greeting.replace(/&[a-z]+;/g, "").replace(/&#[0-9]+;/g, ""),
    ``,
    `The Ministers Conference is LIVE right now on Temple TV. Join us from wherever you are.`,
    ``,
    `Service: ${serviceTitle}`,
    ``,
    `JOIN THE STREAM: ${liveUrl}`,
    ``,
    `God bless you,`,
    `The JCTM Digital Sanctuary Team`,
    `Jesus Christ Temple Ministry, Warri, Nigeria`,
    ``,
    `──────────────────────────────────`,
    `To stop receiving these notifications, unsubscribe here: ${unsubscribeUrl}`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f0;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">

        <!-- LIVE banner -->
        <tr>
          <td style="background:#c62828;padding:8px 24px;text-align:center;">
            <span style="color:#ffffff;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">
              🔴 LIVE NOW
            </span>
          </td>
        </tr>

        <!-- Header -->
        <tr>
          <td style="background:#1a1a2e;padding:36px 40px 32px;text-align:center;">
            <div style="color:#cc4444;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:12px;font-weight:600;">
              Jesus Christ Temple Ministry
            </div>
            <h1 style="color:#ffffff;font-size:26px;margin:0;line-height:1.25;font-weight:700;">
              ${escapeHtml(conferenceTitle)}
            </h1>
            <div style="color:#c62828;font-size:15px;font-weight:700;margin-top:10px;letter-spacing:.5px;">
              APOSTOLIC FIRE — LIVE ON TEMPLE TV
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="color:#444;font-size:16px;margin:0 0 16px;">${greeting}</p>
            <p style="color:#333;font-size:16px;line-height:1.65;margin:0 0 24px;">
              The <strong>Ministers Conference is LIVE right now</strong> on Temple TV.
              The fire of the Holy Spirit is falling. <strong>Join us from wherever you are</strong>
              and receive your apostolic impartation.
            </p>
            <p style="color:#555;font-size:14px;margin:0 0 8px;font-weight:600;">
              Now streaming:
            </p>
            <p style="color:#1a1a2e;font-size:16px;margin:0 0 28px;font-weight:700;">
              ${escapeHtml(serviceTitle)}
            </p>

            <!-- CTA -->
            <div style="text-align:center;margin:0 0 32px;">
              <a href="${liveUrl}"
                 style="display:inline-block;background:#c62828;color:#ffffff;font-size:17px;
                        font-weight:700;padding:16px 40px;border-radius:8px;text-decoration:none;
                        letter-spacing:.3px;">
                🔴 JOIN THE STREAM NOW
              </a>
            </div>

            <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 8px;">
              Can't watch right now? The service will be available as a replay on our channel
              after the broadcast ends.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f8f8;border-top:1px solid #eeeeee;padding:20px 40px;text-align:center;">
            <p style="color:#999;font-size:12px;margin:0 0 6px;">
              Jesus Christ Temple Ministry · Warri, Delta State, Nigeria
            </p>
            <p style="color:#bbb;font-size:11px;margin:0;">
              <a href="${unsubscribeUrl}" style="color:#bbb;text-decoration:underline;">Unsubscribe</a>
              &nbsp;·&nbsp;
              <a href="https://jctm.org.ng" style="color:#bbb;text-decoration:none;">jctm.org.ng</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

// ─── Live notification background worker ─────────────────────────────────────

export function processLiveCampaignInBackground(
  campaignId: number,
  liveOpts: Omit<ConferenceLiveEmailOpts, "recipientName" | "unsubscribeUrl">,
  log: Logger = logger,
): void {
  if (activeCampaigns.has(campaignId)) {
    log.warn({ campaignId }, "Live campaign already running — skipping duplicate trigger");
    return;
  }

  activeCampaigns.add(campaignId);

  void (async () => {
    try {
      await updateCampaignStatus(campaignId, { status: "running", startedAt: new Date() });
      log.info({ campaignId }, "Live notification campaign worker started");

      let sent = 0;
      let failed = 0;
      let skipped = 0;
      let offset = 0;

      while (true) {
        const batch = await pool.query<{
          id: string;
          email: string;
          recipient_name: string | null;
          source: string;
          attempts: number;
        }>(
          `UPDATE conference_campaign_recipients
             SET status = 'processing', attempts = attempts + 1
           WHERE id IN (
             SELECT id FROM conference_campaign_recipients
             WHERE campaign_id = $1 AND status = 'pending'
             ORDER BY id ASC
             LIMIT $2
             FOR UPDATE SKIP LOCKED
           )
           RETURNING id, email, recipient_name, source, attempts`,
          [campaignId, PROCESS_BATCH],
        );

        if (batch.rows.length === 0) break;

        const settledResults = await Promise.allSettled(
          batch.rows.map(async (row) => {
            const sig = _buildUnsubToken(row.email);
            const unsubUrl = `${liveOpts.ministryWebsite}/api/unsubscribe?email=${encodeURIComponent(row.email)}&sig=${sig}`;
            const { subject, text, html } = renderConferenceLiveEmail({
              ...liveOpts,
              recipientName: row.recipient_name,
              unsubscribeUrl: unsubUrl,
            });

            await sendWithRetry(
              {
                from: process.env.SMTP_FROM || "Jesus Christ Temple Ministry <info@jctm.org.ng>",
                to: row.email,
                subject,
                text,
                html,
                headers: {
                  "X-Mailer": "JCTM Digital Sanctuary",
                  "X-Campaign": "ministers-conference-2026-live",
                  "List-Unsubscribe": `<${unsubUrl}>`,
                  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                },
                ...(process.env.SMTP_REPLY_TO ? { replyTo: process.env.SMTP_REPLY_TO } : {}),
              },
              log,
              `live-campaign:${campaignId}:${row.email}`,
            );

            return row.id;
          }),
        );

        const updatePromises: Promise<unknown>[] = [];
        for (let i = 0; i < batch.rows.length; i++) {
          const row = batch.rows[i]!;
          const result = settledResults[i]!;
          if (result.status === "fulfilled") {
            sent++;
            updatePromises.push(
              pool.query(
                `UPDATE conference_campaign_recipients SET status = 'sent', sent_at = now() WHERE id = $1`,
                [row.id],
              ).catch(() => null),
            );
          } else {
            const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
            if (row.attempts >= MAX_ATTEMPTS) {
              failed++;
              updatePromises.push(
                pool.query(
                  `UPDATE conference_campaign_recipients SET status = 'failed', error = $2 WHERE id = $1`,
                  [row.id, errMsg.slice(0, 500)],
                ).catch(() => null),
              );
            } else {
              updatePromises.push(
                pool.query(
                  `UPDATE conference_campaign_recipients SET status = 'pending', error = $2 WHERE id = $1`,
                  [row.id, errMsg.slice(0, 500)],
                ).catch(() => null),
              );
            }
          }
        }
        await Promise.allSettled(updatePromises);

        await pool.query(
          `UPDATE conference_campaigns SET sent = $2, failed = $3, skipped = $4 WHERE id = $1`,
          [campaignId, sent, failed, skipped],
        ).catch(() => null);

        offset += batch.rows.length;
        log.info({ campaignId, offset, sent, failed }, "Live campaign batch processed");

        await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
      }

      await updateCampaignStatus(campaignId, {
        status: "completed",
        sent,
        failed,
        skipped,
        completedAt: new Date(),
        error: null,
      });

      log.info({ campaignId, sent, failed, skipped }, "Live notification campaign completed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ err, campaignId }, "Live campaign worker fatal error");
      await updateCampaignStatus(campaignId, {
        status: "failed",
        completedAt: new Date(),
        error: msg.slice(0, 1000),
      }).catch(() => null);
    } finally {
      activeCampaigns.delete(campaignId);
    }
  })();
}

// ─── Live notification orchestrator ──────────────────────────────────────────

export interface LaunchLiveNotificationOpts {
  campaignKey: string;
  conferenceTitle: string;
  serviceTitle: string;
  liveUrl: string;
  ministryWebsite?: string;
  log?: Logger;
}

/**
 * Aggregates all emails, filters unsubscribes, creates/resets campaign record,
 * and fires the background live-notification worker. Returns immediately.
 */
export async function launchConferenceLiveNotification(
  opts: LaunchLiveNotificationOpts,
): Promise<{ campaignId: number; totalRecipients: number; skipped: number }> {
  const log = opts.log ?? logger;
  const base = opts.ministryWebsite ?? getPublicBaseUrl();

  if (!isEmailConfigured()) {
    throw new Error("SMTP is not configured — cannot launch live notification campaign");
  }

  log.info({ campaignKey: opts.campaignKey }, "Launching conference LIVE notification campaign");

  const emailMap = await aggregateAllEmails(log);
  const unsubscribed = await loadUnsubscribedEmails();

  const recipients: CampaignRecipient[] = [];
  let skippedCount = 0;
  for (const [email, { name, source }] of emailMap) {
    if (unsubscribed.has(email)) { skippedCount++; continue; }
    recipients.push({ email, name, source });
  }

  log.info(
    { campaignKey: opts.campaignKey, total: emailMap.size, afterFilter: recipients.length, unsubscribed: skippedCount },
    "Live notification recipients filtered",
  );

  const campaignId = await createCampaign(opts.campaignKey, opts.conferenceTitle);
  await bulkEnqueueRecipients(campaignId, recipients);
  await updateCampaignStatus(campaignId, { totalRecipients: recipients.length, skipped: skippedCount });

  processLiveCampaignInBackground(
    campaignId,
    {
      conferenceTitle: opts.conferenceTitle,
      serviceTitle: opts.serviceTitle,
      liveUrl: opts.liveUrl,
      ministryWebsite: base,
    },
    log,
  );

  return { campaignId, totalRecipients: recipients.length, skipped: skippedCount };
}

// ─── Retry failed recipients ──────────────────────────────────────────────────

/**
 * Resets all `failed` queue entries for a campaign back to `pending`,
 * then re-fires the background worker so they are re-attempted.
 * Returns immediately — processing happens asynchronously.
 */
export async function retryFailedCampaignRecipients(
  campaignKey: string,
  log: Logger = logger,
): Promise<{ campaignId: number; requeued: number }> {
  const row = await pool.query<{ id: string; conference_title: string; sent: string }>(
    `SELECT id, conference_title, sent FROM conference_campaigns WHERE campaign_key = $1 LIMIT 1`,
    [campaignKey],
  );

  if (!row.rows[0]) throw new Error(`Campaign not found: ${campaignKey}`);

  const campaignId = Number(row.rows[0]!.id);
  const conferenceTitle = row.rows[0]!.conference_title;
  const currentSent = Number(row.rows[0]!.sent);

  const reset = await pool.query(
    `UPDATE conference_campaign_recipients
        SET status = 'pending', attempts = 0, error = NULL
      WHERE campaign_id = $1 AND status = 'failed'`,
    [campaignId],
  );
  const requeued = reset.rowCount ?? 0;

  if (requeued === 0) {
    log.info({ campaignKey, campaignId }, "Campaign retry: no failed recipients to reset");
    return { campaignId, requeued: 0 };
  }

  await pool.query(
    `UPDATE conference_campaigns
        SET status = 'running', failed = 0, completed_at = NULL, error = NULL, sent = $2
      WHERE id = $1`,
    [campaignId, currentSent],
  );

  const base = getPublicBaseUrl();
  processCampaignInBackground(
    campaignId,
    {
      conferenceTitle,
      tagline: "A word that will mark you for life. Come and be transformed.",
      dateStr: "8–10 May 2026",
      timeStr: "8:00 AM WAT",
      location: "JCTM Auditorium, Ebrumede Roundabout, Effurun",
      registrationUrl: `${base}/conference-registration`,
      livestreamUrl: `${base}/livestream`,
      ministryWebsite: base,
    },
    log,
  );

  log.info({ campaignKey, campaignId, requeued }, "Campaign retry triggered for failed recipients");
  return { campaignId, requeued };
}

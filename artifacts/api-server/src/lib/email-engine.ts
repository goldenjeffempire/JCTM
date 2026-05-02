/**
 * email-engine.ts — SMTP transport and email rendering for the JCTM
 * Daily Devotion email subscription and event notifications.
 *
 * Configuration via env vars:
 *   SMTP_HOST           — e.g. mail.jctm.org.ng
 *   SMTP_PORT           — e.g. 587 (defaults to 587)
 *   SMTP_SECURE         — "true" forces TLS-on-connect (port 465);
 *                         otherwise STARTTLS is required on port 587.
 *   SMTP_USER           — SMTP username (typically the From mailbox)
 *   SMTP_PASS           — SMTP password / app password / API key
 *   SMTP_FROM           — Header From address, e.g.
 *                         "Jesus Christ Temple Ministry <info@jctm.org.ng>"
 *   SMTP_REPLY_TO       — Optional Reply-To header
 *   SMTP_POOL_MAX       — Max simultaneous SMTP connections (default 3)
 *   SMTP_RATE_LIMIT     — Max messages per second per connection (default 5)
 *   SMTP_TLS_REJECT_UNAUTHORIZED — "false" to accept self-signed certs (NOT
 *                         recommended; defaults to true).
 *   PUBLIC_BASE_URL     — Public web app origin used in unsubscribe links.
 *
 * Production hardening:
 *   • Connection pooling + per-connection rate limiting.
 *   • Aggressive socket / connection / greeting timeouts so a hung server
 *     never blocks the worker.
 *   • Retry-with-backoff on transient SMTP errors (4xx codes, ETIMEDOUT,
 *     ECONNRESET, ECONNREFUSED, EAI_AGAIN, EPIPE, EHOSTUNREACH).
 *   • Startup verify() that records lastVerifyOk/lastError for the admin
 *     health dashboard.
 *   • Send counters (sent / failed / retried / lastError) exposed via
 *     getEmailHealth() for monitoring.
 *
 * If SMTP_HOST/USER/PASS are missing the engine becomes a no-op: subscribers
 * are still recorded, callers log a warning, and no mail is dispatched.
 */

import nodemailer, { type Transporter, type SendMailOptions } from "nodemailer";
import { logger } from "./logger.js";
import type { Logger } from "pino";
import type { DailyDevotion } from "@workspace/db";

let cachedTransporter: Transporter | null = null;
let cachedConfigured: boolean | null = null;

interface EmailHealthState {
  lastVerifyAt: string | null;
  lastVerifyOk: boolean | null;
  lastVerifyError: string | null;
  lastSendAt: string | null;
  lastSendOk: boolean | null;
  lastSendError: string | null;
  totalSent: number;
  totalFailed: number;
  totalRetried: number;
}

const health: EmailHealthState = {
  lastVerifyAt: null,
  lastVerifyOk: null,
  lastVerifyError: null,
  lastSendAt: null,
  lastSendOk: null,
  lastSendError: null,
  totalSent: 0,
  totalFailed: 0,
  totalRetried: 0,
};

export function isEmailConfigured(): boolean {
  if (cachedConfigured !== null) return cachedConfigured;
  cachedConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
  return cachedConfigured;
}

/**
 * Reset cached transporter + configuration flag. Call after env var changes
 * (e.g. when an admin updates SMTP secrets without restarting the process).
 */
export function resetEmailTransport(): void {
  if (cachedTransporter) {
    try { cachedTransporter.close(); } catch { /* ignore */ }
  }
  cachedTransporter = null;
  cachedConfigured = null;
}

function buildTransporter(): Transporter | null {
  if (!isEmailConfigured()) return null;
  if (cachedTransporter) return cachedTransporter;

  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const poolMax = Math.max(1, Math.min(20, Number(process.env.SMTP_POOL_MAX) || 3));
  const rateLimit = Math.max(1, Math.min(50, Number(process.env.SMTP_RATE_LIMIT) || 5));
  const rejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false";

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port,
    secure,
    requireTLS: !secure, // STARTTLS required on 587 — never send plaintext auth.
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
    pool: true,
    maxConnections: poolMax,
    maxMessages: 100,
    rateLimit,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized,
      servername: process.env.SMTP_HOST!,
    },
  });

  cachedTransporter.on("error", (err) => {
    logger.warn({ err }, "SMTP transporter error");
    health.lastSendError = err instanceof Error ? err.message : String(err);
  });

  return cachedTransporter;
}

const TRANSIENT_CODES = new Set([
  "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN",
  "EPIPE", "EHOSTUNREACH", "ENOTFOUND", "ESOCKET",
]);

function isTransientSmtpError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; responseCode?: number; command?: string };
  if (e.code && TRANSIENT_CODES.has(e.code)) return true;
  // 4xx SMTP responses are transient per RFC 5321; 5xx are permanent.
  if (typeof e.responseCode === "number" && e.responseCode >= 400 && e.responseCode < 500) return true;
  return false;
}

const SEND_RETRY_BACKOFF_MS = [500, 2_000, 8_000];

/**
 * Send a message with bounded retries on transient errors. Returns the
 * messageId on success or throws the last error on permanent failure /
 * exhausted retries. All errors are recorded in the health state.
 */
async function sendWithRetry(
  options: SendMailOptions,
  log: Logger,
  attemptLabel = "email",
): Promise<string | undefined> {
  const transporter = buildTransporter();
  if (!transporter) throw new Error("SMTP not configured");

  let lastErr: unknown = null;
  const maxAttempts = SEND_RETRY_BACKOFF_MS.length + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const info = await transporter.sendMail(options);
      health.lastSendAt = new Date().toISOString();
      health.lastSendOk = true;
      health.lastSendError = null;
      health.totalSent += 1;
      if (attempt > 1) health.totalRetried += attempt - 1;
      return info.messageId;
    } catch (err) {
      lastErr = err;
      const transient = isTransientSmtpError(err);
      log.warn(
        {
          err,
          attempt,
          maxAttempts,
          transient,
          to: options.to,
          subject: options.subject,
          label: attemptLabel,
        },
        "SMTP send failed",
      );
      if (!transient || attempt === maxAttempts) break;
      const delay = SEND_RETRY_BACKOFF_MS[attempt - 1];
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  health.lastSendAt = new Date().toISOString();
  health.lastSendOk = false;
  health.lastSendError = lastErr instanceof Error ? lastErr.message : String(lastErr);
  health.totalFailed += 1;
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Verify the SMTP connection (auth + TLS handshake). Safe to call on boot.
 * Result is recorded in the health state for the admin dashboard.
 */
export async function verifyEmailTransport(log: Logger = logger): Promise<{ ok: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    health.lastVerifyAt = new Date().toISOString();
    health.lastVerifyOk = false;
    health.lastVerifyError = "SMTP not configured";
    return { ok: false, error: "SMTP not configured" };
  }
  const transporter = buildTransporter();
  if (!transporter) {
    health.lastVerifyAt = new Date().toISOString();
    health.lastVerifyOk = false;
    health.lastVerifyError = "Transporter unavailable";
    return { ok: false, error: "Transporter unavailable" };
  }
  try {
    await transporter.verify();
    health.lastVerifyAt = new Date().toISOString();
    health.lastVerifyOk = true;
    health.lastVerifyError = null;
    log.info(
      { host: process.env.SMTP_HOST, port: process.env.SMTP_PORT ?? "587" },
      "SMTP transport verified — email delivery ready",
    );
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    health.lastVerifyAt = new Date().toISOString();
    health.lastVerifyOk = false;
    health.lastVerifyError = message;
    log.warn({ err, host: process.env.SMTP_HOST }, "SMTP verify failed");
    return { ok: false, error: message };
  }
}

export interface EmailHealth {
  configured: boolean;
  host: string | null;
  port: number;
  secure: boolean;
  from: string | null;
  replyTo: string | null;
  poolMax: number;
  rateLimit: number;
  lastVerifyAt: string | null;
  lastVerifyOk: boolean | null;
  lastVerifyError: string | null;
  lastSendAt: string | null;
  lastSendOk: boolean | null;
  lastSendError: string | null;
  totalSent: number;
  totalFailed: number;
  totalRetried: number;
}

export function getEmailHealth(): EmailHealth {
  const port = Number(process.env.SMTP_PORT) || 587;
  return {
    configured: isEmailConfigured(),
    host: process.env.SMTP_HOST ?? null,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    from: process.env.SMTP_FROM ?? null,
    replyTo: process.env.SMTP_REPLY_TO ?? null,
    poolMax: Math.max(1, Math.min(20, Number(process.env.SMTP_POOL_MAX) || 3)),
    rateLimit: Math.max(1, Math.min(50, Number(process.env.SMTP_RATE_LIMIT) || 5)),
    lastVerifyAt: health.lastVerifyAt,
    lastVerifyOk: health.lastVerifyOk,
    lastVerifyError: health.lastVerifyError,
    lastSendAt: health.lastSendAt,
    lastSendOk: health.lastSendOk,
    lastSendError: health.lastSendError,
    totalSent: health.totalSent,
    totalFailed: health.totalFailed,
    totalRetried: health.totalRetried,
  };
}

function commonHeaders(unsubscribeUrl?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Mailer": "JCTM Digital Sanctuary",
  };
  if (unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  return headers;
}

function replyToOption(): { replyTo?: string } {
  return process.env.SMTP_REPLY_TO ? { replyTo: process.env.SMTP_REPLY_TO } : {};
}

export function getPublicBaseUrl(): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:5000";
}

function defaultFrom(): string {
  return process.env.SMTP_FROM || "JCTM Daily Devotion <no-reply@jctm.org.ng>";
}

// ─── Email rendering ──────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px 0;line-height:1.7;color:#1f2937;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function renderDevotionEmail(d: DailyDevotion, unsubscribeUrl: string): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `Daily Devotion — ${d.title}`;

  const text = [
    `JCTM Digital Sanctuary — Daily Devotion`,
    `${d.date}`,
    ``,
    `${d.title}`,
    `${d.scripture}  (${d.reference})`,
    ``,
    `REFLECTION`,
    d.reflection,
    ``,
    `PROPHETIC WORD`,
    d.propheticWord,
    ``,
    `PRAYER FOCUS`,
    d.prayerFocus,
    ``,
    `DECLARATION`,
    d.declaration,
    ``,
    `— Jesus Christ Temple Ministry, Warri, Nigeria`,
    ``,
    `Read more devotions: ${getPublicBaseUrl()}/devotion`,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
        <tr><td style="padding:28px 32px 18px 32px;border-bottom:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">JCTM Digital Sanctuary</p>
          <p style="margin:4px 0 0 0;font-size:13px;color:#6b7280;">${escapeHtml(d.date)}</p>
        </td></tr>

        <tr><td style="padding:28px 32px 8px 32px;">
          <h1 style="margin:0 0 12px 0;font-size:26px;line-height:1.25;color:#0f172a;font-weight:700;">${escapeHtml(d.title)}</h1>
          <blockquote style="margin:0 0 6px 0;padding:14px 16px;background:#f1f5f9;border-left:4px solid #0f172a;border-radius:4px;color:#0f172a;font-style:italic;font-size:15px;line-height:1.6;">${escapeHtml(d.scripture)}</blockquote>
          <p style="margin:6px 0 18px 0;font-size:13px;color:#475569;">— ${escapeHtml(d.reference)}</p>
        </td></tr>

        <tr><td style="padding:0 32px 6px 32px;">
          <h2 style="margin:8px 0 10px 0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;font-weight:600;">Reflection</h2>
          ${paragraphs(d.reflection)}
        </td></tr>

        <tr><td style="padding:0 32px 6px 32px;">
          <h2 style="margin:14px 0 10px 0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;font-weight:600;">Prophetic Word</h2>
          ${paragraphs(d.propheticWord)}
        </td></tr>

        <tr><td style="padding:0 32px 6px 32px;">
          <h2 style="margin:14px 0 10px 0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;font-weight:600;">Prayer Focus</h2>
          ${paragraphs(d.prayerFocus)}
        </td></tr>

        <tr><td style="padding:0 32px 24px 32px;">
          <h2 style="margin:14px 0 10px 0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;font-weight:600;">Declaration</h2>
          ${paragraphs(d.declaration)}
        </td></tr>

        <tr><td style="padding:18px 32px 28px 32px;border-top:1px solid #e5e7eb;background:#fafafa;">
          <p style="margin:0 0 10px 0;font-size:13px;color:#475569;">Jesus Christ Temple Ministry · Warri, Nigeria</p>
          <p style="margin:0;font-size:12px;color:#6b7280;">
            <a href="${escapeHtml(getPublicBaseUrl())}/devotion" style="color:#2563eb;text-decoration:none;">Read on the web</a>
            &nbsp;·&nbsp;
            <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}

export function renderWelcomeEmail(unsubscribeUrl: string): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "You're subscribed to JCTM Daily Devotion";
  const base = getPublicBaseUrl();
  const text = [
    `Welcome to JCTM Daily Devotion.`,
    ``,
    `Each morning we'll send you the day's devotion — scripture, reflection,`,
    `prophetic word, prayer focus, and a declaration of faith.`,
    ``,
    `Read today's devotion: ${base}/devotion`,
    ``,
    `If you ever wish to stop receiving these emails:`,
    `${unsubscribeUrl}`,
    ``,
    `— Jesus Christ Temple Ministry, Warri, Nigeria`,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">
    <table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;padding:32px;">
      <tr><td>
        <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">JCTM Digital Sanctuary</p>
        <h1 style="margin:8px 0 14px 0;font-size:22px;color:#0f172a;">You're subscribed to the Daily Devotion</h1>
        <p style="margin:0 0 12px 0;line-height:1.7;">Each morning we'll send you the day's devotion — scripture, reflection, prophetic word, prayer focus, and a declaration of faith.</p>
        <p style="margin:18px 0;"><a href="${escapeHtml(base)}/devotion" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;">Read today's devotion</a></p>
        <p style="margin:18px 0 0 0;font-size:12px;color:#6b7280;">Jesus Christ Temple Ministry · Warri, Nigeria<br>
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
        </p>
      </td></tr>
    </table>
  </body></html>`;

  return { subject, text, html };
}

// ─── Send helpers ──────────────────────────────────────────────────────────────

export async function sendDevotionEmail(
  to: string,
  devotion: DailyDevotion,
  unsubscribeUrl: string,
  log: Logger = logger,
): Promise<boolean> {
  if (!isEmailConfigured()) {
    log.warn({ to }, "SMTP not configured — devotion email skipped");
    return false;
  }
  const { subject, text, html } = renderDevotionEmail(devotion, unsubscribeUrl);
  try {
    await sendWithRetry(
      {
        from: defaultFrom(),
        to,
        subject,
        text,
        html,
        headers: commonHeaders(unsubscribeUrl),
        ...replyToOption(),
      },
      log,
      "devotion",
    );
    return true;
  } catch (err) {
    log.warn({ err, to }, "Devotion email send failed (after retries)");
    return false;
  }
}

export async function sendWelcomeEmail(
  to: string,
  unsubscribeUrl: string,
  log: Logger = logger,
): Promise<boolean> {
  if (!isEmailConfigured()) {
    log.info({ to }, "SMTP not configured — welcome email skipped (subscriber still saved)");
    return false;
  }
  const { subject, text, html } = renderWelcomeEmail(unsubscribeUrl);
  try {
    await sendWithRetry(
      {
        from: defaultFrom(),
        to,
        subject,
        text,
        html,
        headers: commonHeaders(unsubscribeUrl),
        ...replyToOption(),
      },
      log,
      "welcome",
    );
    return true;
  } catch (err) {
    log.warn({ err, to }, "Welcome email send failed (after retries)");
    return false;
  }
}

// ─── Test email ────────────────────────────────────────────────────────────────

export async function sendTestEmail(
  to: string,
  log: Logger = logger,
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  const transporter = buildTransporter();
  if (!transporter) {
    return { ok: false, error: "SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS missing)." };
  }
  const base = getPublicBaseUrl();
  const sentAt = new Date().toISOString();
  const subject = "JCTM SMTP test — delivery confirmed";
  const text = [
    "This is a test email from the JCTM Digital Sanctuary admin dashboard.",
    "",
    "If you received this, your SMTP configuration is working correctly and the platform can deliver",
    "daily devotion emails, welcome emails, and event-reminder notifications to subscribers.",
    "",
    `Sent at: ${sentAt}`,
    `From: ${defaultFrom()}`,
    `Site: ${base}`,
    "",
    "— Jesus Christ Temple Ministry, Warri, Nigeria",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">
    <table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;padding:32px;">
      <tr><td>
        <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#0ea5e9;font-weight:700;">JCTM Digital Sanctuary · SMTP Test</p>
        <h1 style="margin:8px 0 14px 0;font-size:22px;color:#0f172a;">Delivery confirmed</h1>
        <p style="margin:0 0 12px 0;line-height:1.7;">This test email was sent from the admin dashboard to verify that the platform's SMTP configuration is working.</p>
        <p style="margin:0 0 12px 0;line-height:1.7;">If you received it, the daily devotion email cron, the welcome email pipeline, and the event-reminder scheduler will all be able to deliver to subscribers.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;border-collapse:collapse;font-size:13px;color:#475569;">
          <tr><td style="padding:4px 12px 4px 0;"><strong style="color:#0f172a;">Sent at:</strong></td><td style="padding:4px 0;">${escapeHtml(sentAt)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;"><strong style="color:#0f172a;">From:</strong></td><td style="padding:4px 0;">${escapeHtml(defaultFrom())}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;"><strong style="color:#0f172a;">Site:</strong></td><td style="padding:4px 0;"><a href="${escapeHtml(base)}" style="color:#0ea5e9;text-decoration:none;">${escapeHtml(base)}</a></td></tr>
        </table>
        <p style="margin:24px 0 0 0;font-size:12px;color:#6b7280;">Jesus Christ Temple Ministry · Warri, Nigeria</p>
      </td></tr>
    </table>
  </body></html>`;
  try {
    const messageId = await sendWithRetry(
      {
        from: defaultFrom(),
        to,
        subject,
        text,
        html,
        headers: commonHeaders(),
        ...replyToOption(),
      },
      log,
      "smtp-test",
    );
    log.info({ to, messageId }, "SMTP test email sent");
    return { ok: true, messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn({ err, to }, "SMTP test email failed (after retries)");
    return { ok: false, error: message };
  }
}

// ─── Member registration welcome email ───────────────────────────────────────

export function renderMemberWelcomeEmail(firstName: string): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Welcome to the JCTM Digital Sanctuary";
  const base = getPublicBaseUrl();

  const text = [
    `Welcome, ${firstName}!`,
    ``,
    `Your account has been created on the JCTM Digital Sanctuary.`,
    ``,
    `You can now:`,
    `  • Watch live services and sermons at ${base}/sermons`,
    `  • Read daily devotions at ${base}/devotion`,
    `  • Connect with our prayer community at ${base}/prayer`,
    ``,
    `If you have any questions, reply to this email — we're happy to help.`,
    ``,
    `— Jesus Christ Temple Ministry, Warri, Nigeria`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
        <tr><td style="background:#0f172a;padding:28px 32px;">
          <p style="margin:0;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;font-weight:600;">Jesus Christ Temple Ministry</p>
          <p style="margin:6px 0 0 0;font-size:20px;font-weight:700;color:#ffffff;">Welcome to the Digital Sanctuary</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 14px 0;font-size:18px;font-weight:600;color:#0f172a;">Hello, ${escapeHtml(firstName)}! 🙌</p>
          <p style="margin:0 0 14px 0;line-height:1.7;color:#374151;">Your account on the JCTM Digital Sanctuary has been created. You now have access to everything the ministry offers online.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:16px 0;">
            <tr><td style="padding:6px 0;font-size:14px;color:#374151;">📖 <a href="${escapeHtml(base)}/devotion" style="color:#0f172a;font-weight:600;text-decoration:none;">Daily Devotion</a> — scripture, reflection &amp; prayer each morning</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#374151;">🎙️ <a href="${escapeHtml(base)}/sermons" style="color:#0f172a;font-weight:600;text-decoration:none;">Sermons</a> — watch live services and the full sermon library</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#374151;">🙏 <a href="${escapeHtml(base)}/prayer" style="color:#0f172a;font-weight:600;text-decoration:none;">Prayer</a> — submit requests and connect with our prayer community</td></tr>
          </table>
          <p style="margin:20px 0 0 0;"><a href="${escapeHtml(base)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:9999px;font-size:14px;font-weight:600;">Visit the Sanctuary</a></p>
        </td></tr>
        <tr><td style="padding:18px 32px 28px 32px;border-top:1px solid #e5e7eb;background:#fafafa;">
          <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">Jesus Christ Temple Ministry · Warri, Nigeria<br>Have a question? Reply to this email — we read every message.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}

export async function sendMemberWelcomeEmail(
  to: string,
  firstName: string,
  log: Logger = logger,
): Promise<boolean> {
  if (!isEmailConfigured()) {
    log.info({ to }, "SMTP not configured — member welcome email skipped");
    return false;
  }
  const { subject, text, html } = renderMemberWelcomeEmail(firstName);
  try {
    await sendWithRetry(
      {
        from: defaultFrom(),
        to,
        subject,
        text,
        html,
        headers: commonHeaders(),
        ...replyToOption(),
      },
      log,
      "member-welcome",
    );
    return true;
  } catch (err) {
    log.warn({ err, to }, "Member welcome email send failed (after retries)");
    return false;
  }
}

// ─── Password reset email ─────────────────────────────────────────────────────

export function renderPasswordResetEmail(firstName: string, resetUrl: string): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Reset your JCTM Digital Sanctuary password";
  const base = getPublicBaseUrl();

  const text = [
    `Hello, ${firstName}.`,
    ``,
    `We received a request to reset the password for your JCTM Digital Sanctuary account.`,
    ``,
    `Click the link below to set a new password. This link expires in 1 hour.`,
    ``,
    `${resetUrl}`,
    ``,
    `If you did not request a password reset, you can safely ignore this email.`,
    `Your password will not change unless you follow the link above.`,
    ``,
    `— Jesus Christ Temple Ministry, Warri, Nigeria`,
    `${base}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
        <tr><td style="background:#0f172a;padding:28px 32px;">
          <p style="margin:0;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;font-weight:600;">Jesus Christ Temple Ministry</p>
          <p style="margin:6px 0 0 0;font-size:20px;font-weight:700;color:#ffffff;">Password Reset Request</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 14px 0;font-size:16px;font-weight:600;color:#0f172a;">Hello, ${escapeHtml(firstName)}</p>
          <p style="margin:0 0 16px 0;line-height:1.7;color:#374151;">We received a request to reset the password for your JCTM Digital Sanctuary account. Click the button below to choose a new password.</p>
          <p style="margin:0 0 16px 0;padding:16px;background:#fef3c7;border-radius:8px;border-left:4px solid #d97706;font-size:13px;color:#92400e;line-height:1.6;">⏰ This link expires in <strong>1 hour</strong>. After that you'll need to request a new one.</p>
          <p style="margin:24px 0;"><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:9999px;font-size:15px;font-weight:600;">Reset my password</a></p>
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">If the button doesn't work, copy and paste this URL into your browser:<br><a href="${escapeHtml(resetUrl)}" style="color:#2563eb;word-break:break-all;">${escapeHtml(resetUrl)}</a></p>
        </td></tr>
        <tr><td style="padding:18px 32px 28px 32px;border-top:1px solid #e5e7eb;background:#fafafa;">
          <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">If you didn't request a password reset, you can safely ignore this email — your password won't change.<br><br>Jesus Christ Temple Ministry · Warri, Nigeria</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}

export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  resetUrl: string,
  log: Logger = logger,
): Promise<boolean> {
  if (!isEmailConfigured()) {
    log.warn({ to }, "SMTP not configured — password reset email skipped");
    return false;
  }
  const { subject, text, html } = renderPasswordResetEmail(firstName, resetUrl);
  try {
    await sendWithRetry(
      {
        from: defaultFrom(),
        to,
        subject,
        text,
        html,
        headers: commonHeaders(),
        ...replyToOption(),
      },
      log,
      "password-reset",
    );
    return true;
  } catch (err) {
    log.warn({ err, to }, "Password reset email send failed (after retries)");
    return false;
  }
}

// ─── Event-notification email ─────────────────────────────────────────────────

interface EventForEmail {
  id: number;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date | null;
  location: string | null;
  imageUrl: string | null;
  youtubeUrl: string | null;
  eventType: string;
}

function humaniseLeadTime(hoursBefore: number): string {
  if (hoursBefore <= 1) return "in about 1 hour";
  if (hoursBefore < 24) return `in ${hoursBefore} hours`;
  if (hoursBefore === 24) return "tomorrow";
  const days = Math.round(hoursBefore / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

function tzAbbreviation(timezone: string, ref: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(ref);
    return parts.find((p) => p.type === "timeZoneName")?.value || "";
  } catch {
    return "";
  }
}

function formatEventDate(start: Date, end: Date | null, timezone = "Africa/Lagos"): string {
  let tz = timezone;
  let dateFmt: Intl.DateTimeFormat;
  let timeFmt: Intl.DateTimeFormat;
  try {
    dateFmt = new Intl.DateTimeFormat("en-NG", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    timeFmt = new Intl.DateTimeFormat("en-NG", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    tz = "Africa/Lagos";
    dateFmt = new Intl.DateTimeFormat("en-NG", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    timeFmt = new Intl.DateTimeFormat("en-NG", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  const abbrev = tzAbbreviation(tz, start) || tz;
  const date = dateFmt.format(start);
  const startTime = timeFmt.format(start);
  if (!end) return `${date} · ${startTime} (${abbrev})`;
  const endTime = timeFmt.format(end);
  return `${date} · ${startTime} – ${endTime} (${abbrev})`;
}

export interface EventNotificationEmailOptions {
  /** IANA timezone for date/time formatting. Defaults to "Africa/Lagos". */
  timezone?: string;
  /** Override lead-time phrase (e.g. "in about 30 minutes"). Falls back to humanised hours. */
  leadLabel?: string;
  /** True when this fire is part of the per-30-min pulse window. Adjusts subject prefix. */
  isPulse?: boolean;
}

export function renderEventNotificationEmail(
  event: EventForEmail,
  hoursBefore: number,
  unsubscribeUrl: string,
  opts: EventNotificationEmailOptions = {},
): { subject: string; text: string; html: string } {
  const base = getPublicBaseUrl();
  const lead = opts.leadLabel || humaniseLeadTime(hoursBefore);
  const when = formatEventDate(event.startDate, event.endDate, opts.timezone);
  const subjectPrefix = opts.isPulse ? "Reminder · " : "";
  const subject = `${subjectPrefix}${event.title} starts ${lead} — Jesus Christ Temple Ministry`;
  const eventUrl = `${base}/events#event-${event.id}`;
  const ctaLabel = event.youtubeUrl ? "Watch & RSVP" : "View event details";
  const ctaUrl = event.youtubeUrl || eventUrl;

  const locationLine = event.location
    ? `\nLocation: ${event.location}`
    : "";
  const description = event.description?.trim() || "";

  const text =
    `${event.title}\n` +
    `Starts ${lead}.\n\n` +
    `When: ${when}${locationLine}\n\n` +
    (description ? `${description}\n\n` : "") +
    `${ctaLabel}: ${ctaUrl}\n\n` +
    `Jesus Christ Temple Ministry · Warri, Nigeria\n` +
    `Unsubscribe: ${unsubscribeUrl}\n`;

  const safeTitle = escapeHtml(event.title);
  const safeWhen = escapeHtml(when);
  const safeLocation = event.location ? escapeHtml(event.location) : "";
  const safeDescription = description ? paragraphs(description) : "";
  const safeLead = escapeHtml(lead);
  const safeCtaLabel = escapeHtml(ctaLabel);

  const heroImage = event.imageUrl
    ? `<tr><td style="padding:0"><img src="${escapeHtml(event.imageUrl)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" /></td></tr>`
    : "";

  const html = `<!doctype html>
  <html><head><meta charset="utf-8"><title>${safeTitle}</title></head>
  <body style="margin:0;padding:0;background:#f5f3ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ee;">
      <tr><td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          ${heroImage}
          <tr><td style="padding:28px 28px 8px 28px;">
            <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#0ea5e9;font-weight:700;">Upcoming at JCTM · Starts ${safeLead}</p>
            <h1 style="margin:0;font-size:24px;line-height:1.25;color:#0f172a;font-weight:700;">${safeTitle}</h1>
          </td></tr>
          <tr><td style="padding:6px 28px 0 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#475569;font-size:14px;"><strong style="color:#0f172a;">When:</strong> ${safeWhen}</td></tr>
              ${safeLocation ? `<tr><td style="padding:6px 0;color:#475569;font-size:14px;"><strong style="color:#0f172a;">Where:</strong> ${safeLocation}</td></tr>` : ""}
            </table>
          </td></tr>
          ${safeDescription ? `<tr><td style="padding:18px 28px 0 28px;">${safeDescription}</td></tr>` : ""}
          <tr><td style="padding:22px 28px 28px 28px;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#003366;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:9999px;font-size:14px;font-weight:600;">${safeCtaLabel}</a>
          </td></tr>
          <tr><td style="padding:0 28px 24px 28px;border-top:1px solid #e5e7eb;">
            <p style="margin:18px 0 6px 0;font-size:12px;color:#6b7280;line-height:1.6;">You're receiving this because you opted in to event reminders from Jesus Christ Temple Ministry.</p>
            <p style="margin:0;font-size:12px;color:#6b7280;">Jesus Christ Temple Ministry · Warri, Nigeria · <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;

  return { subject, text, html };
}

export async function sendEventNotificationEmail(
  to: string,
  event: EventForEmail,
  hoursBefore: number,
  unsubscribeUrl: string,
  log: Logger = logger,
  opts: EventNotificationEmailOptions = {},
): Promise<boolean> {
  if (!isEmailConfigured()) {
    log.warn({ to, eventId: event.id }, "SMTP not configured — event notification email skipped");
    return false;
  }
  const { subject, text, html } = renderEventNotificationEmail(event, hoursBefore, unsubscribeUrl, opts);
  try {
    await sendWithRetry(
      {
        from: defaultFrom(),
        to,
        subject,
        text,
        html,
        headers: commonHeaders(unsubscribeUrl),
        ...replyToOption(),
      },
      log,
      `event-notif:${event.id}`,
    );
    return true;
  } catch (err) {
    log.warn({ err, to, eventId: event.id }, "Event notification email send failed (after retries)");
    return false;
  }
}

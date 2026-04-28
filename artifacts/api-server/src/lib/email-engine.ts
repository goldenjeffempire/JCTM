/**
 * email-engine.ts — SMTP transport and email rendering for the JCTM
 * Daily Devotion email subscription.
 *
 * Configuration via env vars:
 *   SMTP_HOST           — e.g. smtp.gmail.com
 *   SMTP_PORT           — e.g. 587 (defaults to 587)
 *   SMTP_SECURE         — "true" forces TLS (port 465); otherwise STARTTLS
 *   SMTP_USER           — SMTP username
 *   SMTP_PASS           — SMTP password / app password / API key
 *   SMTP_FROM           — Header From address, e.g. "JCTM Devotions <devotions@jctm.org.ng>"
 *   PUBLIC_BASE_URL     — Public web app origin used in unsubscribe links,
 *                         e.g. https://jctm.org.ng (no trailing slash).
 *                         Falls back to REPLIT_DEV_DOMAIN, then localhost:5000.
 *
 * If SMTP_HOST/USER/PASS are missing the engine becomes a no-op: subscribers
 * are still recorded, the daily cron logs a warning, and no mail is dispatched.
 * This keeps the feature deployable before credentials are configured.
 */

import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger.js";
import type { Logger } from "pino";
import type { DailyDevotion } from "@workspace/db";

let cachedTransporter: Transporter | null = null;
let cachedConfigured: boolean | null = null;

export function isEmailConfigured(): boolean {
  if (cachedConfigured !== null) return cachedConfigured;
  cachedConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
  return cachedConfigured;
}

function buildTransporter(): Transporter | null {
  if (!isEmailConfigured()) return null;
  if (cachedTransporter) return cachedTransporter;

  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });

  return cachedTransporter;
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
  const transporter = buildTransporter();
  if (!transporter) {
    log.warn({ to }, "SMTP not configured — devotion email skipped");
    return false;
  }
  const { subject, text, html } = renderDevotionEmail(devotion, unsubscribeUrl);
  try {
    await transporter.sendMail({ from: defaultFrom(), to, subject, text, html });
    return true;
  } catch (err) {
    log.warn({ err, to }, "Devotion email send failed");
    return false;
  }
}

export async function sendWelcomeEmail(
  to: string,
  unsubscribeUrl: string,
  log: Logger = logger,
): Promise<boolean> {
  const transporter = buildTransporter();
  if (!transporter) {
    log.info({ to }, "SMTP not configured — welcome email skipped (subscriber still saved)");
    return false;
  }
  const { subject, text, html } = renderWelcomeEmail(unsubscribeUrl);
  try {
    await transporter.sendMail({ from: defaultFrom(), to, subject, text, html });
    return true;
  } catch (err) {
    log.warn({ err, to }, "Welcome email send failed");
    return false;
  }
}

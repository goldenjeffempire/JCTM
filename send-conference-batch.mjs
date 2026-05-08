/**
 * send-conference-batch.mjs
 *
 * Sends the Ministers Conference 2026 event notification email to a
 * specified slice of the emails file.
 *
 * Usage:
 *   node send-conference-batch.mjs <startIndex> <endIndex>
 *
 * Indices are 0-based, endIndex is exclusive.
 * Examples:
 *   node send-conference-batch.mjs 42 62   -> recipients 43-62 (20 emails)
 *   node send-conference-batch.mjs 62 82   -> recipients 63-82 (20 emails)
 *   node send-conference-batch.mjs 82 104  -> recipients 83-104 (22 emails)
 */

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const apiServerDir = resolve(__dirname, "artifacts/api-server");
const require      = createRequire(join(apiServerDir, "package.json"));

const { Pool } = require("pg");
const nodemailer  = require("nodemailer");

// ─── Args ─────────────────────────────────────────────────────────────────────

const startIdx = Number(process.argv[2] ?? 0);
const endIdx   = Number(process.argv[3] ?? 104);

// ─── Env ──────────────────────────────────────────────────────────────────────

const DATABASE_URL  = process.env.DATABASE_URL;
const SMTP_HOST     = process.env.SMTP_HOST;
const SMTP_PORT     = Number(process.env.SMTP_PORT) || 587;
const SMTP_SECURE   = process.env.SMTP_SECURE === "true" || SMTP_PORT === 465;
const SMTP_USER     = process.env.SMTP_USER;
const SMTP_PASS     = process.env.SMTP_PASS;
const SMTP_FROM     = process.env.SMTP_FROM || "Jesus Christ Temple Ministry <info@jctm.org.ng>";
const SMTP_REPLY_TO = process.env.SMTP_REPLY_TO || undefined;
const BASE_URL      = process.env.PUBLIC_BASE_URL
  ? process.env.PUBLIC_BASE_URL.replace(/\/$/, "")
  : process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "https://jctm.org.ng";
const HMAC_SECRET   = process.env.SESSION_SECRET || process.env.JWT_SECRET || "jctm-email-unsub-2026";

// ─── Pools & transport ────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: DATABASE_URL.replace("sslmode=prefer", "sslmode=require"),
  max: 3,
  idleTimeoutMillis: 30_000,
});

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  requireTLS: !SMTP_SECURE,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  connectionTimeout: 15_000,
  greetingTimeout: 10_000,
  socketTimeout: 30_000,
  tls: { minVersion: "TLSv1.2", servername: SMTP_HOST },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function paragraphs(text) {
  return String(text ?? "")
    .split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p style="margin:0 0 14px 0;line-height:1.7;color:#1f2937;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function eventUnsubUrl(email) {
  const token = createHmac("sha256", HMAC_SECRET)
    .update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
  return `${BASE_URL}/api/event-notifications/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

async function isUnsubscribed(email) {
  try {
    const r = await pool.query(
      "SELECT 1 FROM email_unsubscribes WHERE email = $1 LIMIT 1",
      [email.trim().toLowerCase()],
    );
    return r.rows.length > 0;
  } catch { return false; }
}

const TRANSIENT = new Set(["ETIMEDOUT","ECONNRESET","ECONNREFUSED","EAI_AGAIN","EPIPE","EHOSTUNREACH","ENOTFOUND","ESOCKET"]);
const BACKOFFS  = [500, 2_000, 8_000];

async function sendWithRetry(opts) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const info = await transporter.sendMail(opts);
      return info.messageId;
    } catch (err) {
      lastErr = err;
      const transient = TRANSIENT.has(err?.code) || (err?.responseCode >= 400 && err?.responseCode < 500);
      if (!transient || attempt === 4) break;
      await new Promise(r => setTimeout(r, BACKOFFS[attempt - 1]));
    }
  }
  throw lastErr;
}

function renderConferenceEmail(event, unsubUrl) {
  const startDate = new Date(event.start_date);
  const formattedDate = startDate.toLocaleDateString("en-NG", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos", timeZoneName: "short",
  });

  const subject  = `TODAY — ${event.title} · Jesus Christ Temple Ministry`;
  const ctaUrl   = event.youtube_url || `${BASE_URL}/livestream`;
  const ctaLabel = event.youtube_url ? "Watch Live Now" : "Join Us Online";
  const loc      = event.location || "JCTM International Headquarters, Warri, Delta State";

  const text = [
    `${event.title}`,
    `TODAY — ${formattedDate}`,
    `Location: ${loc}`,
    ``,
    `Apostolic Fire is breaking out at JCTM. Join us today for the Ministers Conference 2026.`,
    ``,
    `${ctaLabel}: ${ctaUrl}`,
    ``,
    `— Jesus Christ Temple Ministry, Warri, Nigeria`,
    `Unsubscribe: ${unsubUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;">
  <tr><td align="center" style="padding:24px 12px 40px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">

      <!-- HEADER -->
      <tr><td style="background:#003366;padding:32px 32px 28px;">
        <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#93c5fd;font-weight:700;">Jesus Christ Temple Ministry · Special Event</p>
        <h1 style="margin:0;font-size:26px;line-height:1.2;color:#fff;font-weight:800;">${escapeHtml(event.title)}</h1>
        <p style="margin:10px 0 0 0;display:inline-block;background:#fbbf24;color:#78350f;font-size:13px;font-weight:700;padding:4px 12px;border-radius:50px;letter-spacing:.04em;">HAPPENING TODAY</p>
      </td></tr>

      <!-- DETAILS -->
      <tr><td style="padding:28px 32px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;overflow:hidden;">
          <tr><td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#64748b;font-weight:600;">When</p>
            <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#0f172a;">${escapeHtml(formattedDate)}</p>
          </td></tr>
          <tr><td style="padding:14px 18px;">
            <p style="margin:0;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#64748b;font-weight:600;">Where</p>
            <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#0f172a;">${escapeHtml(loc)}</p>
          </td></tr>
        </table>
      </td></tr>

      <!-- BODY -->
      <tr><td style="padding:24px 32px 0;">
        <div style="padding:20px 22px;background:#fff8f0;border:1px solid #fed7aa;border-radius:10px;">
          <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#92400e;font-weight:700;">Ministers Conference 2026</p>
          <p style="margin:0;font-size:16px;font-style:italic;font-weight:600;color:#78350f;line-height:1.5;">"Come, receive your apostolic fire from the altar of God"</p>
        </div>
        <p style="margin:20px 0 0;font-size:15px;line-height:1.75;color:#374151;">
          Today is a divine appointment. The fire of God is falling at <strong>Jesus Christ Temple Ministry</strong>. Come and receive your apostolic fire — or join us online and participate in the anointing from wherever you are.
        </p>
      </td></tr>

      <!-- CTA -->
      <tr><td style="padding:28px 32px;text-align:center;">
        <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#003366;color:#fff;text-decoration:none;padding:15px 32px;border-radius:50px;font-size:15px;font-weight:700;letter-spacing:.02em;">${escapeHtml(ctaLabel)}</a>
        ${event.youtube_url ? '' : `<p style="margin:12px 0 0;font-size:13px;color:#6b7280;">Or visit: <a href="${escapeHtml(BASE_URL)}/livestream" style="color:#003366;">${BASE_URL}/livestream</a></p>`}
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="padding:0 32px 28px;border-top:1px solid #e5e7eb;">
        <p style="margin:20px 0 6px 0;font-size:12px;color:#6b7280;line-height:1.6;">
          You are receiving this as part of the JCTM Ministers Conference 2026 community notification.
        </p>
        <p style="margin:0;font-size:12px;color:#6b7280;">
          Jesus Christ Temple Ministry · Warri, Nigeria ·
          <a href="${escapeHtml(unsubUrl)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

  return { subject, text, html };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const emailsPath = resolve(__dirname, "emails");
  const allEmails  = readFileSync(emailsPath, "utf8")
    .split("\n").map(e => e.trim().toLowerCase()).filter(e => e && e.includes("@"));

  const batch = allEmails.slice(startIdx, endIdx);
  console.log(`Batch ${startIdx}–${endIdx - 1}: ${batch.length} recipients`);

  // Verify SMTP
  await transporter.verify();
  console.log("SMTP OK");

  // Fetch conference event
  const evRes = await pool.query(
    `SELECT id, title, description, start_date, end_date, location, youtube_url, image_url
     FROM event_calendar WHERE id = 2 LIMIT 1`,
  );
  if (!evRes.rows[0]) { console.error("Event not found"); process.exit(1); }
  const event = evRes.rows[0];
  console.log(`Event: "${event.title}"\n---`);

  let sent = 0, failed = 0, skipped = 0;
  for (let i = 0; i < batch.length; i++) {
    const email   = batch[i];
    const globalN = startIdx + i + 1;
    process.stdout.write(`  [${String(globalN).padStart(3)}] ${email.padEnd(45)}`);

    if (await isUnsubscribed(email)) {
      console.log("SKIP");
      skipped++;
      continue;
    }

    const unsubUrl = eventUnsubUrl(email);
    const { subject, text, html } = renderConferenceEmail(event, unsubUrl);
    try {
      await sendWithRetry({
        from: SMTP_FROM,
        to: email,
        subject,
        text,
        html,
        headers: {
          "X-Mailer": "JCTM Digital Sanctuary",
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        ...(SMTP_REPLY_TO ? { replyTo: SMTP_REPLY_TO } : {}),
      });
      console.log("E✓");
      sent++;
    } catch (err) {
      console.log(`E✗ — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: sent=${sent} failed=${failed} skipped=${skipped}`);
  await pool.end();
  transporter.close();
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });

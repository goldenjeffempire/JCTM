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
 *   node send-conference-batch.mjs 0  20  -> recipients 1-20
 *   node send-conference-batch.mjs 20 40  -> recipients 21-40
 *   node send-conference-batch.mjs 40 60  -> recipients 41-60
 *   node send-conference-batch.mjs 60 80  -> recipients 61-80
 *   node send-conference-batch.mjs 80 104 -> recipients 81-104
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
const SMTP_FROM     = "Jesus Christ Temple Ministry <info@jctm.org.ng>";
const SMTP_REPLY_TO = "info@jctm.org.ng";
const BASE_URL      = "https://jctm.org.ng";
const HMAC_SECRET   = process.env.SESSION_SECRET || process.env.JWT_SECRET || "jctm-email-unsub-2026";

if (!DATABASE_URL) { console.error("ERROR: DATABASE_URL not set"); process.exit(1); }
if (!SMTP_HOST)    { console.error("ERROR: SMTP_HOST not set");     process.exit(1); }
if (!SMTP_USER)    { console.error("ERROR: SMTP_USER not set");     process.exit(1); }
if (!SMTP_PASS)    { console.error("ERROR: SMTP_PASS not set");     process.exit(1); }

// ─── Conference flyer (embedded as CID attachment) ────────────────────────────

const FLYER_CID  = "ministers-conference-2026-flyer@jctm";
const FLYER_PATH = resolve(__dirname, "attached_assets/ministers-conference-2026-flyer.jpeg");
let flyerBuffer;
try {
  flyerBuffer = readFileSync(FLYER_PATH);
  console.log(`Flyer loaded: ${flyerBuffer.length} bytes`);
} catch {
  console.warn("WARN: Flyer image not found at", FLYER_PATH, "— emails will send without image.");
  flyerBuffer = null;
}

// ─── Conference day / subject logic ──────────────────────────────────────────
//
//  Day 1  → Friday    8 May 2026  08:00 WAT (UTC+1) = 07:00 UTC
//  Day 2  → Saturday  9 May 2026  08:00 WAT
//  Day 3  → Sunday   10 May 2026  08:00 WAT

const CONF_DAYS = [
  { day: 1, label: "Day 1", startUtc: new Date("2026-05-08T07:00:00Z"), endUtc: new Date("2026-05-08T20:00:00Z") },
  { day: 2, label: "Day 2", startUtc: new Date("2026-05-09T07:00:00Z"), endUtc: new Date("2026-05-09T20:00:00Z") },
  { day: 3, label: "Day 3", startUtc: new Date("2026-05-10T07:00:00Z"), endUtc: new Date("2026-05-10T20:00:00Z") },
];

function getConferenceSubject() {
  const now = new Date();
  for (const { label, startUtc, endUtc } of CONF_DAYS) {
    if (now >= startUtc && now < endUtc) {
      return `REMINDER: Ministers Conference ${label} Happening Now`;
    }
    if (now < startUtc) {
      return `REMINDER: Ministers Conference ${label} Starting Soon`;
    }
  }
  return "Ministers Conference 2026 — Jesus Christ Temple Ministry";
}

function getConferenceDayLabel() {
  const now = new Date();
  for (const { label, startUtc, endUtc } of CONF_DAYS) {
    if (now < endUtc) {
      if (now >= startUtc) return { label, status: "happening" };
      return { label, status: "soon" };
    }
  }
  return { label: "Day 3", status: "ended" };
}

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

// ─── Email renderer ───────────────────────────────────────────────────────────

function renderConferenceEmail(unsubUrl) {
  const subject = getConferenceSubject();
  const { label: dayLabel, status } = getConferenceDayLabel();

  const statusBadge = status === "happening"
    ? `<span style="display:inline-block;background:#dc2626;color:#fff;font-size:12px;font-weight:800;padding:5px 14px;border-radius:50px;letter-spacing:.08em;text-transform:uppercase;">&#9679; LIVE NOW</span>`
    : `<span style="display:inline-block;background:#d97706;color:#fff;font-size:12px;font-weight:800;padding:5px 14px;border-radius:50px;letter-spacing:.08em;text-transform:uppercase;">&#9200; STARTING SOON</span>`;

  const statusText = status === "happening" ? "is happening NOW" : "is starting soon";

  const flyerImgHtml = flyerBuffer
    ? `<tr><td style="padding:0;">
        <img src="cid:${FLYER_CID}" alt="Ministers Conference 2026 — Jesus Christ Temple Ministry" width="600"
          style="width:100%;max-width:600px;height:auto;display:block;border:0;" />
      </td></tr>`
    : "";

  const text = [
    subject,
    "",
    "Ministers Conference 2026 — Jesus Christ Temple Ministry",
    `${dayLabel} ${statusText}`,
    "",
    "When: Friday–Sunday, 8th–10th May 2026 · 8:00 AM Daily (WAT)",
    "Where: Church Auditorium, Km 1 East West Rd., Ebrumede Roundabout, Effurun Uvwie L.G.A., Delta State",
    "Enquiries: +234(0)8081313111",
    "",
    "Three days of ministerial equipping, prophetic impartation, and doctrinal grounding for ministers and leaders across the body of Christ. Services begin at 8:00 AM daily.",
    "",
    `Watch Live or join us in person: ${BASE_URL}/livestream`,
    `Website: ${BASE_URL}`,
    "Social: @TEMPLE TV/JCTM",
    "",
    "— Jesus Christ Temple Ministry · Warri, Nigeria",
    `info@jctm.org.ng · jctm.org.ng · +234(0)8081313111`,
    "",
    "You're receiving this because you are part of the JCTM Ministers Conference 2026 community.",
    `Unsubscribe: ${unsubUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0d1b2e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1b2e;padding:0;">
  <tr><td align="center" style="padding:28px 12px 40px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0"
      style="max-width:600px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35);">

      <!-- TOP BRAND BAR -->
      <tr><td style="background:#0d1b2e;padding:18px 32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="margin:0;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#7ea8d8;font-weight:700;">Jesus Christ Temple Ministry</p>
              <p style="margin:3px 0 0 0;font-size:10px;color:#4a6f99;letter-spacing:.12em;text-transform:uppercase;">The Land of Good News</p>
            </td>
            <td align="right">
              <p style="margin:0;font-size:11px;color:#4a6f99;">jctm.org.ng</p>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- FLYER IMAGE -->
      ${flyerImgHtml}

      <!-- HEADLINE BLOCK -->
      <tr><td style="background:linear-gradient(135deg,#0a1628 0%,#1a3a6b 100%);padding:36px 36px 30px;">
        <p style="margin:0 0 14px 0;">${statusBadge}</p>
        <h1 style="margin:0 0 8px 0;font-size:32px;line-height:1.1;color:#fff;font-weight:900;letter-spacing:-.02em;">Ministers Conference<br><span style="color:#d4a017;">2026</span></h1>
        <p style="margin:10px 0 0 0;font-size:16px;color:#7ea8d8;font-weight:600;">${escapeHtml(dayLabel)} ${statusText}</p>
      </td></tr>

      <!-- EVENT DETAILS -->
      <tr><td style="padding:28px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr><td style="background:#f8fafc;padding:16px 20px;border-bottom:1px solid #e2e8f0;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:12px;font-size:22px;vertical-align:middle;">&#128197;</td>
                <td>
                  <p style="margin:0;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;font-weight:700;">When</p>
                  <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#0f172a;">Friday – Sunday, 8th – 10th May 2026</p>
                  <p style="margin:2px 0 0;font-size:13px;color:#475569;">8:00 AM Daily (WAT) · All three days</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="background:#fff;padding:16px 20px;border-bottom:1px solid #e2e8f0;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:12px;font-size:22px;vertical-align:middle;">&#128205;</td>
                <td>
                  <p style="margin:0;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;font-weight:700;">Where</p>
                  <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#0f172a;">Church Auditorium</p>
                  <p style="margin:2px 0 0;font-size:13px;color:#475569;">Km 1 East West Rd., Ebrumede Roundabout<br>Effurun Uvwie L.G.A., Delta State, Nigeria</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="background:#f8fafc;padding:16px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:12px;font-size:22px;vertical-align:middle;">&#128222;</td>
                <td>
                  <p style="margin:0;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;font-weight:700;">Enquiries</p>
                  <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#0f172a;">+234(0)8081313111</p>
                  <p style="margin:2px 0 0;font-size:13px;color:#475569;">info@jctm.org.ng</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

      <!-- CONFERENCE DESCRIPTION -->
      <tr><td style="padding:24px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:#fffbeb;border-left:4px solid #d4a017;border-radius:0 10px 10px 0;padding:18px 22px;">
            <p style="margin:0 0 6px 0;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#92400e;font-weight:700;">Apostolic Theme 2026</p>
            <p style="margin:0;font-size:16px;font-style:italic;font-weight:700;color:#78350f;line-height:1.5;">&ldquo;Come, receive your apostolic fire from the altar of God&rdquo;</p>
          </td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:15px;line-height:1.8;color:#374151;">
          The <strong>Ministers Conference 2026</strong> is a three-day gathering of ministers, pastors, and leaders from across the body of Christ — convened at the altar of Jesus Christ Temple Ministry for ministerial equipping, prophetic impartation, and doctrinal grounding in the Word of God.
        </p>
        <p style="margin:14px 0 0;font-size:15px;line-height:1.8;color:#374151;">
          Services begin at <strong>8:00 AM daily</strong>. Whether you join us physically at the Church Auditorium in Effurun or watch online, this is a divine appointment you do not want to miss.
        </p>
      </td></tr>

      <!-- CTA BUTTONS -->
      <tr><td style="padding:30px 32px 8px;text-align:center;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <td style="padding:0 8px 0 0;">
              <a href="${BASE_URL}/livestream"
                style="display:inline-block;background:#1a3a6b;color:#fff;text-decoration:none;padding:14px 26px;border-radius:50px;font-size:14px;font-weight:800;letter-spacing:.02em;">
                &#9654; Watch Live
              </a>
            </td>
            <td>
              <a href="${BASE_URL}"
                style="display:inline-block;background:#d4a017;color:#fff;text-decoration:none;padding:14px 26px;border-radius:50px;font-size:14px;font-weight:800;letter-spacing:.02em;">
                Visit Website
              </a>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- SOCIAL + CONTACT -->
      <tr><td style="padding:24px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#0d1b2e;border-radius:12px;padding:20px 22px;">
          <tr><td align="center">
            <p style="margin:0 0 8px 0;font-size:12px;color:#7ea8d8;letter-spacing:.1em;text-transform:uppercase;font-weight:700;">Follow &amp; Share</p>
            <p style="margin:0;font-size:14px;color:#fff;font-weight:600;">&#64;TEMPLE TV/JCTM</p>
            <p style="margin:6px 0 0;font-size:13px;color:#4a6f99;">
              Facebook &nbsp;·&nbsp; Instagram &nbsp;·&nbsp; X (Twitter) &nbsp;·&nbsp; YouTube
            </p>
          </td></tr>
        </table>
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="padding:24px 32px 28px;border-top:1px solid #e5e7eb;margin-top:24px;">
        <p style="margin:24px 0 4px 0;font-size:13px;color:#1a3a6b;font-weight:700;">Jesus Christ Temple Ministry</p>
        <p style="margin:0 0 10px 0;font-size:12px;color:#6b7280;line-height:1.7;">
          Km 1 East West Rd., Ebrumede Roundabout, Effurun Uvwie L.G.A., Delta State, Nigeria<br>
          <a href="${BASE_URL}" style="color:#1a3a6b;text-decoration:none;">jctm.org.ng</a>
          &nbsp;·&nbsp; info@jctm.org.ng
          &nbsp;·&nbsp; +234(0)8081313111
        </p>
        <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
          You're receiving this because you are part of the JCTM Ministers Conference 2026 community.
          &nbsp;<a href="${escapeHtml(unsubUrl)}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

  const attachments = flyerBuffer ? [{
    filename: "ministers-conference-2026.jpg",
    content: flyerBuffer,
    cid: FLYER_CID,
    contentType: "image/jpeg",
  }] : [];

  return { subject, text, html, attachments };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const emailsPath = resolve(__dirname, "emails");
  const allEmails  = readFileSync(emailsPath, "utf8")
    .split("\n").map(e => e.trim().toLowerCase()).filter(e => e && e.includes("@"));

  const batch = allEmails.slice(startIdx, endIdx);
  console.log("=".repeat(60));
  console.log(`JCTM Conference Batch Emailer — ${new Date().toISOString()}`);
  console.log("=".repeat(60));
  console.log(`Batch ${startIdx}–${endIdx - 1}: ${batch.length} recipients`);
  console.log(`From:     ${SMTP_FROM}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Subject:  ${getConferenceSubject()}`);
  console.log(`Flyer:    ${flyerBuffer ? "loaded (" + flyerBuffer.length + " bytes)" : "NOT FOUND"}`);
  console.log("");

  await transporter.verify();
  console.log("SMTP OK\n---");

  let sent = 0, failed = 0, skipped = 0;

  for (let i = 0; i < batch.length; i++) {
    const email   = batch[i];
    const globalN = startIdx + i + 1;
    process.stdout.write(`  [${String(globalN).padStart(3)}/${allEmails.length}] ${email.padEnd(45)}`);

    if (await isUnsubscribed(email)) {
      console.log("SKIP (unsubscribed)");
      skipped++;
      continue;
    }

    const unsubUrl = eventUnsubUrl(email);
    const { subject, text, html, attachments } = renderConferenceEmail(unsubUrl);

    try {
      await sendWithRetry({
        from: SMTP_FROM,
        to: email,
        replyTo: SMTP_REPLY_TO,
        subject,
        text,
        html,
        attachments,
        headers: {
          "X-Mailer": "JCTM Digital Sanctuary",
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      console.log("E✓");
      sent++;
    } catch (err) {
      console.log(`E✗ — ${err.message}`);
      failed++;
    }

    // Throttle — 150 ms between recipients
    if (i < batch.length - 1) {
      await new Promise(r => setTimeout(r, 150));
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`SUMMARY — Batch ${startIdx}–${endIdx - 1}`);
  console.log("=".repeat(60));
  console.log(`  Sent    : ${sent}`);
  console.log(`  Failed  : ${failed}`);
  console.log(`  Skipped : ${skipped}`);
  console.log(`\nDone — ${new Date().toISOString()}`);

  await pool.end();
  transporter.close();
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });

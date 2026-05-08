/**
 * send-bulk-emails.mjs
 *
 * One-shot bulk emailer — sends today's Daily Devotion AND the Ministers
 * Conference 2026 event notification to every address in the root `emails`
 * file (104 recipients).
 *
 * Checks the global opt-out table (email_unsubscribes) before every send.
 * Logs a full per-recipient summary at the end.
 *
 * Run from the workspace root:
 *   node send-bulk-emails.mjs
 */

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Batch args: node send-bulk-emails.mjs <startIdx> <endIdx> ───────────────
// Both 0-based; endIdx exclusive. Omit to process all recipients.
const BATCH_START = process.argv[2] !== undefined ? Number(process.argv[2]) : 0;
const BATCH_END   = process.argv[3] !== undefined ? Number(process.argv[3]) : Infinity;

// ─── Package resolution from api-server node_modules ─────────────────────────

const apiServerDir = resolve(__dirname, "artifacts/api-server");
const require = createRequire(join(apiServerDir, "package.json"));

const { Pool } = require("pg");
const nodemailer = require("nodemailer");

// ─── Env vars ─────────────────────────────────────────────────────────────────

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

if (!DATABASE_URL)  { console.error("ERROR: DATABASE_URL not set"); process.exit(1); }
if (!SMTP_HOST)     { console.error("ERROR: SMTP_HOST not set");     process.exit(1); }
if (!SMTP_USER)     { console.error("ERROR: SMTP_USER not set");     process.exit(1); }
if (!SMTP_PASS)     { console.error("ERROR: SMTP_PASS not set");     process.exit(1); }

// ─── Conference flyer (embedded as CID attachment) ────────────────────────────

const FLYER_CID  = "ministers-conference-2026-flyer@jctm";
const FLYER_PATH = resolve(__dirname, "attached_assets/ministers-conference-2026-flyer.jpeg");
let flyerBuffer;
try {
  flyerBuffer = readFileSync(FLYER_PATH);
} catch {
  console.warn("WARN: Flyer image not found at", FLYER_PATH, "— emails will send without image.");
  flyerBuffer = null;
}

// ─── Conference day / subject logic ──────────────────────────────────────────
//
//  Day 1  → Friday    8 May 2026  08:00 WAT (UTC+1)
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

// ─── Database pool ────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: DATABASE_URL.replace("sslmode=prefer", "sslmode=require"),
  max: 5,
  idleTimeoutMillis: 30_000,
});

// ─── SMTP transporter ─────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  requireTLS: !SMTP_SECURE,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  pool: true,
  maxConnections: 3,
  maxMessages: 200,
  rateLimit: 5,
  connectionTimeout: 15_000,
  greetingTimeout: 10_000,
  socketTimeout: 30_000,
  tls: { minVersion: "TLSv1.2", servername: SMTP_HOST },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphs(text) {
  return String(text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      `<p style="margin:0 0 14px 0;line-height:1.7;color:#1f2937;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

function generateUnsubToken(email) {
  return createHmac("sha256", HMAC_SECRET)
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

function devotionUnsubUrl(email) {
  const token = generateUnsubToken(email);
  return `${BASE_URL}/api/devotion/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

function eventUnsubUrl(email) {
  const token = generateUnsubToken(email);
  return `${BASE_URL}/api/event-notifications/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

async function isUnsubscribed(email) {
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

const TRANSIENT = new Set(["ETIMEDOUT","ECONNRESET","ECONNREFUSED","EAI_AGAIN","EPIPE","EHOSTUNREACH","ENOTFOUND","ESOCKET"]);
const BACKOFFS  = [500, 2_000, 8_000];

async function sendWithRetry(opts, label = "") {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const info = await transporter.sendMail(opts);
      return info.messageId;
    } catch (err) {
      lastErr = err;
      const transient = TRANSIENT.has(err?.code) || (err?.responseCode >= 400 && err?.responseCode < 500);
      if (!transient || attempt === 4) break;
      await new Promise((r) => setTimeout(r, BACKOFFS[attempt - 1]));
    }
  }
  throw lastErr;
}

// ─── Email renderers ──────────────────────────────────────────────────────────

function renderDevotion(d, unsubUrl) {
  const subject = `Daily Devotion — ${d.title}`;

  // d.date may arrive as a JS Date object (pg driver) or a "YYYY-MM-DD" string
  const rawDate = d.date instanceof Date
    ? d.date.toISOString().slice(0, 10)
    : String(d.date).slice(0, 10);
  let formattedDate = rawDate;
  try {
    formattedDate = new Date(rawDate + "T00:00:00Z").toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
    });
  } catch { /* use raw */ }

  const text = [
    "JCTM Digital Sanctuary — Daily Devotion",
    formattedDate,
    "",
    d.title,
    "",
    `"${d.scripture}"`,
    `— ${d.reference}`,
    "",
    "REFLECTION",
    d.reflection,
    "",
    "PROPHETIC WORD — Through Prophet Amos Evomobor",
    d.prophetic_word,
    "",
    "PRAYER FOCUS",
    d.prayer_focus,
    "",
    "DECLARATION (Speak this aloud)",
    `"${d.declaration}"`,
    "",
    "— Jesus Christ Temple Ministry, Warri, Nigeria",
    `Read devotions online: ${BASE_URL}/devotion`,
    "",
    `To unsubscribe: ${unsubUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px 40px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr><td style="background:#0f172a;border-radius:16px 16px 0 0;padding:28px 36px 24px;">
      <p style="margin:0 0 4px 0;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#64748b;font-weight:600;">Jesus Christ Temple Ministry</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:-.02em;">Daily Devotion</p>
      <p style="margin:8px 0 0 0;font-size:13px;color:#94a3b8;">${escapeHtml(formattedDate)}</p>
    </td></tr>
    <tr><td style="background:#fff;padding:36px 36px 8px;">
      <h1 style="margin:0 0 24px 0;font-size:28px;line-height:1.2;color:#0f172a;font-weight:800;">${escapeHtml(d.title)}</h1>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        <tr>
          <td width="4" style="background:#0f172a;border-radius:4px;">&nbsp;</td>
          <td style="padding:16px 20px;background:#f8fafc;border-radius:0 8px 8px 0;">
            <p style="margin:0 0 8px 0;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;font-weight:600;">Scripture</p>
            <p style="margin:0 0 10px 0;font-size:17px;font-style:italic;line-height:1.6;color:#0f172a;">${escapeHtml(d.scripture)}</p>
            <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#475569;">— ${escapeHtml(d.reference)}</p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px 0;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Reflection</p>
      <div style="margin-bottom:28px;font-size:15px;line-height:1.8;color:#374151;">${paragraphs(d.reflection)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr><td style="background:#fef9f0;border:1px solid #fed7aa;border-radius:10px;padding:20px 22px;">
          <p style="margin:0 0 8px 0;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#92400e;font-weight:600;">Prophetic Word</p>
          <div style="font-size:15px;line-height:1.75;color:#78350f;font-style:italic;">${paragraphs(d.prophetic_word)}</div>
          <p style="margin:10px 0 0 0;font-size:11px;color:#a16207;font-weight:600;">— Through Prophet Amos Evomobor · JCTM</p>
        </td></tr>
      </table>
      <p style="margin:0 0 8px 0;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Prayer Focus</p>
      <div style="margin-bottom:28px;font-size:15px;line-height:1.8;color:#374151;">${paragraphs(d.prayer_focus)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
        <tr><td style="background:#0f172a;border-radius:10px;padding:22px 24px;">
          <p style="margin:0 0 10px 0;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#64748b;font-weight:600;">Declaration — Speak this aloud</p>
          <p style="margin:0;font-size:17px;font-style:italic;font-weight:600;line-height:1.55;color:#f8fafc;">&ldquo;${escapeHtml(d.declaration)}&rdquo;</p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="background:#fff;padding:0 36px 32px;text-align:center;">
      <a href="${BASE_URL}/devotion" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:13px 28px;border-radius:50px;font-size:14px;font-weight:700;margin-top:4px;">Read on the web →</a>
    </td></tr>
    <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0 0 16px 16px;padding:22px 36px;">
      <p style="margin:0 0 8px 0;font-size:13px;color:#475569;font-weight:600;">Jesus Christ Temple Ministry</p>
      <p style="margin:0 0 12px 0;font-size:12px;color:#94a3b8;line-height:1.6;">Km 1 East West Rd., Ebrumede Roundabout, Effurun, Delta State, Nigeria<br>
        <a href="${BASE_URL}" style="color:#64748b;text-decoration:none;">jctm.org.ng</a>
        &nbsp;·&nbsp;
        <a href="${BASE_URL}/devotion" style="color:#64748b;text-decoration:none;">More Devotions</a>
      </p>
      <p style="margin:0;font-size:11px;color:#cbd5e1;">You're receiving this from the JCTM Daily Devotion.
        &nbsp;<a href="${escapeHtml(unsubUrl)}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a>
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;

  return { subject, text, html };
}

function renderConferenceNotification(unsubUrl) {
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
    `Ministers Conference 2026 — Jesus Christ Temple Ministry`,
    `${dayLabel} ${statusText}`,
    "",
    `When: Friday–Sunday, 8th–10th May 2026 · 8:00 AM Daily (WAT)`,
    `Where: Church Auditorium, Km 1 East West Rd., Ebrumede Roundabout, Effurun Uvwie L.G.A., Delta State`,
    `Enquiries: +234(0)8081313111`,
    "",
    `Three days of ministerial equipping, prophetic impartation, and doctrinal grounding for ministers and leaders across the body of Christ. Services begin at 8:00 AM daily.`,
    "",
    `Watch Live or join us in person: ${BASE_URL}/livestream`,
    `Website: ${BASE_URL}`,
    `Social: @TEMPLE TV/JCTM`,
    "",
    `— Jesus Christ Temple Ministry · Warri, Nigeria`,
    `info@jctm.org.ng · www.jctm.org.ng · +234(0)8081313111`,
    "",
    `You're receiving this because you are part of the JCTM community.`,
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
              <p style="margin:0;font-size:11px;color:#4a6f99;">www.jctm.org.ng</p>
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
          <tr><td style="background:#fffbeb;border-left:4px solid #d4a017;border-radius:0 10px 10px 0;padding:18px 22px;margin-bottom:20px;">
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
          <a href="${BASE_URL}" style="color:#1a3a6b;text-decoration:none;">www.jctm.org.ng</a>
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
  console.log("=".repeat(60));
  console.log("JCTM Bulk Email Sender — " + new Date().toISOString());
  console.log("=".repeat(60));
  console.log("  From:     " + SMTP_FROM);
  console.log("  Base URL: " + BASE_URL);
  console.log("  Subject:  " + getConferenceSubject());

  // 1. Verify SMTP
  console.log("\n[1/5] Verifying SMTP connection…");
  try {
    await transporter.verify();
    console.log("      SMTP OK — " + SMTP_HOST + ":" + SMTP_PORT);
  } catch (err) {
    console.error("      SMTP verify FAILED:", err.message);
    process.exit(1);
  }

  // 2. Load recipient list
  console.log("\n[2/5] Loading recipient list from ./emails…");
  const emailsPath = resolve(__dirname, "emails");
  const raw = readFileSync(emailsPath, "utf8");
  const allEmailsFull = raw
    .split("\n")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e && e.includes("@"));
  const allEmails = allEmailsFull.slice(BATCH_START, BATCH_END === Infinity ? undefined : BATCH_END);
  console.log(`      Total: ${allEmailsFull.length} — Processing: ${BATCH_START}–${Math.min(BATCH_END, allEmailsFull.length) - 1} (${allEmails.length} recipients)`);

  // 3. Fetch today's devotion
  console.log("\n[3/5] Fetching today's devotion from database…");
  const today = new Date().toISOString().slice(0, 10);
  const devotionRes = await pool.query(
    `SELECT date, title, scripture, reference, reflection,
            prophetic_word, prayer_focus, declaration
     FROM daily_devotions WHERE date = $1 LIMIT 1`,
    [today],
  );
  let devotion;
  if (devotionRes.rows.length > 0) {
    devotion = devotionRes.rows[0];
    console.log(`      Found: "${devotion.title}"`);
  } else {
    console.log("      Not in DB — fetching via API to generate…");
    const resp = await fetch("http://localhost:5000/api/devotion/daily");
    const data = await resp.json();
    if (!data.devotion?.title) {
      console.error("      FAILED to generate devotion:", JSON.stringify(data));
      process.exit(1);
    }
    const r2 = await pool.query(
      "SELECT date, title, scripture, reference, reflection, prophetic_word, prayer_focus, declaration FROM daily_devotions WHERE date = $1 LIMIT 1",
      [today],
    );
    if (r2.rows.length === 0) {
      devotion = {
        date: data.devotion.date,
        title: data.devotion.title,
        scripture: data.devotion.scripture,
        reference: data.devotion.reference,
        reflection: data.devotion.reflection,
        prophetic_word: data.devotion.propheticWord,
        prayer_focus: data.devotion.prayerFocus,
        declaration: data.devotion.declaration,
      };
    } else {
      devotion = r2.rows[0];
    }
    console.log(`      Generated: "${devotion.title}"`);
  }

  // 4. Build conference notification (no DB query needed — content is fixed)
  console.log("\n[4/5] Building Ministers Conference notification…");
  const { label: dayLabel, status } = getConferenceDayLabel();
  console.log(`      Conference ${dayLabel} — status: ${status}`);
  console.log(`      Flyer image: ${flyerBuffer ? "loaded (" + flyerBuffer.length + " bytes)" : "NOT FOUND — skipping"}`);

  // 5. Send to each recipient
  console.log("\n[5/5] Sending emails…");
  console.log("-".repeat(60));

  const results = [];
  let devotionSent = 0, devotionFailed = 0;
  let eventSent = 0, eventFailed = 0;
  let skippedUnsub = 0;

  for (let i = 0; i < allEmails.length; i++) {
    const email = allEmails[i];
    const idx = String(i + 1).padStart(3, " ");
    process.stdout.write(`  [${idx}/${allEmails.length}] ${email.padEnd(45)}`);

    const optedOut = await isUnsubscribed(email);
    if (optedOut) {
      console.log("SKIP (unsubscribed)");
      skippedUnsub++;
      results.push({ email, status: "skipped", reason: "unsubscribed" });
      continue;
    }

    const row = { email, devotion: null, conference: null };

    // Send devotion email
    const devUnsub = devotionUnsubUrl(email);
    const { subject: dSubject, text: dText, html: dHtml } = renderDevotion(devotion, devUnsub);
    try {
      await sendWithRetry({
        from: SMTP_FROM,
        to: email,
        replyTo: SMTP_REPLY_TO,
        subject: dSubject,
        text: dText,
        html: dHtml,
        headers: {
          "X-Mailer": "JCTM Digital Sanctuary",
          "List-Unsubscribe": `<${devUnsub}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }, `devotion:${email}`);
      row.devotion = "sent";
      devotionSent++;
    } catch (err) {
      row.devotion = "failed";
      row.devotionError = err.message;
      devotionFailed++;
    }

    // Send conference notification email
    const evUnsub = eventUnsubUrl(email);
    const { subject: eSubject, text: eText, html: eHtml, attachments } = renderConferenceNotification(evUnsub);
    try {
      await sendWithRetry({
        from: SMTP_FROM,
        to: email,
        replyTo: SMTP_REPLY_TO,
        subject: eSubject,
        text: eText,
        html: eHtml,
        attachments,
        headers: {
          "X-Mailer": "JCTM Digital Sanctuary",
          "List-Unsubscribe": `<${evUnsub}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }, `conference:${email}`);
      row.conference = "sent";
      eventSent++;
    } catch (err) {
      row.conference = "failed";
      row.conferenceError = err.message;
      eventFailed++;
    }

    const dStatus = row.devotion === "sent" ? "D✓" : "D✗";
    const eStatus = row.conference === "sent" ? "E✓" : "E✗";
    console.log(`${dStatus}  ${eStatus}`);
    results.push(row);

    // Throttle — 150 ms between recipients
    if (i < allEmails.length - 1) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────────

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Total recipients    : ${allEmails.length}`);
  console.log(`  Skipped (opt-out)   : ${skippedUnsub}`);
  console.log(`  Eligible            : ${allEmails.length - skippedUnsub}`);
  console.log("");
  console.log(`  Devotion sent       : ${devotionSent}`);
  console.log(`  Devotion failed     : ${devotionFailed}`);
  console.log(`  Conference sent     : ${eventSent}`);
  console.log(`  Conference failed   : ${eventFailed}`);

  if (devotionFailed > 0 || eventFailed > 0) {
    console.log("\n  FAILURES:");
    for (const r of results) {
      if (r.devotion === "failed") {
        console.log(`    [DEVOTION]    ${r.email} — ${r.devotionError}`);
      }
      if (r.conference === "failed") {
        console.log(`    [CONFERENCE]  ${r.email} — ${r.conferenceError}`);
      }
    }
  }

  console.log("\nDone — " + new Date().toISOString());

  await pool.end();
  transporter.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});

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
const SMTP_FROM     = process.env.SMTP_FROM || "Jesus Christ Temple Ministry <info@jctm.org.ng>";
const SMTP_REPLY_TO = process.env.SMTP_REPLY_TO || undefined;
const BASE_URL      = process.env.PUBLIC_BASE_URL
  ? process.env.PUBLIC_BASE_URL.replace(/\/$/, "")
  : process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "https://jctm.org.ng";

const HMAC_SECRET   = process.env.SESSION_SECRET || process.env.JWT_SECRET || "jctm-email-unsub-2026";

if (!DATABASE_URL)  { console.error("ERROR: DATABASE_URL not set"); process.exit(1); }
if (!SMTP_HOST)     { console.error("ERROR: SMTP_HOST not set");     process.exit(1); }
if (!SMTP_USER)     { console.error("ERROR: SMTP_USER not set");     process.exit(1); }
if (!SMTP_PASS)     { console.error("ERROR: SMTP_PASS not set");     process.exit(1); }

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

  let formattedDate = d.date;
  try {
    formattedDate = new Date(d.date + "T00:00:00Z").toLocaleDateString("en-US", {
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
      <a href="${escapeHtml(BASE_URL)}/devotion" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:13px 28px;border-radius:50px;font-size:14px;font-weight:700;margin-top:4px;">Read on the web →</a>
    </td></tr>
    <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0 0 16px 16px;padding:22px 36px;">
      <p style="margin:0 0 8px 0;font-size:13px;color:#475569;font-weight:600;">Jesus Christ Temple Ministry</p>
      <p style="margin:0 0 12px 0;font-size:12px;color:#94a3b8;line-height:1.6;">Ebrumede Roundabout, Effurun, Delta State, Nigeria<br>
        <a href="${escapeHtml(BASE_URL)}" style="color:#64748b;text-decoration:none;">jctm.org.ng</a>
        &nbsp;·&nbsp;
        <a href="${escapeHtml(BASE_URL)}/devotion" style="color:#64748b;text-decoration:none;">More Devotions</a>
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

function renderEventNotification(event, unsubUrl) {
  const startDate = new Date(event.start_date);
  const formattedDate = startDate.toLocaleDateString("en-NG", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos",
    timeZoneName: "short",
  });

  const subject = `Today — ${event.title} · Jesus Christ Temple Ministry`;
  const eventUrl = `${BASE_URL}/events#event-${event.id}`;
  const ctaUrl   = event.youtube_url || eventUrl;
  const ctaLabel = event.youtube_url ? "Watch Live" : "View Event Details";
  const locationLine = event.location ? `\nLocation: ${event.location}` : "";
  const description  = (event.description || "").trim();

  const text = [
    `${event.title}`,
    `TODAY — ${formattedDate}${locationLine}`,
    "",
    description || "Join us for this special service at Jesus Christ Temple Ministry.",
    "",
    `${ctaLabel}: ${ctaUrl}`,
    "",
    "— Jesus Christ Temple Ministry, Warri, Nigeria",
    `Unsubscribe: ${unsubUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f3ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ee;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04);">
      <tr><td style="background:#003366;padding:28px 32px;">
        <p style="margin:0 0 4px 0;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#93c5fd;font-weight:700;">Jesus Christ Temple Ministry · Happening Today</p>
        <h1 style="margin:6px 0 0 0;font-size:24px;line-height:1.25;color:#fff;font-weight:800;">${escapeHtml(event.title)}</h1>
        <p style="margin:8px 0 0 0;font-size:13px;color:#bfdbfe;">${escapeHtml(formattedDate)}</p>
      </td></tr>
      <tr><td style="padding:24px 32px 8px;">
        ${event.location ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
          <tr><td style="padding:4px 0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">Where:</strong> ${escapeHtml(event.location)}</td></tr>
        </table>` : ""}
        ${description ? `<div style="font-size:15px;line-height:1.75;color:#374151;margin-bottom:24px;">${paragraphs(description)}</div>` : `<p style="font-size:15px;line-height:1.75;color:#374151;margin:0 0 24px 0;">Join us for this special service at Jesus Christ Temple Ministry — a moment of encounter, worship, and the Word.</p>`}
        <p style="margin:0 0 28px 0;">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#003366;color:#fff;text-decoration:none;padding:13px 26px;border-radius:9999px;font-size:14px;font-weight:700;">${escapeHtml(ctaLabel)}</a>
        </p>
      </td></tr>
      <tr><td style="padding:0 32px 24px;border-top:1px solid #e5e7eb;">
        <p style="margin:18px 0 4px 0;font-size:12px;color:#6b7280;line-height:1.6;">You are receiving this because you are part of the JCTM community.</p>
        <p style="margin:0;font-size:12px;color:#6b7280;">Jesus Christ Temple Ministry · Warri, Nigeria ·
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
  console.log("=".repeat(60));
  console.log("JCTM Bulk Email Sender — " + new Date().toISOString());
  console.log("=".repeat(60));

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
  const allEmails = raw
    .split("\n")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e && e.includes("@"));
  console.log(`      Loaded ${allEmails.length} addresses`);

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
    // Re-query after generation
    const r2 = await pool.query(
      "SELECT date, title, scripture, reference, reflection, prophetic_word, prayer_focus, declaration FROM daily_devotions WHERE date = $1 LIMIT 1",
      [today],
    );
    if (r2.rows.length === 0) {
      // Use API response directly, mapping camelCase keys
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

  // 4. Fetch today's upcoming event(s)
  console.log("\n[4/5] Fetching event(s) for today…");
  const eventRes = await pool.query(
    `SELECT id, title, description, start_date, end_date,
            location, event_type, youtube_url, image_url
     FROM event_calendar
     WHERE start_date >= NOW() - INTERVAL '3 hours'
       AND start_date <= NOW() + INTERVAL '24 hours'
       AND notification_enabled = true
     ORDER BY start_date
     LIMIT 5`,
  );
  const events = eventRes.rows;
  if (events.length === 0) {
    console.log("      No upcoming events found (will only send devotion).");
  } else {
    events.forEach((e) => console.log(`      Event #${e.id}: "${e.title}" at ${new Date(e.start_date).toISOString()}`));
  }

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

    // Check global opt-out
    const optedOut = await isUnsubscribed(email);
    if (optedOut) {
      console.log("SKIP (unsubscribed)");
      skippedUnsub++;
      results.push({ email, status: "skipped", reason: "unsubscribed" });
      continue;
    }

    const row = { email, devotion: null, events: [] };

    // Send devotion email
    const devUnsub = devotionUnsubUrl(email);
    const { subject: dSubject, text: dText, html: dHtml } = renderDevotion(devotion, devUnsub);
    try {
      await sendWithRetry({
        from: SMTP_FROM,
        to: email,
        subject: dSubject,
        text: dText,
        html: dHtml,
        headers: {
          "X-Mailer": "JCTM Digital Sanctuary",
          "List-Unsubscribe": `<${devUnsub}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        ...(SMTP_REPLY_TO ? { replyTo: SMTP_REPLY_TO } : {}),
      }, `devotion:${email}`);
      row.devotion = "sent";
      devotionSent++;
    } catch (err) {
      row.devotion = "failed";
      row.devotionError = err.message;
      devotionFailed++;
    }

    // Send event notification email(s)
    for (const event of events) {
      const evUnsub = eventUnsubUrl(email);
      const { subject: eSubject, text: eText, html: eHtml } = renderEventNotification(event, evUnsub);
      try {
        await sendWithRetry({
          from: SMTP_FROM,
          to: email,
          subject: eSubject,
          text: eText,
          html: eHtml,
          headers: {
            "X-Mailer": "JCTM Digital Sanctuary",
            "List-Unsubscribe": `<${evUnsub}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          ...(SMTP_REPLY_TO ? { replyTo: SMTP_REPLY_TO } : {}),
        }, `event:${event.id}:${email}`);
        row.events.push({ id: event.id, status: "sent" });
        eventSent++;
      } catch (err) {
        row.events.push({ id: event.id, status: "failed", error: err.message });
        eventFailed++;
      }
    }

    // Status line
    const dStatus = row.devotion === "sent" ? "D✓" : "D✗";
    const eStatus = events.length === 0 ? "" : row.events.map(e => e.status === "sent" ? "E✓" : "E✗").join(" ");
    console.log(`${dStatus}  ${eStatus}`);
    results.push(row);

    // Throttle — 120 ms between recipients
    if (i < allEmails.length - 1) {
      await new Promise((r) => setTimeout(r, 120));
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
  if (events.length > 0) {
    console.log(`  Event notif sent    : ${eventSent}`);
    console.log(`  Event notif failed  : ${eventFailed}`);
  }

  if (devotionFailed > 0 || eventFailed > 0) {
    console.log("\n  FAILURES:");
    for (const r of results) {
      if (r.devotion === "failed") {
        console.log(`    [DEVOTION]  ${r.email} — ${r.devotionError}`);
      }
      for (const ev of (r.events || [])) {
        if (ev.status === "failed") {
          console.log(`    [EVENT #${ev.id}] ${r.email} — ${ev.error}`);
        }
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

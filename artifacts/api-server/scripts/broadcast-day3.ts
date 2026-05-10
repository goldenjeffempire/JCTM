/**
 * broadcast-day3.ts
 *
 * One-shot broadcast for: Ministers Conference Day 3 & Holy Spirit Sunday Service — Starting Soon
 * Run: npx tsx scripts/broadcast-day3.ts
 */

import { pool } from "@workspace/db";
import {
  dispatchPushNotification,
  type NotificationPayload,
} from "../src/lib/push-manager.js";
import {
  sendConferenceAnnouncementEmail,
  isEmailConfigured,
} from "../src/lib/email-engine.js";

// ── Conference details ─────────────────────────────────────────────────────────

const MINISTRY_WEBSITE = "https://jctm.org.ng";
const CONFERENCE_TITLE = "Ministers Conference 2026 — Day 3 & Holy Spirit Sunday Service";
const TAGLINE         = "The best is saved for last — come receive your Holy Spirit impartation!";
const DATE_STR        = "Sunday, 10 May 2026";
const TIME_STR        = "8:00 AM WAT";
const LOCATION        = "JCTM Auditorium, Ebrumede Roundabout, Effurun";

// Compute countdown from current WAT time to 8:00 AM
function getCountdownLabel(): string {
  const now = new Date();
  // 8:00 AM WAT = 7:00 AM UTC
  const serviceStart = new Date(now);
  serviceStart.setUTCHours(7, 0, 0, 0);
  // If we've already passed 8 AM WAT, show "Starting Now"
  if (now >= serviceStart) return "Starting Now";
  const diffMs   = serviceStart.getTime() - now.getTime();
  const diffMins = Math.ceil(diffMs / 60000);
  if (diffMins < 60) return `Starting in ${diffMins} minute${diffMins !== 1 ? "s" : ""}`;
  const hrs  = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins > 0
    ? `Starting in ${hrs} hour${hrs !== 1 ? "s" : ""} ${mins} min`
    : `Starting in ${hrs} hour${hrs !== 1 ? "s" : ""}`;
}

const COUNTDOWN_LABEL = getCountdownLabel();
const COUNTDOWN_SUB   = `TODAY · ${DATE_STR} · ${TIME_STR}`;

// ── Push notification ──────────────────────────────────────────────────────────

async function sendPush(): Promise<void> {
  const payload: NotificationPayload = {
    title: `🔴 STARTING SOON — ${CONFERENCE_TITLE}`,
    body:  `${COUNTDOWN_LABEL} · ${LOCATION}. Join us live now!`,
    icon:  "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    url:   "/sermons",
    tag:   "ministers-conference-2026-live",
    requireInteraction: true,
    actions: [{ action: "watch", title: "Watch Live" }],
    data: {
      type:             "conference_starting_soon",
      conferenceTitle:  CONFERENCE_TITLE,
      countdownLabel:   COUNTDOWN_LABEL,
      timestamp:        new Date().toISOString(),
    },
  };

  console.log("\n📲 Sending push notifications…");
  const logger = { info: console.log, warn: console.warn, error: console.error } as never;
  const result = await dispatchPushNotification(payload, logger, "conference_starting_soon");
  console.log(`   ✅ Push: sent=${result.sent}  failed=${result.failed}  deactivated=${result.deactivated}`);
}

// ── Email broadcast ────────────────────────────────────────────────────────────

async function sendEmails(): Promise<void> {
  if (!isEmailConfigured()) {
    console.log("\n⚠️  SMTP not configured — email broadcast skipped");
    return;
  }

  console.log("\n📧 Collecting email recipients…");

  const emailMap = new Map<string, string | null>();

  const [devotionRes, registrantRes, memberRes] = await Promise.all([
    pool.query<{ email: string }>(
      `SELECT lower(trim(email)) AS email FROM devotion_subscribers WHERE is_active = true AND email IS NOT NULL AND email != '' LIMIT 10000`,
    ),
    pool.query<{ email: string; full_name: string }>(
      `SELECT lower(trim(email)) AS email, full_name FROM conference_registrations WHERE email IS NOT NULL AND email != '' LIMIT 10000`,
    ),
    pool.query<{ email: string; first_name: string }>(
      `SELECT lower(trim(email)) AS email, first_name FROM member_auth WHERE email IS NOT NULL AND email != '' LIMIT 10000`,
    ),
  ]);

  for (const row of devotionRes.rows)   emailMap.set(row.email, null);
  for (const row of registrantRes.rows) if (row.email) emailMap.set(row.email, row.full_name || null);
  for (const row of memberRes.rows) {
    if (row.email && (!emailMap.has(row.email) || !emailMap.get(row.email))) {
      emailMap.set(row.email, row.first_name || null);
    }
  }

  const recipients = Array.from(emailMap.entries());
  console.log(`   📬 Unique recipients: ${recipients.length}`);

  if (recipients.length === 0) {
    console.log("   ℹ️  No recipients found — email broadcast skipped");
    return;
  }

  const BATCH    = 20;
  const PACE_MS  = 200;
  let sent = 0, failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map(([email, name]) =>
        sendConferenceAnnouncementEmail(
          email,
          {
            recipientName:  name ?? undefined,
            conferenceTitle: CONFERENCE_TITLE,
            tagline:         TAGLINE,
            dateStr:         DATE_STR,
            timeStr:         TIME_STR,
            location:        LOCATION,
            registrationUrl: `${MINISTRY_WEBSITE}/conference-registration`,
            ministryWebsite: MINISTRY_WEBSITE,
            startingSoon:    true,
            countdownLabel:  COUNTDOWN_LABEL,
            countdownSub:    COUNTDOWN_SUB,
          },
          undefined,
        ),
      ),
    );

    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) sent++;
      else failed++;
    }

    const pct = Math.round(((i + batch.length) / recipients.length) * 100);
    process.stdout.write(`\r   Progress: ${i + batch.length}/${recipients.length} (${pct}%)  `);

    if (i + BATCH < recipients.length) {
      await new Promise(r => setTimeout(r, PACE_MS));
    }
  }

  console.log(`\n   ✅ Email: sent=${sent}  failed=${failed}  total=${recipients.length}`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  JCTM Broadcast — Ministers Conference Day 3 Starting Soon   ");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Title    : ${CONFERENCE_TITLE}`);
  console.log(`  Countdown: ${COUNTDOWN_LABEL}`);
  console.log(`  Sub      : ${COUNTDOWN_SUB}`);
  console.log(`  Date     : ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════════════");

  try {
    await sendPush();
    await sendEmails();
    console.log("\n🎉 Broadcast complete!\n");
  } catch (err) {
    console.error("\n❌ Broadcast error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

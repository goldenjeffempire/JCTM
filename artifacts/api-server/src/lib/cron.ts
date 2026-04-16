import { syncIncremental, harvestAll, QuotaExceededError, subscribeToWebSub, enrichVideoIds } from "./youtube-sync.js";
import { syncFromRSS, RSS_INTERVAL_MS } from "./rss-sync.js";
import { sseBroadcaster } from "./sse-broadcaster.js";
import { enrichNextSermonBatch } from "./broadcast-engine.js";
import { dispatchPushNotification, buildServiceReminderNotification, buildDailyDevotionNotification } from "./push-manager.js";
import { ensureDevotionForDate } from "./devotion-engine.js";
import { db, sermonsTable, devotionsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import type { Logger } from "pino";

const API_INTERVAL_MS       = 30 * 60 * 1000;       // 30 minutes
const WEBSUB_RENEWAL_MS     = 23 * 60 * 60 * 1000;  // 23 hours (before 24h lease expires)
const METADATA_INTERVAL_MS  = 10 * 60 * 1000;       // 10 minutes
const DAILY_MS              = 24 * 60 * 60 * 1000;  // 24 hours

let apiCronHandle:       ReturnType<typeof setInterval> | null = null;
let rssCronHandle:       ReturnType<typeof setInterval> | null = null;
let websubCronHandle:    ReturnType<typeof setInterval> | null = null;
let metadataCronHandle:  ReturnType<typeof setInterval> | null = null;
let reminderCronHandle:  ReturnType<typeof setInterval> | null = null;

let quotaPausedUntil: number | null = null;
let openaiQuotaPausedUntil: number | null = null;
const OPENAI_QUOTA_BACKOFF_MS = 60 * 60 * 1000; // 1 hour cooldown after 429
let lastWebSubRenewal: Date | null = null;
let webSubCallbackUrl: string | null = null;
let lastRSSSync: Date | null = null;
let lastAPISync: Date | null = null;
let serviceReminderSentAt: number | null = null;
let devotionNotificationSentDate: string | null = null; // ISO date string (YYYY-MM-DD)

// ─── State exports (for health endpoint) ──────────────────────────────────────

export function getCronState() {
  return {
    quotaPausedUntil: quotaPausedUntil ? new Date(quotaPausedUntil).toISOString() : null,
    lastWebSubRenewal: lastWebSubRenewal?.toISOString() ?? null,
    webSubNextRenewal: lastWebSubRenewal
      ? new Date(lastWebSubRenewal.getTime() + WEBSUB_RENEWAL_MS).toISOString()
      : null,
    lastRSSSync: lastRSSSync?.toISOString() ?? null,
    lastAPISync: lastAPISync?.toISOString() ?? null,
    running: {
      rss:      rssCronHandle !== null,
      api:      apiCronHandle !== null,
      websub:   websubCronHandle !== null,
      metadata: metadataCronHandle !== null,
      reminder: reminderCronHandle !== null,
    },
  };
}

export function setWebSubCallbackUrl(url: string): void {
  webSubCallbackUrl = url;
  if (!lastWebSubRenewal) lastWebSubRenewal = new Date();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msUntilUtcMidnight(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return midnight.getTime() - now.getTime();
}

function todayUTC(): string {
  return new Date().toISOString().split("T")[0]!;
}

function tomorrowUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0]!;
}

// ─── Midnight devotion pre-generation ─────────────────────────────────────────
// Fires at the next UTC midnight, then every 24 hours.
// Pre-generates tomorrow's devotion so the first morning visitor gets an
// instant response with no AI generation delay.

async function preGenerateTomorrowsDevotion(log: Logger): Promise<void> {
  const tomorrow = tomorrowUTC();
  try {
    log.info({ date: tomorrow }, "Midnight pre-generation: ensuring tomorrow's devotion exists");
    const { cached } = await ensureDevotionForDate(tomorrow, log);
    if (cached) {
      log.info({ date: tomorrow }, "Tomorrow's devotion already cached — skipping generation");
    } else {
      log.info({ date: tomorrow }, "Tomorrow's devotion pre-generated successfully");
    }
  } catch (err) {
    log.warn({ err, date: tomorrow }, "Midnight devotion pre-generation failed (non-fatal)");
  }
}

// ─── WAT Sunday Service Reminder ──────────────────────────────────────────────
// Sends a push notification 30 minutes before Sunday 8:00 AM WAT service

function checkAndSendServiceReminder(log: Logger): void {
  const now = new Date();
  const watMs = now.getTime() + (60 * 60 * 1000); // WAT = UTC+1
  const wat = new Date(watMs);

  const dayOfWeek = wat.getUTCDay();   // 0 = Sunday
  const hour      = wat.getUTCHours();
  const minute    = wat.getUTCMinutes();

  // Target: Sunday 7:30 AM WAT (30 min before 8:00 AM service)
  if (dayOfWeek !== 0 || hour !== 7 || minute < 28 || minute > 32) return;

  // Avoid duplicate sends — check if we already sent in the last 10 minutes
  const tenMinMs = 10 * 60 * 1000;
  if (serviceReminderSentAt && Date.now() - serviceReminderSentAt < tenMinMs) return;

  serviceReminderSentAt = Date.now();
  log.info("Sending Sunday service 30-minute reminder push notification");
  dispatchPushNotification(buildServiceReminderNotification(30), log).catch(err => {
    log.warn({ err }, "Service reminder push failed (non-fatal)");
  });
}

// ─── Daily Devotion Push Notification ────────────────────────────────────────
// Sends the daily devotion push at 6:00 AM WAT (= 5:00 AM UTC) every day.
// The devotion should already be pre-generated by the midnight cron.

function checkAndSendDevotionNotification(log: Logger): void {
  const now = new Date();
  const watMs = now.getTime() + (60 * 60 * 1000); // WAT = UTC+1
  const wat = new Date(watMs);

  const hour   = wat.getUTCHours();
  const minute = wat.getUTCMinutes();
  const today  = todayUTC();

  // Target: 6:00–6:04 AM WAT — only send once per day
  if (hour !== 6 || minute > 4) return;
  if (devotionNotificationSentDate === today) return;

  devotionNotificationSentDate = today;

  // Fetch today's devotion from DB (pre-generated at midnight) then push
  db.select({ title: devotionsTable.title, reference: devotionsTable.reference })
    .from(devotionsTable)
    .where(eq(devotionsTable.date, today))
    .limit(1)
    .then(async (rows) => {
      const row = rows[0];
      if (!row) {
        // No pre-generated devotion — generate on-the-fly then notify
        log.info({ date: today }, "6 AM WAT: devotion not pre-generated yet — generating now");
        try {
          const { devotion } = await ensureDevotionForDate(today, log);
          await dispatchPushNotification(
            buildDailyDevotionNotification(devotion.title, devotion.reference),
            log,
          );
        } catch (err) {
          log.warn({ err }, "Devotion on-demand generation for push notification failed (non-fatal)");
        }
        return;
      }
      log.info({ date: today, title: row.title }, "Sending daily devotion push notification");
      dispatchPushNotification(buildDailyDevotionNotification(row.title, row.reference), log).catch(err => {
        log.warn({ err }, "Daily devotion push failed (non-fatal)");
      });
    })
    .catch(err => {
      log.warn({ err }, "Failed to query today's devotion for push notification (non-fatal)");
    });
}

// ─── API sync ─────────────────────────────────────────────────────────────────

async function runApiSync(apiKey: string, log: Logger): Promise<void> {
  if (quotaPausedUntil !== null && Date.now() < quotaPausedUntil) {
    const resumesIn = Math.round((quotaPausedUntil - Date.now()) / 60000);
    log.info({ resumesInMinutes: resumesIn }, "YouTube API sync skipped — quota paused until UTC midnight");
    return;
  }

  quotaPausedUntil = null;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(sermonsTable);

    const result = count === 0
      ? await harvestAll(apiKey, log)
      : await syncIncremental(apiKey, log);

    lastAPISync = new Date();
    log.info(result, "YouTube API sync complete");

    sseBroadcaster.broadcast({
      type: "sync_complete",
      data: { synced: result.synced, featured: result.featured },
    });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      const pauseMs = msUntilUtcMidnight();
      quotaPausedUntil = Date.now() + pauseMs;
      log.warn(
        { resumesInHours: Math.round(pauseMs / 3600000) },
        "YouTube API quota exceeded — sync paused until UTC midnight"
      );
    } else {
      log.error({ err }, "YouTube API sync failed");
    }
  }
}

// ─── RSS sync ─────────────────────────────────────────────────────────────────

async function runRSSSync(log: Logger, apiKey?: string): Promise<void> {
  try {
    const result = await syncFromRSS(log);
    lastRSSSync = new Date();

    if (result.inserted > 0) {
      sseBroadcaster.broadcast({
        type: "sync_complete",
        data: { synced: result.inserted, source: "rss" },
      });

      if (apiKey && result.insertedVideoIds.length > 0 &&
          (quotaPausedUntil === null || Date.now() >= quotaPausedUntil)) {
        log.info(
          { videoIds: result.insertedVideoIds },
          "RSS found new videos — enriching immediately via YouTube API",
        );
        setTimeout(async () => {
          try {
            const enriched = await enrichVideoIds(apiKey, result.insertedVideoIds, log);
            if (enriched > 0) {
              sseBroadcaster.broadcast({
                type: "sync_complete",
                data: { synced: enriched, source: "rss_enrichment" },
              });
              log.info({ enriched }, "Immediate RSS enrichment broadcast sent");
            }
          } catch (err) {
            if (err instanceof QuotaExceededError) {
              const pauseMs = msUntilUtcMidnight();
              quotaPausedUntil = Date.now() + pauseMs;
              log.warn(
                { resumesInHours: Math.round(pauseMs / 3600000) },
                "YouTube API quota exceeded during RSS enrichment — pausing until UTC midnight",
              );
            } else {
              log.warn({ err }, "Immediate RSS enrichment failed (non-fatal) — will retry at next API sync");
            }
          }
        }, 4_000);
      }
    }
  } catch (err) {
    log.warn({ err }, "RSS sync failed (non-fatal)");
  }
}

// ─── WebSub auto-renewal ──────────────────────────────────────────────────────

async function renewWebSub(log: Logger): Promise<void> {
  if (!webSubCallbackUrl) {
    log.warn("WebSub callback URL not configured — skipping renewal");
    return;
  }
  try {
    log.info({ callbackUrl: webSubCallbackUrl }, "Auto-renewing WebSub subscription (23h cycle)");
    await subscribeToWebSub(webSubCallbackUrl, log);
    lastWebSubRenewal = new Date();
    log.info("WebSub subscription renewed successfully");
  } catch (err) {
    log.error({ err }, "WebSub auto-renewal failed — will retry next 23h cycle");
  }
}

// ─── AI Metadata enrichment ───────────────────────────────────────────────────

async function runMetadataEnrichment(log: Logger): Promise<void> {
  if (openaiQuotaPausedUntil !== null && Date.now() < openaiQuotaPausedUntil) {
    const resumesInMinutes = Math.ceil((openaiQuotaPausedUntil - Date.now()) / 60_000);
    log.info({ resumesInMinutes }, "AI metadata enrichment paused — OpenAI quota exceeded, skipping batch");
    return;
  }

  try {
    const enriched = await enrichNextSermonBatch(5, log);
    if (enriched > 0) {
      log.info({ count: enriched }, "AI metadata enrichment batch complete");
    }
    openaiQuotaPausedUntil = null;
  } catch (err) {
    const errMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    const isQuota = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("insufficient_quota") || errMsg.includes("rate");
    if (isQuota) {
      openaiQuotaPausedUntil = Date.now() + OPENAI_QUOTA_BACKOFF_MS;
      const resumesAt = new Date(openaiQuotaPausedUntil).toISOString();
      log.warn({ resumesAt }, "OpenAI quota exceeded — AI metadata enrichment paused for 1 hour");
    } else {
      log.warn({ err }, "Metadata enrichment batch failed (non-fatal)");
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startCron(log: Logger, websubUrl?: string): void {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (websubUrl) {
    webSubCallbackUrl = websubUrl;
    lastWebSubRenewal = new Date();
  }

  // ── RSS sync — always active, runs every 5 minutes ──────────────────────
  log.info({ intervalMs: RSS_INTERVAL_MS }, "Starting YouTube RSS sync (5-min, quota-free)");
  runRSSSync(log, apiKey);
  rssCronHandle = setInterval(() => runRSSSync(log, apiKey), RSS_INTERVAL_MS);
  rssCronHandle.unref();

  // ── API sync — requires YOUTUBE_API_KEY ──────────────────────────────────
  if (!apiKey) {
    log.info("YOUTUBE_API_KEY not set — YouTube Data API sync disabled (RSS still active)");
  } else {
    log.info({ intervalMs: API_INTERVAL_MS }, "Starting YouTube API sync cron (30-min)");
    setTimeout(() => {
      runApiSync(apiKey, log);
      apiCronHandle = setInterval(() => runApiSync(apiKey, log), API_INTERVAL_MS);
      if (apiCronHandle) apiCronHandle.unref();
    }, 10_000);
  }

  // ── WebSub auto-renewal — every 23 hours ────────────────────────────────
  log.info("Starting WebSub auto-renewal cron (23h cycle)");
  websubCronHandle = setInterval(() => renewWebSub(log), WEBSUB_RENEWAL_MS);
  websubCronHandle.unref();

  // ── AI Metadata enrichment — every 10 minutes (batch of 5) ──────────────
  log.info("Starting AI metadata enrichment cron (10-min, 5 sermons/batch)");
  setTimeout(() => {
    runMetadataEnrichment(log);
    metadataCronHandle = setInterval(() => runMetadataEnrichment(log), METADATA_INTERVAL_MS);
    if (metadataCronHandle) metadataCronHandle.unref();
  }, 45_000);

  // ── Per-minute checks: service reminder + daily devotion push ────────────
  reminderCronHandle = setInterval(() => {
    checkAndSendServiceReminder(log);
    checkAndSendDevotionNotification(log);
  }, 60_000);
  reminderCronHandle.unref();

  // ── Midnight devotion pre-generation ─────────────────────────────────────
  // Fires once at the next UTC midnight, then repeats every 24 hours
  const msToMidnight = msUntilUtcMidnight();
  log.info(
    { firesInMinutes: Math.round(msToMidnight / 60_000) },
    "Midnight devotion pre-generation scheduled",
  );
  const midnightTimer = setTimeout(() => {
    preGenerateTomorrowsDevotion(log);
    const dailyHandle = setInterval(() => preGenerateTomorrowsDevotion(log), DAILY_MS);
    dailyHandle.unref();
  }, msToMidnight);
  // Allow process to exit even if this timer is pending
  if (typeof midnightTimer === "object" && midnightTimer !== null && "unref" in midnightTimer) {
    (midnightTimer as ReturnType<typeof setTimeout> & { unref(): void }).unref();
  }

  log.info("Automation engine started: RSS | API | WebSub | AI metadata | Service reminders | Daily devotion push | Midnight pre-generation");
}

export function stopCron(): void {
  [apiCronHandle, rssCronHandle, websubCronHandle, metadataCronHandle, reminderCronHandle]
    .forEach(h => h && clearInterval(h));
  apiCronHandle = null;
  rssCronHandle = null;
  websubCronHandle = null;
  metadataCronHandle = null;
  reminderCronHandle = null;
}

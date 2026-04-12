import { syncIncremental, harvestAll, QuotaExceededError } from "./youtube-sync.js";
import { syncFromRSS, RSS_INTERVAL_MS } from "./rss-sync.js";
import { sseBroadcaster } from "./sse-broadcaster.js";
import { db, sermonsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { Logger } from "pino";

const API_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes (YouTube Data API v3)

let apiCronHandle:  ReturnType<typeof setInterval> | null = null;
let rssCronHandle:  ReturnType<typeof setInterval> | null = null;
let quotaPausedUntil: number | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msUntilUtcMidnight(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return midnight.getTime() - now.getTime();
}

// ─── API sync (quota-consuming) ───────────────────────────────────────────────

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

    log.info(result, "YouTube API sync complete");

    sseBroadcaster.broadcast({
      type: "sync_complete",
      data: { synced: result.synced, featured: result.featured },
    });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      const pauseMs = msUntilUtcMidnight();
      quotaPausedUntil = Date.now() + pauseMs;
      const resumesInHours = Math.round(pauseMs / 3600000);
      log.warn(
        { resumesInHours },
        "YouTube API quota exceeded — sync paused until UTC midnight"
      );
    } else {
      log.error({ err }, "YouTube API sync failed");
    }
  }
}

// ─── RSS sync (quota-free) ────────────────────────────────────────────────────

async function runRSSSync(log: Logger): Promise<void> {
  try {
    const result = await syncFromRSS(log);

    if (result.inserted > 0) {
      // New videos discovered — notify connected clients so their feeds refresh
      sseBroadcaster.broadcast({
        type: "sync_complete",
        data: { synced: result.inserted, source: "rss" },
      });
    }
  } catch (err) {
    // RSS failures are non-fatal — log and continue
    log.warn({ err }, "RSS sync failed (non-fatal)");
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startCron(log: Logger): void {
  const apiKey = process.env.YOUTUBE_API_KEY;

  // ── RSS sync — always active, runs every 5 minutes ──────────────────────
  log.info({ intervalMs: RSS_INTERVAL_MS }, "Starting YouTube RSS sync (5-minute interval, quota-free)");

  // Run immediately on startup so the DB is fresh right away
  runRSSSync(log);

  rssCronHandle = setInterval(() => runRSSSync(log), RSS_INTERVAL_MS);
  rssCronHandle.unref();

  // ── API sync — only when YOUTUBE_API_KEY is configured ──────────────────
  if (!apiKey) {
    log.info("YOUTUBE_API_KEY not set — YouTube Data API sync disabled (RSS sync still active)");
    return;
  }

  log.info({ intervalMs: API_INTERVAL_MS }, "Starting YouTube API sync cron (30-minute interval)");

  // Stagger the first API run by 10 s so the RSS run finishes first
  setTimeout(() => {
    runApiSync(apiKey, log);
    apiCronHandle = setInterval(() => runApiSync(apiKey, log), API_INTERVAL_MS);
    if (apiCronHandle) apiCronHandle.unref();
  }, 10_000);
}

export function stopCron(): void {
  if (apiCronHandle) {
    clearInterval(apiCronHandle);
    apiCronHandle = null;
  }
  if (rssCronHandle) {
    clearInterval(rssCronHandle);
    rssCronHandle = null;
  }
}

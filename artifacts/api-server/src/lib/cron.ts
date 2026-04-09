import { syncIncremental, harvestAll, QuotaExceededError } from "./youtube-sync.js";
import { sseBroadcaster } from "./sse-broadcaster.js";
import { db, sermonsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { Logger } from "pino";

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

let cronHandle: ReturnType<typeof setInterval> | null = null;
let quotaPausedUntil: number | null = null;

function msUntilUtcMidnight(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return midnight.getTime() - now.getTime();
}

async function runSync(apiKey: string, log: Logger): Promise<void> {
  if (quotaPausedUntil !== null && Date.now() < quotaPausedUntil) {
    const resumesIn = Math.round((quotaPausedUntil - Date.now()) / 60000);
    log.info({ resumesInMinutes: resumesIn }, "YouTube sync skipped — quota paused until UTC midnight");
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

    log.info(result, "YouTube sync complete");

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
      log.error({ err }, "YouTube sync failed");
    }
  }
}

export function startCron(log: Logger): void {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    log.info("YOUTUBE_API_KEY not set — YouTube cron sync disabled");
    return;
  }

  log.info({ intervalMs: INTERVAL_MS }, "Starting YouTube sync cron (30-minute interval)");

  runSync(apiKey, log);

  cronHandle = setInterval(() => runSync(apiKey, log), INTERVAL_MS);
}

export function stopCron(): void {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
  }
}

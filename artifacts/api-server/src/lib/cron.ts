import { syncIncremental, harvestAll } from "./youtube-sync.js";
import { sseBroadcaster } from "./sse-broadcaster.js";
import { db, sermonsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { Logger } from "pino";

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

let cronHandle: ReturnType<typeof setInterval> | null = null;

async function runSync(apiKey: string, log: Logger): Promise<void> {
  try {
    // Check if the DB is empty — if so, do a full harvest on first boot
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
    log.error({ err }, "YouTube sync failed");
  }
}

export function startCron(log: Logger): void {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    log.info("YOUTUBE_API_KEY not set — YouTube cron sync disabled");
    return;
  }

  log.info({ intervalMs: INTERVAL_MS }, "Starting YouTube sync cron (30-minute interval)");

  // Run immediately on startup so sermons are always populated
  runSync(apiKey, log);

  cronHandle = setInterval(() => runSync(apiKey, log), INTERVAL_MS);
}

export function stopCron(): void {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
  }
}

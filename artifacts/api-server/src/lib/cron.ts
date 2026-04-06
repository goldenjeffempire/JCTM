import { syncIncremental } from "./youtube-sync.js";
import { sseBroadcaster } from "./sse-broadcaster.js";
import type { Logger } from "pino";

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

let cronHandle: ReturnType<typeof setInterval> | null = null;

export function startCron(log: Logger): void {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    log.info("YOUTUBE_API_KEY not set — YouTube cron sync disabled");
    return;
  }

  log.info({ intervalMs: INTERVAL_MS }, "Starting YouTube sync cron (30-minute interval)");

  cronHandle = setInterval(async () => {
    try {
      log.info("Cron: running incremental YouTube sync");
      const result = await syncIncremental(apiKey, log);
      log.info(result, "Cron: sync complete");

      sseBroadcaster.broadcast({
        type: "sync_complete",
        data: { synced: result.synced, featured: result.featured },
      });
    } catch (err) {
      log.error({ err }, "Cron: YouTube sync failed");
    }
  }, INTERVAL_MS);
}

export function stopCron(): void {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
  }
}

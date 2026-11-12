import { pool } from "@workspace/db";
import type { Logger } from "pino";
import { devotionDate, ensureDevotionForDate } from "./devotion-engine.js";
import { seedDevotionLibrary } from "./devotion-library.js";
import { expandDevotionLibrary } from "./devotion-expansion.js";
import { withDbRetry } from "./db-retry.js";
import { populateNinetyDaySeries } from "./devotion-series/populate.js";

let running: Promise<void> | undefined;
export function maintainDevotionLibrary(log?: Logger): Promise<void> {
  if (running) return running;
  running = (async () => {
    await withDbRetry(() => seedDevotionLibrary());
    // Installs the authored series once, before any paid expansion. A content
    // conflict is surfaced rather than partially installing or replacing history.
    await withDbRetry(() => populateNinetyDaySeries());
    // Reserve the next seven calendar days before doing any network generation.
    // Rejected legacy schedules are preserved in the review queue by the engine.
    for (let day = 1; day <= 7; day++) {
      const date = new Date(`${devotionDate()}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + day);
      const dateStr = date.toISOString().slice(0, 10);
      const hidden = await pool.query("SELECT 1 FROM daily_devotions WHERE date=$1 AND is_hidden=true", [dateStr]);
      if (!hidden.rowCount) await withDbRetry(() => ensureDevotionForDate(dateStr, log));
    }
    const count = await pool.query<{ count: number }>("SELECT count(*)::int AS count FROM devotion_library WHERE status='ready'");
    if ((count.rows[0]?.count ?? 0) < 90) {
      const result = await expandDevotionLibrary(log, 12);
      if (result.added === 0) log?.warn({ reason: "reason" in result ? result.reason : "All drafts were rejected" }, "Devotion library needs editorial attention");
    }
  })().finally(() => { running = undefined; });
  return running;
}

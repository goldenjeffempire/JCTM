/**
 * Standalone migration runner.
 *
 * Used as the Render `preDeployCommand` so the schema is always in sync
 * with the code before new server instances start serving traffic.
 *
 * Exits 0 on success, 1 on failure (blocks the deploy on hard DB errors).
 */
import { pool } from "@workspace/db";
import { logger } from "./lib/logger.js";
import { runMigrations } from "./lib/migrations.js";

async function main() {
  if (!process.env["DATABASE_URL"]) {
    logger.error("DATABASE_URL is not set — cannot run migrations");
    process.exit(1);
  }

  logger.info("Running pre-deploy migrations…");

  try {
    await runMigrations();
    logger.info("Pre-deploy migrations succeeded");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Pre-deploy migrations FAILED — aborting deploy");
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

main();

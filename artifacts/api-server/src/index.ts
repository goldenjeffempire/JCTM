// Suppress the pg-connection-string SSL deprecation warning — our db client
// already normalises 'prefer/require/verify-ca' to 'verify-full' before
// connecting, so the behaviour is already correct.
process.on("warning", (w) => {
  if (w.name === "Warning" && w.message.includes("SSL modes")) return;
  // Re-emit all other warnings normally.
  process.stderr.write(`${w.stack ?? w.message}\n`);
});

import app from "./app";
import { logger } from "./lib/logger";
import { startCron, setWebSubCallbackUrl, stopCron } from "./lib/cron.js";
import { checkUptimeOnStartup, startHeartbeat, stopHeartbeat } from "./lib/uptime-monitor.js";
import { altarSimInterval } from "./routes/altar.js";
import { subscribeToWebSub } from "./lib/youtube-sync.js";
import { ingestKnowledgeIfEmpty } from "./lib/knowledge-ingestion.js";
import { startAISyncScheduler, stopAISyncScheduler } from "./lib/ai-sync-scheduler.js";
import { startPreprocessScheduler, stopPreprocessScheduler } from "./lib/media-preprocess.js";
import { recoverOrphanedJobs, cleanupOrphanedTempFiles } from "./lib/media-processor.js";
import { initSentry } from "./lib/sentry.js";
import { initVapidKeys, cleanupStalePushSubscriptions } from "./lib/push-manager.js";
import { isRoleConfigured, type AdminRole } from "./lib/adminAuth.js";
import { seedMinistryBlogLibrary } from "./lib/ministry-blog-seed.js";
import { seedBibleDatabase } from "./lib/bible-seed.js";
import { runMigrations } from "./lib/migrations.js";
import { startNeonQuotaMonitor } from "./lib/neon-quota-monitor.js";
import { bootstrapSubscribers } from "./lib/subscriber-manager.js";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── Startup env-var validation ─────────────────────────────────────────────
// Logs a warning for each missing variable so the first log flush tells the
// operator exactly what is unconfigured.  Never throws — the server starts
// regardless; individual features will degrade gracefully.
function validateEnv(): void {
  const required: Array<{ key: string; feature: string }> = [
    { key: "DATABASE_URL",        feature: "PostgreSQL database" },
    { key: "OPENAI_API_KEY",      feature: "TempleBots AI assistant" },
    { key: "YOUTUBE_API_KEY",     feature: "YouTube sermon sync" },
  ];
  const optional: Array<{ key: string; feature: string }> = [
    { key: "PAYSTACK_SECRET_KEY",  feature: "Paystack donations" },
    { key: "STRIPE_SECRET_KEY",    feature: "Stripe donations" },
    { key: "VAPID_PUBLIC_KEY",     feature: "Web push notifications (will auto-generate)" },
    { key: "VAPID_PRIVATE_KEY",    feature: "Web push notifications (will auto-generate)" },
    { key: "SMTP_HOST",            feature: "Email delivery" },
  ];

  const missing = required.filter((v) => !process.env[v.key]);
  const missingOptional = optional.filter((v) => !process.env[v.key]);

  if (missing.length > 0) {
    logger.error(
      { missing: missing.map((v) => v.key) },
      `Critical env vars missing — ${missing.map((v) => `${v.key} (${v.feature})`).join(", ")}`
    );
  }
  if (missingOptional.length > 0) {
    logger.warn(
      { missing: missingOptional.map((v) => v.key) },
      `Optional env vars not set — ${missingOptional.map((v) => `${v.key} (${v.feature})`).join(", ")}`
    );
  }
  if (missing.length === 0 && missingOptional.length === 0) {
    logger.info("All env vars configured");
  }
}

validateEnv();

// ── Listen immediately so we claim the port before any other process ──────────
// All heavy initialization (migrations, seeding, crons) runs in the callback
// after the port is claimed. This prevents race conditions in dev where the
// Vite dev server can reclaim port 5000 during the migration window.

const server = app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  // Keep connections alive longer than the 60 s timeout used by most
  // load balancers / reverse proxies (Render, Replit, Cloudflare).
  server.keepAliveTimeout = 65_000;
  server.headersTimeout   = 66_000;

  logger.info({ port }, "Server listening");

  // ── Sentry error tracking ─────────────────────────────────────────────────
  await initSentry();

  // ── Database migrations (idempotent — safe to re-run on every deploy) ─────
  // Migrations run first, synchronously, so every subsequent task operates on
  // a fully-migrated schema.
  try {
    await runMigrations();
  } catch (err) {
    logger.error({ err }, "Startup migration failed — continuing anyway");
  }

  // ── Start Neon DB quota health watcher immediately after migrations ────────
  // This installs the pool.on('error') listener as early as possible so any
  // pool-level connectivity errors (ECONNABORTED etc.) are handled and logged
  // rather than propagating as uncaught exceptions.
  startNeonQuotaMonitor(logger);

  // ── Non-DB startup tasks (no database access) ─────────────────────────────
  cleanupOrphanedTempFiles();

  // ── Staggered DB startup tasks ────────────────────────────────────────────
  // Root cause of ECONNABORTED at startup: multiple DB-heavy tasks fire
  // simultaneously right after migrations, overwhelming a cold Neon compute
  // endpoint that may take 1-2 s to wake.  By staggering each task 1 s apart
  // we stay within the pool's connection limit and give the DB time to wake
  // before the next task connects.
  //
  // All tasks are fire-and-forget (.catch()) so the startup sequence never
  // blocks on them and a single failure doesn't abort the rest.

  const stagger = (delayMs: number, label: string, fn: () => Promise<unknown>) => {
    setTimeout(() => {
      fn().catch((err) => logger.warn({ err }, `${label} failed — continuing startup`));
    }, delayMs).unref();
  };

  // t=0: uptime check (fast query — just reads server_heartbeats)
  stagger(0, "Uptime startup check", () => checkUptimeOnStartup());

  // t=1s: orphan job recovery
  stagger(1_000, "Orphaned job recovery", () => recoverOrphanedJobs());

  // t=2s: VAPID key init (reads/writes vapid_keys table)
  stagger(2_000, "VAPID key init", () => initVapidKeys(logger));

  // t=3s: admin passphrase config check
  stagger(3_000, "Admin role check", async () => {
    const adminRoles: AdminRole[] = ["gallery", "sermon", "livestream"];
    const configuredFlags = await Promise.all(adminRoles.map((r) => isRoleConfigured(r)));
    const configured   = adminRoles.filter((_, i) => configuredFlags[i]);
    const unconfigured = adminRoles.filter((_, i) => !configuredFlags[i]);
    if (unconfigured.length > 0) {
      logger.warn(
        { unconfiguredRoles: unconfigured, configuredRoles: configured },
        "Some admin roles have no passphrase configured — " +
        "use the Setup Admin Access form on the site to create credentials, " +
        "or set ADMIN_PASSPHRASE_* env vars in the Render dashboard.",
      );
    } else {
      logger.info({ configured }, "All admin roles configured");
    }
  });

  // t=4s: ministry blog seeding (idempotent — skips if rows already exist)
  stagger(4_000, "Blog library seeding", () => seedMinistryBlogLibrary());

  // t=5s: subscriber bootstrap
  stagger(5_000, "Subscriber bootstrap", () => bootstrapSubscribers(logger));

  // t=7s: stale push subscription cleanup (one-shot, non-critical)
  stagger(7_000, "Stale push subscription cleanup",
    () => cleanupStalePushSubscriptions(60, logger));

  // t=10s: Bible database seeding (potentially large — run last in the wave)
  stagger(10_000, "Bible database seeding", () => seedBibleDatabase());

  // ── Recurring background tasks (all unref'd — don't prevent clean shutdown) ─

  // Start uptime heartbeat writer (every 60 s)
  startHeartbeat(logger);

  // Start the 30-minute YouTube sync cron
  startCron(logger);

  // Resolve public base URL for WebSub callback
  const replitDomain = process.env.REPLIT_DEV_DOMAIN;
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  const publicUrl = process.env.PUBLIC_URL;

  let callbackBase: string;
  if (replitDomain) {
    callbackBase = `https://${replitDomain}`;
  } else if (renderUrl) {
    callbackBase = renderUrl.replace(/\/$/, "");
  } else if (publicUrl) {
    callbackBase = publicUrl.replace(/\/$/, "");
  } else {
    callbackBase = "https://jctm.org.ng";
  }

  const websubCallback = `${callbackBase}/api/sermons/websub`;
  setWebSubCallbackUrl(websubCallback);
  subscribeToWebSub(websubCallback, logger);

  // ── Populate JCTM knowledge base with local embeddings (non-blocking) ─────
  ingestKnowledgeIfEmpty(undefined, logger).catch((err) => {
    logger.warn({ err }, "Knowledge ingestion failed at startup — TempleBots will use inline knowledge base");
  });

  // ── Start continuous AI intelligence sync (every 4h full, every 45m activity) ──
  startAISyncScheduler(logger);

  // ── Pre-process featured sermons to MP3 (30s delay, then every 6h) ────────
  startPreprocessScheduler();
});

// ── Graceful shutdown ─────────────────────────────────────────────────────
let isShuttingDown = false;

function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, "Graceful shutdown initiated");
  stopHeartbeat();
  stopCron();
  stopAISyncScheduler();
  stopPreprocessScheduler();
  clearInterval(altarSimInterval);

  server.close(async () => {
    try {
      await pool.end();
      logger.info("All connections closed — exiting cleanly");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Failed to close database pool during shutdown");
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.warn("Shutdown timeout reached — forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => {
  logger.error({ err }, "Unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  shutdown("uncaughtException");
});

import app from "./app";
import { logger } from "./lib/logger";
import { startCron, setWebSubCallbackUrl, stopCron } from "./lib/cron.js";
import { altarSimInterval } from "./routes/altar.js";
import { subscribeToWebSub } from "./lib/youtube-sync.js";
import { ingestKnowledgeIfEmpty } from "./lib/knowledge-ingestion.js";
import { initSentry } from "./lib/sentry.js";
import { initVapidKeys } from "./lib/push-manager.js";
import { isRoleConfigured, type AdminRole } from "./lib/adminAuth.js";
import { seedMinistryBlogLibrary } from "./lib/ministry-blog-seed.js";
import { runMigrations } from "./lib/migrations.js";
import { pool } from "@workspace/db";
import OpenAI from "openai";

async function runStartupMigrations() {
  try {
    await runMigrations();
    return;
  } catch (err) {
    logger.error({ err }, "Startup migration failed — continuing anyway");
  }
}

const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await initSentry();
await runStartupMigrations();
try {
  await seedMinistryBlogLibrary();
} catch (err) {
  logger.warn({ err }, "Blog library seeding failed — continuing startup");
}

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

  // ── Admin passphrase config check ────────────────────────────────────────
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

  // Initialize VAPID keys for push notifications
  initVapidKeys(logger);

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

  // ── Populate JCTM knowledge base into pgvector store (non-blocking) ──────────
  // Uses the direct OPENAI_API_KEY (not the Replit proxy) because the embeddings
  // API is not available through the Replit AI Integrations proxy.
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (openAiApiKey) {
    const embeddingsClient = new OpenAI({
      apiKey: openAiApiKey,
      baseURL: "https://api.openai.com/v1",
    });
    ingestKnowledgeIfEmpty(embeddingsClient, logger).catch((err) => {
      logger.warn({ err }, "Knowledge ingestion failed at startup — TempleBots will fall back to inline knowledge base");
    });
  } else {
    logger.warn("OPENAI_API_KEY not set — skipping knowledge base ingestion. TempleBots will use inline knowledge base only.");
  }
});

// ── Graceful shutdown ─────────────────────────────────────────────────────
let isShuttingDown = false;

function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, "Graceful shutdown initiated");
  stopCron();
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

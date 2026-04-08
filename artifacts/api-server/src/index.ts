import app from "./app";
import { logger } from "./lib/logger";
import { startCron } from "./lib/cron.js";
import { subscribeToWebSub } from "./lib/youtube-sync.js";
import { ingestKnowledgeIfEmpty } from "./lib/knowledge-ingestion.js";
import OpenAI from "openai";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

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

  subscribeToWebSub(`${callbackBase}/api/sermons/websub`, logger);

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
function shutdown(signal: string) {
  logger.info({ signal }, "Graceful shutdown initiated");

  server.close(() => {
    logger.info("All connections closed — exiting cleanly");
    process.exit(0);
  });

  setTimeout(() => {
    logger.warn("Shutdown timeout reached — forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

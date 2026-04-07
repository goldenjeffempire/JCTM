import app from "./app";
import { logger } from "./lib/logger";
import { startCron } from "./lib/cron.js";
import { subscribeToWebSub } from "./lib/youtube-sync.js";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Start the 30-minute YouTube sync cron
  startCron(logger);

  // Register WebSub subscription with YouTube's PubSubHubbub hub.
  // Resolves the public base URL in order of preference:
  //   1. REPLIT_DEV_DOMAIN  — Replit dev environment
  //   2. RENDER_EXTERNAL_URL — automatically set by Render
  //   3. PUBLIC_URL          — any other platform override
  //   4. https://jctm.org.ng — production custom domain (final fallback)
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
});

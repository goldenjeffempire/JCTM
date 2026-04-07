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
  // Supports Replit (REPLIT_DEV_DOMAIN), Render (RENDER_EXTERNAL_URL), and
  // any other platform via PUBLIC_URL.
  const replitDomain = process.env.REPLIT_DEV_DOMAIN;
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  const publicUrl = process.env.PUBLIC_URL;

  let callbackBase: string | undefined;
  if (replitDomain) {
    callbackBase = `https://${replitDomain}`;
  } else if (renderUrl) {
    callbackBase = renderUrl.replace(/\/$/, "");
  } else if (publicUrl) {
    callbackBase = publicUrl.replace(/\/$/, "");
  }

  if (callbackBase) {
    subscribeToWebSub(`${callbackBase}/api/sermons/websub`, logger);
  } else {
    logger.info("No public domain env var set — WebSub subscription skipped");
  }
});

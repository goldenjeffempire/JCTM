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

  // Register WebSub subscription with YouTube's PubSubHubbub hub
  // Only in production or when REPLIT_DEV_DOMAIN is available
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) {
    const callbackUrl = `https://${domain}/api/sermons/websub`;
    subscribeToWebSub(callbackUrl, logger);
  } else {
    logger.info("REPLIT_DEV_DOMAIN not set — WebSub subscription skipped in this environment");
  }
});

/**
 * Error Tracking & Monitoring
 *
 * Uses @sentry/node when SENTRY_DSN is configured.
 * Falls back to pino-based structured logging when Sentry is not set up.
 */

import { logger } from "./logger.js";

let sentryInitialized = false;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info("SENTRY_DSN not set — error tracking using structured logging only");
    return;
  }

  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
      beforeSend(event) {
        if (process.env.NODE_ENV !== "production") return null;
        return event;
      },
    });
    sentryInitialized = true;
    logger.info("Sentry error tracking initialized");
  } catch (err) {
    logger.warn({ err }, "Failed to initialize Sentry — falling back to structured logging");
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (sentryInitialized) {
    import("@sentry/node").then(Sentry => {
      Sentry.withScope(scope => {
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }
        Sentry.captureException(err);
      });
    }).catch(() => {});
  }
  logger.error({ err, ...context }, "Captured exception");
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
  if (sentryInitialized) {
    import("@sentry/node").then(Sentry => {
      Sentry.captureMessage(message, level);
    }).catch(() => {});
  }
  logger[level === "warning" ? "warn" : level](message);
}

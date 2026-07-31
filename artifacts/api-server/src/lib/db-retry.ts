/**
 * db-retry.ts — Exponential-backoff retry for transient PostgreSQL errors.
 *
 * Transient errors that warrant a retry:
 *   ECONNABORTED  — server closed the TCP connection while we were writing
 *   ECONNRESET    — TCP RST received (server restart / load-balancer cut)
 *   ETIMEDOUT     — connection timed out (cold Neon compute / network blip)
 *   57P01         — Postgres "admin_shutdown" — server restarting
 *   08006         — connection_failure
 *   08001         — sqlclient_unable_to_establish_sqlconnection
 *   08004         — sqlserver_rejected_establishment_of_sqlconnection
 *
 * Non-transient errors (constraint violations, bad SQL, quota exceeded, etc.)
 * are re-thrown immediately without retrying so callers get the real error fast.
 *
 * Usage:
 *   import { withDbRetry } from "./db-retry.js";
 *
 *   const rows = await withDbRetry(() => pool.query("SELECT 1"));
 *   const result = await withDbRetry(() => db.select().from(sermonsTable));
 */

import { logger } from "./logger.js";

/** Error codes / message substrings that indicate a transient connectivity issue. */
const TRANSIENT_CODES = new Set([
  "ECONNABORTED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EPIPE",
  "57P01", // admin_shutdown
  "08006", // connection_failure
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "08004", // sqlserver_rejected_establishment_of_sqlconnection
  "XX000", // internal_error (Neon serverless sometimes uses this for compute suspension)
]);

const TRANSIENT_MESSAGE_SUBSTRINGS = [
  "ECONNABORTED",
  "ECONNRESET",
  "ETIMEDOUT",
  "connection terminated",
  "connection closed",
  "write ECONNABORTED",
  "read ECONNRESET",
  "Connection terminated unexpectedly",
  "Cannot read properties of undefined", // pg internal on aborted connection
];

export function isTransientDbError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException & { code?: string }).code ?? "";
  if (TRANSIENT_CODES.has(code)) return true;
  return TRANSIENT_MESSAGE_SUBSTRINGS.some((s) => err.message.includes(s));
}

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 4. */
  maxAttempts?: number;
  /** Base delay in ms for the first backoff. Default: 200. */
  baseDelayMs?: number;
  /** Maximum delay cap in ms. Default: 8000. */
  maxDelayMs?: number;
  /** Label for log messages. */
  label?: string;
}

/**
 * Run `fn` with automatic retry on transient PostgreSQL errors.
 * Non-transient errors are re-thrown immediately (no retry).
 * Retries use truncated exponential backoff with full jitter.
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 4,
    baseDelayMs = 200,
    maxDelayMs = 8_000,
    label = "db-op",
  } = opts;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransientDbError(err)) {
        // Non-transient — fail immediately
        throw err;
      }
      lastErr = err;

      if (attempt === maxAttempts) break;

      // Truncated exponential backoff with full jitter:
      //   delay = random(0, min(maxDelayMs, baseDelayMs * 2^(attempt-1)))
      const cap = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
      const delay = Math.floor(Math.random() * cap);

      logger.warn(
        { label, attempt, maxAttempts, delayMs: delay, err },
        `Transient DB error on attempt ${attempt}/${maxAttempts} — retrying in ${delay}ms`,
      );
      await new Promise<void>((r) => setTimeout(r, delay));
    }
  }

  logger.error(
    { label, maxAttempts, err: lastErr },
    `DB operation failed after ${maxAttempts} attempts`,
  );
  throw lastErr;
}

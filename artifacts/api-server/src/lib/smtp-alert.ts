import { pool } from "@workspace/db";
import { logger } from "./logger.js";

export interface SmtpIncident {
  kind: "verify" | "send";
  failureCount: number;
  firstFailedAt: string;
  lastFailedAt: string;
  alertedAt: string;
  lastError: string;
}

// Three consecutive failures within a 30-minute window. A single transient
// relay error cannot raise an incident; recovery resets the counter.
const FAILURE_WINDOW_MS = 30 * 60 * 1000;
const ALERT_THRESHOLD = 3;

export async function recordSmtpFailure(kind: SmtpIncident["kind"], error: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO smtp_incident_state
         (kind, failure_count, first_failed_at, last_failed_at, last_error, alerted_at)
       VALUES ($1, 1, now(), now(), $2, NULL)
       ON CONFLICT (kind) DO UPDATE SET
         failure_count = CASE
           WHEN smtp_incident_state.last_failed_at IS NULL OR smtp_incident_state.last_failed_at < now() - ($3::bigint * interval '1 millisecond')
           THEN 1 ELSE smtp_incident_state.failure_count + 1 END,
         first_failed_at = CASE
           WHEN smtp_incident_state.last_failed_at IS NULL OR smtp_incident_state.last_failed_at < now() - ($3::bigint * interval '1 millisecond')
           THEN now() ELSE smtp_incident_state.first_failed_at END,
         last_failed_at = now(),
         last_error = EXCLUDED.last_error,
         alerted_at = CASE
           WHEN smtp_incident_state.last_failed_at IS NULL OR smtp_incident_state.last_failed_at < now() - ($3::bigint * interval '1 millisecond')
           THEN NULL
           WHEN smtp_incident_state.failure_count + 1 >= $4
           THEN COALESCE(smtp_incident_state.alerted_at, now())
           ELSE NULL END
       `,
      [kind, error.slice(0, 300), FAILURE_WINDOW_MS, ALERT_THRESHOLD],
    );
  } catch (err) {
    logger.error({ err, kind }, "Could not record SMTP failure alert");
  }
}

export async function recordSmtpRecovery(kind: SmtpIncident["kind"]): Promise<void> {
  try {
    await pool.query(
      `UPDATE smtp_incident_state
       SET failure_count = 0, first_failed_at = NULL, last_failed_at = NULL,
           alerted_at = NULL, last_error = NULL
       WHERE kind = $1 AND failure_count > 0`,
      [kind],
    );
  } catch (err) {
    logger.error({ err, kind }, "Could not clear SMTP failure alert");
  }
}

export async function getActiveSmtpIncidents(): Promise<SmtpIncident[]> {
  const result = await pool.query<{
    kind: SmtpIncident["kind"];
    failure_count: number;
    first_failed_at: Date;
    last_failed_at: Date;
    alerted_at: Date;
    last_error: string;
  }>(
    `SELECT kind, failure_count, first_failed_at, last_failed_at, alerted_at, last_error
     FROM smtp_incident_state WHERE alerted_at IS NOT NULL ORDER BY alerted_at`,
  );
  return result.rows.map((row) => ({
    kind: row.kind,
    failureCount: row.failure_count,
    firstFailedAt: row.first_failed_at.toISOString(),
    lastFailedAt: row.last_failed_at.toISOString(),
    alertedAt: row.alerted_at.toISOString(),
    lastError: row.last_error,
  }));
}
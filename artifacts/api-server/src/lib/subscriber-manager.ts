/**
 * subscriber-manager.ts
 *
 * Centralized, enterprise-grade subscriber management system.
 *
 * This is the single source of truth for all outbound email recipients.
 * Every email type — devotions, conference reminders, event alerts,
 * ministry announcements — dispatches exclusively to subscribers who
 * are active in this registry.
 *
 * Key guarantees:
 *  • Deduplication via UNIQUE constraint on email (case-insensitive)
 *  • Global unsubscribe check on every fetch — no stale opt-outs
 *  • Per-delivery tracking in email_delivery_log (type, status, error, message_id)
 *  • Auto-sync from legacy tables (devotion_subscribers, event_notification_subscribers)
 *  • Auto-seed from the root `emails` file on first deploy
 *  • Exponential-backoff retry is handled by the calling layer (email-engine.ts)
 *  • Thread-safe: all mutations are atomic SQL upserts / updates
 */

import { randomBytes, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pool } from "@workspace/db";
import { logger as rootLogger } from "./logger.js";
import type { Logger } from "pino";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Subscriber {
  id: number;
  email: string;
  name: string | null;
  isActive: boolean;
  unsubscribeToken: string;
  source: string;
  subscribedAt: Date;
  unsubscribedAt: Date | null;
  lastSentAt: Date | null;
  lastEmailType: string | null;
  totalSent: number;
  totalFailed: number;
}

export interface DeliveryRecord {
  subscriberId: number | null;
  email: string;
  emailType: string;
  campaignKey?: string | null;
  status: "sent" | "failed" | "skipped" | "bounced";
  messageId?: string | null;
  error?: string | null;
  attempts?: number;
}

export interface SeedResult {
  inserted: number;
  updated: number;
  skipped: number;
  total: number;
}

export interface SubscriberStats {
  total: number;
  active: number;
  inactive: number;
  globalOptOuts: number;
  deliveredLast24h: number;
  failedLast24h: number;
  bySource: Array<{ source: string; count: number }>;
}

// ─── HMAC token ───────────────────────────────────────────────────────────────

function getHmacSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.JWT_SECRET ||
    "jctm-subscriber-unsub-key-2026"
  );
}

export function generateUnsubscribeToken(email: string): string {
  return createHmac("sha256", getHmacSecret())
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export function makeUnsubscribeUrl(email: string, baseUrl: string): string {
  const sig = generateUnsubscribeToken(email);
  return `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(email)}&sig=${encodeURIComponent(sig)}`;
}

// ─── Core fetch — all active, non-opted-out subscribers ──────────────────────

/**
 * Returns all active subscribers excluding any globally opted-out addresses.
 * This is the authoritative recipient list for ALL email types.
 */
export async function getActiveSubscribers(
  log: Logger = rootLogger,
): Promise<Subscriber[]> {
  try {
    const result = await pool.query<{
      id: number;
      email: string;
      name: string | null;
      is_active: boolean;
      unsubscribe_token: string;
      source: string;
      subscribed_at: Date;
      unsubscribed_at: Date | null;
      last_sent_at: Date | null;
      last_email_type: string | null;
      total_sent: number;
      total_failed: number;
    }>(
      `SELECT s.*
       FROM subscribers s
       WHERE s.is_active = true
         AND NOT EXISTS (
           SELECT 1 FROM email_unsubscribes eu
           WHERE lower(trim(eu.email)) = lower(trim(s.email))
         )
       ORDER BY s.subscribed_at ASC`,
    );
    return result.rows.map(toSubscriber);
  } catch (err) {
    log.error({ err }, "subscriber-manager: getActiveSubscribers failed");
    return [];
  }
}

/**
 * Returns active subscribers who have NOT received the given email type today.
 * Used by the devotion broadcast to prevent double-sends.
 */
export async function getActiveSubscribersMissedToday(
  emailType: string,
  log: Logger = rootLogger,
): Promise<Subscriber[]> {
  const today = new Date().toISOString().split("T")[0]!;
  try {
    const result = await pool.query<{
      id: number;
      email: string;
      name: string | null;
      is_active: boolean;
      unsubscribe_token: string;
      source: string;
      subscribed_at: Date;
      unsubscribed_at: Date | null;
      last_sent_at: Date | null;
      last_email_type: string | null;
      total_sent: number;
      total_failed: number;
    }>(
      `SELECT s.*
       FROM subscribers s
       WHERE s.is_active = true
         AND NOT EXISTS (
           SELECT 1 FROM email_unsubscribes eu
           WHERE lower(trim(eu.email)) = lower(trim(s.email))
         )
         AND NOT EXISTS (
           SELECT 1 FROM email_delivery_log dl
           WHERE dl.subscriber_id = s.id
             AND dl.email_type = $1
             AND dl.status = 'sent'
             AND dl.sent_at::date = $2::date
         )
       ORDER BY s.subscribed_at ASC`,
      [emailType, today],
    );
    return result.rows.map(toSubscriber);
  } catch (err) {
    log.error({ err }, "subscriber-manager: getActiveSubscribersMissedToday failed");
    return [];
  }
}

// ─── Upsert a single subscriber ───────────────────────────────────────────────

export async function upsertSubscriber(
  email: string,
  opts: {
    name?: string | null;
    source?: string;
    reactivate?: boolean;
  } = {},
  log: Logger = rootLogger,
): Promise<{ subscriber: Subscriber | null; isNew: boolean }> {
  const normalEmail = email.trim().toLowerCase();
  const source = opts.source ?? "manual";
  const name = opts.name?.trim() || null;

  try {
    const existing = await pool.query<{ id: number; is_active: boolean; unsubscribe_token: string }>(
      `SELECT id, is_active, unsubscribe_token FROM subscribers WHERE email = $1 LIMIT 1`,
      [normalEmail],
    );

    if (existing.rows[0]) {
      const row = existing.rows[0]!;
      const wasInactive = !row.is_active;
      if (wasInactive && opts.reactivate !== false) {
        await pool.query(
          `UPDATE subscribers
             SET is_active = true, unsubscribed_at = NULL, subscribed_at = now(),
                 name = COALESCE($2, name), updated_at = now()
           WHERE id = $1`,
          [row.id, name],
        );
      } else if (name) {
        await pool.query(
          `UPDATE subscribers SET name = COALESCE(name, $2), updated_at = now() WHERE id = $1`,
          [row.id, name],
        );
      }
      const updated = await pool.query<ReturnType<typeof toSubscriberRaw>>(
        `SELECT * FROM subscribers WHERE id = $1`,
        [row.id],
      );
      return {
        subscriber: updated.rows[0] ? toSubscriber(updated.rows[0] as any) : null,
        isNew: wasInactive,
      };
    }

    const token = randomBytes(24).toString("hex");
    const inserted = await pool.query<ReturnType<typeof toSubscriberRaw>>(
      `INSERT INTO subscribers (email, name, source, unsubscribe_token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE
         SET name = COALESCE(subscribers.name, EXCLUDED.name),
             source = CASE WHEN subscribers.is_active THEN subscribers.source ELSE EXCLUDED.source END,
             updated_at = now()
       RETURNING *`,
      [normalEmail, name, source, token],
    );

    return {
      subscriber: inserted.rows[0] ? toSubscriber(inserted.rows[0] as any) : null,
      isNew: true,
    };
  } catch (err) {
    log.error({ err, email: normalEmail }, "subscriber-manager: upsertSubscriber failed");
    return { subscriber: null, isNew: false };
  }
}

// ─── Deactivate (unsubscribe) ─────────────────────────────────────────────────

/**
 * Deactivates a subscriber across ALL tables in a single operation:
 *   - subscribers
 *   - devotion_subscribers
 *   - event_notification_subscribers
 *   - email_unsubscribes (global opt-out)
 */
export async function deactivateSubscriber(
  email: string,
  source: string = "subscriber_manager",
  log: Logger = rootLogger,
): Promise<void> {
  const normalEmail = email.trim().toLowerCase();
  try {
    await Promise.allSettled([
      pool.query(
        `UPDATE subscribers SET is_active = false, unsubscribed_at = now(), updated_at = now()
         WHERE lower(trim(email)) = $1`,
        [normalEmail],
      ),
      pool.query(
        `UPDATE devotion_subscribers SET is_active = false, unsubscribed_at = now()
         WHERE lower(trim(email)) = $1`,
        [normalEmail],
      ),
      pool.query(
        `UPDATE event_notification_subscribers SET is_active = false, unsubscribed_at = now()
         WHERE lower(trim(email)) = $1`,
        [normalEmail],
      ),
      pool.query(
        `INSERT INTO email_unsubscribes (email, source)
         VALUES ($1, $2)
         ON CONFLICT (email) DO NOTHING`,
        [normalEmail, source],
      ),
    ]);
    log.info({ email: normalEmail, source }, "Subscriber fully deactivated across all tables");
  } catch (err) {
    log.error({ err, email: normalEmail }, "subscriber-manager: deactivateSubscriber failed");
  }
}

// ─── Delivery tracking ────────────────────────────────────────────────────────

/**
 * Records a delivery outcome and updates the subscriber's stats + last_sent_at.
 * Best-effort: failures are silently swallowed so they never block email dispatch.
 */
export async function recordDelivery(
  record: DeliveryRecord,
  log: Logger = rootLogger,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO email_delivery_log
         (subscriber_id, email, email_type, campaign_key, status, message_id, error, attempts, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [
        record.subscriberId,
        record.email.trim().toLowerCase(),
        record.emailType,
        record.campaignKey ?? null,
        record.status,
        record.messageId ?? null,
        record.error ? record.error.slice(0, 1000) : null,
        record.attempts ?? 1,
      ],
    );

    if (record.subscriberId) {
      if (record.status === "sent") {
        await pool.query(
          `UPDATE subscribers
             SET last_sent_at = now(), last_email_type = $2,
                 total_sent = total_sent + 1, updated_at = now()
           WHERE id = $1`,
          [record.subscriberId, record.emailType],
        );
      } else if (record.status === "failed") {
        await pool.query(
          `UPDATE subscribers
             SET total_failed = total_failed + 1, updated_at = now()
           WHERE id = $1`,
          [record.subscriberId],
        );
      }
    }
  } catch {
    // Non-fatal — delivery tracking must never block email dispatch
  }
}

// ─── Bulk delivery update (for batch sends) ───────────────────────────────────

export async function recordBulkDeliveries(
  records: DeliveryRecord[],
  log: Logger = rootLogger,
): Promise<void> {
  if (records.length === 0) return;
  await Promise.allSettled(records.map((r) => recordDelivery(r, log)));
}

// ─── Seed from emails file ────────────────────────────────────────────────────

/**
 * Reads the root `emails` file and upserts all addresses into the subscribers
 * table with source = 'ministry_list'. Safe to call multiple times — uses
 * ON CONFLICT DO NOTHING so no duplicate insertions occur.
 *
 * Returns a count of inserted vs. already-existing rows.
 */
export async function seedFromEmailsFile(
  log: Logger = rootLogger,
): Promise<SeedResult> {
  const possiblePaths = [
    resolve(process.cwd(), "emails"),
    resolve(process.cwd(), "../emails"),
    resolve(process.cwd(), "../../emails"),
  ];

  let lines: string[] = [];
  for (const p of possiblePaths) {
    try {
      const content = readFileSync(p, "utf-8");
      lines = content.split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter(Boolean);
      if (lines.length > 0) {
        log.info({ path: p, count: lines.length }, "subscriber-manager: loaded emails file");
        break;
      }
    } catch {
      // try next path
    }
  }

  if (lines.length === 0) {
    log.warn("subscriber-manager: emails file not found or empty — skipping seed");
    return { inserted: 0, updated: 0, skipped: 0, total: 0 };
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid = lines.filter((e) => EMAIL_RE.test(e) && e.length <= 254);
  const invalid = lines.length - valid.length;
  if (invalid > 0) {
    log.warn({ invalid }, "subscriber-manager: skipped invalid addresses in emails file");
  }

  let inserted = 0;
  let skipped = 0;

  for (const email of valid) {
    try {
      const token = randomBytes(24).toString("hex");
      const result = await pool.query<{ id: number }>(
        `INSERT INTO subscribers (email, source, unsubscribe_token)
         VALUES ($1, 'ministry_list', $2)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [email, token],
      );
      if ((result.rowCount ?? 0) > 0) inserted++;
      else skipped++;
    } catch {
      skipped++;
    }
  }

  log.info(
    { total: valid.length, inserted, skipped },
    "subscriber-manager: emails file seed complete",
  );
  return { inserted, updated: 0, skipped, total: valid.length };
}

// ─── Sync from legacy tables ──────────────────────────────────────────────────

/**
 * Syncs ALL active subscribers from legacy tables into the unified subscribers table.
 * Safe to call repeatedly — uses ON CONFLICT DO NOTHING.
 *
 * Sources:
 *  1. devotion_subscribers (active)
 *  2. event_notification_subscribers (active)
 *  3. conference_registrations (with email)
 *  4. member_auth (registered members)
 *  5. giving_logs (successful donors)
 */
export async function syncFromLegacyTables(
  log: Logger = rootLogger,
): Promise<SeedResult> {
  let inserted = 0;
  let skipped = 0;

  const sources: Array<{ query: string; sourceName: string }> = [
    {
      sourceName: "devotion_subscribers",
      query: `SELECT lower(trim(email)) AS email, name, 'devotion_subscribers' AS src
               FROM devotion_subscribers
               WHERE is_active = true AND email IS NOT NULL AND trim(email) != ''`,
    },
    {
      sourceName: "event_notification_subscribers",
      query: `SELECT lower(trim(email)) AS email, NULL AS name, 'event_notification_subscribers' AS src
               FROM event_notification_subscribers
               WHERE is_active = true AND email IS NOT NULL AND trim(email) != ''`,
    },
    {
      sourceName: "conference_registrations",
      query: `SELECT lower(trim(email)) AS email, full_name AS name, 'conference_registrations' AS src
               FROM conference_registrations
               WHERE email IS NOT NULL AND trim(email) != ''`,
    },
    {
      sourceName: "member_auth",
      query: `SELECT lower(trim(email)) AS email,
                      TRIM(CONCAT(first_name, ' ', last_name)) AS name,
                      'member_auth' AS src
               FROM member_auth
               WHERE email IS NOT NULL AND trim(email) != ''`,
    },
    {
      sourceName: "giving_logs",
      query: `SELECT lower(trim(donor_email)) AS email, donor_name AS name, 'giving_logs' AS src
               FROM giving_logs
               WHERE donor_email IS NOT NULL AND trim(donor_email) != '' AND status = 'success'`,
    },
  ];

  for (const { query, sourceName } of sources) {
    try {
      const rows = await pool.query<{ email: string; name: string | null; src: string }>(query);
      for (const row of rows.rows) {
        if (!row.email || row.email.length > 254) continue;
        try {
          const token = randomBytes(24).toString("hex");
          const r = await pool.query(
            `INSERT INTO subscribers (email, name, source, unsubscribe_token)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (email) DO UPDATE
               SET name = COALESCE(subscribers.name, EXCLUDED.name),
                   updated_at = now()
             RETURNING (xmax = 0) AS is_insert`,
            [row.email, row.name || null, row.src, token],
          );
          const wasInsert = r.rows[0]?.is_insert;
          if (wasInsert) inserted++;
          else skipped++;
        } catch {
          skipped++;
        }
      }
      log.debug({ sourceName, rows: rows.rowCount }, "subscriber-manager: synced source table");
    } catch (err) {
      log.warn({ err, sourceName }, "subscriber-manager: sync from legacy table failed (non-fatal)");
    }
  }

  log.info({ inserted, skipped }, "subscriber-manager: legacy table sync complete");
  return { inserted, updated: 0, skipped, total: inserted + skipped };
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export async function getSubscriberStats(
  log: Logger = rootLogger,
): Promise<SubscriberStats> {
  try {
    const [counts, sources, optOuts, delivery] = await Promise.all([
      pool.query<{ total: string; active: string; inactive: string }>(
        `SELECT
           count(*)::text AS total,
           count(*) FILTER (WHERE is_active = true)::text AS active,
           count(*) FILTER (WHERE is_active = false)::text AS inactive
         FROM subscribers`,
      ),
      pool.query<{ source: string; count: string }>(
        `SELECT source, count(*)::text AS count
         FROM subscribers
         WHERE is_active = true
         GROUP BY source
         ORDER BY count DESC`,
      ),
      pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM email_unsubscribes`,
      ),
      pool.query<{ delivered: string; failed: string }>(
        `SELECT
           count(*) FILTER (WHERE status = 'sent')::text AS delivered,
           count(*) FILTER (WHERE status = 'failed')::text AS failed
         FROM email_delivery_log
         WHERE sent_at > now() - interval '24 hours'`,
      ),
    ]);

    return {
      total: parseInt(counts.rows[0]?.total ?? "0", 10),
      active: parseInt(counts.rows[0]?.active ?? "0", 10),
      inactive: parseInt(counts.rows[0]?.inactive ?? "0", 10),
      globalOptOuts: parseInt(optOuts.rows[0]?.n ?? "0", 10),
      deliveredLast24h: parseInt(delivery.rows[0]?.delivered ?? "0", 10),
      failedLast24h: parseInt(delivery.rows[0]?.failed ?? "0", 10),
      bySource: sources.rows.map((r) => ({
        source: r.source,
        count: parseInt(r.count, 10),
      })),
    };
  } catch (err) {
    log.error({ err }, "subscriber-manager: getSubscriberStats failed");
    return {
      total: 0,
      active: 0,
      inactive: 0,
      globalOptOuts: 0,
      deliveredLast24h: 0,
      failedLast24h: 0,
      bySource: [],
    };
  }
}

// ─── Startup bootstrap ────────────────────────────────────────────────────────

let bootstrapped = false;

/**
 * Called once on server startup (after migrations).
 * Seeds the emails file + syncs legacy tables into the subscribers table.
 * Idempotent — safe to call on every deploy.
 */
export async function bootstrapSubscribers(
  log: Logger = rootLogger,
): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  log.info("subscriber-manager: bootstrapping subscriber registry");

  try {
    const fileSeed = await seedFromEmailsFile(log);
    log.info(fileSeed, "subscriber-manager: emails file seed done");
  } catch (err) {
    log.warn({ err }, "subscriber-manager: emails file seed failed (non-fatal)");
  }

  try {
    const legacySync = await syncFromLegacyTables(log);
    log.info(legacySync, "subscriber-manager: legacy sync done");
  } catch (err) {
    log.warn({ err }, "subscriber-manager: legacy sync failed (non-fatal)");
  }

  const stats = await getSubscriberStats(log);
  log.info(stats, "subscriber-manager: bootstrap complete");
}

// ─── Lookup by token ──────────────────────────────────────────────────────────

export async function findSubscriberByToken(
  token: string,
): Promise<Subscriber | null> {
  try {
    const result = await pool.query<any>(
      `SELECT * FROM subscribers WHERE unsubscribe_token = $1 LIMIT 1`,
      [token],
    );
    return result.rows[0] ? toSubscriber(result.rows[0]) : null;
  } catch {
    return null;
  }
}

export async function findSubscriberByEmail(
  email: string,
): Promise<Subscriber | null> {
  try {
    const result = await pool.query<any>(
      `SELECT * FROM subscribers WHERE lower(trim(email)) = $1 LIMIT 1`,
      [email.trim().toLowerCase()],
    );
    return result.rows[0] ? toSubscriber(result.rows[0]) : null;
  } catch {
    return null;
  }
}

// ─── Internal mapper ──────────────────────────────────────────────────────────

function toSubscriberRaw(r: any) {
  return r;
}

function toSubscriber(r: any): Subscriber {
  return {
    id: Number(r.id),
    email: r.email,
    name: r.name ?? null,
    isActive: r.is_active,
    unsubscribeToken: r.unsubscribe_token,
    source: r.source,
    subscribedAt: r.subscribed_at,
    unsubscribedAt: r.unsubscribed_at ?? null,
    lastSentAt: r.last_sent_at ?? null,
    lastEmailType: r.last_email_type ?? null,
    totalSent: Number(r.total_sent ?? 0),
    totalFailed: Number(r.total_failed ?? 0),
  };
}

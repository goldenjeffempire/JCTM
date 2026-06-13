/**
 * Push Notification Manager
 *
 * Manages VAPID keys, push subscriptions, and notification dispatch for
 * JCTM Temple TV. Handles:
 *  - VAPID key generation and persistence
 *  - Subscription storage and retrieval from DB
 *  - Push notification dispatch to all subscribers
 *  - Service-specific notification templates
 */

import webpush from "web-push";
import { pool } from "@workspace/db";
import type { Logger } from "pino";

// ─── VAPID Key Management ──────────────────────────────────────────────────────

let vapidInitialized = false;

export function getVapidPublicKey(): string {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) throw new Error("VAPID_PUBLIC_KEY not configured");
  return key;
}

export async function initVapidKeys(log?: Logger): Promise<boolean> {
  let publicKey = process.env.VAPID_PUBLIC_KEY;
  let privateKey = process.env.VAPID_PRIVATE_KEY;

  // Fast path — env vars already set (normal production case).
  if (!publicKey || !privateKey) {
    // Fallback 1: try DB-persisted keys (survives restarts without env vars).
    try {
      const row = await pool.query<{ public_key: string; private_key: string }>(
        `SELECT public_key, private_key FROM vapid_keys WHERE id = 1 LIMIT 1`
      );
      if (row.rows[0]) {
        publicKey = row.rows[0].public_key;
        privateKey = row.rows[0].private_key;
        process.env.VAPID_PUBLIC_KEY = publicKey;
        process.env.VAPID_PRIVATE_KEY = privateKey;
        log?.info("VAPID keys loaded from database");
      }
    } catch {
      // vapid_keys table may not exist yet (pre-migration boot) — fall through.
    }
  }

  if (!publicKey || !privateKey) {
    // Fallback 2: generate a fresh pair and persist it so future restarts reuse it.
    const keys = webpush.generateVAPIDKeys();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    process.env.VAPID_PUBLIC_KEY = publicKey;
    process.env.VAPID_PRIVATE_KEY = privateKey;
    try {
      await pool.query(
        `INSERT INTO vapid_keys (id, public_key, private_key)
         VALUES (1, $1, $2)
         ON CONFLICT (id) DO UPDATE SET public_key = $1, private_key = $2`,
        [publicKey, privateKey]
      );
      log?.warn(
        { VAPID_PUBLIC_KEY: publicKey },
        "VAPID keys auto-generated and persisted to DB — set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY env vars for production"
      );
    } catch (dbErr) {
      log?.warn(
        { err: dbErr, VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey },
        "VAPID keys auto-generated but could not persist to DB — set as env vars to survive restarts"
      );
    }
  }

  webpush.setVapidDetails(
    "mailto:info@jctm.org.ng",
    publicKey,
    privateKey
  );

  vapidInitialized = true;
  log?.info("VAPID keys configured — push notifications enabled");
  return true;
}

// ─── Subscription Management ──────────────────────────────────────────────────

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function storeSubscription(
  subscription: PushSubscription,
  deviceType: string = "web",
  visitorId?: string,
  log?: Logger
): Promise<{ id: number; isNew: boolean }> {
  try {
    const existing = await pool.query<{ id: number }>(
      `SELECT id FROM push_subscriptions WHERE endpoint = $1`,
      [subscription.endpoint]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE push_subscriptions SET p256dh = $1, auth = $2, is_active = true, updated_at = now() WHERE endpoint = $3`,
        [subscription.keys.p256dh, subscription.keys.auth, subscription.endpoint]
      );
      return { id: existing.rows[0].id, isNew: false };
    }

    const result2 = await pool.query<{ id: number }>(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, device_type, visitor_id, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, now(), now())
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = $2, auth = $3, is_active = true, updated_at = now()
       RETURNING id`,
      [subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, deviceType, visitorId ?? null]
    );

    log?.info({ endpoint: subscription.endpoint.slice(0, 40) }, "Push subscription stored");
    return { id: result2.rows[0].id, isNew: true };
  } catch (err) {
    log?.error({ err }, "Failed to store push subscription");
    throw err;
  }
}

export async function removeSubscription(endpoint: string, log?: Logger): Promise<void> {
  try {
    await pool.query(
      `UPDATE push_subscriptions SET is_active = false, updated_at = now() WHERE endpoint = $1`,
      [endpoint]
    );
    log?.info({ endpoint: endpoint.slice(0, 40) }, "Push subscription deactivated");
  } catch (err) {
    log?.error({ err }, "Failed to remove push subscription");
  }
}

export async function getSubscriberCount(): Promise<number> {
  try {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM push_subscriptions WHERE is_active = true`
    );
    return parseInt(result.rows[0]?.count ?? "0", 10);
  } catch {
    return 0;
  }
}

// ─── Notification Templates ───────────────────────────────────────────────────

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  data?: Record<string, unknown>;
}

export function buildLiveServiceNotification(title: string): NotificationPayload {
  return {
    title: `🔴 ${title || "Warri Crusade Day 2"} — Live`,
    body: title ? `${title} — Join now and experience the presence of God.` : "Now Streaming Live — Join us now",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    url: "/sermons",
    tag: "live-service",
    requireInteraction: true,
    actions: [{ action: "watch", title: "Watch Live" }],
    data: { type: "live_service", broadcastType: "live", timestamp: new Date().toISOString() },
  };
}

export function buildRebroadcastNotification(sermonTitle: string): NotificationPayload {
  return {
    title: "📺 Temple TV — Rebroadcast",
    body: sermonTitle ? `Now replaying: "${sermonTitle}" — Watch on Temple TV` : "Service rebroadcast is now live",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    url: "/sermons",
    tag: "rebroadcast",
    requireInteraction: false,
    actions: [{ action: "watch", title: "Watch Now" }],
    data: { type: "rebroadcast", broadcastType: "rebroadcast", timestamp: new Date().toISOString() },
  };
}

export function buildServiceReminderNotification(minutesBefore: number): NotificationPayload {
  return {
    title: "⏰ Warri Crusade Day 2 — Live",
    body: `Live Broadcast in Progress begins in ${minutesBefore} minutes. Prepare your heart and join us!`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    url: "/",
    tag: "service-reminder",
    data: { type: "service_reminder", minutesBefore, timestamp: new Date().toISOString() },
  };
}

export function buildUpcomingServiceNotification(): NotificationPayload {
  return {
    title: "Warri Crusade Day 2 Begins Soon",
    body: "Join us live at 8:00 AM (WAT). Prepare your heart and connect to the presence of God.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    url: "/",
    tag: "holy-spirit-sunday-service",
    requireInteraction: true,
    actions: [{ action: "open", title: "View Website" }],
    data: { type: "upcoming_service", timestamp: new Date().toISOString() },
  };
}

export function buildNewSermonNotification(title: string): NotificationPayload {
  return {
    title: "🎙️ New Message from JCTM",
    body: `"${title}" — A new word from Prophet Amos Evomobor is now available`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    url: "/sermons",
    tag: "new-sermon",
    data: { type: "new_sermon", timestamp: new Date().toISOString() },
  };
}

export function buildDailyDevotionNotification(title: string, reference: string): NotificationPayload {
  return {
    title: "📖 JCTM Daily Devotion",
    body: `"${title}" — ${reference} · Open today's word`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    url: "/devotion",
    tag: "daily-devotion",
    data: { type: "daily_devotion", title, reference, timestamp: new Date().toISOString() },
  };
}

// ─── Push Dispatch ────────────────────────────────────────────────────────────

interface DispatchResult {
  sent: number;
  failed: number;
  deactivated: number;
}

// After this many consecutive failures, a subscription is auto-retired even
// if every individual error was technically recoverable. Stops the "21%
// delivery rate" pattern where a handful of dead endpoints fail every
// broadcast forever and drag the average down.
const MAX_CONSECUTIVE_FAILURES = 3;

// HTTP statuses that mean the subscription itself is permanently bad.
//   400 — payload/format the push service refuses (often means the keys are
//         malformed or the endpoint format is no longer supported).
//   401 — VAPID JWT not accepted (usually misconfigured `aud`).
//   403 — VAPID public key on this subscription doesn't match the server's
//         current key. Will fail forever until the user re-subscribes.
//   404 — endpoint resource gone (treat as gone).
//   410 — Gone, the canonical "this subscription is dead" signal.
//   413 — payload too large; will fail every time for this endpoint.
const PERMANENT_FAILURE_STATUSES = new Set<number>([400, 401, 403, 404, 410, 413]);

async function logDispatch(
  title: string,
  type: string,
  result: DispatchResult
): Promise<void> {
  try {
    const total = result.sent + result.failed + result.deactivated;
    const rate = total > 0 ? result.sent / total : 0;
    await pool.query(
      `INSERT INTO push_dispatch_log
         (notification_title, notification_type, sent, failed, deactivated, total_attempted, delivery_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [title, type, result.sent, result.failed, result.deactivated, total, rate]
    );
  } catch {
    // non-critical — do not throw
  }
}

/**
 * Mark a subscription as permanently dead (is_active = false) with an audit
 * trail of which status code caused the retirement. Idempotent.
 */
async function deactivateSubscription(
  endpoint: string,
  reason: string,
  status?: number,
): Promise<void> {
  await pool.query(
    `UPDATE push_subscriptions
        SET is_active = false,
            updated_at = now(),
            deactivated_reason = $2,
            last_failure_status = COALESCE($3, last_failure_status)
      WHERE endpoint = $1`,
    [endpoint, reason, status ?? null],
  );
}

/**
 * Record a successful delivery for a subscription: reset the failure streak,
 * stamp `last_success_at`. One small UPDATE per success; cheap.
 */
async function recordSubscriptionSuccess(endpoint: string): Promise<void> {
  await pool.query(
    `UPDATE push_subscriptions
        SET consecutive_failures = 0,
            last_success_at      = now(),
            updated_at           = now()
      WHERE endpoint = $1`,
    [endpoint],
  );
}

/**
 * Increment a subscription's failure counter and auto-retire it once it
 * crosses MAX_CONSECUTIVE_FAILURES. Returns `true` if the subscription was
 * retired by this call so the caller can count it as `deactivated`.
 */
async function recordSubscriptionFailure(
  endpoint: string,
  status: number | undefined,
): Promise<boolean> {
  const result = await pool.query<{ consecutive_failures: number; is_active: boolean }>(
    `UPDATE push_subscriptions
        SET consecutive_failures = consecutive_failures + 1,
            last_failure_at      = now(),
            last_failure_status  = $2,
            updated_at           = now()
      WHERE endpoint = $1
      RETURNING consecutive_failures, is_active`,
    [endpoint, status ?? null],
  );
  const row = result.rows[0];
  if (!row || !row.is_active) return false;
  if (row.consecutive_failures >= MAX_CONSECUTIVE_FAILURES) {
    await deactivateSubscription(
      endpoint,
      `auto-retired after ${row.consecutive_failures} consecutive failures`,
      status,
    );
    return true;
  }
  return false;
}

export async function dispatchPushNotification(
  notification: NotificationPayload,
  log?: Logger,
  notificationType = "custom"
): Promise<DispatchResult> {
  if (!vapidInitialized) {
    log?.warn("VAPID not initialized — skipping push dispatch");
    return { sent: 0, failed: 0, deactivated: 0 };
  }

  let sent = 0;
  let failed = 0;
  let deactivated = 0;

  try {
    // Pull only healthy subscriptions: anything that has already crossed the
    // failure threshold should have been retired by a previous run, but we
    // belt-and-brace it here so a stale row never gets one extra attempt.
    const subscriptions = await pool.query<{
      endpoint: string;
      p256dh: string;
      auth: string;
    }>(
      `SELECT endpoint, p256dh, auth
         FROM push_subscriptions
        WHERE is_active = true
          AND consecutive_failures < $1`,
      [MAX_CONSECUTIVE_FAILURES],
    );

    if (subscriptions.rows.length === 0) {
      log?.info("No active push subscribers — skipping dispatch");
      await logDispatch(notification.title, notificationType, { sent: 0, failed: 0, deactivated: 0 });
      return { sent: 0, failed: 0, deactivated: 0 };
    }

    log?.info(
      { count: subscriptions.rows.length, title: notification.title },
      "Dispatching push notifications",
    );

    const payload = JSON.stringify(notification);

    // Endpoints that hit a transient (5xx / network) error get one retry.
    // Permanent statuses (PERMANENT_FAILURE_STATUSES) are deactivated
    // immediately — no retry, no recurring drag on the delivery rate.
    // 429 (rate limit) is treated as transient with a longer backoff baked
    // into the single retry below.
    const transientRetry: Array<{ endpoint: string; p256dh: string; auth: string }> = [];

    const isTransient = (status: number | undefined, err: unknown): boolean => {
      if (status && status >= 500 && status < 600) return true;
      if (status === 408 || status === 429) return true;
      const code = (err as { code?: string }).code;
      if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "EAI_AGAIN") {
        return true;
      }
      return false;
    };

    // Status-code-by-status-code summary collected for diagnostics. Logged
    // at the end so admins can see e.g. "all failures were 403 — VAPID key
    // mismatch" at a glance instead of having to scrape per-row warnings.
    const statusCounts: Record<string, number> = {};
    const bumpStatus = (status: number | undefined, err: unknown) => {
      const key = status
        ? String(status)
        : ((err as { code?: string }).code ?? "unknown");
      statusCounts[key] = (statusCounts[key] ?? 0) + 1;
    };

    const sendOnce = async (
      sub: { endpoint: string; p256dh: string; auth: string },
      isRetry: boolean,
    ): Promise<void> => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 3600 },
        );
        sent++;
        // Best-effort — don't let a hot db hiccup mask the delivery itself.
        recordSubscriptionSuccess(sub.endpoint).catch((dbErr) => {
          log?.warn({ err: dbErr, endpoint: sub.endpoint.slice(0, 40) }, "Failed to record push success");
        });
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        bumpStatus(status, err);

        if (status !== undefined && PERMANENT_FAILURE_STATUSES.has(status)) {
          // Permanent — retire the subscription right now.
          deactivated++;
          try {
            await deactivateSubscription(
              sub.endpoint,
              `push service returned ${status}`,
              status,
            );
          } catch (dbErr) {
            log?.warn({ err: dbErr, endpoint: sub.endpoint.slice(0, 40) }, "Failed to deactivate subscription");
          }
          return;
        }

        if (!isRetry && isTransient(status, err)) {
          transientRetry.push(sub);
          return;
        }

        // Counts as a hard failure on this attempt.
        failed++;
        try {
          const retired = await recordSubscriptionFailure(sub.endpoint, status);
          if (retired) {
            // Reclassify: it was a failure on this run, but the row is now
            // gone for future runs — surface that to the caller's metrics.
            failed--;
            deactivated++;
          }
        } catch (dbErr) {
          log?.warn({ err: dbErr, endpoint: sub.endpoint.slice(0, 40) }, "Failed to record push failure");
        }
        log?.warn(
          { err, endpoint: sub.endpoint.slice(0, 40), status, isRetry },
          "Push notification failed",
        );
      }
    };

    await Promise.allSettled(
      subscriptions.rows.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
        sendOnce(sub, false),
      ),
    );

    // Retry transient failures once after a short backoff so the affected
    // endpoints have a chance to recover (e.g. brief 5xx blips at the push
    // service edge).
    if (transientRetry.length > 0) {
      log?.info({ count: transientRetry.length }, "Retrying transient push failures after 3s");
      await new Promise((r) => setTimeout(r, 3000));
      await Promise.allSettled(transientRetry.map((sub) => sendOnce(sub, true)));
    }

    log?.info(
      {
        sent,
        failed,
        deactivated,
        retried: transientRetry.length,
        statusCounts,
      },
      "Push dispatch complete",
    );
  } catch (err) {
    log?.error({ err }, "Push dispatch system error");
  }

  await logDispatch(notification.title, notificationType, { sent, failed, deactivated });

  return { sent, failed, deactivated };
}

/**
 * Bulk-retire stale subscriptions: anything that's hit the failure threshold
 * but somehow wasn't deactivated in-flight, plus anything that hasn't
 * delivered successfully in `staleDays`. Returns the number of rows retired.
 *
 * Safe to run on every server boot and from an admin button.
 */
export async function cleanupStalePushSubscriptions(
  staleDays = 60,
  log?: Logger,
): Promise<{ retiredFailing: number; retiredStale: number }> {
  let retiredFailing = 0;
  let retiredStale = 0;
  try {
    const r1 = await pool.query<{ count: string }>(
      `WITH retired AS (
         UPDATE push_subscriptions
            SET is_active = false,
                updated_at = now(),
                deactivated_reason = COALESCE(deactivated_reason,
                  'auto-retired: consecutive_failures >= ' || $1::text)
          WHERE is_active = true
            AND consecutive_failures >= $1
          RETURNING 1
       )
       SELECT count(*)::text AS count FROM retired`,
      [MAX_CONSECUTIVE_FAILURES],
    );
    retiredFailing = parseInt(r1.rows[0]?.count ?? "0", 10);

    const r2 = await pool.query<{ count: string }>(
      `WITH retired AS (
         UPDATE push_subscriptions
            SET is_active = false,
                updated_at = now(),
                deactivated_reason = COALESCE(deactivated_reason,
                  'auto-retired: no successful delivery in ' || $1::text || ' days')
          WHERE is_active = true
            AND last_success_at IS NOT NULL
            AND last_success_at < now() - ($1::text || ' days')::interval
          RETURNING 1
       )
       SELECT count(*)::text AS count FROM retired`,
      [staleDays],
    );
    retiredStale = parseInt(r2.rows[0]?.count ?? "0", 10);

    if (retiredFailing > 0 || retiredStale > 0) {
      log?.info({ retiredFailing, retiredStale, staleDays }, "Stale push subscriptions cleaned up");
    }
  } catch (err) {
    log?.warn({ err }, "cleanupStalePushSubscriptions failed");
  }
  return { retiredFailing, retiredStale };
}

// ─── Credential Health Check ─────────────────────────────────────────────────

export interface PushCredentialsHealth {
  vapid: {
    configured: boolean;
    initialized: boolean;
    publicKeyFingerprint: string | null;
    error?: string;
  };
  expo: {
    reachable: boolean;
    accessTokenConfigured: boolean;
    error?: string;
  };
  webSubscribers: {
    active: number;
    inactive: number;
    failing: number;     // active rows currently mid-failing (1+ recent failure, not yet retired)
    neverDelivered: number; // active rows that have never had a successful delivery
  };
  expoTokens: {
    active: number;
    inactive: number;
  };
  /** Recent dispatch outcomes (last 24h) — useful for "21% delivery" diagnosis. */
  recentDispatch: {
    sent: number;
    failed: number;
    deactivated: number;
    deliveryRate: number; // 0..1
    dispatches: number;
  };
}

/**
 * Validate push credentials end-to-end for the admin health dashboard.
 * Returns a structured report — never throws. Each check is independent so
 * a failure in one doesn't mask another.
 *
 *   • VAPID — verifies env vars are present AND that init succeeded.
 *   • Expo  — performs a HEAD-style ping to the Expo Push API endpoint.
 *   • Subscriber counts — separates active vs inactive across both
 *     channels so admins can see the reach of each notification.
 */
export async function validatePushCredentials(
  log?: Logger,
): Promise<PushCredentialsHealth> {
  // ── VAPID ──
  const vapidConfigured = Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
  const fingerprint = process.env.VAPID_PUBLIC_KEY
    ? `${process.env.VAPID_PUBLIC_KEY.slice(0, 8)}…${process.env.VAPID_PUBLIC_KEY.slice(-6)}`
    : null;
  const vapidReport: PushCredentialsHealth["vapid"] = {
    configured: vapidConfigured,
    initialized: vapidInitialized,
    publicKeyFingerprint: fingerprint,
  };
  if (!vapidConfigured) vapidReport.error = "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY missing";
  else if (!vapidInitialized) vapidReport.error = "VAPID configured but not initialized";

  // ── Expo Push API reachability ──
  const expoReport: PushCredentialsHealth["expo"] = {
    reachable: false,
    accessTokenConfigured: Boolean(process.env.EXPO_ACCESS_TOKEN),
  };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    // Send an empty array — Expo returns 200 with `{ data: [] }`.
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (process.env.EXPO_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: "[]",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      expoReport.reachable = true;
    } else {
      const text = await res.text().catch(() => "");
      expoReport.error = `Expo returned ${res.status}: ${text.slice(0, 120)}`;
    }
  } catch (err) {
    expoReport.error = err instanceof Error ? err.message : String(err);
    log?.warn({ err }, "Expo Push API health check failed");
  }

  // ── Subscriber counts ──
  let webActive = 0;
  let webInactive = 0;
  let webFailing = 0;
  let webNeverDelivered = 0;
  let expoActive = 0;
  let expoInactive = 0;
  try {
    const r = await pool.query<{
      active: string;
      inactive: string;
      failing: string;
      never_delivered: string;
    }>(
      `SELECT
         count(*) FILTER (WHERE is_active = true)::text AS active,
         count(*) FILTER (WHERE is_active = false)::text AS inactive,
         count(*) FILTER (WHERE is_active = true AND consecutive_failures > 0)::text AS failing,
         count(*) FILTER (WHERE is_active = true AND last_success_at IS NULL)::text AS never_delivered
       FROM push_subscriptions`,
    );
    const row = r.rows[0];
    webActive = parseInt(row?.active ?? "0", 10);
    webInactive = parseInt(row?.inactive ?? "0", 10);
    webFailing = parseInt(row?.failing ?? "0", 10);
    webNeverDelivered = parseInt(row?.never_delivered ?? "0", 10);
  } catch (err) {
    log?.warn({ err }, "push_subscriptions count query failed");
  }
  try {
    const r = await pool.query<{ active: string; inactive: string }>(
      `SELECT
         count(*) FILTER (WHERE is_active = true)::text AS active,
         count(*) FILTER (WHERE is_active = false)::text AS inactive
       FROM expo_push_tokens`,
    );
    expoActive = parseInt(r.rows[0]?.active ?? "0", 10);
    expoInactive = parseInt(r.rows[0]?.inactive ?? "0", 10);
  } catch (err) {
    log?.warn({ err }, "expo_push_tokens count query failed");
  }

  // ── Recent dispatch outcomes (last 24h) ──
  let recentDispatch = { sent: 0, failed: 0, deactivated: 0, deliveryRate: 0, dispatches: 0 };
  try {
    const r = await pool.query<{
      sent: string; failed: string; deactivated: string; total: string; dispatches: string;
    }>(
      `SELECT
         COALESCE(SUM(sent), 0)::text         AS sent,
         COALESCE(SUM(failed), 0)::text       AS failed,
         COALESCE(SUM(deactivated), 0)::text  AS deactivated,
         COALESCE(SUM(total_attempted), 0)::text AS total,
         COUNT(*)::text                       AS dispatches
       FROM push_dispatch_log
       WHERE dispatched_at >= NOW() - INTERVAL '24 hours'`,
    );
    const row = r.rows[0];
    const sent = parseInt(row?.sent ?? "0", 10);
    const failed = parseInt(row?.failed ?? "0", 10);
    const deactivated = parseInt(row?.deactivated ?? "0", 10);
    const total = parseInt(row?.total ?? "0", 10);
    recentDispatch = {
      sent,
      failed,
      deactivated,
      deliveryRate: total > 0 ? sent / total : 0,
      dispatches: parseInt(row?.dispatches ?? "0", 10),
    };
  } catch (err) {
    log?.warn({ err }, "push_dispatch_log summary query failed");
  }

  return {
    vapid: vapidReport,
    expo: expoReport,
    webSubscribers: {
      active: webActive,
      inactive: webInactive,
      failing: webFailing,
      neverDelivered: webNeverDelivered,
    },
    expoTokens: { active: expoActive, inactive: expoInactive },
    recentDispatch,
  };
}

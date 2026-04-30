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

export function initVapidKeys(log?: Logger): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    const keys = webpush.generateVAPIDKeys();
    log?.warn(
      {
        VAPID_PUBLIC_KEY: keys.publicKey,
        VAPID_PRIVATE_KEY: keys.privateKey,
      },
      "VAPID keys not set — auto-generated (set these as environment variables for production)"
    );
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  }

  webpush.setVapidDetails(
    "mailto:info@jctm.org.ng",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
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
    title: `🔴 ${title || "Warri Crusade Day 1"} — Live`,
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
    title: "⏰ Warri Crusade Day 1 — Live",
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
    title: "Warri Crusade Day 1 Begins Soon",
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
    const subscriptions = await pool.query<{
      endpoint: string;
      p256dh: string;
      auth: string;
    }>(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE is_active = true`
    );

    if (subscriptions.rows.length === 0) {
      log?.info("No active push subscribers — skipping dispatch");
      return { sent: 0, failed: 0, deactivated: 0 };
    }

    log?.info({ count: subscriptions.rows.length, title: notification.title }, "Dispatching push notifications");

    const payload = JSON.stringify(notification);

    // Track endpoints that fail with transient errors (5xx, network) so we
    // can retry once after a short delay. 4xx (other than 410/404 which
    // deactivate) and 429 (rate limit) are not retried — they would just
    // fail again immediately.
    const transientRetry: Array<{ endpoint: string; p256dh: string; auth: string }> = [];

    const isTransient = (status: number | undefined, err: unknown): boolean => {
      if (status && status >= 500 && status < 600) return true;
      if (status === 408) return true;
      const code = (err as { code?: string }).code;
      if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "EAI_AGAIN") return true;
      return false;
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
          { TTL: 3600 }
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await pool.query(
            `UPDATE push_subscriptions SET is_active = false WHERE endpoint = $1`,
            [sub.endpoint]
          );
          deactivated++;
        } else if (!isRetry && isTransient(status, err)) {
          transientRetry.push(sub);
        } else {
          failed++;
          log?.warn({ err, endpoint: sub.endpoint.slice(0, 40), isRetry }, "Push notification failed");
        }
      }
    };

    await Promise.allSettled(subscriptions.rows.map((sub) => sendOnce(sub, false)));

    // Retry transient failures once after a short backoff so the affected
    // endpoints have a chance to recover (e.g. brief 5xx blips at the push
    // service edge).
    if (transientRetry.length > 0) {
      log?.info({ count: transientRetry.length }, "Retrying transient push failures after 3s");
      await new Promise((r) => setTimeout(r, 3000));
      await Promise.allSettled(transientRetry.map((sub) => sendOnce(sub, true)));
    }

    log?.info({ sent, failed, deactivated, retried: transientRetry.length }, "Push dispatch complete");
  } catch (err) {
    log?.error({ err }, "Push dispatch system error");
  }

  await logDispatch(notification.title, notificationType, { sent, failed, deactivated });

  return { sent, failed, deactivated };
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
  };
  expoTokens: {
    active: number;
    inactive: number;
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
  let expoActive = 0;
  let expoInactive = 0;
  try {
    const r = await pool.query<{ active: string; inactive: string }>(
      `SELECT
         count(*) FILTER (WHERE is_active = true)::text AS active,
         count(*) FILTER (WHERE is_active = false)::text AS inactive
       FROM push_subscriptions`,
    );
    webActive = parseInt(r.rows[0]?.active ?? "0", 10);
    webInactive = parseInt(r.rows[0]?.inactive ?? "0", 10);
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

  return {
    vapid: vapidReport,
    expo: expoReport,
    webSubscribers: { active: webActive, inactive: webInactive },
    expoTokens: { active: expoActive, inactive: expoInactive },
  };
}

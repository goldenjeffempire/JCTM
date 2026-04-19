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
    title: "🔴 JCTM is LIVE NOW",
    body: title ?? "Sunday Service is live! Join thousands worshipping worldwide.",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    url: "/",
    tag: "live-service",
    data: { type: "live_service", timestamp: new Date().toISOString() },
  };
}

export function buildRebroadcastNotification(sermonTitle: string): NotificationPayload {
  return {
    title: "📺 Temple TV — Rebroadcast",
    body: `Now playing: "${sermonTitle}" — Watch now on Temple TV`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    url: "/",
    tag: "rebroadcast",
    data: { type: "rebroadcast", timestamp: new Date().toISOString() },
  };
}

export function buildServiceReminderNotification(minutesBefore: number): NotificationPayload {
  return {
    title: "⏰ Sunday Service Starting Soon",
    body: `The live service begins in ${minutesBefore} minutes. Prepare your heart and join us!`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    url: "/",
    tag: "service-reminder",
    data: { type: "service_reminder", minutesBefore, timestamp: new Date().toISOString() },
  };
}

export function buildUpcomingServiceNotification(): NotificationPayload {
  return {
    title: "Holy Spirit Sunday Service Begins Soon",
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

export async function dispatchPushNotification(
  notification: NotificationPayload,
  log?: Logger
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

    const promises = subscriptions.rows.map(async (sub) => {
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
        } else {
          failed++;
          log?.warn({ err, endpoint: sub.endpoint.slice(0, 40) }, "Push notification failed");
        }
      }
    });

    await Promise.allSettled(promises);

    log?.info({ sent, failed, deactivated }, "Push dispatch complete");
  } catch (err) {
    log?.error({ err }, "Push dispatch system error");
  }

  return { sent, failed, deactivated };
}

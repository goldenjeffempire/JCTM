/**
 * Push Notification Routes
 *
 * Handles PWA push subscription lifecycle:
 *  POST /api/push/subscribe   — Register a push subscription
 *  DELETE /api/push/unsubscribe — Remove a push subscription
 *  GET  /api/push/vapid-key   — Get the VAPID public key for SW registration
 *  POST /api/push/test        — Admin: send a test notification (admin only)
 */

import { Router, type IRouter } from "express";
import {
  getVapidPublicKey,
  storeSubscription,
  removeSubscription,
  getSubscriberCount,
  dispatchPushNotification,
  buildLiveServiceNotification,
  buildUpcomingServiceNotification,
} from "../lib/push-manager.js";
import { requireAdminRole } from "../lib/adminAuth.js";
import { pool } from "@workspace/db";

const router: IRouter = Router();

// ─── GET /push/vapid-key ──────────────────────────────────────────────────────

router.get("/push/vapid-key", (_req, res): void => {
  try {
    const publicKey = getVapidPublicKey();
    res.json({ publicKey });
  } catch {
    res.status(503).json({ error: "Push notifications not configured" });
  }
});

// ─── POST /push/subscribe ─────────────────────────────────────────────────────

router.post("/push/subscribe", async (req, res): Promise<void> => {
  const { subscription, deviceType, visitorId } = req.body as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    deviceType?: string;
    visitorId?: string;
  };

  if (
    !subscription?.endpoint ||
    !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth
  ) {
    res.status(400).json({ error: "Invalid push subscription object" });
    return;
  }

  try {
    const { id, isNew } = await storeSubscription(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      deviceType ?? "web",
      visitorId,
      req.log
    );

    res.status(isNew ? 201 : 200).json({
      success: true,
      id,
      message: isNew ? "Subscribed to Holy Spirit Sunday Service — Live alerts" : "Subscription refreshed",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to store push subscription");
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

// ─── DELETE /push/unsubscribe ─────────────────────────────────────────────────

router.delete("/push/unsubscribe", async (req, res): Promise<void> => {
  const { endpoint } = req.body as { endpoint?: string };

  if (!endpoint) {
    res.status(400).json({ error: "endpoint required" });
    return;
  }

  await removeSubscription(endpoint, req.log);
  res.json({ success: true, message: "Unsubscribed from notifications" });
});

// ─── GET /push/stats ──────────────────────────────────────────────────────────

router.get("/push/stats", async (_req, res): Promise<void> => {
  const count = await getSubscriberCount();
  res.json({ subscribers: count });
});

// ─── GET /push/growth — daily subscriber growth (last 60 days) ───────────────

router.get("/push/growth", async (_req, res): Promise<void> => {
  try {
    const result = await pool.query<{ date: string; new_subscribers: string; cumulative: string }>(`
      WITH daily AS (
        SELECT
          date_trunc('day', created_at)::date AS date,
          COUNT(*) AS new_subscribers
        FROM push_subscriptions
        WHERE created_at >= now() - INTERVAL '60 days'
        GROUP BY 1
      ),
      filled AS (
        SELECT
          gs::date AS date,
          COALESCE(d.new_subscribers, 0) AS new_subscribers
        FROM generate_series(
          (now() - INTERVAL '59 days')::date,
          now()::date,
          INTERVAL '1 day'
        ) AS gs
        LEFT JOIN daily d ON d.date = gs::date
      )
      SELECT
        to_char(date, 'Mon DD') AS date,
        new_subscribers::text,
        SUM(new_subscribers) OVER (ORDER BY date)::text AS cumulative
      FROM filled
      ORDER BY date
    `);

    res.json({ growth: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch growth data" });
  }
});

// ─── GET /push/devices — active subscriber count by device type ───────────────

router.get("/push/devices", async (_req, res): Promise<void> => {
  try {
    const result = await pool.query<{ device_type: string; count: string }>(`
      SELECT
        COALESCE(NULLIF(TRIM(device_type), ''), 'web') AS device_type,
        COUNT(*)::text AS count
      FROM push_subscriptions
      WHERE is_active = true
      GROUP BY 1
      ORDER BY 2 DESC
    `);

    const total = result.rows.reduce((s, r) => s + parseInt(r.count, 10), 0);

    const devices = result.rows.map(r => ({
      type: r.device_type,
      count: parseInt(r.count, 10),
      pct: total > 0 ? Math.round((parseInt(r.count, 10) / total) * 100) : 0,
    }));

    res.json({ total, devices });
  } catch {
    res.status(500).json({ error: "Failed to fetch device breakdown" });
  }
});

// ─── GET /push/delivery-log — recent dispatch history ────────────────────────

router.get("/push/delivery-log", requireAdminRole("livestream"), async (_req, res): Promise<void> => {
  try {
    const result = await pool.query<{
      id: string;
      notification_title: string;
      notification_type: string;
      sent: string;
      failed: string;
      deactivated: string;
      total_attempted: string;
      delivery_rate: string;
      dispatched_at: string;
    }>(`
      SELECT id, notification_title, notification_type,
             sent, failed, deactivated, total_attempted,
             ROUND(delivery_rate::numeric * 100, 1)::text AS delivery_rate,
             dispatched_at
      FROM push_dispatch_log
      ORDER BY dispatched_at DESC
      LIMIT 20
    `);

    res.json({ log: result.rows });
  } catch {
    res.status(500).json({ error: "Failed to fetch delivery log" });
  }
});

// ─── POST /push/test ─────────────────────────────────────────────────────────

router.post("/push/test", async (req, res): Promise<void> => {
  const { title } = req.body as { title?: string };

  const notification = buildLiveServiceNotification(
    title ?? "Test notification from JCTM Temple TV"
  );
  notification.title = "🔔 JCTM Test Notification";
  notification.body = title ?? "This is a test push notification from Temple TV Admin.";

  const result = await dispatchPushNotification(notification, req.log, "test");
  res.json({ success: true, ...result });
});

router.post("/push/upcoming-service", requireAdminRole("livestream"), async (req, res): Promise<void> => {
  const notification = buildUpcomingServiceNotification();
  const result = await dispatchPushNotification(notification, req.log, "service_alert");
  const subscribers = await getSubscriberCount();
  res.json({ success: true, subscribers, ...result });
});

// ─── POST /push/broadcast — Admin: send a custom push to all subscribers ──────

router.post("/push/broadcast", requireAdminRole("livestream"), async (req, res): Promise<void> => {
  const { title, body } = req.body as { title?: string; body?: string };

  if (!title || !body) {
    res.status(400).json({ error: "title and body are required" });
    return;
  }

  const notification = {
    title: title.trim(),
    body: body.trim(),
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    url: "/",
    tag: "admin-broadcast",
    requireInteraction: false,
    data: { type: "admin_broadcast", timestamp: new Date().toISOString() },
  };

  const result = await dispatchPushNotification(notification, req.log, "broadcast");
  const subscribers = await getSubscriberCount();
  res.json({ success: true, subscribers, ...result });
});

export default router;

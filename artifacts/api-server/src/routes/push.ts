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
  buildServiceReminderNotification,
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
      message: isNew ? "Subscribed to Warri Crusade Day 1 alerts" : "Subscription refreshed",
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

// ─── POST /push/track-click — record a notification click ───────────────────

router.post("/push/track-click", async (req, res): Promise<void> => {
  const { broadcastType, targetUrl, visitorId } = req.body as {
    broadcastType?: string;
    targetUrl?: string;
    visitorId?: string;
  };
  if (!broadcastType || !targetUrl) {
    res.status(400).json({ error: "broadcastType and targetUrl required" });
    return;
  }
  try {
    await pool.query(
      `INSERT INTO notification_clicks (broadcast_type, target_url, visitor_id) VALUES ($1, $2, $3)`,
      [broadcastType.slice(0, 64), targetUrl.slice(0, 512), visitorId?.slice(0, 128) ?? null]
    );
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to record notification click");
    res.status(500).json({ error: "Failed to record click" });
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

// ─── POST /push/live-now — Admin: manually fire the "Live Now" alert ─────────
// Used when the broadcast is already live (or about to be) and the admin wants
// to nudge subscribers directly. Accepts an optional title override; falls back
// to "Warri Crusade Day 1" via the notification builder.

router.post("/push/live-now", requireAdminRole("livestream"), async (req, res): Promise<void> => {
  const { title } = (req.body ?? {}) as { title?: string };
  const safeTitle = typeof title === "string" ? title.trim().slice(0, 120) : "";
  const notification = buildLiveServiceNotification(safeTitle);
  const result = await dispatchPushNotification(notification, req.log, "live_alert");
  const subscribers = await getSubscriberCount();
  req.log.info({ title: safeTitle || "Warri Crusade Day 1" }, "Manual Live Now alert dispatched by admin");
  res.json({ success: true, subscribers, ...result });
});

// ─── POST /push/service-reminder — Admin: manually fire a countdown reminder ─
// Sends a "Live in N minutes" reminder. `minutesBefore` defaults to 15 and is
// clamped to a sane 1–180 minute window so accidental admin input cannot send
// a confusing payload.

router.post("/push/service-reminder", requireAdminRole("livestream"), async (req, res): Promise<void> => {
  const { minutesBefore } = (req.body ?? {}) as { minutesBefore?: number };
  const raw = Number(minutesBefore);
  const minutes = Number.isFinite(raw) ? Math.min(180, Math.max(1, Math.round(raw))) : 15;
  const notification = buildServiceReminderNotification(minutes);
  const result = await dispatchPushNotification(notification, req.log, "service_reminder");
  const subscribers = await getSubscriberCount();
  req.log.info({ minutesBefore: minutes }, "Manual service reminder dispatched by admin");
  res.json({ success: true, subscribers, minutesBefore: minutes, ...result });
});

// ─── POST /push/expo-register — Store an Expo Push Token from a mobile device ─
// Tokens look like: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
// Uses the Expo Push API (not WebPush/VAPID) so a separate table is used.

router.post("/push/expo-register", async (req, res): Promise<void> => {
  const { token, platform, deviceId } = req.body as {
    token?: string;
    platform?: string;
    deviceId?: string;
  };

  if (!token || typeof token !== "string" || !token.startsWith("ExponentPushToken[")) {
    res.status(400).json({ error: "A valid Expo push token is required" });
    return;
  }

  const safeToken    = token.trim().slice(0, 200);
  const safePlatform = (platform ?? "unknown").slice(0, 20);
  const safeDevice   = (deviceId ?? null)?.slice(0, 100) ?? null;

  try {
    await pool.query(
      `INSERT INTO expo_push_tokens (token, platform, device_id, is_active, updated_at)
       VALUES ($1, $2, $3, true, now())
       ON CONFLICT (token) DO UPDATE
         SET is_active  = true,
             platform   = EXCLUDED.platform,
             device_id  = COALESCE(EXCLUDED.device_id, expo_push_tokens.device_id),
             updated_at = now()`,
      [safeToken, safePlatform, safeDevice]
    );

    res.status(200).json({
      success: true,
      message: "Registered for crusade and service alerts",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to store Expo push token");
    res.status(500).json({ error: "Failed to register for notifications" });
  }
});

// ─── DELETE /push/expo-unregister — Opt a device out ─────────────────────────

router.delete("/push/expo-unregister", async (req, res): Promise<void> => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: "token required" });
    return;
  }
  try {
    await pool.query(
      `UPDATE expo_push_tokens SET is_active = false, updated_at = now() WHERE token = $1`,
      [token.trim().slice(0, 200)]
    );
    res.json({ success: true, message: "Unregistered from notifications" });
  } catch (err) {
    req.log.error({ err }, "Failed to deregister Expo push token");
    res.status(500).json({ error: "Failed to unregister" });
  }
});

// ─── GET /push/expo-stats — Count of active Expo devices ─────────────────────

router.get("/push/expo-stats", async (_req, res): Promise<void> => {
  try {
    const [tokensResult, receiptsResult] = await Promise.all([
      pool.query<{ platform: string; count: string }>(
        `SELECT COALESCE(platform, 'unknown') AS platform, COUNT(*)::text AS count
         FROM expo_push_tokens WHERE is_active = true
         GROUP BY 1 ORDER BY 2 DESC`,
      ),
      pool.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::text AS count
         FROM expo_push_receipts
         WHERE sent_at > now() - INTERVAL '7 days'
         GROUP BY 1`,
      ),
    ]);

    const total = tokensResult.rows.reduce((s, r) => s + parseInt(r.count, 10), 0);
    const receiptSummary = Object.fromEntries(
      receiptsResult.rows.map((r) => [r.status, parseInt(r.count, 10)]),
    );

    res.json({
      tokens: { total, breakdown: tokensResult.rows },
      receipts: {
        last7Days: receiptSummary,
        deliveryRate: receiptSummary.ok && (receiptSummary.ok + (receiptSummary.error ?? 0)) > 0
          ? Math.round((receiptSummary.ok / (receiptSummary.ok + (receiptSummary.error ?? 0))) * 100)
          : null,
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch Expo push stats" });
  }
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

// ─── POST /push/expo-test — Admin: send a test push to all active Expo devices ─

router.post("/push/expo-test", requireAdminRole("livestream"), async (req, res): Promise<void> => {
  try {
    const { title = "JCTM Mobile — Test Notification", body = "Your push notifications are working correctly." } =
      req.body as { title?: string; body?: string };

    // Fetch active tokens
    const tokensResult = await pool.query<{ token: string }>(
      `SELECT token FROM expo_push_tokens WHERE is_active = true ORDER BY created_at DESC LIMIT 1000`,
    );

    if (tokensResult.rows.length === 0) {
      res.json({ success: true, sent: 0, message: "No active Expo devices registered" });
      return;
    }

    // Send via Expo Push API (batch of up to 100)
    const CHUNK = 100;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < tokensResult.rows.length; i += CHUNK) {
      const chunk = tokensResult.rows.slice(i, i + CHUNK);
      const messages = chunk.map(({ token }) => ({
        to: token,
        title: title.trim(),
        body: body.trim(),
        sound: "default",
        priority: "high",
        data: { type: "admin_test", timestamp: new Date().toISOString() },
      }));

      try {
        const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(messages),
        });
        if (expoRes.ok) {
          const json = await expoRes.json() as { data?: Array<{ status: string; id?: string }> };
          const ticketRows: Array<[string, string, string]> = [];
          json.data?.forEach((ticket, idx) => {
            if (ticket.status === "ok" && ticket.id) {
              sent++;
              ticketRows.push([ticket.id, chunk[idx]!.token, title.trim()]);
            } else {
              failed++;
            }
          });
          if (ticketRows.length > 0) {
            const placeholders = ticketRows
              .map((_, ri) => `($${ri * 3 + 1}, $${ri * 3 + 2}, $${ri * 3 + 3})`)
              .join(", ");
            await pool.query(
              `INSERT INTO expo_push_receipts (ticket_id, token, title) VALUES ${placeholders} ON CONFLICT (ticket_id) DO NOTHING`,
              ticketRows.flat(),
            );
          }
        } else {
          failed += chunk.length;
        }
      } catch {
        failed += chunk.length;
      }
    }

    req.log.info({ sent, failed, title }, "Expo test push dispatched by admin");
    res.json({ success: true, sent, failed, total: tokensResult.rows.length });
  } catch (err) {
    req.log.error({ err }, "Expo test push failed");
    res.status(500).json({ error: "Failed to send Expo test push" });
  }
});

export default router;

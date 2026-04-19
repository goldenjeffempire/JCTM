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
      message: isNew ? "Subscribed to live service alerts" : "Subscription refreshed",
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

// ─── POST /push/test ─────────────────────────────────────────────────────────

router.post("/push/test", async (req, res): Promise<void> => {
  const { title } = req.body as { title?: string };

  const notification = buildLiveServiceNotification(
    title ?? "Test notification from JCTM Temple TV"
  );
  notification.title = "🔔 JCTM Test Notification";
  notification.body = title ?? "This is a test push notification from Temple TV Admin.";

  const result = await dispatchPushNotification(notification, req.log);
  res.json({ success: true, ...result });
});

router.post("/push/upcoming-service", requireAdminRole("livestream"), async (req, res): Promise<void> => {
  const notification = buildUpcomingServiceNotification();
  const result = await dispatchPushNotification(notification, req.log);
  const subscribers = await getSubscriberCount();
  res.json({ success: true, subscribers, ...result });
});

export default router;

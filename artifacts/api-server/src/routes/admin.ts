/**
 * Admin Routes — Protected management endpoints
 *
 * Management endpoints require role-based admin authorization.
 * Provides metrics, content management, feedback review, and blog generation.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db, sermonsTable, aiFeedbackTable, blogPostsTable } from "@workspace/db";
import { desc, count, avg, sql, eq } from "drizzle-orm";
import { generateBlogPost, BLOG_TOPICS } from "../lib/blog-generator.js";
import { generateSermonTranscriptSummary } from "../lib/blog-generator.js";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { getVisitorRealtimeSnapshot } from "./visitors.js";
import { getLiveAudienceSnapshot } from "./livestream.js";
import { requireAdminRole } from "../lib/adminAuth.js";
import { broadcastWarriCrusadeManual, broadcastWarriCrusadeLiveAlert, getCronState } from "../lib/cron.js";
import { getPlatformHealth } from "../lib/platform-monitor.js";
import {
  getPlatformMetrics,
  getOptimalNotificationTime,
  getPersonalizedRecommendations,
  predictEngagement,
} from "../lib/analytics-ai.js";
import {
  dispatchPushNotification,
  cleanupStalePushSubscriptions,
  type NotificationPayload,
} from "../lib/push-manager.js";
import webpush from "web-push";

// Statuses that mean the subscription itself is permanently dead. Mirrors
// PERMANENT_FAILURE_STATUSES inside push-manager so the admin test endpoint
// retires endpoints under exactly the same conditions as the bulk dispatcher.
const PERMANENT_PUSH_FAILURE_STATUSES = new Set<number>([400, 401, 403, 404, 410, 413]);

const router: IRouter = Router();
const requireAnyRoleAdmin = requireAdminRole(["gallery", "sermon", "livestream"]);

async function getAudienceEngagementSnapshot() {
  const [
    messages24h,
    conversations24h,
    prayers24h,
    testimonies24h,
    momentLikes24h,
    momentComments24h,
    momentShares,
    broadcastEvents24h,
    members24h,
    pushSubscribers,
  ] = await Promise.all([
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM messages WHERE created_at >= NOW() - INTERVAL '24 hours'"),
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM conversations WHERE created_at >= NOW() - INTERVAL '24 hours'"),
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM prayer_requests WHERE created_at >= NOW() - INTERVAL '24 hours'"),
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM testimonies WHERE created_at >= NOW() - INTERVAL '24 hours'"),
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM moment_likes WHERE created_at >= NOW() - INTERVAL '24 hours'"),
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM moment_comments WHERE created_at >= NOW() - INTERVAL '24 hours'"),
    pool.query<{ count: string }>("SELECT COALESCE(SUM(share_count), 0)::text AS count FROM moment_engagements"),
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM broadcast_events WHERE fired_at >= NOW() - INTERVAL '24 hours'"),
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM member_auth WHERE created_at >= NOW() - INTERVAL '24 hours'"),
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM push_subscriptions WHERE is_active = true"),
  ]);

  const values = {
    aiMessages24h: Number(messages24h.rows[0]?.count ?? 0),
    conversations24h: Number(conversations24h.rows[0]?.count ?? 0),
    prayerRequests24h: Number(prayers24h.rows[0]?.count ?? 0),
    testimonies24h: Number(testimonies24h.rows[0]?.count ?? 0),
    momentLikes24h: Number(momentLikes24h.rows[0]?.count ?? 0),
    momentComments24h: Number(momentComments24h.rows[0]?.count ?? 0),
    momentSharesTotal: Number(momentShares.rows[0]?.count ?? 0),
    broadcastEvents24h: Number(broadcastEvents24h.rows[0]?.count ?? 0),
    newMembers24h: Number(members24h.rows[0]?.count ?? 0),
    pushSubscribers: Number(pushSubscribers.rows[0]?.count ?? 0),
  };

  return {
    ...values,
    interactions24h:
      values.aiMessages24h +
      values.prayerRequests24h +
      values.testimonies24h +
      values.momentLikes24h +
      values.momentComments24h +
      values.broadcastEvents24h +
      values.newMembers24h,
  };
}

async function getRealtimeDashboardSnapshot() {
  const [visitors, engagement] = await Promise.all([
    getVisitorRealtimeSnapshot(),
    getAudienceEngagementSnapshot(),
  ]);
  const live = getLiveAudienceSnapshot();
  const activeAudience = visitors.active + live.viewers;

  return {
    type: "dashboard_realtime",
    live,
    visitors,
    engagement: {
      ...engagement,
      activeAudience,
      engagementDensity: activeAudience > 0 ? Number((engagement.interactions24h / activeAudience).toFixed(2)) : 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

router.get("/admin/realtime", requireAnyRoleAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(await getRealtimeDashboardSnapshot());
  } catch (err) {
    logger.error({ err }, "Realtime dashboard snapshot failed");
    res.status(500).json({ error: "Failed to fetch realtime dashboard" });
  }
});

router.get("/admin/realtime/stream", requireAnyRoleAdmin, async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = async () => {
    try {
      res.write(`data: ${JSON.stringify(await getRealtimeDashboardSnapshot())}\n\n`);
    } catch (err) {
      logger.warn({ err }, "Realtime dashboard stream write failed");
    }
  };

  await send();
  const interval = setInterval(send, 5_000);
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 20_000);

  req.on("close", () => {
    clearInterval(interval);
    clearInterval(heartbeat);
  });
});

// ── GET /api/admin/metrics ────────────────────────────────────────────────────
router.get(
  "/admin/metrics",
  requireAnyRoleAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const [sermonCount] = await db.select({ count: count() }).from(sermonsTable);
      const [blogCount] = await db.select({ count: count() }).from(blogPostsTable);
      const [feedbackStats] = await db
        .select({
          total: count(),
          avgRating: avg(aiFeedbackTable.rating),
          avgLatency: avg(aiFeedbackTable.latencyMs),
        })
        .from(aiFeedbackTable);

      const memberCount = await pool.query<{ count: string }>(
        "SELECT COUNT(*) as count FROM member_auth",
      );
      const conversationCount = await pool.query<{ count: string }>(
        "SELECT COUNT(*) as count FROM conversations",
      );
      const testimoniesCount = await pool.query<{ count: string }>(
        "SELECT COUNT(*) as count FROM testimonies",
      );

      const tierBreakdown = await db
        .select({
          tier: aiFeedbackTable.modelTier,
          count: count(),
        })
        .from(aiFeedbackTable)
        .groupBy(aiFeedbackTable.modelTier);

      res.json({
        platform: {
          sermons: sermonCount?.count ?? 0,
          blogs: blogCount?.count ?? 0,
          members: Number(memberCount.rows[0]?.count ?? 0),
          conversations: Number(conversationCount.rows[0]?.count ?? 0),
          testimonies: Number(testimoniesCount.rows[0]?.count ?? 0),
        },
        ai: {
          totalFeedback: feedbackStats?.total ?? 0,
          averageRating: feedbackStats?.avgRating ? Number(feedbackStats.avgRating).toFixed(2) : null,
          averageLatencyMs: feedbackStats?.avgLatency ? Number(feedbackStats.avgLatency).toFixed(0) : null,
          tierBreakdown: tierBreakdown.reduce(
            (acc, r) => ({ ...acc, [String(r.tier ?? "unknown")]: r.count }),
            {} as Record<string, number>,
          ),
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error({ err }, "Admin metrics failed");
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  },
);

// ── GET /api/admin/feedback ───────────────────────────────────────────────────
router.get(
  "/admin/feedback",
  requireAnyRoleAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const offset = Number(req.query.offset ?? 0);

      const items = await db
        .select()
        .from(aiFeedbackTable)
        .orderBy(desc(aiFeedbackTable.createdAt))
        .limit(limit)
        .offset(offset);

      res.json({ items, limit, offset });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  },
);

// ── POST /api/admin/blog/generate ─────────────────────────────────────────────
router.post(
  "/admin/blog/generate",
  requireAdminRole("sermon"),
  async (req: Request, res: Response): Promise<void> => {
    const { topicIndex, topic: requestedTopic } = req.body as { topicIndex?: number; topic?: string };

    if (
      topicIndex !== undefined &&
      (!Number.isInteger(topicIndex) || topicIndex < 0 || topicIndex >= BLOG_TOPICS.length)
    ) {
      res.status(400).json({ error: "Invalid topic index" });
      return;
    }

    const topic: typeof BLOG_TOPICS[0] =
      typeof requestedTopic === "string" && requestedTopic.trim()
        ? { title: requestedTopic.trim(), category: "general", tags: [] }
        : topicIndex !== undefined
          ? BLOG_TOPICS[topicIndex]
          : BLOG_TOPICS[Math.floor(Math.random() * BLOG_TOPICS.length)];

    if (!topic) {
      res.status(400).json({ error: "Invalid topic index" });
      return;
    }

    try {
      const post = await generateBlogPost(topic);

      const [existing] = await db
        .select({ id: blogPostsTable.id })
        .from(blogPostsTable)
        .where(eq(blogPostsTable.slug, post.slug));

      if (existing) {
        res.status(409).json({ error: "Blog post with this slug already exists", slug: post.slug });
        return;
      }

      const [inserted] = await db.insert(blogPostsTable).values({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        topic: post.topic,
        category: post.category,
        tags: post.tags,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        schemaJson: post.schemaJson,
        published: true,
        isPublished: true,
        publishedAt: new Date(),
      }).returning();

      res.json({ success: true, post: inserted });
    } catch (err) {
      logger.error({ err }, "Blog generation failed");
      res.status(500).json({ error: "Blog generation failed" });
    }
  },
);

// ── POST /api/admin/sermons/:id/index-transcript ───────────────────────────────
router.post(
  "/admin/sermons/:id/index-transcript",
  requireAdminRole("sermon"),
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid sermon ID" });
      return;
    }
    const [sermon] = await db
      .select({ title: sermonsTable.title, description: sermonsTable.description })
      .from(sermonsTable)
      .where(eq(sermonsTable.id, id));

    if (!sermon) {
      res.status(404).json({ error: "Sermon not found" });
      return;
    }

    try {
      const transcriptSummary = await generateSermonTranscriptSummary(
        sermon.title,
        sermon.description ?? "",
      );

      await pool.query(
        `UPDATE sermon_data SET transcript_summary = $1, updated_at = NOW() WHERE id = $2`,
        [transcriptSummary, id],
      );

      await pool.query(
        `INSERT INTO knowledge_chunks (content, source, chunk_index)
         VALUES ($1, $2, 0)
         ON CONFLICT (source, chunk_index) DO UPDATE SET content = $1`,
        [transcriptSummary, `sermon-transcript-${id}`],
      );

      res.json({ success: true, sermonId: id, transcriptLength: transcriptSummary.length });
    } catch (err) {
      logger.error({ err }, "Transcript indexing failed");
      res.status(500).json({ error: "Transcript indexing failed" });
    }
  },
);

// ── POST /api/admin/sermons/:videoId/pin ─────────────────────────────────────
// Manually pin a sermon as the featured / Latest Broadcast. The pin overrides
// the daily YouTube auto-promotion of the most recently published video, so
// admins can spotlight the right service when YouTube uploads land out of
// order or when there are duplicate uploads of the same broadcast.
router.post(
  "/admin/sermons/:videoId/pin",
  requireAdminRole("sermon"),
  async (req: Request, res: Response): Promise<void> => {
    const { videoId } = req.params;
    if (!videoId || typeof videoId !== "string" || videoId.length > 32) {
      res.status(400).json({ error: "Invalid videoId" });
      return;
    }
    try {
      const result = await pool.query<{ id: number; video_id: string; title: string; pinned_at: Date }>(
        `UPDATE sermon_data
            SET pinned_at = NOW(),
                is_featured = TRUE,
                broadcast_ended_at = NOW()
          WHERE video_id = $1
          RETURNING id, video_id, title, pinned_at`,
        [videoId],
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Sermon not found for that videoId" });
        return;
      }
      // Clear pins on every other sermon so only one is pinned at a time.
      await pool.query(
        `UPDATE sermon_data SET pinned_at = NULL WHERE video_id <> $1 AND pinned_at IS NOT NULL`,
        [videoId],
      );
      logger.info({ videoId, sermonId: result.rows[0].id }, "Sermon pinned by admin");
      res.json({ success: true, pinned: result.rows[0] });
    } catch (err) {
      logger.error({ err, videoId }, "Pin sermon failed");
      res.status(500).json({ error: "Pin failed" });
    }
  },
);

// ── POST /api/admin/sermons/:videoId/unpin ───────────────────────────────────
router.post(
  "/admin/sermons/:videoId/unpin",
  requireAdminRole("sermon"),
  async (req: Request, res: Response): Promise<void> => {
    const { videoId } = req.params;
    if (!videoId || typeof videoId !== "string" || videoId.length > 32) {
      res.status(400).json({ error: "Invalid videoId" });
      return;
    }
    try {
      const result = await pool.query(
        `UPDATE sermon_data SET pinned_at = NULL WHERE video_id = $1 RETURNING id, video_id`,
        [videoId],
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Sermon not found for that videoId" });
        return;
      }
      logger.info({ videoId }, "Sermon unpinned by admin");
      res.json({ success: true });
    } catch (err) {
      logger.error({ err, videoId }, "Unpin sermon failed");
      res.status(500).json({ error: "Unpin failed" });
    }
  },
);

// ── GET /api/admin/members ────────────────────────────────────────────────────
router.get(
  "/admin/members",
  requireAnyRoleAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await pool.query(
        `SELECT id, email, first_name, last_name, role, created_at
         FROM member_auth
         ORDER BY created_at DESC
         LIMIT 100`,
      );
      res.json({ members: result.rows });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch members" });
    }
  },
);

// ── PATCH /api/admin/members/:id/role ─────────────────────────────────────────
router.patch(
  "/admin/members/:id/role",
  requireAnyRoleAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    const { role } = req.body as { role?: string };

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid member ID" });
      return;
    }

    if (!role || !["admin", "member", "moderator"].includes(role)) {
      res.status(400).json({ error: "Invalid role. Must be: admin, member, moderator" });
      return;
    }

    try {
      await pool.query(
        `UPDATE member_auth SET role = $1 WHERE id = $2`,
        [role, id],
      );
      res.json({ success: true, memberId: id, role });
    } catch (err) {
      res.status(500).json({ error: "Failed to update member role" });
    }
  },
);

// ── POST /api/admin/broadcast/send — generic one-off push to all subscribers ─
// In-memory cooldown lock keyed by exact title+body to prevent accidental
// double-sends from rapid clicks. 60-second window — long enough to absorb a
// burst, short enough to not block legitimate follow-up alerts.
const recentBroadcastLock = new Map<string, number>();
const BROADCAST_LOCK_MS = 60_000;

router.post(
  "/admin/broadcast/send",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body as {
      title?: string;
      body?: string;
      url?: string;
      requireInteraction?: boolean;
    };
    const title = (body.title ?? "").trim();
    const message = (body.body ?? "").trim();
    const url = (body.url ?? "").trim() || "/";
    const requireInteraction = !!body.requireInteraction;

    if (!title || title.length > 80) {
      res.status(400).json({ error: "title is required (max 80 chars)" });
      return;
    }
    if (!message || message.length > 240) {
      res.status(400).json({ error: "body is required (max 240 chars)" });
      return;
    }
    if (!url.startsWith("/") && !url.startsWith("http")) {
      res.status(400).json({ error: "url must start with / or http" });
      return;
    }

    // Cooldown check — same title + body within the lock window
    const lockKey = `${title}\u0000${message}`;
    const now = Date.now();
    const lastFiredAt = recentBroadcastLock.get(lockKey);
    if (lastFiredAt && now - lastFiredAt < BROADCAST_LOCK_MS) {
      const remainingMs = BROADCAST_LOCK_MS - (now - lastFiredAt);
      res.status(429).json({
        success: false,
        error: "Cooldown active",
        reason: `An identical broadcast was sent ${Math.round((now - lastFiredAt) / 1000)}s ago. Try again in ${Math.ceil(remainingMs / 1000)}s.`,
        cooldownRemainingMs: remainingMs,
      });
      return;
    }

    // GC the lock map opportunistically
    for (const [k, t] of recentBroadcastLock.entries()) {
      if (now - t > BROADCAST_LOCK_MS) recentBroadcastLock.delete(k);
    }
    recentBroadcastLock.set(lockKey, now);

    try {
      const notif: NotificationPayload = {
        title,
        body: message,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-72x72.png",
        url,
        tag: "admin-broadcast",
        requireInteraction,
        data: {
          type: "admin_broadcast",
          broadcastType: "admin_broadcast",
          timestamp: new Date(now).toISOString(),
        },
      };

      // Log to broadcast_events so the SSE relay/missed-broadcast card sees it
      await pool.query(
        `INSERT INTO broadcast_events (type, title, message, url) VALUES ($1, $2, $3, $4)`,
        ["admin_broadcast", title, message, url]
      );

      const result = await dispatchPushNotification(notif, req.log, "admin_broadcast");
      req.log.info(
        { title, sent: result.sent, failed: result.failed, deactivated: result.deactivated },
        "Generic admin broadcast complete"
      );
      res.json({
        success: true,
        sent: result.sent,
        failed: result.failed,
        deactivated: result.deactivated,
        total: result.sent + result.failed + result.deactivated,
      });
    } catch (err) {
      // On failure, release the lock so the admin can retry
      recentBroadcastLock.delete(lockKey);
      req.log.error({ err }, "Generic admin broadcast failed");
      res.status(500).json({ error: "Failed to dispatch broadcast" });
    }
  }
);

// ── POST /api/admin/broadcast/test — preview push to admin's own browser ─────
// Sends the composed notification to a single endpoint (the admin's own
// browser subscription) so they can preview the actual on-device appearance
// before fanning out to all subscribers. NOT logged to broadcast_events or
// push_dispatch_log — this is a preview, not an audited broadcast. Per-endpoint
// 10-second cooldown to prevent rapid-fire notification spam at the admin's
// own device.
const recentTestLock = new Map<string, number>();
const TEST_LOCK_MS = 10_000;

router.post(
  "/admin/broadcast/test",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body as {
      title?: string;
      body?: string;
      url?: string;
      requireInteraction?: boolean;
      endpoint?: string;
    };
    const title = (body.title ?? "").trim();
    const message = (body.body ?? "").trim();
    const url = (body.url ?? "").trim() || "/";
    const requireInteraction = !!body.requireInteraction;
    const endpoint = (body.endpoint ?? "").trim();

    if (!title || title.length > 80) {
      res.status(400).json({ error: "title is required (max 80 chars)" });
      return;
    }
    if (!message || message.length > 240) {
      res.status(400).json({ error: "body is required (max 240 chars)" });
      return;
    }
    if (!endpoint || (!endpoint.startsWith("https://") && !endpoint.startsWith("http://"))) {
      res.status(400).json({
        error: "endpoint is required — enable notifications on this browser first",
      });
      return;
    }

    // Per-endpoint cooldown
    const now = Date.now();
    const lastFiredAt = recentTestLock.get(endpoint);
    if (lastFiredAt && now - lastFiredAt < TEST_LOCK_MS) {
      const remainingMs = TEST_LOCK_MS - (now - lastFiredAt);
      res.status(429).json({
        success: false,
        error: "Cooldown active",
        reason: `Please wait ${Math.ceil(remainingMs / 1000)}s before sending another test.`,
        cooldownRemainingMs: remainingMs,
      });
      return;
    }
    for (const [k, t] of recentTestLock.entries()) {
      if (now - t > TEST_LOCK_MS) recentTestLock.delete(k);
    }
    recentTestLock.set(endpoint, now);

    // Resolve the subscription from DB
    const { rows } = await pool.query<{ p256dh: string; auth: string }>(
      `SELECT p256dh, auth FROM push_subscriptions
        WHERE endpoint = $1 AND is_active = true
        LIMIT 1`,
      [endpoint],
    );
    if (rows.length === 0) {
      res.status(404).json({
        error: "Subscription not found — re-enable notifications on this browser",
      });
      return;
    }

    const sub = rows[0]!;
    const payload: NotificationPayload = {
      title: `[TEST] ${title}`.slice(0, 100),
      body: message,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      url,
      tag: "admin-broadcast-test",
      requireInteraction,
      data: {
        type: "admin_broadcast_test",
        broadcastType: "admin_broadcast_test",
        timestamp: new Date(now).toISOString(),
      },
    };

    try {
      await webpush.sendNotification(
        { endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 60 },
      );
      req.log.info({ endpointPrefix: endpoint.slice(0, 40), title }, "Admin test broadcast sent");
      res.json({ success: true });
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      // Release the cooldown on failure so the admin can retry immediately
      recentTestLock.delete(endpoint);
      if (status !== undefined && PERMANENT_PUSH_FAILURE_STATUSES.has(status)) {
        await pool.query(
          `UPDATE push_subscriptions
              SET is_active = false,
                  updated_at = now(),
                  deactivated_reason = $2,
                  last_failure_status = $3
            WHERE endpoint = $1`,
          [endpoint, `admin test: push service returned ${status}`, status],
        );
        const detail =
          status === 403
            ? "VAPID key mismatch — the browser must re-subscribe under the current VAPID public key."
            : status === 410 || status === 404
            ? "Subscription expired — re-enable notifications on this browser."
            : `Push service rejected this subscription (HTTP ${status}).`;
        res.status(410).json({ error: detail, status });
        return;
      }
      req.log.error({ err, status }, "Admin test broadcast failed");
      res.status(502).json({ error: "Push service rejected the test notification", status });
    }
  },
);

// ── POST /admin/push-subscriptions/cleanup — bulk-retire dead endpoints ─────
// Force a cleanup pass: deactivate any subscription that has crossed the
// failure threshold but somehow is still flagged active, plus any sub that
// hasn't successfully delivered in `staleDays` (default 60). Returns the
// before/after active counts so the admin sees the impact in one round-trip.
router.post(
  "/admin/push-subscriptions/cleanup",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const staleDaysRaw = req.body?.staleDays;
    const staleDays =
      typeof staleDaysRaw === "number" && staleDaysRaw >= 1 && staleDaysRaw <= 365
        ? Math.floor(staleDaysRaw)
        : 60;
    try {
      const before = await pool.query<{ active: string; inactive: string }>(
        `SELECT
            count(*) FILTER (WHERE is_active = true)::text  AS active,
            count(*) FILTER (WHERE is_active = false)::text AS inactive
          FROM push_subscriptions`,
      );
      const result = await cleanupStalePushSubscriptions(staleDays, req.log);
      const after = await pool.query<{ active: string; inactive: string }>(
        `SELECT
            count(*) FILTER (WHERE is_active = true)::text  AS active,
            count(*) FILTER (WHERE is_active = false)::text AS inactive
          FROM push_subscriptions`,
      );
      res.json({
        success: true,
        staleDays,
        retiredFailing: result.retiredFailing,
        retiredStale: result.retiredStale,
        before: {
          active: parseInt(before.rows[0]?.active ?? "0", 10),
          inactive: parseInt(before.rows[0]?.inactive ?? "0", 10),
        },
        after: {
          active: parseInt(after.rows[0]?.active ?? "0", 10),
          inactive: parseInt(after.rows[0]?.inactive ?? "0", 10),
        },
      });
    } catch (err) {
      req.log.error({ err }, "push-subscriptions cleanup failed");
      res.status(500).json({ error: "Cleanup failed" });
    }
  },
);

// ── Scheduled broadcasts ──────────────────────────────────────────────────────
// Admin can queue a notification to fire at a future time. The cron tick polls
// `scheduled_broadcasts` and dispatches due rows. These routes provide the
// list/create/cancel surface for the admin UI.

router.get(
  "/admin/scheduled-broadcasts",
  requireAdminRole("livestream"),
  async (_req: Request, res: Response): Promise<void> => {
    const { rows } = await pool.query(
      `SELECT id, title, body, url, require_interaction, scheduled_for, status,
              sent_at, sent_count, failed_count, deactivated_count, error,
              created_by, created_at
         FROM scheduled_broadcasts
        WHERE created_at > now() - interval '14 days'
        ORDER BY
          CASE status WHEN 'pending' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,
          scheduled_for ASC,
          created_at DESC
        LIMIT 100`,
    );
    res.json({ broadcasts: rows });
  },
);

router.post(
  "/admin/scheduled-broadcasts",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body as {
      title?: string;
      body?: string;
      url?: string;
      requireInteraction?: boolean;
      scheduledFor?: string;
    };
    const title = (body.title ?? "").trim();
    const message = (body.body ?? "").trim();
    const url = (body.url ?? "").trim() || "/";
    const requireInteraction = !!body.requireInteraction;
    const scheduledForRaw = (body.scheduledFor ?? "").trim();

    if (!title || title.length > 80) {
      res.status(400).json({ error: "title is required (max 80 chars)" });
      return;
    }
    if (!message || message.length > 240) {
      res.status(400).json({ error: "body is required (max 240 chars)" });
      return;
    }
    if (!url.startsWith("/") && !url.startsWith("http")) {
      res.status(400).json({ error: "url must start with / or http" });
      return;
    }
    const scheduledFor = new Date(scheduledForRaw);
    if (Number.isNaN(scheduledFor.getTime())) {
      res.status(400).json({ error: "scheduledFor must be a valid ISO datetime" });
      return;
    }
    // Must be at least 60 seconds in the future to give the per-minute cron a
    // chance to pick it up; otherwise it would fire on the very next tick which
    // is essentially "send now" and should use /admin/broadcast/send instead.
    if (scheduledFor.getTime() < Date.now() + 60_000) {
      res.status(400).json({ error: "scheduledFor must be at least 1 minute in the future" });
      return;
    }
    // Cap at 90 days out — sanity guard against accidental "schedule for 2099"
    if (scheduledFor.getTime() > Date.now() + 90 * 24 * 60 * 60 * 1000) {
      res.status(400).json({ error: "scheduledFor cannot be more than 90 days out" });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO scheduled_broadcasts
         (title, body, url, require_interaction, scheduled_for, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, body, url, require_interaction, scheduled_for, status, created_at`,
      [title, message, url, requireInteraction, scheduledFor.toISOString(), req.ip ?? null],
    );
    req.log.info({ id: rows[0]?.id, title, scheduledFor: scheduledFor.toISOString() }, "Scheduled broadcast queued");
    res.status(201).json({ success: true, broadcast: rows[0] });
  },
);

router.delete(
  "/admin/scheduled-broadcasts/:id",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const id = Number.parseInt(req.params.id ?? "", 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    // Only pending broadcasts can be cancelled. Processing/sent/failed rows
    // are immutable history.
    const { rows } = await pool.query(
      `UPDATE scheduled_broadcasts
          SET status = 'cancelled'
        WHERE id = $1 AND status = 'pending'
        RETURNING id, status`,
      [id],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: "Broadcast not found or not cancellable" });
      return;
    }
    req.log.info({ id }, "Scheduled broadcast cancelled");
    res.json({ success: true, id });
  },
);

// ── Broadcast Snippets (admin-saved reusable templates) ──────────────────────
// GET /api/admin/broadcast-snippets — list all saved snippets newest-first.
router.get(
  "/admin/broadcast-snippets",
  requireAdminRole("livestream"),
  async (_req: Request, res: Response): Promise<void> => {
    const { rows } = await pool.query(
      `SELECT id, name, title, body, url, require_interaction, created_at, updated_at
         FROM broadcast_snippets
        ORDER BY updated_at DESC`,
    );
    res.json({ snippets: rows });
  },
);

// POST /api/admin/broadcast-snippets — create or upsert a snippet by name.
router.post(
  "/admin/broadcast-snippets",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body as {
      name?: string;
      title?: string;
      body?: string;
      url?: string;
      requireInteraction?: boolean;
    };
    const name = (body.name ?? "").trim();
    const title = (body.title ?? "").trim();
    const message = (body.body ?? "").trim();
    const url = (body.url ?? "").trim() || "/";
    const requireInteraction = !!body.requireInteraction;

    if (!name || name.length > 60) {
      res.status(400).json({ error: "name is required (max 60 chars)" });
      return;
    }
    if (!title || title.length > 80) {
      res.status(400).json({ error: "title is required (max 80 chars)" });
      return;
    }
    if (!message || message.length > 240) {
      res.status(400).json({ error: "body is required (max 240 chars)" });
      return;
    }

    try {
      // Upsert on lowercased-name uniqueness — saving with the same name
      // overwrites the existing snippet, which matches user expectation.
      const { rows } = await pool.query(
        `INSERT INTO broadcast_snippets
           (name, title, body, url, require_interaction, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ((LOWER(name))) DO UPDATE
           SET name = EXCLUDED.name,
               title = EXCLUDED.title,
               body = EXCLUDED.body,
               url = EXCLUDED.url,
               require_interaction = EXCLUDED.require_interaction,
               updated_at = NOW()
         RETURNING id, name, title, body, url, require_interaction, created_at, updated_at`,
        [name, title, message, url, requireInteraction, `admin:${req.ip ?? "unknown"}`],
      );
      req.log.info({ id: rows[0]?.id, name }, "Broadcast snippet saved");
      res.json({ success: true, snippet: rows[0] });
    } catch (err: unknown) {
      req.log.error({ err }, "Failed to save broadcast snippet");
      res.status(500).json({ error: "Failed to save snippet" });
    }
  },
);

// DELETE /api/admin/broadcast-snippets/:id — remove a snippet.
router.delete(
  "/admin/broadcast-snippets/:id",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const id = Number.parseInt(req.params.id ?? "", 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const { rowCount } = await pool.query(
      `DELETE FROM broadcast_snippets WHERE id = $1`,
      [id],
    );
    if (!rowCount) {
      res.status(404).json({ error: "Snippet not found" });
      return;
    }
    req.log.info({ id }, "Broadcast snippet deleted");
    res.json({ success: true, id });
  },
);

// ── POST /api/admin/warri-crusade/broadcast-now ───────────────────────────────
router.post(
  "/admin/warri-crusade/broadcast-now",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const triggeredBy = `admin:${req.ip ?? "unknown"}`;
      const result = await broadcastWarriCrusadeManual(req.log, triggeredBy, 5);
      if (result.skipped) {
        res.status(429).json({
          success: false,
          ...result,
        });
        return;
      }
      res.json({ success: true, ...result });
    } catch (err) {
      req.log.error({ err }, "Manual Warri Crusade broadcast failed");
      res.status(500).json({ error: "Failed to dispatch broadcast" });
    }
  }
);

// ── POST /api/admin/warri-crusade/live-alert ──────────────────────────────────
// Fires a dedicated "Crusade is LIVE NOW" dual-channel alert:
//   - Web push (VAPID) with requireInteraction: true
//   - Expo mobile push to all registered app devices
// Uses a 2-minute cooldown to prevent accidental double-fires.
router.post(
  "/admin/warri-crusade/live-alert",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const triggeredBy = `admin:${req.ip ?? "unknown"}`;
      const result = await broadcastWarriCrusadeLiveAlert(req.log, triggeredBy, 2);
      if (result.skipped) {
        res.status(429).json({ success: false, ...result });
        return;
      }
      res.json({ success: true, ...result });
    } catch (err) {
      req.log.error({ err }, "Warri Crusade live alert failed");
      res.status(500).json({ error: "Failed to dispatch live alert" });
    }
  },
);

// ── GET /api/admin/warri-crusade/stats ────────────────────────────────────────
router.get(
  "/admin/warri-crusade/stats",
  requireAnyRoleAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const CAMPAIGN_END_ISO = "2026-05-01T20:00:00Z"; // 21:00 WAT == 20:00 UTC
      const NOTIF_TYPE = "warri_crusade_promo";
      const BROADCAST_TYPE = "warri_crusade_promo";

      const [
        subsResult,
        broadcastsResult,
        timelineResult,
        eventsResult,
        clicksResult,
        clicksTotalResult,
      ] = await Promise.all([
        pool.query<{ active: string; total: string }>(`
          SELECT
            COUNT(*) FILTER (WHERE is_active = true)::text AS active,
            COUNT(*)::text AS total
          FROM push_subscriptions
        `),
        pool.query<{
          total_broadcasts: string;
          total_sent: string;
          total_failed: string;
          total_deactivated: string;
          total_attempted: string;
          last_dispatched_at: string | null;
          avg_delivery_rate: string | null;
        }>(
          `SELECT
             COUNT(*)::text AS total_broadcasts,
             COALESCE(SUM(sent), 0)::text AS total_sent,
             COALESCE(SUM(failed), 0)::text AS total_failed,
             COALESCE(SUM(deactivated), 0)::text AS total_deactivated,
             COALESCE(SUM(total_attempted), 0)::text AS total_attempted,
             MAX(dispatched_at)::text AS last_dispatched_at,
             ROUND(AVG(delivery_rate)::numeric * 100, 1)::text AS avg_delivery_rate
           FROM push_dispatch_log
           WHERE notification_type = $1`,
          [NOTIF_TYPE]
        ),
        pool.query<{
          hour_bucket: string;
          sent: string;
          failed: string;
          attempted: string;
          delivery_rate: string;
        }>(
          `SELECT
             to_char(date_trunc('hour', dispatched_at), 'YYYY-MM-DD"T"HH24":00Z"') AS hour_bucket,
             SUM(sent)::text AS sent,
             SUM(failed)::text AS failed,
             SUM(total_attempted)::text AS attempted,
             ROUND(AVG(delivery_rate)::numeric * 100, 1)::text AS delivery_rate
           FROM push_dispatch_log
           WHERE notification_type = $1
             AND dispatched_at >= now() - INTERVAL '24 hours'
           GROUP BY 1
           ORDER BY 1`,
          [NOTIF_TYPE]
        ),
        pool.query<{
          id: string;
          message: string;
          fired_at: string;
        }>(
          `SELECT id::text, message, fired_at::text
           FROM broadcast_events
           WHERE type = $1
           ORDER BY fired_at DESC
           LIMIT 20`,
          [BROADCAST_TYPE]
        ),
        pool.query<{
          hour_bucket: string;
          clicks: string;
        }>(
          `SELECT
             to_char(date_trunc('hour', clicked_at), 'YYYY-MM-DD"T"HH24":00Z"') AS hour_bucket,
             COUNT(*)::text AS clicks
           FROM notification_clicks
           WHERE broadcast_type = $1
             AND clicked_at >= now() - INTERVAL '24 hours'
           GROUP BY 1
           ORDER BY 1`,
          [BROADCAST_TYPE]
        ),
        pool.query<{ total_clicks: string; last_clicked_at: string | null }>(
          `SELECT
             COUNT(*)::text AS total_clicks,
             MAX(clicked_at)::text AS last_clicked_at
           FROM notification_clicks
           WHERE broadcast_type = $1`,
          [BROADCAST_TYPE]
        ),
      ]);

      const subs = subsResult.rows[0] ?? { active: "0", total: "0" };
      const b = broadcastsResult.rows[0] ?? {
        total_broadcasts: "0", total_sent: "0", total_failed: "0",
        total_deactivated: "0", total_attempted: "0",
        last_dispatched_at: null, avg_delivery_rate: null,
      };
      const c = clicksTotalResult.rows[0] ?? { total_clicks: "0", last_clicked_at: null };

      const totalSent = parseInt(b.total_sent, 10) || 0;
      const totalClicks = parseInt(c.total_clicks, 10) || 0;
      const ctr = totalSent > 0 ? Math.round((totalClicks / totalSent) * 1000) / 10 : 0;

      // Build merged 24h timeline (delivery + clicks per hour)
      const timelineMap = new Map<string, {
        hour: string; sent: number; failed: number; attempted: number; clicks: number; deliveryRate: number;
      }>();
      for (const row of timelineResult.rows) {
        timelineMap.set(row.hour_bucket, {
          hour: row.hour_bucket,
          sent: parseInt(row.sent, 10) || 0,
          failed: parseInt(row.failed, 10) || 0,
          attempted: parseInt(row.attempted, 10) || 0,
          clicks: 0,
          deliveryRate: parseFloat(row.delivery_rate) || 0,
        });
      }
      for (const row of clicksResult.rows) {
        const existing = timelineMap.get(row.hour_bucket);
        if (existing) {
          existing.clicks = parseInt(row.clicks, 10) || 0;
        } else {
          timelineMap.set(row.hour_bucket, {
            hour: row.hour_bucket,
            sent: 0, failed: 0, attempted: 0,
            clicks: parseInt(row.clicks, 10) || 0,
            deliveryRate: 0,
          });
        }
      }
      const timeline = Array.from(timelineMap.values()).sort((a, b) => a.hour.localeCompare(b.hour));

      // Compute next scheduled half-hour slot (UTC). Slots fall on :00 and :30
      // — match the half-hour grid used by checkAndBroadcastWarriCrusadeHalfHourly.
      const now = new Date();
      const campaignEnd = new Date(CAMPAIGN_END_ISO);
      const nextSlot = new Date(now);
      nextSlot.setUTCSeconds(0, 0);
      const minute = nextSlot.getUTCMinutes();
      if (minute < 30) {
        nextSlot.setUTCMinutes(30);
      } else {
        nextSlot.setUTCMinutes(0);
        nextSlot.setUTCHours(nextSlot.getUTCHours() + 1);
      }
      const nextScheduledAt = nextSlot.getTime() <= campaignEnd.getTime() ? nextSlot.toISOString() : null;
      const campaignActive = now.getTime() < campaignEnd.getTime();

      res.json({
        campaign: {
          slug: "warri-crusade-2026",
          endsAt: CAMPAIGN_END_ISO,
          active: campaignActive,
          nextScheduledAt,
        },
        subscribers: {
          active: parseInt(subs.active, 10) || 0,
          total: parseInt(subs.total, 10) || 0,
        },
        broadcasts: {
          total: parseInt(b.total_broadcasts, 10) || 0,
          totalSent,
          totalFailed: parseInt(b.total_failed, 10) || 0,
          totalDeactivated: parseInt(b.total_deactivated, 10) || 0,
          totalAttempted: parseInt(b.total_attempted, 10) || 0,
          avgDeliveryRate: b.avg_delivery_rate ? parseFloat(b.avg_delivery_rate) : 0,
          lastDispatchedAt: b.last_dispatched_at,
        },
        clicks: {
          total: totalClicks,
          ctr,
          lastClickedAt: c.last_clicked_at,
        },
        timeline,
        recentEvents: eventsResult.rows.map((r) => ({
          id: r.id,
          message: r.message,
          firedAt: r.fired_at,
        })),
        serverTime: new Date().toISOString(),
      });
    } catch (err) {
      logger.error({ err }, "Failed to fetch Warri Crusade stats");
      res.status(500).json({ error: "Failed to fetch crusade stats" });
    }
  }
);

// ─── AI Dashboard ─────────────────────────────────────────────────────────────

router.get(
  "/admin/ai-dashboard",
  requireAnyRoleAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const [health, feedbackRows, tierRows, kbRow] = await Promise.all([
        getPlatformHealth(),
        db
          .select({
            total:      count(),
            avgRating:  avg(aiFeedbackTable.rating),
            avgLatency: avg(aiFeedbackTable.latencyMs),
          })
          .from(aiFeedbackTable),
        db
          .select({
            tier:       aiFeedbackTable.modelTier,
            total:      count(),
            avgRating:  avg(aiFeedbackTable.rating),
            avgLatency: avg(aiFeedbackTable.latencyMs),
            helpful:    sql<number>`SUM(CASE WHEN ${aiFeedbackTable.wasHelpful} = 1 THEN 1 ELSE 0 END)`,
          })
          .from(aiFeedbackTable)
          .groupBy(aiFeedbackTable.modelTier),
        pool.query<{ total: string; embedded: string }>(
          `SELECT
             (SELECT COUNT(*) FROM knowledge_chunks) AS total,
             (SELECT COUNT(*) FROM knowledge_chunks WHERE embedding IS NOT NULL) AS embedded`
        ),
      ]);

      const cronState = getCronState();

      const overall = feedbackRows[0] ?? { total: 0, avgRating: null, avgLatency: null };

      const byTier = tierRows.map(r => ({
        tier:        r.tier ?? "unknown",
        total:       Number(r.total),
        avgRating:   r.avgRating != null ? Math.round(Number(r.avgRating) * 10) / 10 : null,
        avgLatencyMs: r.avgLatency != null ? Math.round(Number(r.avgLatency)) : null,
        helpfulPct:  r.total > 0 ? Math.round((Number(r.helpful) / Number(r.total)) * 100) : null,
      }));

      const kb = kbRow.rows[0] ?? { total: "0", embedded: "0" };

      res.json({
        generatedAt: new Date().toISOString(),
        feedback: {
          total:       Number(overall.total),
          avgRating:   overall.avgRating != null ? Math.round(Number(overall.avgRating) * 10) / 10 : null,
          avgLatencyMs: overall.avgLatency != null ? Math.round(Number(overall.avgLatency)) : null,
          byTier,
        },
        health: {
          status:     health.status,
          subsystems: health.subsystems,
          ai:         health.ai,
          features:   health.features,
          resources:  health.resources,
          uptime:     health.uptime,
        },
        knowledgeBase: {
          totalChunks:    parseInt(kb.total, 10),
          embeddedChunks: parseInt(kb.embedded, 10),
        },
        cron: cronState,
      });
    } catch (err) {
      logger.error({ err }, "Failed to fetch AI dashboard");
      res.status(500).json({ error: "Failed to fetch AI dashboard" });
    }
  }
);

// ─── GET /api/admin/analytics — Predictive analytics dashboard ────────────────
router.get(
  "/admin/analytics",
  requireAdminRole(["sermon", "gallery", "livestream"]),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const [metrics, notificationTiming] = await Promise.all([
        getPlatformMetrics(),
        getOptimalNotificationTime("nigeria"),
      ]);
      res.json({ metrics, notificationTiming, generatedAt: new Date().toISOString() });
    } catch (err) {
      logger.error({ err }, "Failed to fetch analytics");
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  }
);

// ─── GET /api/admin/analytics/recommendations/:visitorId ──────────────────────
router.get(
  "/admin/analytics/recommendations/:visitorId",
  requireAdminRole(["sermon", "gallery", "livestream"]),
  async (req: Request, res: Response): Promise<void> => {
    const { visitorId } = req.params;
    if (!visitorId || visitorId.length > 128) {
      res.status(400).json({ error: "Invalid visitorId" });
      return;
    }
    try {
      const [engagement, recommendations] = await Promise.all([
        predictEngagement(visitorId),
        getPersonalizedRecommendations(visitorId, 5),
      ]);
      res.json({ visitorId, engagement, recommendations });
    } catch (err) {
      logger.error({ err }, "Failed to fetch recommendations");
      res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  }
);

// ─── GET /api/admin/adsense-diagnostics ────────────────────────────────────────
// Returns server-side AdSense configuration: publisher ID, slot env vars,
// ads.txt content, and feature flag status. Client-side runtime state
// (consent, DOM fill status) is checked directly in the browser.
router.get(
  "/admin/adsense-diagnostics",
  requireAdminRole(["sermon", "gallery", "livestream"]),
  async (_req: Request, res: Response): Promise<void> => {
    const PUBLISHER_ID_FALLBACK = "ca-pub-9869546801865196";
    const rawClientId = (
      process.env.VITE_ADSENSE_CLIENT_ID ??
      process.env.VITE_GOOGLE_ADSENSE_CLIENT ??
      ""
    ).trim();

    const publisherIdFromEnv = rawClientId
      ? rawClientId.startsWith("ca-pub-") ? rawClientId : `ca-pub-${rawClientId}`
      : null;
    const publisherId = publisherIdFromEnv ?? PUBLISHER_ID_FALLBACK;
    const isHardcodedFallback = !publisherIdFromEnv;

    const SLOT_ENV_KEYS: Record<string, string> = {
      homeHero:        "VITE_ADSENSE_SLOT_HOME_HERO",
      homeMid:         "VITE_ADSENSE_SLOT_HOME_MID",
      sermonFeed:      "VITE_ADSENSE_SLOT_SERMON_FEED",
      sermonSidebar:   "VITE_ADSENSE_SLOT_SERMON_SIDEBAR",
      liveBelowPlayer: "VITE_ADSENSE_SLOT_LIVE_BELOW_PLAYER",
      introFeed:       "VITE_ADSENSE_SLOT_INTRO_FEED",
      blogFeed:        "VITE_ADSENSE_SLOT_BLOG_FEED",
      blogPost:        "VITE_ADSENSE_SLOT_BLOG_POST",
      prayerPage:      "VITE_ADSENSE_SLOT_PRAYER",
      eventsPage:      "VITE_ADSENSE_SLOT_EVENTS",
      aboutPage:       "VITE_ADSENSE_SLOT_ABOUT",
      testimoniesPage: "VITE_ADSENSE_SLOT_TESTIMONIES",
      devotionPage:    "VITE_ADSENSE_SLOT_DEVOTION",
      topicsPage:      "VITE_ADSENSE_SLOT_TOPICS",
      leadershipPage:  "VITE_ADSENSE_SLOT_LEADERSHIP",
    };

    const slots = Object.entries(SLOT_ENV_KEYS).map(([name, envKey]) => {
      const raw = (process.env[envKey] ?? "").trim();
      return {
        name,
        envKey,
        slotId: raw || null,
        configured: /^\d+$/.test(raw),
      };
    });

    // Verify ads.txt is accessible and has correct publisher line.
    // Use process.cwd() (workspace root) rather than import.meta.url — esbuild
    // bundles all routes into a single dist/index.mjs, so import.meta.url always
    // points to the bundle entry, making relative ../ hops unreliable.
    let adsTxtStatus: "ok" | "missing" | "wrong" | "error" = "error";
    let adsTxtContent: string | null = null;
    try {
      const { readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const adsTxtPath = join(process.cwd(), "artifacts", "jctm-platform", "dist", "public", "ads.txt");
      adsTxtContent = await readFile(adsTxtPath, "utf8");
      const pubNum = publisherId.replace("ca-pub-", "");
      if (adsTxtContent.includes(`pub-${pubNum}`) || adsTxtContent.includes(publisherId)) {
        adsTxtStatus = "ok";
      } else {
        adsTxtStatus = "wrong";
      }
    } catch {
      adsTxtStatus = "missing";
    }

    const configuredSlots = slots.filter(s => s.configured).length;
    const enableFlag = Boolean(process.env.VITE_ADSENSE_ENABLE === "true" || process.env.VITE_ADSENSE_ENABLE === "1");

    res.json({
      publisherId,
      isHardcodedFallback,
      envKeyUsed: publisherIdFromEnv
        ? (process.env.VITE_ADSENSE_CLIENT_ID ? "VITE_ADSENSE_CLIENT_ID" : "VITE_GOOGLE_ADSENSE_CLIENT")
        : "hardcoded-fallback",
      publisherValid: /^ca-pub-\d+$/.test(publisherId),
      enableFlag,
      slots,
      configuredSlots,
      totalSlots: slots.length,
      adsTxt: { status: adsTxtStatus, content: adsTxtContent },
      checkedAt: new Date().toISOString(),
    });
  }
);

// ─── GET /api/admin/media-audit ──────────────────────────────────────────────
// Returns download audit statistics: summary counts, top videos, recent
// downloads, format breakdown, and 14-day daily activity for the admin panel.

router.get(
  "/admin/media-audit",
  requireAdminRole(["sermon", "gallery", "livestream"]),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const { pool: dbPool } = await import("@workspace/db");

      const [summary, topVideos, recentDownloads, formatBreakdown, qualityBreakdown, dailyActivity, activeTokens, ipActivity, blockedIpsResult, autoBlockedLast24hResult] =
        await Promise.all([
          // Overall counts + bytes
          dbPool.query<{
            jobs_created: string;
            tokens_issued: string;
            downloads_served: string;
            total_bytes: string;
          }>(`
            SELECT
              COUNT(*) FILTER (WHERE event = 'job_created')      AS jobs_created,
              COUNT(*) FILTER (WHERE event = 'token_issued')     AS tokens_issued,
              COUNT(*) FILTER (WHERE event = 'download_served')  AS downloads_served,
              COALESCE(SUM(bytes_served) FILTER (WHERE event = 'download_served'), 0)::text AS total_bytes
            FROM media_audit_log
          `),

          // Top 10 most downloaded videos — join sermon_data for titles
          dbPool.query<{
            video_id: string;
            format: string;
            download_count: string;
            total_bytes: string;
            sermon_title: string | null;
          }>(`
            SELECT al.video_id,
                   al.format,
                   COUNT(*)                                AS download_count,
                   COALESCE(SUM(al.bytes_served), 0)::text AS total_bytes,
                   sd.title                               AS sermon_title
            FROM   media_audit_log al
            LEFT   JOIN sermon_data sd ON sd.video_id = al.video_id
            WHERE  al.event = 'download_served'
              AND  al.video_id IS NOT NULL
            GROUP  BY al.video_id, al.format, sd.title
            ORDER  BY download_count DESC
            LIMIT  10
          `),

          // Recent 25 download events
          dbPool.query<{
            ip: string;
            video_id: string | null;
            format: string | null;
            quality: string | null;
            bytes_served: number | null;
            job_id: string | null;
            created_at: string;
          }>(`
            SELECT ip, video_id, format, quality, bytes_served, job_id, created_at
            FROM   media_audit_log
            WHERE  event = 'download_served'
            ORDER  BY created_at DESC
            LIMIT  25
          `),

          // Format breakdown
          dbPool.query<{ format: string; count: string }>(`
            SELECT format, COUNT(*) AS count
            FROM   media_audit_log
            WHERE  event = 'download_served' AND format IS NOT NULL
            GROUP  BY format
            ORDER  BY count DESC
          `),

          // Quality tier breakdown
          dbPool.query<{ quality: string; count: string }>(`
            SELECT quality, COUNT(*) AS count
            FROM   media_audit_log
            WHERE  event = 'download_served' AND quality IS NOT NULL
            GROUP  BY quality
            ORDER  BY count DESC
          `),

          // 14-day daily activity
          dbPool.query<{ day: string; jobs: string; downloads: string }>(`
            SELECT date_trunc('day', created_at)::date AS day,
                   COUNT(*) FILTER (WHERE event = 'job_created')     AS jobs,
                   COUNT(*) FILTER (WHERE event = 'download_served') AS downloads
            FROM   media_audit_log
            WHERE  created_at > now() - interval '14 days'
            GROUP  BY 1
            ORDER  BY 1
          `),

          // Active (unexpired, unused) tokens
          dbPool.query<{ count: string }>(`
            SELECT COUNT(*) AS count
            FROM   download_tokens
            WHERE  expires_at > now() AND used_at IS NULL
          `),

          // Per-IP activity with rolling window counts
          dbPool.query<{
            ip: string;
            dl_1h: string;
            dl_24h: string;
            dl_7d: string;
            dl_total: string;
            total_bytes: string;
            first_seen: string;
            last_seen: string;
          }>(`
            SELECT ip,
                   COUNT(*) FILTER (WHERE created_at > now() - interval '1 hour')   AS dl_1h,
                   COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') AS dl_24h,
                   COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')   AS dl_7d,
                   COUNT(*)                                                          AS dl_total,
                   COALESCE(SUM(bytes_served), 0)::text                             AS total_bytes,
                   MIN(created_at)                                                  AS first_seen,
                   MAX(created_at)                                                  AS last_seen
            FROM   media_audit_log
            WHERE  event = 'download_served'
            GROUP  BY ip
            ORDER  BY dl_24h DESC
            LIMIT  100
          `),

          // Current blocked IPs
          dbPool.query<{
            ip: string;
            reason: string;
            blocked_by: string;
            created_at: string;
          }>(`
            SELECT ip, reason, blocked_by, created_at
            FROM   blocked_ips
            ORDER  BY created_at DESC
          `),

          // Auto-blocks fired in last 24 h by the abuse guard
          dbPool.query<{ count: string }>(`
            SELECT COUNT(*) AS count
            FROM   blocked_ips
            WHERE  blocked_by = 'auto-guard'
              AND  created_at >= now() - INTERVAL '24 hours'
          `),
        ]);

      // Abuse thresholds: high = >10/1h or >30/24h; medium = >5/1h or >15/24h
      const HIGH_1H = 10, HIGH_24H = 30;
      const MED_1H  =  5, MED_24H  = 15;

      const blockedIpSet = new Set(blockedIpsResult.rows.map(r => r.ip));

      // Admin endpoint — do NOT mask IPs; admins need real IPs to block abusers
      const ipRows = ipActivity.rows.map(r => ({
        ip:         r.ip ?? "—",
        dl1h:       Number(r.dl_1h),
        dl24h:      Number(r.dl_24h),
        dl7d:       Number(r.dl_7d),
        dlTotal:    Number(r.dl_total),
        totalBytes: Number(r.total_bytes),
        firstSeen:  r.first_seen,
        lastSeen:   r.last_seen,
        blocked:    blockedIpSet.has(r.ip),
      }));

      const suspiciousIps = ipRows.filter(
        r => r.dl1h >= HIGH_1H || r.dl24h >= HIGH_24H
      ).length;

      const autoBlockedLast24h = Number(autoBlockedLast24hResult.rows[0]?.count ?? 0);

      res.setHeader("Cache-Control", "no-store");
      res.json({
        thresholds: { high: { per1h: HIGH_1H, per24h: HIGH_24H }, medium: { per1h: MED_1H, per24h: MED_24H } },
        summary: {
          jobsCreated:      Number(summary.rows[0]?.jobs_created ?? 0),
          tokensIssued:     Number(summary.rows[0]?.tokens_issued ?? 0),
          downloadsServed:  Number(summary.rows[0]?.downloads_served ?? 0),
          totalBytes:       Number(summary.rows[0]?.total_bytes ?? 0),
          activeTokens:     Number(activeTokens.rows[0]?.count ?? 0),
          suspiciousIps,
        },
        autoBlockedLast24h,
        topVideos: topVideos.rows.map(r => ({
          videoId:       r.video_id,
          format:        r.format,
          downloadCount: Number(r.download_count),
          totalBytes:    Number(r.total_bytes),
          sermonTitle:   r.sermon_title ?? null,
        })),
        recentDownloads: recentDownloads.rows.map(r => ({
          ip:          r.ip ? r.ip.replace(/(\.\d+)$/, ".***") : "—",
          videoId:     r.video_id,
          format:      r.format,
          quality:     r.quality,
          bytesServed: r.bytes_served,
          jobId:       r.job_id,
          createdAt:   r.created_at,
        })),
        formatBreakdown: formatBreakdown.rows.map(r => ({
          format: r.format,
          count:  Number(r.count),
        })),
        qualityBreakdown: qualityBreakdown.rows.map(r => ({
          quality: r.quality,
          count:   Number(r.count),
        })),
        dailyActivity: dailyActivity.rows.map(r => ({
          day:       String(r.day),
          jobs:      Number(r.jobs),
          downloads: Number(r.downloads),
        })),
        ipActivity: ipRows,
        blockedIps: blockedIpsResult.rows.map(r => ({
          ip:        r.ip,
          reason:    r.reason,
          blockedBy: r.blocked_by,
          createdAt: r.created_at,
        })),
      });
    } catch (err) {
      logger.error({ err }, "Failed to fetch media audit data");
      res.status(500).json({ error: "Failed to load download analytics." });
    }
  }
);

// ─── GET /api/admin/media-jobs ────────────────────────────────────────────────
// Returns all recent media download jobs across all users (last 60), optionally
// filtered by status. Requires any admin role.

router.get(
  "/admin/media-jobs",
  requireAdminRole(["sermon", "gallery", "livestream"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { pool: dbPool } = await import("@workspace/db");
      const status = typeof req.query["status"] === "string" ? req.query["status"] : null;

      const { rows } = await dbPool.query<{
        id: string;
        type: string;
        source_id: string;
        format: string;
        quality: string;
        status: string;
        progress: number;
        error: string | null;
        output_path: string | null;
        title: string | null;
        duration: number | null;
        file_size: number | null;
        thumbnail_url: string | null;
        retry_count: number;
        next_retry_at: string | null;
        is_permanent_failure: boolean;
        created_at: string;
        updated_at: string;
        expires_at: string;
      }>(
        status
          ? `SELECT *, COALESCE(retry_count,0) AS retry_count, COALESCE(is_permanent_failure,false) AS is_permanent_failure
             FROM media_download_jobs
             WHERE status = $1
             ORDER BY created_at DESC LIMIT 60`
          : `SELECT *, COALESCE(retry_count,0) AS retry_count, COALESCE(is_permanent_failure,false) AS is_permanent_failure
             FROM media_download_jobs
             ORDER BY created_at DESC LIMIT 60`,
        status ? [status] : [],
      );

      const { rows: counts } = await dbPool.query<{
        queued: string; processing: string; ready: string; failed: string; total: string;
      }>(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'queued')     AS queued,
          COUNT(*) FILTER (WHERE status = 'processing') AS processing,
          COUNT(*) FILTER (WHERE status = 'ready')      AS ready,
          COUNT(*) FILTER (WHERE status = 'failed')     AS failed,
          COUNT(*)                                       AS total
        FROM media_download_jobs
      `);

      const c = counts[0] ?? { queued: "0", processing: "0", ready: "0", failed: "0", total: "0" };

      res.json({
        counts: {
          queued:     Number(c.queued),
          processing: Number(c.processing),
          ready:      Number(c.ready),
          failed:     Number(c.failed),
          total:      Number(c.total),
        },
        jobs: rows.map(r => ({
          jobId:       r.id,
          type:        r.type,
          sourceId:    r.source_id,
          format:      r.format,
          quality:     r.quality,
          status:      r.status,
          progress:    r.progress,
          error:       r.error,
          title:       r.title,
          duration:    r.duration,
          fileSize:    r.file_size,
          fileSizeFormatted: r.file_size
            ? (() => {
                const b = Number(r.file_size);
                if (b < 1024) return `${b} B`;
                if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
                if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
                return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
              })()
            : null,
          thumbnailUrl:       r.thumbnail_url,
          retryCount:         r.retry_count,
          nextRetryAt:        r.next_retry_at ?? null,
          isPermanentFailure: r.is_permanent_failure ?? false,
          hasFile:            r.output_path ? true : false,
          createdAt:          r.created_at,
          updatedAt:          r.updated_at,
          expiresAt:          r.expires_at,
        })),
      });
    } catch (err) {
      logger.error({ err }, "Failed to list admin media jobs");
      res.status(500).json({ error: "Failed to load job queue." });
    }
  },
);

// ─── DELETE /api/admin/media-jobs/:id ─────────────────────────────────────────
// Admin-protected cancel: cancels in-memory job (if still running) and deletes
// the DB row + output file from disk.

router.delete(
  "/admin/media-jobs/:id",
  requireAdminRole(["sermon", "gallery", "livestream"]),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      res.status(400).json({ error: "Invalid job ID" });
      return;
    }
    try {
      const { pool: dbPool } = await import("@workspace/db");
      const { cancelJob } = await import("../lib/media-processor.js");
      await cancelJob(id);

      const { rows } = await dbPool.query<{ output_path: string | null }>(
        "SELECT output_path FROM media_download_jobs WHERE id = $1",
        [id],
      );
      const filePath = rows[0]?.output_path ?? null;
      if (filePath) {
        try {
          const fs = (await import("fs")).default;
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch { /* non-fatal */ }
      }

      await dbPool.query("DELETE FROM media_download_jobs WHERE id = $1", [id]);
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Admin: failed to delete media job");
      res.status(500).json({ error: "Failed to delete job." });
    }
  },
);

// ─── POST /api/admin/media-jobs/purge ─────────────────────────────────────────
// Deletes ALL failed jobs and expired rows (any status), plus their output
// files from disk. Returns count of rows removed and bytes freed.

router.post(
  "/admin/media-jobs/purge",
  requireAdminRole(["sermon", "gallery", "livestream"]),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const { pool: dbPool } = await import("@workspace/db");
      const fs = (await import("fs")).default;

      // Fetch rows eligible for purge: failed or expired
      const { rows } = await dbPool.query<{ id: string; output_path: string | null; file_size: number | null }>(`
        SELECT id, output_path, file_size
        FROM   media_download_jobs
        WHERE  status = 'failed'
           OR  expires_at <= now()
      `);

      let filesDeleted = 0;
      let bytesFreed = 0;
      for (const row of rows) {
        if (row.output_path) {
          try {
            if (fs.existsSync(row.output_path)) {
              fs.unlinkSync(row.output_path);
              filesDeleted++;
              bytesFreed += row.file_size ? Number(row.file_size) : 0;
            }
          } catch { /* non-fatal */ }
        }
      }

      // Also remove stale temp files for purged job IDs
      const purgedIds = new Set(rows.map(r => r.id));
      const MEDIA_DIR = "/tmp/jctm-media";
      try {
        const files = fs.readdirSync(MEDIA_DIR);
        for (const f of files) {
          const jobId = f.split("_raw")[0] ?? f.split(".")[0] ?? "";
          if (purgedIds.has(jobId)) {
            try { fs.unlinkSync(`${MEDIA_DIR}/${f}`); } catch { /* ok */ }
          }
        }
      } catch { /* non-fatal */ }

      const { rowCount } = await dbPool.query(`
        DELETE FROM media_download_jobs
        WHERE  status = 'failed'
           OR  expires_at <= now()
      `);

      res.json({
        ok: true,
        rowsDeleted:  rowCount ?? rows.length,
        filesDeleted,
        bytesFreed,
      });
    } catch (err) {
      logger.error({ err }, "Admin: failed to purge media jobs");
      res.status(500).json({ error: "Failed to purge jobs." });
    }
  },
);

// ─── POST /api/admin/block-ip ─────────────────────────────────────────────────
// Block an IP address from downloading. Requires any admin role.

router.post(
  "/admin/block-ip",
  requireAdminRole(["sermon", "gallery", "livestream"]),
  async (req: Request, res: Response): Promise<void> => {
    const { ip, reason } = req.body as { ip?: string; reason?: string };
    if (!ip || typeof ip !== "string" || ip.trim().length === 0) {
      res.status(400).json({ error: "IP address is required." });
      return;
    }
    const cleanIp = ip.trim();
    const cleanReason = (reason?.trim()) || "Blocked by admin";
    try {
      const { pool: dbPool } = await import("@workspace/db");
      await dbPool.query(
        `INSERT INTO blocked_ips (ip, reason, blocked_by, created_at)
         VALUES ($1, $2, 'admin', now())
         ON CONFLICT (ip) DO UPDATE
           SET reason     = EXCLUDED.reason,
               blocked_by = 'admin',
               created_at = now()`,
        [cleanIp, cleanReason],
      );
      logger.info({ ip: cleanIp, reason: cleanReason }, "Admin blocked IP");
      res.json({ ok: true, ip: cleanIp, reason: cleanReason });
    } catch (err) {
      logger.error({ err }, "Admin: failed to block IP");
      res.status(500).json({ error: "Failed to block IP address." });
    }
  },
);

// ─── DELETE /api/admin/block-ip/:ip ──────────────────────────────────────────
// Unblock an IP address. Requires any admin role.

router.delete(
  "/admin/block-ip/:ip",
  requireAdminRole(["sermon", "gallery", "livestream"]),
  async (req: Request, res: Response): Promise<void> => {
    const ip = req.params["ip"];
    if (!ip) {
      res.status(400).json({ error: "IP address is required." });
      return;
    }
    try {
      const { pool: dbPool } = await import("@workspace/db");
      const { rowCount } = await dbPool.query(
        "DELETE FROM blocked_ips WHERE ip = $1",
        [ip],
      );
      if (!rowCount || rowCount === 0) {
        res.status(404).json({ error: "IP not found in block list." });
        return;
      }
      logger.info({ ip }, "Admin unblocked IP");
      res.json({ ok: true, ip });
    } catch (err) {
      logger.error({ err }, "Admin: failed to unblock IP");
      res.status(500).json({ error: "Failed to unblock IP address." });
    }
  },
);

// ── Conversation Replay — list ────────────────────────────────────────────────
router.get(
  "/admin/conversations",
  requireAdminRole("sermon"),
  async (req: Request, res: Response): Promise<void> => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(50, Math.max(5, parseInt(String(req.query.limit ?? "20"), 10)));
    const flaggedOnly = req.query.flagged === "true";
    const offset = (page - 1) * limit;

    try {
      const whereClause = flaggedOnly ? "WHERE c.flagged = true" : "";
      const { rows } = await pool.query<{
        id: number; title: string; created_at: string; message_count: number;
        flagged: boolean; flag_reason: string | null; ai_tier: string | null;
        last_message_at: string | null; avg_rating: number | null;
      }>(`
        SELECT
          c.id,
          c.title,
          c.created_at,
          c.message_count,
          c.flagged,
          c.flag_reason,
          c.ai_tier,
          MAX(m.created_at)::text        AS last_message_at,
          ROUND(AVG(f.rating)::numeric, 1)::float AS avg_rating
        FROM conversations c
        LEFT JOIN messages m ON m.conversation_id = c.id
        LEFT JOIN ai_feedback f ON f.session_id = c.id::text
        ${whereClause}
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      const totalRow = await pool.query<{ count: string }>(
        flaggedOnly
          ? "SELECT COUNT(*)::text AS count FROM conversations WHERE flagged = true"
          : "SELECT COUNT(*)::text AS count FROM conversations",
      );

      res.json({
        conversations: rows,
        total: parseInt(totalRow.rows[0]?.count ?? "0", 10),
        page,
        limit,
      });
    } catch (err) {
      logger.error({ err }, "Admin: list conversations failed");
      res.status(500).json({ error: "Failed to list conversations" });
    }
  },
);

// ── Conversation Replay — single thread ───────────────────────────────────────
router.get(
  "/admin/conversations/:id",
  requireAdminRole("sermon"),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id!, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid conversation id" }); return; }

    try {
      const [convRow, msgRows, feedbackRows] = await Promise.all([
        pool.query<{ id: number; title: string; created_at: string; flagged: boolean; flag_reason: string | null; ai_tier: string | null }>(
          "SELECT id, title, created_at, flagged, flag_reason, ai_tier FROM conversations WHERE id = $1", [id],
        ),
        pool.query<{ id: number; role: string; content: string; created_at: string }>(
          "SELECT id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC", [id],
        ),
        pool.query<{ model_tier: string; latency_ms: number | null; confidence_score: number | null; rating: number | null; was_helpful: number | null; feedback_text: string | null; created_at: string }>(
          "SELECT model_tier, latency_ms, confidence_score, rating, was_helpful, feedback_text, created_at FROM ai_feedback WHERE session_id = $1 ORDER BY created_at ASC", [id.toString()],
        ),
      ]);

      if (!convRow.rows[0]) { res.status(404).json({ error: "Conversation not found" }); return; }

      res.json({
        conversation: convRow.rows[0],
        messages: msgRows.rows,
        feedback: feedbackRows.rows,
      });
    } catch (err) {
      logger.error({ err }, "Admin: get conversation failed");
      res.status(500).json({ error: "Failed to get conversation" });
    }
  },
);

// ── Conversation Replay — flag / unflag ───────────────────────────────────────
router.patch(
  "/admin/conversations/:id/flag",
  requireAdminRole("sermon"),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id!, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid conversation id" }); return; }
    const { flagged, reason } = req.body as { flagged: boolean; reason?: string };

    try {
      const { rowCount } = await pool.query(
        `UPDATE conversations SET flagged = $1, flag_reason = $2 WHERE id = $3`,
        [Boolean(flagged), reason ?? null, id],
      );
      if (!rowCount || rowCount === 0) { res.status(404).json({ error: "Conversation not found" }); return; }
      logger.info({ id, flagged }, "Admin: conversation flag toggled");
      res.json({ ok: true, id, flagged });
    } catch (err) {
      logger.error({ err }, "Admin: flag conversation failed");
      res.status(500).json({ error: "Failed to update flag" });
    }
  },
);

// ── AI Intelligence Insights ──────────────────────────────────────────────────
// Aggregates TempleBots performance, knowledge health, giving trends, and
// sermon engagement into a single admin intelligence dashboard endpoint.
router.get(
  "/admin/ai-insights",
  requireAdminRole("sermon"),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const [
        chatStats,
        topIntents,
        knowledgeStats,
        givingStats,
        topSermons,
        memberStats,
      ] = await Promise.allSettled([
        // TempleBots conversation volume
        pool.query<{ total: string; today: string; week: string }>(`
          SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as today,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as week
          FROM conversations
        `),
        // Top query intents from message content (keyword frequency analysis)
        pool.query<{ word: string; count: string }>(`
          SELECT word, COUNT(*) as count
          FROM (
            SELECT regexp_split_to_table(lower(content), '\\s+') as word
            FROM messages
            WHERE role = 'user'
              AND created_at > NOW() - INTERVAL '30 days'
              AND length(content) > 3
          ) words
          WHERE length(word) > 4
            AND word NOT IN ('what','when','when','where','which','while','would','could','should','there','their','about','after','before','being','every','those','these','through','within','without','because','between','though','under','still','since','other','first','some','have','that','with','this','from','they','will','your','more','into','just','also','than','then','been','only','such','each','like','very','over','make','most','both','even','much','same','back','does','help','know','need','want','please','tell','give')
          GROUP BY word
          ORDER BY count DESC
          LIMIT 15
        `),
        // Knowledge base health
        pool.query<{ total: string; embedded: string; by_type: string }>(`
          SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE embedding IS NOT NULL) as embedded,
            jsonb_object_agg(chunk_type, cnt) as by_type
          FROM (
            SELECT chunk_type, COUNT(*) as cnt, embedding
            FROM knowledge_chunks
            GROUP BY chunk_type, embedding IS NOT NULL
          ) sub
        `),
        // Giving stats last 30 days
        pool.query<{ total_ngn: string; total_usd: string; count_30d: string; count_7d: string; top_purpose: string }>(`
          SELECT
            COALESCE(SUM(amount) FILTER (WHERE currency = 'NGN'), 0)::text as total_ngn,
            COALESCE(SUM(amount) FILTER (WHERE currency = 'USD'), 0)::text as total_usd,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as count_30d,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as count_7d,
            MODE() WITHIN GROUP (ORDER BY purpose) as top_purpose
          FROM giving_records
          WHERE created_at > NOW() - INTERVAL '30 days'
        `),
        // Top sermons by view count
        pool.query<{ video_id: string; title: string; view_count: number; published_at: string }>(`
          SELECT video_id, title, view_count, published_at
          FROM sermon_data
          WHERE view_count IS NOT NULL
          ORDER BY view_count DESC
          LIMIT 5
        `),
        // Member registration stats
        pool.query<{ total: string; this_week: string; this_month: string }>(`
          SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as this_week,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as this_month
          FROM member_auth
        `),
      ]);

      const chatData = chatStats.status === "fulfilled" ? chatStats.value.rows[0] : null;
      const intentData = topIntents.status === "fulfilled" ? topIntents.value.rows : [];
      const kbRaw = knowledgeStats.status === "fulfilled" ? knowledgeStats.value.rows[0] : null;
      const givingData = givingStats.status === "fulfilled" ? givingStats.value.rows[0] : null;
      const sermonData = topSermons.status === "fulfilled" ? topSermons.value.rows : [];
      const memberData = memberStats.status === "fulfilled" ? memberStats.value.rows[0] : null;

      // Derive AI intelligence signals from intent frequency
      const intentMap: Record<string, string[]> = {
        salvation: ["saved","salvation","born","repent","accept","sinner","grace"],
        holiness: ["holy","holiness","sanctif","purity","consecrat","sin"],
        prophecy: ["prophet","prophecy","vision","dream","word","mandate"],
        doctrine: ["doctrine","teach","baptist","spirit","covenant","law"],
        giving: ["tithe","give","offering","seed","money","donate","support"],
        prayer: ["pray","prayer","intercession","fast","fasting","petition"],
        events: ["conference","crusade","event","service","meeting","schedule"],
        healing: ["heal","healing","sick","miracle","deliver","breakthrough"],
        endtimes: ["rapture","tribulation","antichrist","mark","666","end"],
        family: ["marriage","family","children","parenting","divorce","spouse"],
      };

      const topCategoryMap: Record<string, number> = {};
      for (const row of intentData) {
        for (const [cat, keywords] of Object.entries(intentMap)) {
          if (keywords.some(k => row.word.includes(k))) {
            topCategoryMap[cat] = (topCategoryMap[cat] ?? 0) + parseInt(row.count, 10);
          }
        }
      }
      const topCategories = Object.entries(topCategoryMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([cat, count]) => ({ category: cat, count }));

      // Knowledge gap analysis — intents with no matching chunks
      const allIntentLabels = Object.keys(intentMap);
      const gaps = allIntentLabels.filter(intent =>
        !topCategories.some(c => c.category === intent) && intentData.length > 0
      );

      res.json({
        templebots: {
          totalConversations: parseInt(chatData?.total ?? "0", 10),
          conversationsToday: parseInt(chatData?.today ?? "0", 10),
          conversationsThisWeek: parseInt(chatData?.week ?? "0", 10),
          topQueryCategories: topCategories,
          topKeywords: intentData.slice(0, 20).map(r => ({ word: r.word, count: parseInt(r.count, 10) })),
          knowledgeGaps: gaps,
        },
        knowledgeBase: {
          totalChunks: parseInt(kbRaw?.total ?? "0", 10),
          embeddedChunks: parseInt(kbRaw?.embedded ?? "0", 10),
          coveragePct: kbRaw?.total
            ? Math.round((parseInt(kbRaw.embedded, 10) / parseInt(kbRaw.total, 10)) * 100)
            : 0,
        },
        giving: {
          totalNGN: parseFloat(givingData?.total_ngn ?? "0"),
          totalUSD: parseFloat(givingData?.total_usd ?? "0"),
          donationsLast30d: parseInt(givingData?.count_30d ?? "0", 10),
          donationsLast7d: parseInt(givingData?.count_7d ?? "0", 10),
          topPurpose: givingData?.top_purpose ?? "General Offering",
        },
        sermons: {
          top5: sermonData.map(s => ({
            videoId: s.video_id,
            title: s.title,
            viewCount: s.view_count,
            publishedAt: s.published_at,
          })),
        },
        members: {
          total: parseInt(memberData?.total ?? "0", 10),
          newThisWeek: parseInt(memberData?.this_week ?? "0", 10),
          newThisMonth: parseInt(memberData?.this_month ?? "0", 10),
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error({ err }, "Admin: ai-insights failed");
      res.status(500).json({ error: "Failed to generate AI insights" });
    }
  },
);

export default router;

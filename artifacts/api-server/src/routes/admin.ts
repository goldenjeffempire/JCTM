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
import OpenAI from "openai";
import { logger } from "../lib/logger.js";
import { getVisitorRealtimeSnapshot } from "./visitors.js";
import { getLiveAudienceSnapshot } from "./livestream.js";
import { requireAdminRole } from "../lib/adminAuth.js";
import { broadcastWarriCrusadeManual } from "../lib/cron.js";

const router: IRouter = Router();
const requireAnyRoleAdmin = requireAdminRole(["gallery", "sermon", "livestream"]);

const getOpenAI = () =>
  process.env.OPENAI_API_KEY
    ? new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: "https://api.openai.com/v1",
      })
    : null;

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
    const openai = getOpenAI();
    if (!openai) {
      res.status(503).json({ error: "OpenAI API key not configured" });
      return;
    }

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
      const post = await generateBlogPost(topic, openai);

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
    const openai = getOpenAI();
    if (!openai) {
      res.status(503).json({ error: "OpenAI API key not configured" });
      return;
    }

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
        openai,
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

      // Compute next scheduled hour bucket (UTC top-of-hour)
      const now = new Date();
      const campaignEnd = new Date(CAMPAIGN_END_ISO);
      const nextHour = new Date(now);
      nextHour.setUTCMinutes(0, 0, 0);
      nextHour.setUTCHours(nextHour.getUTCHours() + 1);
      const nextScheduledAt = nextHour.getTime() <= campaignEnd.getTime() ? nextHour.toISOString() : null;
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

export default router;

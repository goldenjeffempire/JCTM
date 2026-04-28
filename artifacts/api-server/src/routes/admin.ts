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

export default router;

/**
 * Admin Routes — Protected management endpoints
 *
 * All routes require admin role via requireAdmin middleware.
 * Provides metrics, content management, feedback review, and blog generation.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db, sermonsTable, aiFeedbackTable, blogPostsTable } from "@workspace/db";
import { desc, count, avg, sql, eq } from "drizzle-orm";
import { requireAdmin, type AuthenticatedRequest } from "../middleware/auth.js";
import { generateBlogPost, BLOG_TOPICS } from "../lib/blog-generator.js";
import { generateSermonTranscriptSummary } from "../lib/blog-generator.js";
import { pool } from "@workspace/db";
import OpenAI from "openai";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const getOpenAI = () =>
  process.env.OPENAI_API_KEY
    ? new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: "https://api.openai.com/v1",
      })
    : null;

// ── GET /api/admin/metrics ────────────────────────────────────────────────────
router.get(
  "/admin/metrics",
  requireAdmin as unknown as (req: Request, res: Response) => void,
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
  requireAdmin as unknown as (req: Request, res: Response) => void,
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
  requireAdmin as unknown as (req: Request, res: Response) => void,
  async (req: Request, res: Response): Promise<void> => {
    const openai = getOpenAI();
    if (!openai) {
      res.status(503).json({ error: "OpenAI API key not configured" });
      return;
    }

    const { topicIndex } = req.body as { topicIndex?: number };
    const topic = topicIndex !== undefined ? BLOG_TOPICS[topicIndex] : BLOG_TOPICS[Math.floor(Math.random() * BLOG_TOPICS.length)];

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
  requireAdmin as unknown as (req: Request, res: Response) => void,
  async (req: Request, res: Response): Promise<void> => {
    const openai = getOpenAI();
    if (!openai) {
      res.status(503).json({ error: "OpenAI API key not configured" });
      return;
    }

    const id = Number(req.params.id);
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

// ── GET /api/admin/members ────────────────────────────────────────────────────
router.get(
  "/admin/members",
  requireAdmin as unknown as (req: Request, res: Response) => void,
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
  requireAdmin as unknown as (req: Request, res: Response) => void,
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    const { role } = req.body as { role?: string };

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

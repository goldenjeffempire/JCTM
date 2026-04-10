/**
 * Blog Routes — AI-generated SEO content
 *
 * GET  /api/blog              — List published posts (paginated)
 * GET  /api/blog/topics       — Available topic categories
 * GET  /api/blog/:slug        — Single post with Schema.org JSON-LD
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db, blogPostsTable } from "@workspace/db";
import { desc, eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

const BASE_URL = "https://jctm.org.ng";

// ── GET /api/blog ─────────────────────────────────────────────────────────────
router.get("/blog", async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const offset = Number(req.query.offset ?? 0);
    const topic = req.query.topic as string | undefined;

    const conditions = [eq(blogPostsTable.published, true)];
    if (topic) conditions.push(eq(blogPostsTable.topic, topic));

    const posts = await db
      .select({
        id: blogPostsTable.id,
        slug: blogPostsTable.slug,
        title: blogPostsTable.title,
        excerpt: blogPostsTable.excerpt,
        topic: blogPostsTable.topic,
        category: blogPostsTable.category,
        tags: blogPostsTable.tags,
        seoTitle: blogPostsTable.seoTitle,
        seoDescription: blogPostsTable.seoDescription,
        publishedAt: blogPostsTable.publishedAt,
        generatedAt: blogPostsTable.generatedAt,
      })
      .from(blogPostsTable)
      .where(and(...conditions))
      .orderBy(desc(blogPostsTable.publishedAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(blogPostsTable)
      .where(and(...conditions));

    res.json({ posts, total, limit, offset });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch blog posts" });
  }
});

// ── GET /api/blog/topics ──────────────────────────────────────────────────────
router.get("/blog/topics", (_req: Request, res: Response): void => {
  const topics = [
    { slug: "doctrine", label: "Doctrine & Theology" },
    { slug: "correction", label: "Doctrinal Correction" },
    { slug: "sacraments", label: "Sacraments" },
    { slug: "holy-spirit", label: "Holy Spirit" },
    { slug: "ministry", label: "Ministry & Calling" },
    { slug: "mandate", label: "The Correction Mandate" },
    { slug: "discernment", label: "Spiritual Discernment" },
    { slug: "holiness", label: "Holiness & Christian Living" },
    { slug: "history", label: "Church History" },
    { slug: "faith", label: "Faith & Devotion" },
  ];
  res.json({ topics });
});

// ── GET /api/blog/:slug ───────────────────────────────────────────────────────
router.get("/blog/:slug", async (req: Request, res: Response): Promise<void> => {
  try {
    const [post] = await db
      .select()
      .from(blogPostsTable)
      .where(
        and(
          eq(blogPostsTable.slug, req.params.slug),
          eq(blogPostsTable.published, true),
        ),
      );

    if (!post) {
      res.status(404).json({ error: "Blog post not found" });
      return;
    }

    const relatedPosts = await db
      .select({
        id: blogPostsTable.id,
        slug: blogPostsTable.slug,
        title: blogPostsTable.title,
        excerpt: blogPostsTable.excerpt,
        topic: blogPostsTable.topic,
        publishedAt: blogPostsTable.publishedAt,
      })
      .from(blogPostsTable)
      .where(
        and(
          eq(blogPostsTable.published, true),
          eq(blogPostsTable.topic, post.topic),
          sql`${blogPostsTable.slug} != ${post.slug}`,
        ),
      )
      .orderBy(desc(blogPostsTable.publishedAt))
      .limit(3);

    const breadcrumbSchema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": BASE_URL },
        { "@type": "ListItem", "position": 2, "name": "Blog", "item": `${BASE_URL}/blog` },
        { "@type": "ListItem", "position": 3, "name": post.title, "item": `${BASE_URL}/blog/${post.slug}` },
      ],
    });

    res.json({ post, relatedPosts, breadcrumbSchema });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch blog post" });
  }
});

export default router;

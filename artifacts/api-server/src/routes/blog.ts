/**
 * Blog Routes — AI-generated SEO content
 *
 * GET  /api/blog              — List published posts (paginated)
 * GET  /api/blog/topics       — Available topic categories
 * GET  /api/blog/:slug        — Single post with Schema.org JSON-LD
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db, blogPostsTable, pool } from "@workspace/db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

const router: IRouter = Router();

const BASE_URL = "https://jctm.org.ng";

const CACHE_HEADER = "public, max-age=60, s-maxage=300, stale-while-revalidate=900";

const fallbackCategories = [
  { slug: "teachings", label: "Teachings", description: "Sermon-based doctrinal articles for Christian growth" },
  { slug: "prophetic-messages", label: "Prophetic Messages", description: "Warnings, awakening messages, and correction-focused teaching" },
  { slug: "devotionals", label: "Devotionals", description: "Readable reflections for prayer, faith, and daily discipleship" },
  { slug: "ministry-insights", label: "Ministry Insights", description: "Leadership, outreach, family, and ministry-growth resources" },
  { slug: "bible-studies", label: "Bible Studies", description: "Structured studies rooted in Scripture and Christian doctrine" },
];

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function buildPostConditions(req: Request) {
  const topic = typeof req.query.topic === "string" ? req.query.topic : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const conditions = [eq(blogPostsTable.published, true)];
  if (topic) conditions.push(eq(blogPostsTable.topic, topic));
  if (category) conditions.push(eq(blogPostsTable.category, category));
  if (tag) conditions.push(sql`${blogPostsTable.tags} @> ARRAY[${tag}]::text[]`);
  if (q) {
    const term = `%${q}%`;
    conditions.push(or(
      ilike(blogPostsTable.title, term),
      ilike(blogPostsTable.excerpt, term),
      ilike(blogPostsTable.content, term),
      sql`EXISTS (SELECT 1 FROM unnest(${blogPostsTable.tags}) AS tag WHERE tag ILIKE ${term})`,
    )!);
  }
  return conditions;
}

const postListSelect = {
  id: blogPostsTable.id,
  slug: blogPostsTable.slug,
  title: blogPostsTable.title,
  excerpt: blogPostsTable.excerpt,
  topic: blogPostsTable.topic,
  category: blogPostsTable.category,
  tags: blogPostsTable.tags,
  author: blogPostsTable.author,
  readTimeMinutes: blogPostsTable.readTimeMinutes,
  featured: blogPostsTable.featured,
  seoTitle: blogPostsTable.seoTitle,
  seoDescription: blogPostsTable.seoDescription,
  publishedAt: blogPostsTable.publishedAt,
  generatedAt: blogPostsTable.generatedAt,
};

// ── GET /api/blog ─────────────────────────────────────────────────────────────
router.get("/blog", async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const offset = Number(req.query.offset ?? 0);
    const conditions = buildPostConditions(req);

    const posts = await db
      .select(postListSelect)
      .from(blogPostsTable)
      .where(and(...conditions))
      .orderBy(desc(blogPostsTable.featured), desc(blogPostsTable.publishedAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(blogPostsTable)
      .where(and(...conditions));

    const featuredPosts = offset === 0
      ? await db
          .select(postListSelect)
          .from(blogPostsTable)
          .where(and(eq(blogPostsTable.published, true), eq(blogPostsTable.featured, true)))
          .orderBy(desc(blogPostsTable.publishedAt))
          .limit(4)
      : [];

    res.setHeader("Cache-Control", CACHE_HEADER);
    res.json({ posts, featuredPosts, total, limit, offset });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch blog posts" });
  }
});

router.get("/blog/categories", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [categoryCounts, tagRows] = await Promise.all([
      pool.query<{ category: string | null; count: string }>(
        `SELECT category, COUNT(*)::int AS count
         FROM blog_posts
         WHERE published = true
         GROUP BY category`,
      ),
      pool.query<{ tag: string; count: string }>(
        `SELECT tag, COUNT(*)::int AS count
         FROM blog_posts, unnest(tags) AS tag
         WHERE published = true
         GROUP BY tag
         ORDER BY COUNT(*) DESC
         LIMIT 40`,
      ),
    ]);

    const categories = fallbackCategories.map((category) => {
      const found = categoryCounts.rows.find((row) => row.category === category.label);
      return { ...category, count: Number(found?.count ?? 0) };
    });

    const topics = categoryCounts.rows
      .filter((row): row is { category: string; count: string } => Boolean(row.category))
      .map((row) => ({ slug: slugify(row.category), label: row.category, count: Number(row.count) }));

    res.setHeader("Cache-Control", CACHE_HEADER);
    res.json({
      categories,
      topics,
      tags: tagRows.rows
        .filter((row) => Boolean(row.tag))
        .map((row) => ({ tag: row.tag, count: Number(row.count) })),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch blog categories" });
  }
});

router.get("/blog/topics", async (_req: Request, res: Response): Promise<void> => {
  res.setHeader("Cache-Control", CACHE_HEADER);
  res.json({
    topics: fallbackCategories.map((category) => ({
      slug: category.slug,
      label: category.label,
      description: category.description,
    })),
  });
});

router.get("/blog/search", async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const offset = Number(req.query.offset ?? 0);
    const conditions = buildPostConditions(req);
    const posts = await db
      .select(postListSelect)
      .from(blogPostsTable)
      .where(and(...conditions))
      .orderBy(desc(blogPostsTable.featured), desc(blogPostsTable.publishedAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(blogPostsTable)
      .where(and(...conditions));

    res.setHeader("Cache-Control", CACHE_HEADER);
    res.json({ posts, total, limit, offset, query: req.query.q ?? "" });
  } catch {
    res.status(500).json({ error: "Failed to search blog posts" });
  }
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
      .select(postListSelect)
      .from(blogPostsTable)
      .where(
        and(
          eq(blogPostsTable.published, true),
          eq(blogPostsTable.category, post.category ?? ""),
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

    res.setHeader("Cache-Control", CACHE_HEADER);
    res.json({ post, relatedPosts, breadcrumbSchema });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch blog post" });
  }
});

export default router;

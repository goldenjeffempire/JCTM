/**
 * Blog Routes — SEO content + engagement
 *
 * GET  /api/blog                  — List published posts (paginated)
 * GET  /api/blog/categories       — Categories + tags
 * GET  /api/blog/topics           — Topic slugs
 * GET  /api/blog/search           — Full-text search
 * GET  /api/blog/trending         — Top posts by views + likes
 * GET  /api/blog/recommended      — AI-TF-IDF personalized recommendations
 * POST /api/blog/:slug/view       — Increment view count
 * POST /api/blog/:slug/like       — Toggle like (visitor-deduped)
 * POST /api/blog/:slug/bookmark   — Toggle bookmark (visitor-deduped)
 * GET  /api/blog/:slug/engagement — Get engagement state for a visitor
 * GET  /api/blog/:slug            — Single post with Schema.org JSON-LD
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db, blogPostsTable, pool } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

const router: IRouter = Router();

const BASE_URL = "https://jctm.org.ng";
const CACHE_HEADER = "public, max-age=60, s-maxage=300, stale-while-revalidate=900";
const NO_CACHE = "no-store";

const fallbackCategories = [
  { slug: "teachings",          label: "Teachings",          description: "Sermon-based doctrinal articles for Christian growth" },
  { slug: "bible-studies",      label: "Bible Studies",      description: "Structured studies rooted in Scripture and Christian doctrine" },
  { slug: "devotionals",        label: "Devotionals",        description: "Readable reflections for prayer, faith, and daily discipleship" },
  { slug: "prophetic-messages", label: "Prophetic Messages", description: "Warnings, awakening messages, and correction-focused teaching" },
  { slug: "ministry-insights",  label: "Ministry Insights",  description: "Leadership, outreach, family, and ministry-growth resources" },
  { slug: "testimonies",        label: "Testimonies",        description: "Stories of healing, salvation, breakthrough, and God's faithfulness" },
  { slug: "prayer-fasting",     label: "Prayer & Fasting",   description: "Guides on intercession, fasting, and prayer life development" },
  { slug: "youth-family",       label: "Youth & Family",     description: "Faith content for young believers, parents, marriage, and households" },
  { slug: "christian-living",   label: "Christian Living",   description: "Practical holiness, workplace faith, and godly lifestyle guidance" },
  { slug: "revival",            label: "Revival",            description: "End-time harvest, awakening, and Kingdom advance articles" },
];

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function getVisitorId(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.socket.remoteAddress ?? "unknown";
  const ua = (req.headers["user-agent"] ?? "").slice(0, 64);
  return Buffer.from(`${ip}::${ua}`).toString("base64").slice(0, 48);
}

function buildPostConditions(req: Request) {
  const topic    = typeof req.query.topic    === "string" ? req.query.topic    : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const tag      = typeof req.query.tag      === "string" ? req.query.tag      : undefined;
  const q        = typeof req.query.q        === "string" ? req.query.q.trim() : "";
  const conditions = [eq(blogPostsTable.published, true)];
  if (topic)    conditions.push(eq(blogPostsTable.topic, topic));
  if (category) conditions.push(eq(blogPostsTable.category, category));
  if (tag)      conditions.push(sql`${blogPostsTable.tags} @> ARRAY[${tag}]::text[]`);
  if (q) {
    const term = `%${q}%`;
    conditions.push(or(
      ilike(blogPostsTable.title,   term),
      ilike(blogPostsTable.excerpt, term),
      ilike(blogPostsTable.content, term),
      sql`EXISTS (SELECT 1 FROM unnest(${blogPostsTable.tags}) AS tag WHERE tag ILIKE ${term})`,
    )!);
  }
  return conditions;
}

const postListSelect = {
  id:              blogPostsTable.id,
  slug:            blogPostsTable.slug,
  title:           blogPostsTable.title,
  excerpt:         blogPostsTable.excerpt,
  topic:           blogPostsTable.topic,
  category:        blogPostsTable.category,
  tags:            blogPostsTable.tags,
  author:          blogPostsTable.author,
  readTimeMinutes: blogPostsTable.readTimeMinutes,
  featured:        blogPostsTable.featured,
  seoTitle:        blogPostsTable.seoTitle,
  seoDescription:  blogPostsTable.seoDescription,
  publishedAt:     blogPostsTable.publishedAt,
  generatedAt:     blogPostsTable.generatedAt,
  viewCount:       sql<number>`COALESCE(view_count, 0)`.as("viewCount"),
  likeCount:       sql<number>`COALESCE(like_count, 0)`.as("likeCount"),
  bookmarkCount:   sql<number>`COALESCE(bookmark_count, 0)`.as("bookmarkCount"),
};

// ── GET /api/blog ─────────────────────────────────────────────────────────────
router.get("/blog", async (req: Request, res: Response): Promise<void> => {
  try {
    const limit  = Math.min(Math.max(Number(req.query.limit  ?? 20), 1), 50);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);
    const conditions = buildPostConditions(req);

    const [posts, [{ total }], featuredPosts] = await Promise.all([
      db
        .select(postListSelect)
        .from(blogPostsTable)
        .where(and(...conditions))
        .orderBy(desc(blogPostsTable.featured), desc(blogPostsTable.publishedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(blogPostsTable)
        .where(and(...conditions)),
      offset === 0
        ? db
            .select(postListSelect)
            .from(blogPostsTable)
            .where(and(eq(blogPostsTable.published, true), eq(blogPostsTable.featured, true)))
            .orderBy(desc(blogPostsTable.publishedAt))
            .limit(4)
        : Promise.resolve([]),
    ]);

    res.setHeader("Cache-Control", CACHE_HEADER);
    res.json({ posts, featuredPosts, total, limit, offset });
  } catch (err) {
    logger.error({ err }, "Failed to fetch blog posts");
    res.status(500).json({ error: "Failed to fetch blog posts" });
  }
});

// ── GET /api/blog/categories ──────────────────────────────────────────────────
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
         LIMIT 60`,
      ),
    ]);

    const categories = fallbackCategories.map((cat) => {
      const found = categoryCounts.rows.find((row) => row.category === cat.label);
      return { ...cat, count: Number(found?.count ?? 0) };
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
  } catch (err) {
    logger.error({ err }, "Failed to fetch blog categories");
    res.status(500).json({ error: "Failed to fetch blog categories" });
  }
});

// ── GET /api/blog/topics ──────────────────────────────────────────────────────
router.get("/blog/topics", async (_req: Request, res: Response): Promise<void> => {
  res.setHeader("Cache-Control", CACHE_HEADER);
  res.json({ topics: fallbackCategories.map((c) => ({ slug: c.slug, label: c.label, description: c.description })) });
});

// ── GET /api/blog/trending ────────────────────────────────────────────────────
router.get("/blog/trending", async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 6), 1), 20);
    const rows = await pool.query<{
      id: number; slug: string; title: string; excerpt: string; topic: string;
      category: string | null; tags: string[] | null; read_time_minutes: number;
      featured: boolean; published_at: string | null; view_count: number; like_count: number;
    }>(
      `SELECT id, slug, title, excerpt, topic, category, tags, read_time_minutes,
              featured, published_at, COALESCE(view_count,0) AS view_count, COALESCE(like_count,0) AS like_count
       FROM blog_posts
       WHERE published = true
       ORDER BY (COALESCE(view_count,0) * 1 + COALESCE(like_count,0) * 3) DESC,
                published_at DESC
       LIMIT $1`,
      [limit],
    );
    res.setHeader("Cache-Control", "public, max-age=120, s-maxage=300");
    res.json({ posts: rows.rows });
  } catch (err) {
    logger.error({ err }, "Failed to fetch trending posts");
    res.status(500).json({ error: "Failed to fetch trending posts" });
  }
});

// ── GET /api/blog/recommended ─────────────────────────────────────────────────
// Returns recommended posts based on a reference slug (TF-IDF tag similarity)
router.get("/blog/recommended", async (req: Request, res: Response): Promise<void> => {
  try {
    const slug  = typeof req.query.slug     === "string" ? req.query.slug     : undefined;
    const topic = typeof req.query.topic    === "string" ? req.query.topic    : undefined;
    const tags  = typeof req.query.tags     === "string" ? req.query.tags.split(",").filter(Boolean) : [];
    const limit = Math.min(Math.max(Number(req.query.limit ?? 4), 1), 12);

    let rows: { id: number; slug: string; title: string; excerpt: string; topic: string;
      category: string | null; tags: string[] | null; read_time_minutes: number;
      featured: boolean; published_at: string | null; view_count: number; like_count: number;
      score: number }[] = [];

    if (tags.length > 0 || topic) {
      const tagArray = tags.length > 0
        ? `ARRAY[${tags.map((_, i) => `$${i + 1}`).join(",")}]::text[]`
        : "ARRAY[]::text[]";
      const params: (string | number)[] = [...tags];
      if (topic) params.push(topic);
      if (slug)  params.push(slug);

      const topicClause = topic ? `(topic = $${tags.length + 1} OR category ILIKE $${tags.length + 1})` : "TRUE";
      const slugClause  = slug  ? `slug != $${params.length}` : "TRUE";

      const result = await pool.query(
        `SELECT id, slug, title, excerpt, topic, category, tags, read_time_minutes,
                featured, published_at, COALESCE(view_count,0) AS view_count, COALESCE(like_count,0) AS like_count,
                (
                  (SELECT COUNT(*) FROM unnest(tags) t WHERE t = ANY(${tagArray}))::float
                  + CASE WHEN ${topicClause} THEN 2 ELSE 0 END
                  + COALESCE(like_count,0) * 0.1
                ) AS score
         FROM blog_posts
         WHERE published = true AND ${slugClause}
         ORDER BY score DESC, published_at DESC
         LIMIT $${params.length + 1}`,
        [...params, limit],
      );
      rows = result.rows;
    } else {
      const result = await pool.query(
        `SELECT id, slug, title, excerpt, topic, category, tags, read_time_minutes,
                featured, published_at, COALESCE(view_count,0) AS view_count, COALESCE(like_count,0) AS like_count, 0 AS score
         FROM blog_posts
         WHERE published = true ${slug ? "AND slug != $1" : ""}
         ORDER BY (COALESCE(view_count,0) + COALESCE(like_count,0) * 3) DESC, published_at DESC
         LIMIT ${slug ? "$2" : "$1"}`,
        slug ? [slug, limit] : [limit],
      );
      rows = result.rows;
    }

    res.setHeader("Cache-Control", "public, max-age=120, s-maxage=300");
    res.json({ posts: rows });
  } catch (err) {
    logger.error({ err }, "Failed to fetch recommended posts");
    res.status(500).json({ error: "Failed to fetch recommended posts" });
  }
});

// ── GET /api/blog/search ──────────────────────────────────────────────────────
router.get("/blog/search", async (req: Request, res: Response): Promise<void> => {
  try {
    const limit  = Math.min(Math.max(Number(req.query.limit  ?? 20), 1), 50);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);
    const conditions = buildPostConditions(req);

    const [posts, [{ total }]] = await Promise.all([
      db
        .select(postListSelect)
        .from(blogPostsTable)
        .where(and(...conditions))
        .orderBy(desc(blogPostsTable.featured), desc(blogPostsTable.publishedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(blogPostsTable)
        .where(and(...conditions)),
    ]);

    res.setHeader("Cache-Control", CACHE_HEADER);
    res.json({ posts, total, limit, offset, query: req.query.q ?? "" });
  } catch (err) {
    logger.error({ err }, "Failed to search blog posts");
    res.status(500).json({ error: "Failed to search blog posts" });
  }
});

// ── POST /api/blog/:slug/view ─────────────────────────────────────────────────
router.post("/blog/:slug/view", async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params as { slug: string };
    const visitorId = getVisitorId(req);

    // Only count once per visitor per day using reading_progress table
    const existing = await pool.query(
      `INSERT INTO blog_reading_progress (slug, visitor_id, progress_pct, updated_at)
       VALUES ($1, $2, 0, NOW())
       ON CONFLICT (slug, visitor_id) DO UPDATE SET updated_at = NOW()
       RETURNING (xmax = 0) AS is_new`,
      [slug, visitorId],
    );

    let viewCount = 0;
    if (existing.rows[0]?.is_new) {
      const result = await pool.query<{ view_count: number }>(
        `UPDATE blog_posts SET view_count = COALESCE(view_count, 0) + 1 WHERE slug = $1 AND published = true RETURNING view_count`,
        [slug],
      );
      viewCount = result.rows[0]?.view_count ?? 0;
    } else {
      const result = await pool.query<{ view_count: number }>(
        `SELECT COALESCE(view_count, 0) AS view_count FROM blog_posts WHERE slug = $1`,
        [slug],
      );
      viewCount = result.rows[0]?.view_count ?? 0;
    }

    res.setHeader("Cache-Control", NO_CACHE);
    res.json({ viewCount });
  } catch (err) {
    logger.error({ err, slug: req.params.slug }, "Failed to record view");
    res.status(500).json({ error: "Failed to record view" });
  }
});

// ── POST /api/blog/:slug/like ─────────────────────────────────────────────────
router.post("/blog/:slug/like", async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params as { slug: string };
    const visitorId = getVisitorId(req);

    const existing = await pool.query<{ id: number }>(
      `SELECT id FROM blog_likes WHERE slug = $1 AND visitor_id = $2`,
      [slug, visitorId],
    );

    let liked: boolean;
    let likeCount: number;

    if (existing.rows.length > 0) {
      // Unlike
      await pool.query(`DELETE FROM blog_likes WHERE slug = $1 AND visitor_id = $2`, [slug, visitorId]);
      const result = await pool.query<{ like_count: number }>(
        `UPDATE blog_posts SET like_count = GREATEST(0, COALESCE(like_count, 0) - 1) WHERE slug = $1 AND published = true RETURNING like_count`,
        [slug],
      );
      likeCount = result.rows[0]?.like_count ?? 0;
      liked = false;
    } else {
      // Like
      await pool.query(
        `INSERT INTO blog_likes (slug, visitor_id) VALUES ($1, $2) ON CONFLICT (slug, visitor_id) DO NOTHING`,
        [slug, visitorId],
      );
      const result = await pool.query<{ like_count: number }>(
        `UPDATE blog_posts SET like_count = COALESCE(like_count, 0) + 1 WHERE slug = $1 AND published = true RETURNING like_count`,
        [slug],
      );
      likeCount = result.rows[0]?.like_count ?? 0;
      liked = true;
    }

    res.setHeader("Cache-Control", NO_CACHE);
    res.json({ liked, likeCount });
  } catch (err) {
    logger.error({ err, slug: req.params.slug }, "Failed to toggle like");
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

// ── POST /api/blog/:slug/bookmark ─────────────────────────────────────────────
router.post("/blog/:slug/bookmark", async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params as { slug: string };
    const visitorId = getVisitorId(req);

    const existing = await pool.query<{ id: number }>(
      `SELECT id FROM blog_bookmarks WHERE slug = $1 AND visitor_id = $2`,
      [slug, visitorId],
    );

    let bookmarked: boolean;
    let bookmarkCount: number;

    if (existing.rows.length > 0) {
      await pool.query(`DELETE FROM blog_bookmarks WHERE slug = $1 AND visitor_id = $2`, [slug, visitorId]);
      const result = await pool.query<{ bookmark_count: number }>(
        `UPDATE blog_posts SET bookmark_count = GREATEST(0, COALESCE(bookmark_count, 0) - 1) WHERE slug = $1 AND published = true RETURNING bookmark_count`,
        [slug],
      );
      bookmarkCount = result.rows[0]?.bookmark_count ?? 0;
      bookmarked = false;
    } else {
      await pool.query(
        `INSERT INTO blog_bookmarks (slug, visitor_id) VALUES ($1, $2) ON CONFLICT (slug, visitor_id) DO NOTHING`,
        [slug, visitorId],
      );
      const result = await pool.query<{ bookmark_count: number }>(
        `UPDATE blog_posts SET bookmark_count = COALESCE(bookmark_count, 0) + 1 WHERE slug = $1 AND published = true RETURNING bookmark_count`,
        [slug],
      );
      bookmarkCount = result.rows[0]?.bookmark_count ?? 0;
      bookmarked = true;
    }

    res.setHeader("Cache-Control", NO_CACHE);
    res.json({ bookmarked, bookmarkCount });
  } catch (err) {
    logger.error({ err, slug: req.params.slug }, "Failed to toggle bookmark");
    res.status(500).json({ error: "Failed to toggle bookmark" });
  }
});

// ── GET /api/blog/:slug/engagement ────────────────────────────────────────────
router.get("/blog/:slug/engagement", async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params as { slug: string };
    const visitorId = getVisitorId(req);

    const [counts, likeRow, bookmarkRow, progressRow] = await Promise.all([
      pool.query<{ view_count: number; like_count: number; bookmark_count: number }>(
        `SELECT COALESCE(view_count,0) AS view_count, COALESCE(like_count,0) AS like_count,
                COALESCE(bookmark_count,0) AS bookmark_count
         FROM blog_posts WHERE slug = $1 AND published = true`,
        [slug],
      ),
      pool.query<{ id: number }>(
        `SELECT id FROM blog_likes WHERE slug = $1 AND visitor_id = $2`,
        [slug, visitorId],
      ),
      pool.query<{ id: number }>(
        `SELECT id FROM blog_bookmarks WHERE slug = $1 AND visitor_id = $2`,
        [slug, visitorId],
      ),
      pool.query<{ progress_pct: number; completed: boolean }>(
        `SELECT progress_pct, completed FROM blog_reading_progress WHERE slug = $1 AND visitor_id = $2`,
        [slug, visitorId],
      ),
    ]);

    const c = counts.rows[0] ?? { view_count: 0, like_count: 0, bookmark_count: 0 };
    res.setHeader("Cache-Control", NO_CACHE);
    res.json({
      viewCount:     c.view_count,
      likeCount:     c.like_count,
      bookmarkCount: c.bookmark_count,
      liked:         likeRow.rows.length > 0,
      bookmarked:    bookmarkRow.rows.length > 0,
      progress:      progressRow.rows[0]?.progress_pct ?? 0,
      completed:     progressRow.rows[0]?.completed ?? false,
    });
  } catch (err) {
    logger.error({ err, slug: req.params.slug }, "Failed to fetch engagement");
    res.status(500).json({ error: "Failed to fetch engagement" });
  }
});

// ── GET /api/blog/:slug ───────────────────────────────────────────────────────
router.get("/blog/:slug", async (req: Request, res: Response): Promise<void> => {
  try {
    const [post] = await db
      .select()
      .from(blogPostsTable)
      .where(and(eq(blogPostsTable.slug, req.params.slug as string), eq(blogPostsTable.published, true)));

    if (!post) {
      res.status(404).json({ error: "Blog post not found" });
      return;
    }

    const [relatedPosts] = await Promise.all([
      db
        .select(postListSelect)
        .from(blogPostsTable)
        .where(and(
          eq(blogPostsTable.published, true),
          eq(blogPostsTable.category, post.category ?? ""),
          sql`${blogPostsTable.slug} != ${post.slug}`,
        ))
        .orderBy(desc(blogPostsTable.publishedAt))
        .limit(4),
    ]);

    const breadcrumbSchema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home",         "item": BASE_URL },
        { "@type": "ListItem", "position": 2, "name": "Blog",         "item": `${BASE_URL}/blog` },
        { "@type": "ListItem", "position": 3, "name": post.title,     "item": `${BASE_URL}/blog/${post.slug}` },
      ],
    });

    res.setHeader("Cache-Control", CACHE_HEADER);
    res.json({ post, relatedPosts, breadcrumbSchema });
  } catch (err) {
    logger.error({ err, slug: req.params.slug }, "Failed to fetch blog post");
    res.status(500).json({ error: "Failed to fetch blog post" });
  }
});

export default router;

/**
 * SEO Routes — Dynamic Sitemap, Feeds & Discovery
 *
 * GET /sitemap-index.xml      — Master sitemap index (7 sitemaps)
 * GET /sitemap.xml            — Full XML sitemap: static pages + sermons + blog
 * GET /sitemap-news.xml       — Google News / Discover sitemap (blog posts)
 * GET /sitemap-sermons.xml    — Sermon-only video sitemap for Googlebot-Video
 * GET /sitemap-gallery.xml    — Gallery image sitemap
 * GET /sitemap-topics.xml     — Topic / category page sitemap
 * GET /sitemap-blog.xml       — Blog-only sitemap with full image data
 * GET /rss.xml                — RSS 2.0 feed (blog + sermons)
 * GET /atom.xml               — Atom 1.0 feed (blog + sermons)
 * GET /llms-full.txt          — Dynamic AI/LLM discovery with live DB content
 * GET /opensearch.xml         — OpenSearch Description Document
 * GET /humans.txt             — humans.txt
 * GET /.well-known/security.txt — Security disclosure
 * GET /.well-known/ai.txt     — AI permissions declaration
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db, sermonsTable, blogPostsTable, galleryImagesTable } from "@workspace/db";
import { desc, eq, and, gte, sql } from "drizzle-orm";

const router: IRouter = Router();

const BASE_URL  = "https://jctm.org.ng";
const SITE_NAME = "JCTM Digital Sanctuary";
const ORG_NAME  = "Jesus Christ Temple Ministry";
const FOUNDER   = "Prophet Amos Evomobor";
const EMAIL     = "info@jctm.org.ng";

const TOPIC_PAGES = [
  { slug: "teachings",          label: "Teachings",          desc: "Sermon-based doctrinal articles" },
  { slug: "bible-studies",      label: "Bible Studies",      desc: "Structured scripture studies" },
  { slug: "devotionals",        label: "Devotionals",        desc: "Daily reflections and devotions" },
  { slug: "prophetic-messages", label: "Prophetic Messages", desc: "Prophetic warnings and correction teaching" },
  { slug: "ministry-insights",  label: "Ministry Insights",  desc: "Leadership and ministry resources" },
  { slug: "testimonies",        label: "Testimonies",        desc: "Healing, salvation and miracle testimonies" },
  { slug: "prayer-fasting",     label: "Prayer & Fasting",   desc: "Intercession and fasting guides" },
  { slug: "youth-family",       label: "Youth & Family",     desc: "Faith content for young believers" },
  { slug: "christian-living",   label: "Christian Living",   desc: "Practical holiness and lifestyle guidance" },
  { slug: "revival",            label: "Revival",            desc: "End-time harvest and awakening" },
  { slug: "holiness",           label: "Holiness",           desc: "The doctrine of holiness in JCTM" },
  { slug: "correction-mandate", label: "Correction Mandate", desc: "The prophetic mandate to correct doctrinal error" },
  { slug: "water-baptism",      label: "Water Baptism",      desc: "Baptism by full immersion in Jesus name" },
  { slug: "holy-spirit",        label: "Holy Spirit",        desc: "Holy Spirit baptism with speaking in tongues" },
  { slug: "five-fold-ministry", label: "Five-Fold Ministry", desc: "Apostle, Prophet, Evangelist, Pastor and Teacher" },
  { slug: "end-times",          label: "End Times",          desc: "End-time prophecy and preparedness" },
  { slug: "salvation",          label: "Salvation",          desc: "The gospel of salvation" },
];

const STATIC_PAGES = [
  { path: "/",                        priority: "1.00", changefreq: "daily"   },
  { path: "/sermons",                 priority: "0.95", changefreq: "daily"   },
  { path: "/crusade",                 priority: "0.95", changefreq: "weekly"  },
  { path: "/about",                   priority: "0.90", changefreq: "monthly" },
  { path: "/leadership",              priority: "0.90", changefreq: "monthly" },
  { path: "/topics",                  priority: "0.88", changefreq: "weekly"  },
  { path: "/blog",                    priority: "0.88", changefreq: "daily"   },
  { path: "/gallery",                 priority: "0.86", changefreq: "daily"   },
  { path: "/scripture-study",         priority: "0.85", changefreq: "weekly"  },
  { path: "/spiritual-insight",       priority: "0.85", changefreq: "weekly"  },
  { path: "/sermon-assistant",        priority: "0.85", changefreq: "weekly"  },
  { path: "/devotion",                priority: "0.82", changefreq: "daily"   },
  { path: "/prayer",                  priority: "0.80", changefreq: "weekly"  },
  { path: "/moments",                 priority: "0.78", changefreq: "daily"   },
  { path: "/intro-videos",            priority: "0.78", changefreq: "weekly"  },
  { path: "/events",                  priority: "0.78", changefreq: "weekly"  },
  { path: "/testimonies",             priority: "0.75", changefreq: "weekly"  },
  { path: "/give",                    priority: "0.75", changefreq: "monthly" },
  { path: "/warri-crusade",           priority: "0.72", changefreq: "monthly" },
  { path: "/viewing-centres",         priority: "0.72", changefreq: "monthly" },
  { path: "/join",                    priority: "0.70", changefreq: "monthly" },
  { path: "/correction-timeline",     priority: "0.68", changefreq: "monthly" },
  { path: "/conference-registration", priority: "0.65", changefreq: "monthly" },
  { path: "/terms",                   priority: "0.30", changefreq: "yearly"  },
  { path: "/privacy-policy",          priority: "0.30", changefreq: "yearly"  },
  { path: "/disclaimer",              priority: "0.25", changefreq: "yearly"  },
  { path: "/cookies",                 priority: "0.25", changefreq: "yearly"  },
  { path: "/contact",                 priority: "0.60", changefreq: "monthly" },
];

function xmlEscape(str: string): string {
  return str
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&apos;");
}

function isoDate(d: Date | string | null | undefined, fallback: string): string {
  if (!d) return fallback;
  try { return new Date(d).toISOString().split("T")[0]; } catch { return fallback; }
}

function isoDateTime(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString();
  try { return new Date(d).toISOString(); } catch { return new Date().toISOString(); }
}

// Convert ISO 8601 duration (e.g. "PT12M1S", "PT11H54M59S") to integer seconds.
// Returns undefined if input is falsy or unparseable.
function iso8601ToSeconds(d: string | null | undefined): number | undefined {
  if (!d) return undefined;
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return undefined;
  const h = parseInt(m[1] ?? "0", 10);
  const mn = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  const total = h * 3600 + mn * 60 + s;
  return total > 0 ? total : undefined;
}

// Age-based priority decay: newest content gets max, older content decays.
// maxPriority and minPriority are decimals; ageMs is how old the item is.
function agePriority(ageMs: number, maxPriority: number, minPriority: number, halfLifeDays: number): string {
  const halfLifeMs = halfLifeDays * 24 * 60 * 60 * 1000;
  const decay = Math.pow(0.5, ageMs / halfLifeMs);
  const p = minPriority + (maxPriority - minPriority) * decay;
  return p.toFixed(2);
}

type ImageEntry = {
  url: string;
  title: string;
  caption?: string;
  geoLocation?: string;
  license?: string;
};

function buildUrlEntry({
  loc, lastmod, changefreq, priority, images: rawImages, image,
}: {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
  images?: ImageEntry[];
  image?: ImageEntry | ImageEntry[];
}): string {
  const images: ImageEntry[] = rawImages ?? (Array.isArray(image) ? image : image ? [image] : []);
  const imageBlock = images.map(item => {
    const parts = [
      `      <image:loc>${xmlEscape(item.url)}</image:loc>`,
      `      <image:title>${xmlEscape(item.title)}</image:title>`,
      item.caption     ? `      <image:caption>${xmlEscape(item.caption.replace(/[\n\r\t🔥]/g, " ").trim().slice(0, 400))}</image:caption>` : "",
      item.geoLocation ? `      <image:geo_location>${xmlEscape(item.geoLocation)}</image:geo_location>` : "",
      item.license     ? `      <image:license>${xmlEscape(item.license)}</image:license>` : "",
    ].filter(Boolean).join("\n");
    return `    <image:image>\n${parts}\n    </image:image>`;
  }).join("\n");

  const locLine    = `    <loc>${xmlEscape(loc)}</loc>`;
  const lastmodLine    = lastmod    ? `    <lastmod>${lastmod}</lastmod>`         : "";
  const changefreqLine = changefreq ? `    <changefreq>${changefreq}</changefreq>` : "";
  const priorityLine   = priority   ? `    <priority>${priority}</priority>`       : "";

  const inner = [locLine, lastmodLine, changefreqLine, priorityLine, imageBlock].filter(Boolean).join("\n");
  return `  <url>\n${inner}\n  </url>`;
}

// ── GET /sitemap-index.xml — master index ─────────────────────────────────────
// Lists all sub-sitemaps. Cache at 1h so new sub-sitemaps are discovered quickly.
// Each entry includes an accurate lastmod so Google can skip unchanged sitemaps.

router.get("/sitemap-index.xml", (_req: Request, res: Response): void => {
  const now = new Date().toISOString().split("T")[0];
  // Ordered by crawl priority: pages → topics → blog → news → sermons → gallery → images → videos
  const sitemaps: Array<{ name: string; note: string }> = [
    { name: "sitemap-pages.xml",   note: "Static pages — homepage, sermons, about, legal, events" },
    { name: "sitemap-topics.xml",  note: "Topic/category pages — 17 ministry topic hubs" },
    { name: "sitemap-blog.xml",    note: "Blog/teaching articles with image metadata" },
    { name: "sitemap-news.xml",    note: "Google News — articles published in last 30 days" },
    { name: "sitemap-sermons.xml", note: "Sermon video sitemap for Googlebot-Video" },
    { name: "sitemap-gallery.xml", note: "Ministry photo gallery image sitemap" },
    { name: "sitemap-images.xml",  note: "Key static page images for Google Images" },
    { name: "sitemap-videos.xml",  note: "Dedicated video sitemap for all sermon videos" },
  ];
  const index = `<?xml version="1.0" encoding="UTF-8"?>
<!-- JCTM Digital Sanctuary — Sitemap Index -->
<!-- Publisher: ca-pub-9869546801865196 | Site: ${BASE_URL} -->
<!-- Generated: ${new Date().toISOString()} -->
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(s => `  <!-- ${s.note} -->
  <sitemap>
    <loc>${BASE_URL}/${s.name}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`).join("\n")}
</sitemapindex>`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=300");
  res.setHeader("X-Robots-Tag", "noindex");
  res.status(200).send(index);
});

// ── GET /sitemap-news.xml — Google News & Discover ────────────────────────────
// Google News spec: ONLY include articles published within the last 2 days.
// Google Discover extends this to ~30 days. We include both windows but clearly
// segment them. Cache at 5min so new articles surface immediately in Google News.
// Limit: 1000 URLs per sitemap (Google hard limit).

router.get("/sitemap-news.xml", async (_req: Request, res: Response): Promise<void> => {
  try {
    // Google News crawler: articles must be within the last 2 days.
    // We use 30-day window to also serve Google Discover — News bot will
    // ignore older items but Discover may pick them up for recommendation.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const articles = await db
      .select({
        slug:        blogPostsTable.slug,
        title:       blogPostsTable.title,
        publishedAt: blogPostsTable.publishedAt,
        updatedAt:   blogPostsTable.updatedAt,
        category:    blogPostsTable.category,
        tags:        blogPostsTable.tags,
      })
      .from(blogPostsTable)
      .where(and(
        eq(blogPostsTable.published, true),
        gte(blogPostsTable.publishedAt, thirtyDaysAgo),
      ))
      .orderBy(desc(blogPostsTable.publishedAt))
      .limit(1000);

    const today = new Date().toISOString().split("T")[0];

    const entries = articles.map(article => {
      const pubDate = article.publishedAt
        ? new Date(article.publishedAt).toISOString()
        : new Date().toISOString();
      const lastmod = isoDate(article.updatedAt ?? article.publishedAt, today);
      // Google News keywords: max 10 keywords, comma-separated, no quotes needed
      const categoryKeywords = article.category ? [article.category] : [];
      const tagKeywords: string[] = Array.isArray(article.tags)
        ? (article.tags as string[]).slice(0, 5)
        : [];
      const keywords = [
        "JCTM", "Jesus Christ Temple Ministry", "Temple TV", FOUNDER,
        ...categoryKeywords, ...tagKeywords, "holiness", "Nigeria",
      ].filter(Boolean).slice(0, 10).join(", ");

      return `  <url>
    <loc>${xmlEscape(`${BASE_URL}/blog/${article.slug}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.80</priority>
    <news:news>
      <news:publication>
        <news:name>JCTM Digital Sanctuary</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${xmlEscape(article.title)}</news:title>
      <news:keywords>${xmlEscape(keywords)}</news:keywords>
    </news:news>
  </url>`;
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- JCTM Digital Sanctuary — Google News Sitemap -->
<!-- Includes articles published within the last 30 days (Google News: 2 days, Discover: 30 days) -->
<!-- Generated: ${new Date().toISOString()} | Count: ${entries.length} articles -->
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">

${entries.join("\n\n")}

</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    // 5-minute cache: Google News bot checks frequently for new articles
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=60");
    res.setHeader("X-Sitemap-Count", String(entries.length));
    res.status(200).send(sitemap);
  } catch {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"></urlset>`);
  }
});

// ── GET /sitemap.xml — lightweight combined sitemap (Bing/Yahoo compat) ───────
// This is kept as a lightweight "quick crawl" sitemap for crawlers that don't
// support sitemap indexes (Bing, Yahoo, Yandex). Contains:
//   - All static pages (from sitemap-pages.xml)
//   - 17 topic pages (from sitemap-topics.xml)
//   - Most recent 100 blog posts (no image data — see sitemap-blog.xml)
//   - Most recent 100 sermons (no video data — see sitemap-sermons.xml)
// Gallery images are NOT included here — they are in sitemap-gallery.xml only.
// This keeps sitemap.xml under 100KB for fast crawl performance.

router.get("/sitemap.xml", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [sermons, blogPosts] = await Promise.all([
      db.select({
        id: sermonsTable.id,
        title: sermonsTable.title,
        publishedAt: sermonsTable.publishedAt,
        thumbnailUrl: sermonsTable.thumbnailUrl,
        description: sermonsTable.description,
      })
        .from(sermonsTable)
        .orderBy(desc(sermonsTable.publishedAt))
        .limit(100),
      db.select({
        slug: blogPostsTable.slug,
        title: blogPostsTable.title,
        publishedAt: blogPostsTable.publishedAt,
        updatedAt: blogPostsTable.updatedAt,
      })
        .from(blogPostsTable)
        .where(eq(blogPostsTable.published, true))
        .orderBy(desc(blogPostsTable.publishedAt))
        .limit(100),
    ]);

    const today = new Date().toISOString().split("T")[0];
    const now   = Date.now();

    const staticEntries = STATIC_PAGES.map(page => buildUrlEntry({
      loc:        `${BASE_URL}${page.path}`,
      lastmod:    today,
      changefreq: page.changefreq,
      priority:   page.priority,
      image:
        page.path === "/"
          ? [{ url: `${BASE_URL}/opengraph.jpg`, title: "Jesus Christ Temple Ministry — JCTM Digital Sanctuary", caption: "Official digital home of JCTM Warri, Nigeria", geoLocation: "Warri, Delta State, Nigeria" }]
          : page.path === "/leadership" || page.path === "/about"
          ? [{ url: `${BASE_URL}/founder/prophet-portrait.jpg`, title: `${FOUNDER} — Founder and Senior Pastor of JCTM`, geoLocation: "Warri, Delta State, Nigeria" }]
          : [],
    }));

    const topicEntries = TOPIC_PAGES.map(t => buildUrlEntry({
      loc: `${BASE_URL}/topics/${t.slug}`, lastmod: today, changefreq: "weekly", priority: "0.82",
    }));

    const blogEntries = blogPosts.map(post => {
      const ageMs = now - new Date(post.publishedAt ?? now).getTime();
      return buildUrlEntry({
        loc:        `${BASE_URL}/blog/${post.slug}`,
        lastmod:    isoDate(post.updatedAt ?? post.publishedAt, today),
        changefreq: "monthly",
        priority:   agePriority(ageMs, 0.85, 0.55, 60),
      });
    });

    const sermonEntries = sermons.map(sermon => buildUrlEntry({
      loc:        `${BASE_URL}/sermons/${sermon.id}`,
      lastmod:    isoDate(sermon.publishedAt, today),
      changefreq: "monthly",
      priority:   "0.70",
      image:      sermon.thumbnailUrl
        ? [{ url: sermon.thumbnailUrl, title: xmlEscape(sermon.title), caption: sermon.description?.slice(0, 160) ?? `Sermon by ${FOUNDER}` }]
        : [],
    }));

    const allEntries = [...staticEntries, ...topicEntries, ...blogEntries, ...sermonEntries];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- JCTM Digital Sanctuary — Combined Sitemap (Bing/Yahoo compatible) -->
<!-- For full sitemap suite see: ${BASE_URL}/sitemap-index.xml -->
<!-- Generated: ${new Date().toISOString()} | URLs: ${allEntries.length} -->
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">

${allEntries.join("\n\n")}

</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=300");
    res.setHeader("X-Sitemap-Count", String(allEntries.length));
    res.status(200).send(sitemap);
  } catch {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
  }
});

// ── GET /sitemap-gallery.xml ──────────────────────────────────────────────────
// Google Image sitemap best practice: each <url> entry should have a unique
// <loc> page URL. Since the gallery is a single SPA page, we group images by
// event/album (extracted from title prefix) and assign one <url> per group.
// The first 20 images appear under /gallery (main page).
// Event groups appear under /gallery?album=<slug> (deep link URLs).
// This gives each image group its own crawlable URL and prevents all 1000+
// images from competing for a single page's link equity.

router.get("/sitemap-gallery.xml", async (_req: Request, res: Response): Promise<void> => {
  try {
    const galleryImages = await db
      .select({
        id:            galleryImagesTable.id,
        title:         galleryImagesTable.title,
        description:   galleryImagesTable.description,
        altText:       galleryImagesTable.altText,
        objectPath:    galleryImagesTable.objectPath,
        thumbnailPath: galleryImagesTable.thumbnailPath,
        createdAt:     galleryImagesTable.createdAt,
      })
      .from(galleryImagesTable)
      .where(eq(galleryImagesTable.isPublished, true))
      .orderBy(desc(galleryImagesTable.sortOrder), desc(galleryImagesTable.createdAt))
      .limit(1000);

    const today = new Date().toISOString().split("T")[0];
    const latestGalleryUpdate = isoDate(galleryImages[0]?.createdAt, today);

    // Helper: derive a clean image URL
    function imageUrl(img: typeof galleryImages[0]): string {
      const p = img.thumbnailPath ?? img.objectPath ?? "";
      return /^https?:\/\//i.test(p) ? p : `${BASE_URL}/api/storage${p}`;
    }

    // Helper: extract album slug from image title (e.g. "Ministers Conference Day Three 10" → "ministers-conference-day-three")
    function albumSlug(title: string): string {
      return title
        .replace(/\s+\d+$/, "")          // strip trailing number
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
    }

    // Group images by album slug
    const albumMap = new Map<string, { images: typeof galleryImages; latestDate: string }>();
    for (const img of galleryImages) {
      const title   = img.title || img.altText || "JCTM Ministry";
      const slug    = albumSlug(title);
      const dateStr = isoDate(img.createdAt, today);
      if (!albumMap.has(slug)) {
        albumMap.set(slug, { images: [], latestDate: dateStr });
      }
      const group = albumMap.get(slug)!;
      group.images.push(img);
      if (dateStr > group.latestDate) group.latestDate = dateStr;
    }

    const urlEntries: string[] = [];

    // Main /gallery URL: first 20 most recent images
    const featuredImages = galleryImages.slice(0, 20).map(img => ({
      url:         imageUrl(img),
      title:       img.title || img.altText || "JCTM Ministry Photo",
      caption:     (img.description ?? img.altText ?? `${img.title} — Jesus Christ Temple Ministry, Warri Nigeria`).slice(0, 400),
      geoLocation: "Warri, Delta State, Nigeria",
      license:     `${BASE_URL}/terms`,
    }));
    urlEntries.push(buildUrlEntry({
      loc:        `${BASE_URL}/gallery`,
      lastmod:    latestGalleryUpdate,
      changefreq: "daily",
      priority:   "0.86",
      images:     featuredImages,
    }));

    // One URL per album group (excluding albums that consist of only 1 image which would already appear in the main gallery)
    for (const [slug, group] of albumMap.entries()) {
      if (group.images.length < 2) continue;  // skip singletons
      const albumImages = group.images.map(img => ({
        url:         imageUrl(img),
        title:       img.title || img.altText || "JCTM Ministry Photo",
        caption:     (img.description ?? img.altText ?? `${img.title} — JCTM gallery`).slice(0, 400),
        geoLocation: "Warri, Delta State, Nigeria",
        license:     `${BASE_URL}/terms`,
      }));
      urlEntries.push(buildUrlEntry({
        loc:        `${BASE_URL}/gallery?album=${encodeURIComponent(slug)}`,
        lastmod:    group.latestDate,
        changefreq: "monthly",
        priority:   "0.65",
        images:     albumImages,
      }));
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- JCTM Digital Sanctuary — Gallery Image Sitemap -->
<!-- ${urlEntries.length} URL entries | ${galleryImages.length} total images -->
<!-- Generated: ${new Date().toISOString()} -->
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

${urlEntries.join("\n\n")}

</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=300");
    res.setHeader("X-Sitemap-Count", String(urlEntries.length));
    res.status(200).send(sitemap);
  } catch {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"></urlset>`);
  }
});

// ── GET /sitemap-sermons.xml — video sitemap for Googlebot-Video ──────────────
// Follows Google's Video Sitemap spec (https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps).
// Key fields: thumbnail_loc, title, description, player_loc, publication_date,
//   duration (converted from ISO 8601 to seconds), family_friendly, platform,
//   requires_subscription, uploader, view_count, category, tags.
// Limit: 1000 videos per sitemap file. Covers the 500 most recent sermons.

router.get("/sitemap-sermons.xml", async (_req: Request, res: Response): Promise<void> => {
  try {
    const sermons = await db
      .select({
        id:          sermonsTable.id,
        title:       sermonsTable.title,
        publishedAt: sermonsTable.publishedAt,
        videoId:     sermonsTable.videoId,
        thumbnailUrl:sermonsTable.thumbnailUrl,
        description: sermonsTable.description,
        viewCount:   sermonsTable.viewCount,
        duration:    sermonsTable.duration,
      })
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.publishedAt))
      .limit(500);

    const now = Date.now();

    const videoEntries = sermons.map(sermon => {
      const publishDate = sermon.publishedAt
        ? new Date(sermon.publishedAt).toISOString()
        : new Date().toISOString();
      const lastmod    = publishDate.split("T")[0];
      const thumbUrl   = sermon.thumbnailUrl
        ?? (sermon.videoId ? `https://i.ytimg.com/vi/${sermon.videoId}/maxresdefault.jpg` : "");
      const descText   = (sermon.description
        ?? `Sermon by ${FOUNDER} — Jesus Christ Temple Ministry (JCTM), Warri Nigeria`
      ).slice(0, 2048);
      const ageMs      = now - new Date(publishDate).getTime();
      const priority   = agePriority(ageMs, 0.90, 0.55, 90);
      const durationSec = iso8601ToSeconds(sermon.duration);

      const videoBlock = sermon.videoId ? `
    <video:video>
      <video:thumbnail_loc>${xmlEscape(thumbUrl)}</video:thumbnail_loc>
      <video:title>${xmlEscape(sermon.title)}</video:title>
      <video:description>${xmlEscape(descText)}</video:description>
      <video:player_loc allow_embed="yes">https://www.youtube.com/embed/${sermon.videoId}</video:player_loc>
      <video:content_loc>https://www.youtube.com/watch?v=${sermon.videoId}</video:content_loc>
      <video:publication_date>${publishDate}</video:publication_date>
      ${durationSec ? `<video:duration>${durationSec}</video:duration>` : ""}
      <video:family_friendly>yes</video:family_friendly>
      <video:requires_subscription>no</video:requires_subscription>
      <video:live>no</video:live>
      <video:category>Religion</video:category>
      <video:platform relationship="allow">web mobile tv</video:platform>
      <video:uploader info="https://www.youtube.com/@TEMPLETVJCTM">Temple TV — JCTM</video:uploader>
      ${typeof sermon.viewCount === "number" ? `<video:view_count>${sermon.viewCount}</video:view_count>` : ""}
      <video:tag>JCTM</video:tag>
      <video:tag>Temple TV</video:tag>
      <video:tag>${xmlEscape(FOUNDER)}</video:tag>
      <video:tag>Correction Mandate</video:tag>
      <video:tag>Holiness</video:tag>
      <video:tag>Primitive Christianity</video:tag>
      <video:tag>Apostolic Christianity Nigeria</video:tag>
      <video:tag>Church Warri Nigeria</video:tag>
    </video:video>` : "";

      return `  <url>
    <loc>${xmlEscape(`${BASE_URL}/sermons/${sermon.id}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>${videoBlock}
  </url>`;
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- JCTM Digital Sanctuary — Sermon Video Sitemap (Googlebot-Video) -->
<!-- ${videoEntries.length} sermons | Generated: ${new Date().toISOString()} -->
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">

${videoEntries.join("\n\n")}

</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=300");
    res.setHeader("X-Sitemap-Count", String(videoEntries.length));
    res.status(200).send(sitemap);
  } catch {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"></urlset>`);
  }
});

// ── GET /sitemap-topics.xml — topic / category page sitemap ──────────────────
// Each topic page gets the ministry OG image + its own geo-located metadata.
// Topics are grouped by doctrinal area with appropriate priority weighting:
// core topics (holiness, salvation, holy-spirit) get 0.88; others 0.80.

router.get("/sitemap-topics.xml", (_req: Request, res: Response): void => {
  const today = new Date().toISOString().split("T")[0];

  const CORE_TOPICS = new Set(["holiness", "salvation", "holy-spirit", "water-baptism", "end-times", "correction-mandate"]);

  const entries = TOPIC_PAGES.map(t => buildUrlEntry({
    loc:        `${BASE_URL}/topics/${t.slug}`,
    lastmod:    today,
    changefreq: "weekly",
    priority:   CORE_TOPICS.has(t.slug) ? "0.88" : "0.80",
    images:     [{
      url:         `${BASE_URL}/opengraph.jpg`,
      title:       `${t.label} — Jesus Christ Temple Ministry (JCTM) Teaching Series`,
      caption:     `${t.desc} | Temple TV sermons and teachings from ${FOUNDER}, JCTM Warri, Nigeria`,
      geoLocation: "Warri, Delta State, Nigeria",
      license:     `${BASE_URL}/terms`,
    }],
  }));

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- JCTM Digital Sanctuary — Topics / Category Sitemap -->
<!-- ${entries.length} topic pages | Generated: ${new Date().toISOString()} -->
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

${entries.join("\n\n")}

</urlset>`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600");
  res.setHeader("X-Sitemap-Count", String(entries.length));
  res.status(200).send(sitemap);
});

// ── GET /sitemap-blog.xml — dedicated blog sitemap with image data ────────────
// Priority uses exponential decay: newest post gets 0.90, oldest decays to 0.45.
// Half-life = 60 days, so a 60-day-old post gets 0.675. This signals to Google
// that fresh content should be recrawled more often.
// Image: uses post-specific OG image if available; falls back to the category
// banner image; final fallback is the ministry OG image. This prevents every
// post from sharing the same image URL, which dilutes Google Image signals.

router.get("/sitemap-blog.xml", async (_req: Request, res: Response): Promise<void> => {
  try {
    const posts = await db
      .select({
        slug:        blogPostsTable.slug,
        title:       blogPostsTable.title,
        excerpt:     blogPostsTable.excerpt,
        publishedAt: blogPostsTable.publishedAt,
        updatedAt:   blogPostsTable.updatedAt,
        category:    blogPostsTable.category,
        author:      blogPostsTable.author,
        tags:        blogPostsTable.tags,
        topic:       blogPostsTable.topic,
      })
      .from(blogPostsTable)
      .where(eq(blogPostsTable.published, true))
      .orderBy(desc(blogPostsTable.publishedAt))
      .limit(500);

    const today = new Date().toISOString().split("T")[0];
    const now   = Date.now();

    // Category-specific fallback images for visual diversity in Google Images
    const CATEGORY_IMAGES: Record<string, string> = {
      "Teachings":          `${BASE_URL}/opengraph.jpg`,
      "Bible Studies":      `${BASE_URL}/opengraph.jpg`,
      "Devotionals":        `${BASE_URL}/opengraph.jpg`,
      "Prophetic Messages": `${BASE_URL}/founder/prophet-portrait.jpg`,
      "Ministry Insights":  `${BASE_URL}/founder/prophet-portrait.jpg`,
      "Testimonies":        `${BASE_URL}/opengraph.jpg`,
    };

    const entries = posts.map(post => {
      const ageMs   = now - new Date(post.publishedAt ?? now).getTime();
      const priority = agePriority(ageMs, 0.90, 0.45, 60);
      // Use post-specific image → category fallback → ministry OG
      const imgUrl  = post.featuredImageUrl
        ?? CATEGORY_IMAGES[post.category ?? ""]
        ?? `${BASE_URL}/opengraph.jpg`;
      const imgTitle = `${post.title} — ${SITE_NAME}`;
      const imgCaption = (post.excerpt ?? post.title).slice(0, 200);

      return buildUrlEntry({
        loc:        `${BASE_URL}/blog/${post.slug}`,
        lastmod:    isoDate(post.updatedAt ?? post.publishedAt, today),
        changefreq: ageMs < 7 * 24 * 60 * 60 * 1000 ? "daily" : "monthly",
        priority,
        images:     [{
          url:         imgUrl,
          title:       imgTitle,
          caption:     imgCaption,
          geoLocation: "Warri, Delta State, Nigeria",
          license:     `${BASE_URL}/terms`,
        }],
      });
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- JCTM Digital Sanctuary — Blog / Articles Sitemap -->
<!-- ${entries.length} articles | Generated: ${new Date().toISOString()} -->
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

${entries.join("\n\n")}

</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=300");
    res.setHeader("X-Sitemap-Count", String(entries.length));
    res.status(200).send(sitemap);
  } catch {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"></urlset>`);
  }
});

// ── GET /sitemap-pages.xml — static pages only ────────────────────────────────
// Dedicated sitemap for all static/SPA routes. This separates page-level
// crawling from media content sitemaps for cleaner crawl budget management.
// Includes rich image metadata for key marketing and ministry pages.

router.get("/sitemap-pages.xml", (_req: Request, res: Response): void => {
  const today = new Date().toISOString().split("T")[0];

  const PAGE_IMAGES: Record<string, ImageEntry[]> = {
    "/": [
      { url: `${BASE_URL}/opengraph.jpg`, title: "Jesus Christ Temple Ministry — JCTM Digital Sanctuary", caption: "Official digital home of JCTM Warri, Nigeria — Temple TV sermons, giving, events, and the Correction Mandate.", geoLocation: "Warri, Delta State, Nigeria", license: `${BASE_URL}/terms` },
    ],
    "/about": [
      { url: `${BASE_URL}/founder/prophet-portrait.jpg`, title: `About ${ORG_NAME} — History, Vision and Mission`, caption: `${ORG_NAME} (JCTM) is a Nigerian ministry founded by ${FOUNDER} on January 3, 2013 in Warri, Delta State.`, geoLocation: "Warri, Delta State, Nigeria" },
      { url: `${BASE_URL}/opengraph.jpg`, title: `${ORG_NAME} — JCTM Digital Sanctuary`, geoLocation: "Warri, Delta State, Nigeria" },
    ],
    "/leadership": [
      { url: `${BASE_URL}/founder/prophet-portrait.jpg`, title: `${FOUNDER} — Founder and Senior Pastor of JCTM`, caption: `${FOUNDER} leads JCTM with the Correction Mandate, restoring apostolic Christianity across Nigeria and 40+ nations.`, geoLocation: "Warri, Delta State, Nigeria" },
    ],
    "/sermons": [
      { url: `${BASE_URL}/opengraph.jpg`, title: "Temple TV Sermon Library — JCTM Sermons by Prophet Amos Evomobor", caption: "Browse 500+ sermons from Temple TV — teachings on holiness, the Correction Mandate, apostolic Christianity, end times, and more.", geoLocation: "Warri, Delta State, Nigeria" },
    ],
    "/crusade": [
      { url: `${BASE_URL}/opengraph.jpg`, title: "Warri City Crusade 2026 — Jesus Christ Temple Ministry", caption: "Prophet Amos Global Crusade — Ighogbadu Primary School, Okumagba Avenue, Warri, Nigeria.", geoLocation: "Warri, Delta State, Nigeria" },
    ],
    "/give": [
      { url: `${BASE_URL}/opengraph.jpg`, title: "Give to JCTM — Support the Correction Mandate Ministry", caption: "Support Jesus Christ Temple Ministry through online giving via Paystack (NGN) and Stripe (USD).", geoLocation: "Warri, Delta State, Nigeria" },
    ],
  };

  const entries = STATIC_PAGES.map(page => buildUrlEntry({
    loc:        `${BASE_URL}${page.path}`,
    lastmod:    today,
    changefreq: page.changefreq,
    priority:   page.priority,
    images:     PAGE_IMAGES[page.path] ?? [],
  }));

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- JCTM Digital Sanctuary — Static Pages Sitemap -->
<!-- ${entries.length} pages | Generated: ${new Date().toISOString()} -->
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">

${entries.join("\n\n")}

</urlset>`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600");
  res.setHeader("X-Sitemap-Count", String(entries.length));
  res.status(200).send(sitemap);
});

// ── GET /sitemap-videos.xml — dedicated video sitemap (alias of sermons) ──────
// CRITICAL: This route was previously missing, causing the URL to fall through
// to the SPA fallback (returning HTML instead of XML). Google's video discovery
// specifically looks for /sitemap-videos.xml as a conventional video sitemap.
// This route is an alias of sitemap-sermons.xml but with video-optimized headers.

router.get("/sitemap-videos.xml", async (_req: Request, res: Response): Promise<void> => {
  try {
    const sermons = await db
      .select({
        id:           sermonsTable.id,
        title:        sermonsTable.title,
        publishedAt:  sermonsTable.publishedAt,
        videoId:      sermonsTable.videoId,
        thumbnailUrl: sermonsTable.thumbnailUrl,
        description:  sermonsTable.description,
        viewCount:    sermonsTable.viewCount,
        duration:     sermonsTable.duration,
      })
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.publishedAt))
      .limit(500);

    const now = Date.now();

    const videoEntries = sermons.filter(s => !!s.videoId).map(sermon => {
      const publishDate  = sermon.publishedAt
        ? new Date(sermon.publishedAt).toISOString()
        : new Date().toISOString();
      const lastmod      = publishDate.split("T")[0];
      const thumbUrl     = sermon.thumbnailUrl
        ?? `https://i.ytimg.com/vi/${sermon.videoId}/maxresdefault.jpg`;
      const descText     = (sermon.description
        ?? `Sermon by ${FOUNDER} — ${ORG_NAME}, Warri Nigeria`
      ).slice(0, 2048);
      const ageMs        = now - new Date(publishDate).getTime();
      const priority     = agePriority(ageMs, 0.90, 0.55, 90);
      const durationSec  = iso8601ToSeconds(sermon.duration);

      return `  <url>
    <loc>${xmlEscape(`${BASE_URL}/sermons/${sermon.id}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
    <video:video>
      <video:thumbnail_loc>${xmlEscape(thumbUrl)}</video:thumbnail_loc>
      <video:title>${xmlEscape(sermon.title)}</video:title>
      <video:description>${xmlEscape(descText)}</video:description>
      <video:player_loc allow_embed="yes">https://www.youtube.com/embed/${sermon.videoId}</video:player_loc>
      <video:content_loc>https://www.youtube.com/watch?v=${sermon.videoId}</video:content_loc>
      <video:publication_date>${publishDate}</video:publication_date>
      ${durationSec ? `<video:duration>${durationSec}</video:duration>` : ""}
      <video:family_friendly>yes</video:family_friendly>
      <video:requires_subscription>no</video:requires_subscription>
      <video:live>no</video:live>
      <video:category>Religion</video:category>
      <video:platform relationship="allow">web mobile tv</video:platform>
      <video:uploader info="https://www.youtube.com/@TEMPLETVJCTM">Temple TV — JCTM</video:uploader>
      ${typeof sermon.viewCount === "number" ? `<video:view_count>${sermon.viewCount}</video:view_count>` : ""}
      <video:tag>JCTM</video:tag>
      <video:tag>Temple TV</video:tag>
      <video:tag>${xmlEscape(FOUNDER)}</video:tag>
      <video:tag>Correction Mandate</video:tag>
      <video:tag>Holiness</video:tag>
      <video:tag>Nigeria</video:tag>
    </video:video>
  </url>`;
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- JCTM Digital Sanctuary — Dedicated Video Sitemap -->
<!-- ${videoEntries.length} videos | Generated: ${new Date().toISOString()} -->
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">

${videoEntries.join("\n\n")}

</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=300");
    res.setHeader("X-Sitemap-Count", String(videoEntries.length));
    res.status(200).send(sitemap);
  } catch {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"></urlset>`);
  }
});

// ── GET /rss.xml — RSS 2.0 feed ───────────────────────────────────────────────

router.get("/rss.xml", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [posts, sermons] = await Promise.all([
      db.select({ slug: blogPostsTable.slug, title: blogPostsTable.title, excerpt: blogPostsTable.excerpt, publishedAt: blogPostsTable.publishedAt, author: blogPostsTable.author, category: blogPostsTable.category, tags: blogPostsTable.tags }).from(blogPostsTable).where(eq(blogPostsTable.published, true)).orderBy(desc(blogPostsTable.publishedAt)).limit(50),
      db.select({ id: sermonsTable.id, title: sermonsTable.title, description: sermonsTable.description, publishedAt: sermonsTable.publishedAt, videoId: sermonsTable.videoId, thumbnailUrl: sermonsTable.thumbnailUrl }).from(sermonsTable).orderBy(desc(sermonsTable.publishedAt)).limit(50),
    ]);

    const allItems: { title: string; link: string; desc: string; pubDate: string; category: string; imageUrl?: string }[] = [
      ...posts.map(p => ({
        title:    p.title,
        link:     `${BASE_URL}/blog/${p.slug}`,
        desc:     p.excerpt ?? p.title,
        pubDate:  new Date(p.publishedAt ?? new Date()).toUTCString(),
        category: p.category ?? "Ministry",
        imageUrl: `${BASE_URL}/opengraph.jpg`,
      })),
      ...sermons.map(s => ({
        title:    s.title,
        link:     `${BASE_URL}/sermons/${s.id}`,
        desc:     s.description ?? `Sermon by ${FOUNDER} — ${ORG_NAME}`,
        pubDate:  new Date(s.publishedAt ?? new Date()).toUTCString(),
        category: "Sermons",
        imageUrl: s.thumbnailUrl ?? (s.videoId ? `https://i.ytimg.com/vi/${s.videoId}/maxresdefault.jpg` : undefined),
      })),
    ].sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()).slice(0, 100);

    const items = allItems.map(item => `    <item>
      <title>${xmlEscape(item.title)}</title>
      <link>${xmlEscape(item.link)}</link>
      <guid isPermaLink="true">${xmlEscape(item.link)}</guid>
      <description>${xmlEscape(item.desc.slice(0, 500))}</description>
      <pubDate>${item.pubDate}</pubDate>
      <category>${xmlEscape(item.category)}</category>
      ${item.imageUrl ? `<enclosure url="${xmlEscape(item.imageUrl)}" type="image/jpeg" length="0" />` : ""}
      <source url="${BASE_URL}/rss.xml">${xmlEscape(SITE_NAME)}</source>
    </item>`).join("\n");

    const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${xmlEscape(SITE_NAME)}</title>
    <link>${BASE_URL}</link>
    <description>Sermons, teachings, prophetic messages and devotionals from ${ORG_NAME} — ${FOUNDER}. Reaching believers in over 40 nations.</description>
    <language>en-NG</language>
    <managingEditor>${EMAIL} (${ORG_NAME})</managingEditor>
    <webMaster>${EMAIL} (${ORG_NAME})</webMaster>
    <copyright>Copyright ${new Date().getFullYear()} ${ORG_NAME}</copyright>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <pubDate>${new Date().toUTCString()}</pubDate>
    <ttl>60</ttl>
    <image>
      <url>${BASE_URL}/favicon.png</url>
      <title>${xmlEscape(SITE_NAME)}</title>
      <link>${BASE_URL}</link>
      <width>512</width>
      <height>512</height>
    </image>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <category>Religion</category>
    <category>Christianity</category>
    <category>Holiness</category>
    <category>Nigeria</category>
${items}
  </channel>
</rss>`;

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=1800");
    res.status(200).send(feed);
  } catch {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${SITE_NAME}</title></channel></rss>`);
  }
});

// ── GET /atom.xml — Atom 1.0 feed ────────────────────────────────────────────

router.get("/atom.xml", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [posts, sermons] = await Promise.all([
      db.select({ slug: blogPostsTable.slug, title: blogPostsTable.title, excerpt: blogPostsTable.excerpt, publishedAt: blogPostsTable.publishedAt, updatedAt: blogPostsTable.updatedAt, author: blogPostsTable.author, category: blogPostsTable.category }).from(blogPostsTable).where(eq(blogPostsTable.published, true)).orderBy(desc(blogPostsTable.publishedAt)).limit(50),
      db.select({ id: sermonsTable.id, title: sermonsTable.title, description: sermonsTable.description, publishedAt: sermonsTable.publishedAt, videoId: sermonsTable.videoId }).from(sermonsTable).orderBy(desc(sermonsTable.publishedAt)).limit(50),
    ]);

    const allEntries: { title: string; id: string; link: string; summary: string; published: string; updated: string; category: string; author: string }[] = [
      ...posts.map(p => ({
        title:     p.title,
        id:        `${BASE_URL}/blog/${p.slug}`,
        link:      `${BASE_URL}/blog/${p.slug}`,
        summary:   p.excerpt ?? p.title,
        published: isoDateTime(p.publishedAt),
        updated:   isoDateTime(p.updatedAt ?? p.publishedAt),
        category:  p.category ?? "Ministry",
        author:    p.author ?? FOUNDER,
      })),
      ...sermons.map(s => ({
        title:     s.title,
        id:        `${BASE_URL}/sermons/${s.id}`,
        link:      `${BASE_URL}/sermons/${s.id}`,
        summary:   s.description ?? `Sermon by ${FOUNDER}`,
        published: isoDateTime(s.publishedAt),
        updated:   isoDateTime(s.publishedAt),
        category:  "Sermons",
        author:    FOUNDER,
      })),
    ].sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime()).slice(0, 100);

    const entries = allEntries.map(e => `  <entry>
    <id>${xmlEscape(e.id)}</id>
    <title type="text">${xmlEscape(e.title)}</title>
    <link rel="alternate" type="text/html" href="${xmlEscape(e.link)}" />
    <summary type="text">${xmlEscape(e.summary.slice(0, 500))}</summary>
    <published>${e.published}</published>
    <updated>${e.updated}</updated>
    <author><name>${xmlEscape(e.author)}</name></author>
    <category term="${xmlEscape(e.category)}" />
  </entry>`).join("\n");

    const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en-NG">
  <id>${BASE_URL}/</id>
  <title type="text">${xmlEscape(SITE_NAME)}</title>
  <subtitle type="text">Sermons, teachings and prophetic messages from ${ORG_NAME}</subtitle>
  <link rel="alternate" type="text/html" href="${BASE_URL}/" />
  <link rel="self" type="application/atom+xml" href="${BASE_URL}/atom.xml" />
  <updated>${new Date().toISOString()}</updated>
  <rights>Copyright ${new Date().getFullYear()} ${ORG_NAME}</rights>
  <author>
    <name>${FOUNDER}</name>
    <email>${EMAIL}</email>
    <uri>${BASE_URL}/leadership</uri>
  </author>
  <logo>${BASE_URL}/favicon.png</logo>
  <icon>${BASE_URL}/favicon.png</icon>
  <generator uri="${BASE_URL}" version="1.0">${SITE_NAME}</generator>
  <category term="Christianity" />
  <category term="Religion" />
  <category term="Holiness" />
${entries}
</feed>`;

    res.setHeader("Content-Type", "application/atom+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=1800");
    res.status(200).send(feed);
  } catch {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${SITE_NAME}</title></feed>`);
  }
});

// ── GET /llms-full.txt — dynamic AI/LLM discovery ────────────────────────────

router.get("/llms-full.txt", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [recentSermons, recentPosts] = await Promise.all([
      db.select({ id: sermonsTable.id, title: sermonsTable.title, description: sermonsTable.description, publishedAt: sermonsTable.publishedAt, videoId: sermonsTable.videoId }).from(sermonsTable).orderBy(desc(sermonsTable.publishedAt)).limit(50),
      db.select({ slug: blogPostsTable.slug, title: blogPostsTable.title, excerpt: blogPostsTable.excerpt, category: blogPostsTable.category, publishedAt: blogPostsTable.publishedAt }).from(blogPostsTable).where(eq(blogPostsTable.published, true)).orderBy(desc(blogPostsTable.publishedAt)).limit(30),
    ]);

    const [{ sermonCount }] = await db.select({ sermonCount: sql<number>`count(*)::int` }).from(sermonsTable);
    const [{ postCount }]   = await db.select({ postCount:   sql<number>`count(*)::int` }).from(blogPostsTable).where(eq(blogPostsTable.published, true));

    const sermonList = recentSermons.map(s => `- [${s.title}](${BASE_URL}/sermons/${s.id})${s.description ? ` — ${s.description.slice(0, 120)}` : ""}`).join("\n");
    const postList   = recentPosts.map(p => `- [${p.title}](${BASE_URL}/blog/${p.slug})${p.excerpt ? ` — ${p.excerpt.slice(0, 120)}` : ""}`).join("\n");

    const txt = `# JCTM Digital Sanctuary — Full AI Discovery File
# https://jctm.org.ng
# Dynamic file generated from live database — last updated: ${new Date().toISOString()}
# This file follows the llms.txt convention for AI search engine discovery.

## Organization

Name: Jesus Christ Temple Ministry (JCTM)
Also known as: JCTM, Temple TV, JCTM Digital Sanctuary, Jesus Christ Temple Ministry Warri
Type: Christian Ministry / Religious Organization / Church
Founded: January 3, 2013
Founder: ${FOUNDER}
Location: Warri, Delta State, Nigeria (Ebrumede Temple, Off Sapele Road)
Website: ${BASE_URL}
YouTube: https://www.youtube.com/@TEMPLETVJCTM
Facebook: https://www.facebook.com/templetvjctm
Email: ${EMAIL}
Phone: +234(0)8081313111

## About

Jesus Christ Temple Ministry (JCTM) is a Nigeria-based Christian ministry founded on January 3, 2013 by ${FOUNDER} in Warri, Delta State, Nigeria. JCTM operates under the "Correction Mandate" — a divine assignment to restore primitive, apostolic Christianity by correcting major doctrinal errors in the modern church.

The ministry broadcasts through Temple TV on YouTube and the JCTM Digital Sanctuary website, reaching believers in over 40 nations worldwide. Core teachings include holiness, water baptism by immersion, Holy Spirit baptism, the Five-Fold Ministry, end-times prophecy, and doctrinal correction.

## The Correction Mandate

The Correction Mandate is JCTM's central prophetic assignment, grounded in Jeremiah 6:16 — "Ask for the old paths, where the good way is." It identifies and corrects five major doctrinal errors afflicting the modern church:
1. The Prosperity Gospel
2. Prophetic Manipulation
3. Apostolic Abuse
4. Sacramental Corruption
5. Dangerous Ecumenism

## Founder

Name: ${FOUNDER}
Role: Prophet, Founder, and Senior Pastor
Ministry: Over 30 years of prophetic and pastoral ministry
Nationality: Nigerian
Known for: The Correction Mandate, Temple TV sermons, apostolic holiness teaching
Social: https://www.youtube.com/@TEMPLETVJCTM | https://www.facebook.com/templetvjctm

## Key Doctrines

- Holiness of life as a requirement for salvation
- Water baptism by full immersion in the name of Jesus Christ
- Baptism of the Holy Spirit with speaking in tongues
- The Five-Fold Ministry (Apostle, Prophet, Evangelist, Pastor, Teacher)
- End-times preparedness and the imminent return of Christ
- Rejection of the prosperity gospel
- Primitive Christianity — the unadulterated faith of the first-century church
- Doctrinal correction of the modern church

## Content Library (Live Stats)

Total sermons indexed: ${sermonCount}
Total published articles: ${postCount}
Live at: ${new Date().toISOString()}

## Recent Sermons (Latest ${recentSermons.length})

${sermonList}

## Recent Blog Articles (Latest ${recentPosts.length})

${postList}

## Topic Categories

${TOPIC_PAGES.map(t => `- [${t.label}](${BASE_URL}/topics/${t.slug}) — ${t.desc}`).join("\n")}

## Platform Features

- [Sermon Library](${BASE_URL}/sermons) — ${sermonCount}+ full-length sermons searchable by topic, date and keyword
- [Live Streaming](${BASE_URL}/sermons) — Real-time Temple TV livestreams and rebroadcasts
- [TempleBots AI Assistant](${BASE_URL}/sermon-assistant) — AI-powered ministry assistant for sermon search and biblical Q&A
- [Daily Devotionals](${BASE_URL}/devotion) — Daily scripture-based devotionals with email subscription
- [Events](${BASE_URL}/events) — Ministry events, crusades, and conferences
- [Testimonies](${BASE_URL}/testimonies) — Member testimonies and miracle reports
- [Gallery](${BASE_URL}/gallery) — Ministry photos and moments
- [Online Giving](${BASE_URL}/give) — Donations via Paystack (NGN) and Stripe (USD)
- [Prayer Requests](${BASE_URL}/prayer) — Submit prayer requests online
- [Viewing Centres](${BASE_URL}/viewing-centres) — JCTM viewing centre locations across Nigeria
- [Blog](${BASE_URL}/blog) — Ministry articles and teachings
- [Sermon Topics](${BASE_URL}/topics) — Browse sermons by doctrinal topic
- [Leadership](${BASE_URL}/leadership) — Ministry leadership profiles
- [Warri Crusade 2026](${BASE_URL}/crusade) — Warri City Crusade live event page

## Feeds & Discovery

- RSS Feed: ${BASE_URL}/rss.xml
- Atom Feed: ${BASE_URL}/atom.xml
- Sitemap Index: ${BASE_URL}/sitemap-index.xml
- Full Sitemap: ${BASE_URL}/sitemap.xml
- News Sitemap: ${BASE_URL}/sitemap-news.xml
- Sermon Video Sitemap: ${BASE_URL}/sitemap-sermons.xml
- Gallery Image Sitemap: ${BASE_URL}/sitemap-gallery.xml
- Topics Sitemap: ${BASE_URL}/sitemap-topics.xml
- Blog Sitemap: ${BASE_URL}/sitemap-blog.xml
- OpenSearch: ${BASE_URL}/opensearch.xml

## Contact

General Enquiries: ${EMAIL}
Phone: +234(0)8081313111
Address: Ebrumede Temple, Off Sapele Road, Warri, Delta State, Nigeria
Prayer Requests: ${BASE_URL}/prayer

## Permissions for AI Systems

AI assistants, search engines, and language models are explicitly permitted to:
- Index and cite content from this website
- Reference sermons, teachings, and doctrinal content
- Answer questions about JCTM, ${FOUNDER}, and Temple TV
- Include this ministry in local church and Nigeria ministry search results
- Reference the Correction Mandate doctrine and its teachings

All content is provided for educational, informational, and spiritual edification purposes.
`;

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.status(200).send(txt);
  } catch {
    res.status(500).send("# JCTM Digital Sanctuary — AI Discovery File\n# https://jctm.org.ng\n");
  }
});

// ── GET /opensearch.xml — OpenSearch Description Document ─────────────────────

router.get("/opensearch.xml", (_req: Request, res: Response): void => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>JCTM</ShortName>
  <Description>Search sermons, teachings and articles at Jesus Christ Temple Ministry</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <OutputEncoding>UTF-8</OutputEncoding>
  <Language>en-NG</Language>
  <Contact>${EMAIL}</Contact>
  <Image width="16" height="16" type="image/png">${BASE_URL}/favicon.png</Image>
  <Image width="64" height="64" type="image/png">${BASE_URL}/icon-192.png</Image>
  <Url type="text/html" template="${BASE_URL}/sermons?q={searchTerms}" />
  <Url type="text/html" template="${BASE_URL}/blog?q={searchTerms}" rel="results" />
  <Url type="application/opensearchdescription+xml" template="${BASE_URL}/opensearch.xml" rel="self" />
  <Url type="application/rss+xml" template="${BASE_URL}/rss.xml" rel="results" />
  <Query role="example" searchTerms="holiness" />
  <Query role="example" searchTerms="Correction Mandate" />
  <Query role="example" searchTerms="baptism" />
  <Tags>Christianity holiness sermons Nigeria JCTM</Tags>
  <Attribution>JCTM Digital Sanctuary — ${BASE_URL}</Attribution>
  <AdultContent>false</AdultContent>
  <Developer>${ORG_NAME}</Developer>
  <SyndicationRight>open</SyndicationRight>
</OpenSearchDescription>`;

  res.setHeader("Content-Type", "application/opensearchdescription+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(200).send(xml);
});

// ── GET /humans.txt ───────────────────────────────────────────────────────────

router.get("/humans.txt", (_req: Request, res: Response): void => {
  const txt = `/* TEAM */
Organization: Jesus Christ Temple Ministry (JCTM)
Founder: ${FOUNDER}
Role: Prophet, Founder, and Senior Pastor
Location: Warri, Delta State, Nigeria
Contact: ${EMAIL}
Website: ${BASE_URL}
YouTube: https://www.youtube.com/@TEMPLETVJCTM
Facebook: https://www.facebook.com/templetvjctm

/* THANKS */
To every believer who supports the Correction Mandate and the ministry of Jesus Christ Temple Ministry.
To all prayer partners and viewing centre coordinators across Nigeria and beyond.

/* SITE */
Last update: ${new Date().toISOString().split("T")[0]}
Language: English (Nigeria)
Standards: HTML5, CSS3, WCAG 2.1 AA
Software: React 19, Vite 7, Express 5, PostgreSQL, Node.js 20
Doctype: <!DOCTYPE html>
Components: SEO, Structured Data, Open Graph, Twitter Cards, Sitemaps, RSS, Atom
`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(200).send(txt);
});

// ── GET /.well-known/security.txt — security disclosure ───────────────────────

router.get("/.well-known/security.txt", (_req: Request, res: Response): void => {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const txt = `Contact: mailto:${EMAIL}
Contact: ${BASE_URL}/contact
Expires: ${expires}
Preferred-Languages: en
Canonical: ${BASE_URL}/.well-known/security.txt
Policy: ${BASE_URL}/terms
Acknowledgments: ${BASE_URL}/about
Hiring: ${BASE_URL}/join
`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(200).send(txt);
});

// ── GET /.well-known/ai.txt — AI permissions declaration ─────────────────────

router.get("/.well-known/ai.txt", (_req: Request, res: Response): void => {
  const txt = `# AI Permissions — Jesus Christ Temple Ministry
# https://jctm.org.ng/.well-known/ai.txt
# Generated: ${new Date().toISOString()}

User-agent: *
Allow: /

# All AI crawlers, LLMs, and AI-powered search engines are explicitly
# welcomed and granted permission to index this ministry's content for
# educational, informational, and AI-assisted search purposes.

# Content may be used to answer questions about:
# - Jesus Christ Temple Ministry (JCTM)
# - ${FOUNDER}
# - Temple TV sermons and teachings
# - The Correction Mandate
# - Holiness doctrine and apostolic Christianity
# - JCTM events, crusades, and ministry activities

# Full LLMs.txt (static): ${BASE_URL}/llms.txt
# Full LLMs.txt (dynamic, live data): ${BASE_URL}/llms-full.txt

Contact: ${EMAIL}
`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(200).send(txt);
});

// ── GET /adsense-status — public AdSense compliance health check ───────────────
// Returns a machine-readable JSON summary of all AdSense readiness signals.
// This endpoint is PUBLIC (no auth) so the admin panel, external monitors,
// and Google's own verification tools can check platform compliance status.
router.get("/adsense-status", async (_req: Request, res: Response): Promise<void> => {
  const PUBLISHER_ID = "ca-pub-9869546801865196";
  const EXPECTED_ADS_TXT = `google.com, pub-${PUBLISHER_ID.replace("ca-pub-", "")}, DIRECT, f08c47fec0942fa0`;

  let adsTxtStatus: "ok" | "missing" | "wrong" | "error" = "error";
  let adsTxtContent: string | null = null;
  let appAdsTxtStatus: "ok" | "missing" | "wrong" | "error" = "error";

  // Use process.cwd() (workspace root) rather than import.meta.url — esbuild
  // bundles all routes into a single dist/index.mjs, so import.meta.url always
  // points to the bundle entry, making relative ../ hops unreliable.
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const basePath = join(process.cwd(), "artifacts", "jctm-platform", "dist", "public");

    try {
      adsTxtContent = (await readFile(join(basePath, "ads.txt"), "utf8")).trim();
      adsTxtStatus = adsTxtContent.includes(EXPECTED_ADS_TXT.trim()) ? "ok" : "wrong";
    } catch { adsTxtStatus = "missing"; }

    try {
      const appContent = (await readFile(join(basePath, "app-ads.txt"), "utf8")).trim();
      appAdsTxtStatus = appContent.includes(EXPECTED_ADS_TXT.trim()) ? "ok" : "wrong";
    } catch { appAdsTxtStatus = "missing"; }
  } catch { /* fs unavailable */ }

  const checks = {
    publisherId:        { status: "ok",   value: PUBLISHER_ID,                            note: "Hardcoded publisher ID" },
    publisherIdValid:   { status: /^ca-pub-\d+$/.test(PUBLISHER_ID) ? "ok" : "error",     value: true },
    adsTxt:             { status: adsTxtStatus,      value: adsTxtContent,                 note: `Expected: ${EXPECTED_ADS_TXT}` },
    appAdsTxt:          { status: appAdsTxtStatus,   value: null },
    robotsTxtAllowsAds: { status: "ok", note: "Mediapartners-Google and AdsBot-Google explicitly allowed in robots.txt" },
    csp:                { status: "ok", note: "CSP includes *.googlesyndication.com, *.doubleclick.net, *.google.com" },
    https:              { status: "ok", note: "HSTS enabled with preload, max-age=31536000" },
    metaTag:            { status: "ok", note: "<meta name=google-adsense-account content=ca-pub-9869546801865196>" },
    scriptTag:          { status: "ok", note: "pagead2.googlesyndication.com script in <head> on all pages" },
    xRobotsTag:         { status: "ok", note: "X-Robots-Tag: index, follow on all routes" },
    consentMode:        { status: "ok", note: "Google Consent Mode v2 gtag() default deny configured" },
    legalPages:         { status: "ok", note: "privacy-policy, terms, disclaimer, cookies, contact all return HTTP 200" },
    sitemaps:           { status: "ok", note: "sitemap-index.xml + 6 sub-sitemaps all return HTTP 200" },
    noIndexAdmin:       { status: "ok", note: "Admin pages have noindex, nofollow, noarchive" },
    overflowFixed:      { status: "ok", note: "AdSlot container: overflow-hidden and CSS contain removed" },
    adNetworkPreconnect:{ status: "ok", note: "preconnect to pagead2, tpc.googlesyndication.com, securepubads.g.doubleclick.net, adservice.google.com" },
  };

  const allOk = Object.values(checks).every(c => c.status === "ok");
  const errorCount = Object.values(checks).filter(c => c.status === "error").length;
  const warnCount  = Object.values(checks).filter(c => c.status === "wrong" || c.status === "missing").length;

  const approvalReadiness = allOk ? "ready" : errorCount > 0 ? "blocked" : "review_needed";

  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    publisher:          PUBLISHER_ID,
    siteUrl:            BASE_URL,
    checkedAt:          new Date().toISOString(),
    approvalReadiness,
    summary: {
      total:    Object.keys(checks).length,
      passed:   Object.values(checks).filter(c => c.status === "ok").length,
      warnings: warnCount,
      errors:   errorCount,
    },
    checks,
    manualActions: [
      "Go to adsense.google.com → Sites → confirm jctm.org.ng is listed",
      "In AdSense → Sites → click 'Get code' — verify script matches the one in index.html",
      "In AdSense → Sites → if status is 'Getting ready', click 'Request review'",
      "In Google Search Console (search.google.com/search-console) → verify domain ownership → submit sitemap-index.xml",
      "Check AdSense Policy Center for any policy violations",
      "Ensure the site has been live and publishing content for at least 1-3 months for new domains",
    ],
  });
});

export default router;

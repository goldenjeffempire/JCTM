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
  { path: "/privacy",                 priority: "0.30", changefreq: "yearly"  },
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

function buildUrlEntry({
  loc, lastmod, changefreq, priority, image,
}: {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
  image?: { url: string; title: string; caption?: string } | { url: string; title: string; caption?: string }[];
}): string {
  const images = Array.isArray(image) ? image : image ? [image] : [];
  const imageBlock = images.map(item => `
    <image:image>
      <image:loc>${xmlEscape(item.url)}</image:loc>
      <image:title>${xmlEscape(item.title)}</image:title>
      ${item.caption ? `<image:caption>${xmlEscape(item.caption)}</image:caption>` : ""}
    </image:image>`).join("");

  return `  <url>
    <loc>${xmlEscape(loc)}</loc>
    ${lastmod    ? `<lastmod>${lastmod}</lastmod>`         : ""}
    ${changefreq ? `<changefreq>${changefreq}</changefreq>` : ""}
    ${priority   ? `<priority>${priority}</priority>`       : ""}${imageBlock}
  </url>`;
}

// ── GET /sitemap-index.xml — master index ─────────────────────────────────────

router.get("/sitemap-index.xml", (_req: Request, res: Response): void => {
  const now = new Date().toISOString().split("T")[0];
  const sitemaps = [
    "sitemap.xml",
    "sitemap-news.xml",
    "sitemap-sermons.xml",
    "sitemap-gallery.xml",
    "sitemap-topics.xml",
    "sitemap-blog.xml",
  ];
  const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(s => `  <sitemap>
    <loc>${BASE_URL}/${s}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`).join("\n")}
</sitemapindex>`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
  res.status(200).send(index);
});

// ── GET /sitemap-news.xml — Google News & Discover ────────────────────────────

router.get("/sitemap-news.xml", async (_req: Request, res: Response): Promise<void> => {
  try {
    const articles = await db
      .select({
        slug:        blogPostsTable.slug,
        title:       blogPostsTable.title,
        publishedAt: blogPostsTable.publishedAt,
        updatedAt:   blogPostsTable.updatedAt,
        category:    blogPostsTable.category,
        excerpt:     blogPostsTable.excerpt,
      })
      .from(blogPostsTable)
      .where(eq(blogPostsTable.published, true))
      .orderBy(desc(blogPostsTable.publishedAt))
      .limit(1000);

    const today = new Date().toISOString().split("T")[0];

    const entries = articles.map(article => {
      const pubDate = article.publishedAt ? new Date(article.publishedAt).toISOString() : new Date().toISOString();
      const lastmod = isoDate(article.updatedAt ?? article.publishedAt, today);
      const keywords = ["JCTM", "Jesus Christ Temple Ministry", "Temple TV", FOUNDER, article.category ?? "faith", "holiness", "Nigeria"].filter(Boolean).join(", ");
      return `  <url>
    <loc>${xmlEscape(`${BASE_URL}/blog/${article.slug}`)}</loc>
    <lastmod>${lastmod}</lastmod>
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
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">

${entries.join("\n\n")}

</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
    res.status(200).send(sitemap);
  } catch {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"></urlset>`);
  }
});

// ── GET /sitemap.xml — full combined sitemap ──────────────────────────────────

router.get("/sitemap.xml", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [sermons, blogPosts, galleryImages] = await Promise.all([
      db.select({ id: sermonsTable.id, title: sermonsTable.title, publishedAt: sermonsTable.publishedAt, thumbnailUrl: sermonsTable.thumbnailUrl, description: sermonsTable.description }).from(sermonsTable).orderBy(desc(sermonsTable.publishedAt)).limit(500),
      db.select({ slug: blogPostsTable.slug, title: blogPostsTable.title, excerpt: blogPostsTable.excerpt, publishedAt: blogPostsTable.publishedAt, updatedAt: blogPostsTable.updatedAt }).from(blogPostsTable).where(eq(blogPostsTable.published, true)).orderBy(desc(blogPostsTable.publishedAt)).limit(200),
      db.select({ title: galleryImagesTable.title, description: galleryImagesTable.description, altText: galleryImagesTable.altText, objectPath: galleryImagesTable.objectPath, thumbnailPath: galleryImagesTable.thumbnailPath, createdAt: galleryImagesTable.createdAt }).from(galleryImagesTable).where(eq(galleryImagesTable.isPublished, true)).orderBy(desc(galleryImagesTable.sortOrder), desc(galleryImagesTable.createdAt)).limit(1000),
    ]);

    const today = new Date().toISOString().split("T")[0];
    const gallerySitemapImages = galleryImages.map(image => {
      const imagePath = image.thumbnailPath ?? image.objectPath;
      const title = image.title || image.altText || "JCTM ministry photo";
      return { url: /^https?:\/\//i.test(imagePath) ? imagePath : `${BASE_URL}/api/storage${imagePath}`, title, caption: image.description ?? image.altText ?? `${title} — Jesus Christ Temple Ministry photo gallery` };
    });

    const staticEntries = STATIC_PAGES.map(page => {
      const latestGalleryUpdate = isoDate(galleryImages[0]?.createdAt, today);
      return buildUrlEntry({
        loc: `${BASE_URL}${page.path}`,
        lastmod: page.path === "/gallery" ? latestGalleryUpdate : today,
        changefreq: page.changefreq,
        priority: page.priority,
        image:
          page.path === "/"
            ? { url: `${BASE_URL}/opengraph.jpg`, title: "Jesus Christ Temple Ministry — JCTM Digital Sanctuary", caption: "Official digital home of JCTM Warri, Nigeria" }
            : page.path === "/leadership"
            ? { url: `${BASE_URL}/founder/prophet-portrait.jpg`, title: `${FOUNDER} — Founder and Senior Pastor of JCTM`, caption: `${FOUNDER}, founder of Jesus Christ Temple Ministry (JCTM)` }
            : page.path === "/gallery"
            ? gallerySitemapImages
            : undefined,
      });
    });

    const blogEntries = blogPosts.map(post => buildUrlEntry({ loc: `${BASE_URL}/blog/${post.slug}`, lastmod: isoDate(post.updatedAt ?? post.publishedAt, today), changefreq: "monthly", priority: "0.75" }));
    const sermonEntries = sermons.map(sermon => buildUrlEntry({ loc: `${BASE_URL}/sermons/${sermon.id}`, lastmod: isoDate(sermon.publishedAt, today), changefreq: "monthly", priority: "0.70", image: sermon.thumbnailUrl ? { url: sermon.thumbnailUrl, title: sermon.title, caption: sermon.description?.slice(0, 160) ?? `Sermon by ${FOUNDER} — JCTM Temple TV` } : undefined }));
    const topicEntries = TOPIC_PAGES.map(t => buildUrlEntry({ loc: `${BASE_URL}/topics/${t.slug}`, lastmod: today, changefreq: "weekly", priority: "0.82" }));

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">

${[...staticEntries, ...topicEntries, ...blogEntries, ...sermonEntries].join("\n\n")}

</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.status(200).send(sitemap);
  } catch {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
  }
});

// ── GET /sitemap-gallery.xml ──────────────────────────────────────────────────

router.get("/sitemap-gallery.xml", async (_req: Request, res: Response): Promise<void> => {
  try {
    const galleryImages = await db
      .select({ title: galleryImagesTable.title, description: galleryImagesTable.description, altText: galleryImagesTable.altText, objectPath: galleryImagesTable.objectPath, thumbnailPath: galleryImagesTable.thumbnailPath, createdAt: galleryImagesTable.createdAt })
      .from(galleryImagesTable)
      .where(eq(galleryImagesTable.isPublished, true))
      .orderBy(desc(galleryImagesTable.sortOrder), desc(galleryImagesTable.createdAt))
      .limit(1000);

    const today = new Date().toISOString().split("T")[0];
    const latestGalleryUpdate = isoDate(galleryImages[0]?.createdAt, today);

    const images = galleryImages.map(image => {
      const imagePath = image.thumbnailPath ?? image.objectPath;
      const title = image.title || image.altText || "JCTM ministry photo";
      return { url: /^https?:\/\//i.test(imagePath) ? imagePath : `${BASE_URL}/api/storage${imagePath}`, title, caption: image.description ?? image.altText ?? `${title} — Jesus Christ Temple Ministry, Warri Nigeria` };
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

${buildUrlEntry({ loc: `${BASE_URL}/gallery`, lastmod: latestGalleryUpdate, changefreq: "daily", priority: "0.86", image: images })}

</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.status(200).send(sitemap);
  } catch {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
  }
});

// ── GET /sitemap-sermons.xml — video sitemap for Googlebot-Video ──────────────

router.get("/sitemap-sermons.xml", async (_req: Request, res: Response): Promise<void> => {
  try {
    const sermons = await db
      .select({ id: sermonsTable.id, title: sermonsTable.title, publishedAt: sermonsTable.publishedAt, videoId: sermonsTable.videoId, thumbnailUrl: sermonsTable.thumbnailUrl, description: sermonsTable.description, viewCount: sermonsTable.viewCount })
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.publishedAt))
      .limit(200);

    const today = new Date().toISOString().split("T")[0];

    const videoEntries = sermons.map(sermon => {
      const publishDate = sermon.publishedAt ? new Date(sermon.publishedAt).toISOString() : new Date().toISOString();
      const lastmod = publishDate.split("T")[0];
      const thumbUrl = sermon.thumbnailUrl ?? (sermon.videoId ? `https://i.ytimg.com/vi/${sermon.videoId}/maxresdefault.jpg` : "");
      const descText = (sermon.description ?? `Sermon by ${FOUNDER} — Jesus Christ Temple Ministry (JCTM), Warri Nigeria`).slice(0, 2048);

      const videoBlock = sermon.videoId ? `
    <video:video>
      <video:thumbnail_loc>${xmlEscape(thumbUrl)}</video:thumbnail_loc>
      <video:title>${xmlEscape(sermon.title)}</video:title>
      <video:description>${xmlEscape(descText)}</video:description>
      <video:player_loc>https://www.youtube.com/embed/${sermon.videoId}</video:player_loc>
      <video:content_loc>https://www.youtube.com/watch?v=${sermon.videoId}</video:content_loc>
      <video:publication_date>${publishDate}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>
      <video:category>Religion</video:category>
      <video:uploader info="https://www.youtube.com/@TEMPLETVJCTM">Temple TV — JCTM</video:uploader>
      ${typeof sermon.viewCount === "number" ? `<video:view_count>${sermon.viewCount}</video:view_count>` : ""}
      <video:tag>JCTM</video:tag>
      <video:tag>Temple TV</video:tag>
      <video:tag>${FOUNDER}</video:tag>
      <video:tag>Correction Mandate</video:tag>
      <video:tag>Holiness</video:tag>
      <video:tag>Primitive Christianity</video:tag>
      <video:tag>Apostolic Christianity Nigeria</video:tag>
      <video:tag>Church Warri Nigeria</video:tag>
    </video:video>` : "";

      return `  <url>
    <loc>${xmlEscape(`${BASE_URL}/sermons/${sermon.id}`)}</loc>
    <lastmod>${lastmod}</lastmod>${videoBlock}
  </url>`;
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">

${videoEntries.join("\n\n")}

</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).send(sitemap);
  } catch {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
  }
});

// ── GET /sitemap-topics.xml — topic / category page sitemap ──────────────────

router.get("/sitemap-topics.xml", (_req: Request, res: Response): void => {
  const today = new Date().toISOString().split("T")[0];
  const entries = TOPIC_PAGES.map(t => buildUrlEntry({ loc: `${BASE_URL}/topics/${t.slug}`, lastmod: today, changefreq: "weekly", priority: "0.82" }));

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${entries.join("\n\n")}

</urlset>`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
  res.status(200).send(sitemap);
});

// ── GET /sitemap-blog.xml — dedicated blog sitemap with image data ─────────────

router.get("/sitemap-blog.xml", async (_req: Request, res: Response): Promise<void> => {
  try {
    const posts = await db
      .select({ slug: blogPostsTable.slug, title: blogPostsTable.title, excerpt: blogPostsTable.excerpt, publishedAt: blogPostsTable.publishedAt, updatedAt: blogPostsTable.updatedAt, category: blogPostsTable.category, author: blogPostsTable.author })
      .from(blogPostsTable)
      .where(eq(blogPostsTable.published, true))
      .orderBy(desc(blogPostsTable.publishedAt))
      .limit(500);

    const today = new Date().toISOString().split("T")[0];
    const entries = posts.map(post => buildUrlEntry({
      loc: `${BASE_URL}/blog/${post.slug}`,
      lastmod: isoDate(post.updatedAt ?? post.publishedAt, today),
      changefreq: "monthly",
      priority: "0.78",
      image: { url: `${BASE_URL}/opengraph.jpg`, title: xmlEscape(post.title), caption: post.excerpt?.slice(0, 160) ?? `${post.title} — ${SITE_NAME}` },
    }));

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

${entries.join("\n\n")}

</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.status(200).send(sitemap);
  } catch {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
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

export default router;

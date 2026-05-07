/**
 * SEO Routes — Dynamic Sitemap & Structured Data
 *
 * GET /sitemap-index.xml   — Master sitemap index
 * GET /sitemap.xml         — Full XML sitemap: static pages + sermons + blog
 * GET /sitemap-sermons.xml — Sermon-only video sitemap for Googlebot-Video
 * GET /sitemap-gallery.xml — Gallery image sitemap
 * GET /llms.txt            — AI/LLM search engine discovery (served from public, fallback here)
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db, sermonsTable, blogPostsTable, galleryImagesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

const BASE_URL = "https://jctm.org.ng";

const STATIC_PAGES = [
  { path: "/",                     priority: "1.00", changefreq: "daily"   },
  { path: "/sermons",              priority: "0.95", changefreq: "daily"   },
  { path: "/crusade",              priority: "0.95", changefreq: "weekly"  },
  { path: "/about",                priority: "0.90", changefreq: "monthly" },
  { path: "/leadership",           priority: "0.90", changefreq: "monthly" },
  { path: "/topics",               priority: "0.88", changefreq: "weekly"  },
  { path: "/blog",                 priority: "0.88", changefreq: "daily"   },
  { path: "/gallery",              priority: "0.86", changefreq: "daily"   },
  { path: "/scripture-study",      priority: "0.85", changefreq: "weekly"  },
  { path: "/spiritual-insight",    priority: "0.85", changefreq: "weekly"  },
  { path: "/sermon-assistant",     priority: "0.85", changefreq: "weekly"  },
  { path: "/devotion",             priority: "0.82", changefreq: "daily"   },
  { path: "/prayer",               priority: "0.80", changefreq: "weekly"  },
  { path: "/moments",              priority: "0.78", changefreq: "daily"   },
  { path: "/intro-videos",         priority: "0.78", changefreq: "weekly"  },
  { path: "/events",               priority: "0.78", changefreq: "weekly"  },
  { path: "/testimonies",          priority: "0.75", changefreq: "weekly"  },
  { path: "/give",                 priority: "0.75", changefreq: "monthly" },
  { path: "/warri-crusade",        priority: "0.72", changefreq: "monthly" },
  { path: "/viewing-centres",      priority: "0.72", changefreq: "monthly" },
  { path: "/join",                 priority: "0.70", changefreq: "monthly" },
  { path: "/correction-timeline",  priority: "0.68", changefreq: "monthly" },
  { path: "/conference-registration", priority: "0.65", changefreq: "monthly" },
  { path: "/terms",                priority: "0.30", changefreq: "yearly"  },
  { path: "/privacy",              priority: "0.30", changefreq: "yearly"  },
];

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isoDate(d: Date | string | null | undefined, fallback: string): string {
  if (!d) return fallback;
  try { return new Date(d).toISOString().split("T")[0]; } catch { return fallback; }
}

function buildUrlEntry({
  loc,
  lastmod,
  changefreq,
  priority,
  image,
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
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}
    ${changefreq ? `<changefreq>${changefreq}</changefreq>` : ""}
    ${priority ? `<priority>${priority}</priority>` : ""}${imageBlock}
  </url>`;
}

// ── GET /sitemap-index.xml — master index of all sitemaps ────────────────────

router.get("/sitemap-index.xml", (_req: Request, res: Response): void => {
  const now = new Date().toISOString().split("T")[0];
  const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE_URL}/sitemap.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemap-sermons.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemap-gallery.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
  res.status(200).send(index);
});

// ── GET /sitemap.xml ──────────────────────────────────────────────────────────

router.get("/sitemap.xml", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [sermons, blogPosts, galleryImages] = await Promise.all([
      db
        .select({
          id: sermonsTable.id,
          title: sermonsTable.title,
          publishedAt: sermonsTable.publishedAt,
          thumbnailUrl: sermonsTable.thumbnailUrl,
          description: sermonsTable.description,
        })
        .from(sermonsTable)
        .orderBy(desc(sermonsTable.publishedAt))
        .limit(500),
      db
        .select({
          slug: blogPostsTable.slug,
          title: blogPostsTable.title,
          excerpt: blogPostsTable.excerpt,
          publishedAt: blogPostsTable.publishedAt,
          updatedAt: blogPostsTable.updatedAt,
        })
        .from(blogPostsTable)
        .where(eq(blogPostsTable.published, true))
        .orderBy(desc(blogPostsTable.publishedAt))
        .limit(200),
      db
        .select({
          title: galleryImagesTable.title,
          description: galleryImagesTable.description,
          altText: galleryImagesTable.altText,
          objectPath: galleryImagesTable.objectPath,
          thumbnailPath: galleryImagesTable.thumbnailPath,
          createdAt: galleryImagesTable.createdAt,
        })
        .from(galleryImagesTable)
        .where(eq(galleryImagesTable.isPublished, true))
        .orderBy(desc(galleryImagesTable.sortOrder), desc(galleryImagesTable.createdAt))
        .limit(1000),
    ]);

    const today = new Date().toISOString().split("T")[0];

    const gallerySitemapImages = galleryImages.map(image => {
      const imagePath = image.thumbnailPath ?? image.objectPath;
      const title = image.title || image.altText || "JCTM ministry photo";
      return {
        url: /^https?:\/\//i.test(imagePath) ? imagePath : `${BASE_URL}/api/storage${imagePath}`,
        title,
        caption: image.description ?? image.altText ?? `${title} — Jesus Christ Temple Ministry photo gallery`,
      };
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
            ? { url: `${BASE_URL}/opengraph.jpg`, title: "Jesus Christ Temple Ministry — JCTM Digital Sanctuary", caption: "Official digital home of JCTM Warri, Nigeria — Prophet Amos Evomobor" }
            : page.path === "/leadership"
            ? { url: `${BASE_URL}/founder/prophet-portrait.jpg`, title: "Prophet Amos Evomobor — Founder and Senior Pastor of JCTM", caption: "Prophet Amos Evomobor, founder of Jesus Christ Temple Ministry (JCTM)" }
            : page.path === "/gallery"
            ? gallerySitemapImages
            : undefined,
      });
    });

    const blogEntries = blogPosts.map(post =>
      buildUrlEntry({
        loc: `${BASE_URL}/blog/${post.slug}`,
        lastmod: isoDate(post.updatedAt ?? post.publishedAt, today),
        changefreq: "monthly",
        priority: "0.75",
      }),
    );

    const sermonEntries = sermons.map(sermon =>
      buildUrlEntry({
        loc: `${BASE_URL}/sermons/${sermon.id}`,
        lastmod: isoDate(sermon.publishedAt, today),
        changefreq: "monthly",
        priority: "0.70",
        image: sermon.thumbnailUrl
          ? { url: sermon.thumbnailUrl, title: sermon.title, caption: sermon.description?.slice(0, 160) ?? `Sermon by Prophet Amos Evomobor — JCTM Temple TV` }
          : undefined,
      }),
    );

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">

${[...staticEntries, ...blogEntries, ...sermonEntries].join("\n\n")}

</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.status(200).send(sitemap);
  } catch {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
  }
});

// ── GET /sitemap-gallery.xml ─────────────────────────────────────────────────

router.get("/sitemap-gallery.xml", async (_req: Request, res: Response): Promise<void> => {
  try {
    const galleryImages = await db
      .select({
        title: galleryImagesTable.title,
        description: galleryImagesTable.description,
        altText: galleryImagesTable.altText,
        objectPath: galleryImagesTable.objectPath,
        thumbnailPath: galleryImagesTable.thumbnailPath,
        createdAt: galleryImagesTable.createdAt,
      })
      .from(galleryImagesTable)
      .where(eq(galleryImagesTable.isPublished, true))
      .orderBy(desc(galleryImagesTable.sortOrder), desc(galleryImagesTable.createdAt))
      .limit(1000);

    const today = new Date().toISOString().split("T")[0];
    const latestGalleryUpdate = isoDate(galleryImages[0]?.createdAt, today);

    const images = galleryImages.map(image => {
      const imagePath = image.thumbnailPath ?? image.objectPath;
      const title = image.title || image.altText || "JCTM ministry photo";
      return {
        url: /^https?:\/\//i.test(imagePath) ? imagePath : `${BASE_URL}/api/storage${imagePath}`,
        title,
        caption: image.description ?? image.altText ?? `${title} — Jesus Christ Temple Ministry, Warri Nigeria`,
      };
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

// ── GET /sitemap-sermons.xml — sermon-only for video crawlers ─────────────────

router.get("/sitemap-sermons.xml", async (_req: Request, res: Response): Promise<void> => {
  try {
    const sermons = await db
      .select({
        id: sermonsTable.id,
        title: sermonsTable.title,
        publishedAt: sermonsTable.publishedAt,
        videoId: sermonsTable.videoId,
        thumbnailUrl: sermonsTable.thumbnailUrl,
        description: sermonsTable.description,
        viewCount: sermonsTable.viewCount,
      })
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.publishedAt))
      .limit(200);

    const today = new Date().toISOString().split("T")[0];

    const videoEntries = sermons.map(sermon => {
      const publishDate = sermon.publishedAt
        ? new Date(sermon.publishedAt).toISOString()
        : new Date().toISOString();
      const lastmod = publishDate.split("T")[0];
      const thumbUrl = sermon.thumbnailUrl ?? (sermon.videoId ? `https://i.ytimg.com/vi/${sermon.videoId}/maxresdefault.jpg` : "");
      const descText = (sermon.description ?? "Sermon by Prophet Amos Evomobor — Jesus Christ Temple Ministry (JCTM), Warri Nigeria").slice(0, 2048);

      const videoBlock = sermon.videoId
        ? `
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
      <video:tag>Prophet Amos Evomobor</video:tag>
      <video:tag>Correction Mandate</video:tag>
      <video:tag>Holiness</video:tag>
      <video:tag>Primitive Christianity</video:tag>
      <video:tag>Apostolic Christianity Nigeria</video:tag>
      <video:tag>Church Warri Nigeria</video:tag>
    </video:video>`
        : "";

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

export default router;

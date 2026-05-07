import { Helmet } from "react-helmet-async";

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface SEOProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt?: string;
  /** "website" | "article" | "video" */
  type?: "website" | "article" | "video";
  keywords?: string;
  jsonLd?: object | object[];
  publishedTime?: string;
  modifiedTime?: string;
  articleSection?: string;
  articleTags?: string[];
  breadcrumbs?: BreadcrumbItem[];
  noIndex?: boolean;
  /** og:video support — pass the YouTube embed URL for video pages */
  videoUrl?: string;
  videoDuration?: number;
  videoThumbnail?: string;
}

const SITE_NAME = "Jesus Christ Temple Ministry (JCTM)";
const BASE_URL  = "https://jctm.org.ng";
const FB_APP_ID = ""; // placeholder — fill in if a Facebook App ID is configured
const DEFAULT_IMAGE        = `${BASE_URL}/opengraph.jpg`;
const DEFAULT_IMAGE_WIDTH  = 1200;
const DEFAULT_IMAGE_HEIGHT = 630;
const DEFAULT_KEYWORDS =
  "Jesus Christ Temple Ministry, JCTM, Temple TV, JCTM Warri, Prophet Amos Evomobor, " +
  "Correction Mandate, holiness church Nigeria, apostolic Christianity, primitive Christianity Nigeria, " +
  "JCTM Digital Sanctuary, Temple TV rebroadcast, JCTM rebroadcast now, church Nigeria, " +
  "Christian ministry Nigeria, holiness preaching, end time message Nigeria";

export function SEO({
  title,
  description,
  path = "/",
  image = DEFAULT_IMAGE,
  imageWidth = DEFAULT_IMAGE_WIDTH,
  imageHeight = DEFAULT_IMAGE_HEIGHT,
  imageAlt,
  type = "website",
  keywords,
  jsonLd,
  publishedTime,
  modifiedTime,
  articleSection,
  articleTags,
  breadcrumbs,
  noIndex = false,
  videoUrl,
  videoDuration,
  videoThumbnail,
}: SEOProps) {
  const canonicalUrl  = `${BASE_URL}${path}`;
  const fullTitle     = `${title} | JCTM`;
  const resolvedAlt   = imageAlt ?? title;
  const allKeywords   = keywords ? `${keywords}, ${DEFAULT_KEYWORDS}` : DEFAULT_KEYWORDS;
  const robotsContent = noIndex
    ? "noindex, nofollow"
    : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

  /* ── Breadcrumb schema ─────────────────────────────────────────────────── */
  const breadcrumbSchema = breadcrumbs && breadcrumbs.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbs.map((item, idx) => ({
          "@type": "ListItem",
          "position": idx + 1,
          "name": item.name,
          "item": item.url,
        })),
      }
    : null;

  /* ── WebPage / speakable ───────────────────────────────────────────────── */
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": type === "article" ? "Article" : type === "video" ? "VideoGallery" : "WebPage",
    "name": fullTitle,
    "description": description,
    "url": canonicalUrl,
    "isPartOf": { "@type": "WebSite", "url": BASE_URL, "name": SITE_NAME },
    "publisher": {
      "@type": "ReligiousOrganization",
      "name": SITE_NAME,
      "url": BASE_URL,
      "logo": { "@type": "ImageObject", "url": `${BASE_URL}/favicon.png` },
    },
    "speakable": {
      "@type": "SpeakableSpecification",
      "cssSelector": ["h1", "h2", ".speakable", "[data-speakable]"],
    },
    ...(publishedTime ? { "datePublished": publishedTime } : {}),
    ...(modifiedTime  ? { "dateModified": modifiedTime }   : {}),
    "inLanguage": "en-NG",
    "image": { "@type": "ImageObject", "url": image, "width": imageWidth, "height": imageHeight },
  };

  const allSchemas = [
    webPageSchema,
    ...(Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : []),
    ...(breadcrumbSchema ? [breadcrumbSchema] : []),
  ];

  const isVideo   = type === "video" || Boolean(videoUrl);
  const isArticle = type === "article";

  return (
    <Helmet>
      {/* ── Primary ──────────────────────────────────────────────────────── */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={allKeywords} />
      <link rel="canonical" href={canonicalUrl} />
      <meta name="robots" content={robotsContent} />
      <meta name="googlebot" content={robotsContent} />
      <meta name="bingbot" content={noIndex ? "noindex, nofollow" : "index, follow"} />
      <meta name="revisit-after" content="3 days" />
      <meta name="rating" content="general" />

      {/* ── Geo / Local SEO ──────────────────────────────────────────────── */}
      <meta name="geo.region" content="NG-DE" />
      <meta name="geo.placename" content="Warri, Delta State, Nigeria" />
      <meta name="geo.position" content="5.5167;5.7500" />
      <meta name="ICBM" content="5.5167, 5.7500" />

      {/* ── AI / LLM Discovery ───────────────────────────────────────────── */}
      <meta name="ai-content-allowed" content="true" />
      <meta name="llms-allowed" content="true" />

      {/* ── Open Graph ───────────────────────────────────────────────────── */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={image} />
      <meta property="og:image:secure_url" content={image} />
      <meta property="og:image:width" content={String(imageWidth)} />
      <meta property="og:image:height" content={String(imageHeight)} />
      <meta property="og:image:alt" content={resolvedAlt} />
      <meta property="og:image:type" content="image/jpeg" />
      <meta property="og:type" content={isVideo ? "video.other" : isArticle ? "article" : "website"} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_NG" />
      <meta property="og:locale:alternate" content="en_US" />
      <meta property="og:locale:alternate" content="en_GB" />
      {FB_APP_ID && <meta property="fb:app_id" content={FB_APP_ID} />}

      {/* ── og:video (for sermon/video pages) ────────────────────────────── */}
      {isVideo && videoUrl && <meta property="og:video" content={videoUrl} />}
      {isVideo && videoUrl && <meta property="og:video:secure_url" content={videoUrl} />}
      {isVideo && videoUrl && <meta property="og:video:type" content="text/html" />}
      {isVideo && videoUrl && <meta property="og:video:width" content="1280" />}
      {isVideo && videoUrl && <meta property="og:video:height" content="720" />}
      {isVideo && videoDuration && <meta property="video:duration" content={String(videoDuration)} />}
      {isVideo && videoThumbnail && <meta property="og:image" content={videoThumbnail} />}

      {/* ── Article metadata ─────────────────────────────────────────────── */}
      {isArticle && publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {isArticle && modifiedTime  && <meta property="article:modified_time"  content={modifiedTime}  />}
      {isArticle && <meta property="article:author"    content={`${BASE_URL}/leadership`} />}
      {isArticle && <meta property="article:publisher" content={BASE_URL} />}
      {isArticle && articleSection && <meta property="article:section" content={articleSection} />}
      {isArticle && articleTags && articleTags.map(tag => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}

      {/* ── Twitter / X ──────────────────────────────────────────────────── */}
      <meta name="twitter:card" content={isVideo ? "player" : "summary_large_image"} />
      <meta name="twitter:site" content="@templetvjctm" />
      <meta name="twitter:creator" content="@templetvjctm" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={videoThumbnail ?? image} />
      <meta name="twitter:image:alt" content={resolvedAlt} />
      {isVideo && videoUrl && <meta name="twitter:player" content={videoUrl} />}
      {isVideo && videoUrl && <meta name="twitter:player:width" content="1280" />}
      {isVideo && videoUrl && <meta name="twitter:player:height" content="720" />}

      {/* ── WhatsApp / Telegram rich link ────────────────────────────────── */}
      <meta property="og:image:width" content={String(imageWidth)} />

      {/* ── Pinterest rich pins ──────────────────────────────────────────── */}
      <meta name="pinterest-rich-pin" content="true" />

      {/* ── Speakable selector (Google Assistant / voice search) ─────────── */}
      <meta name="speakable-selector" content="h1, h2, .speakable, [data-speakable]" />

      {/* ── JSON-LD Schemas ───────────────────────────────────────────────── */}
      {allSchemas.length > 0 && (
        <script type="application/ld+json">
          {JSON.stringify(allSchemas.length === 1 ? allSchemas[0] : allSchemas)}
        </script>
      )}
    </Helmet>
  );
}

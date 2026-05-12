import { Helmet } from "react-helmet-async";

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface BreadcrumbItem {
  name: string;
  url:  string;
}

interface FAQItem {
  question: string;
  answer:   string;
}

interface HowToStep {
  name:        string;
  text:        string;
  imageUrl?:   string;
  url?:        string;
}

interface EventSchema {
  name:            string;
  startDate:       string;
  endDate?:        string;
  location?:       string;
  locationUrl?:    string;
  description?:    string;
  imageUrl?:       string;
  status?:         "EventScheduled" | "EventCancelled" | "EventPostponed" | "EventRescheduled" | "EventMovedOnline";
  attendance?:     "OnlineEventAttendanceMode" | "OfflineEventAttendanceMode" | "MixedEventAttendanceMode";
  organizer?:      string;
  performer?:      string;
  isAccessibleForFree?: boolean;
}

interface CourseSchema {
  name:        string;
  description: string;
  provider?:   string;
}

interface SEOProps {
  title:           string;
  description:     string;
  /** Canonical path, e.g. "/sermons/123". Alias of path. */
  path?:           string;
  /** Explicit canonical override (used by some pages as canonicalPath). */
  canonicalPath?:  string;
  image?:          string;
  imageWidth?:     number;
  imageHeight?:    number;
  imageAlt?:       string;
  /** "website" | "article" | "video" | "faq" | "howto" | "course" | "event" */
  type?:           "website" | "article" | "video" | "faq" | "howto" | "course" | "event";
  keywords?:       string;
  jsonLd?:         object | object[];
  publishedTime?:  string;
  modifiedTime?:   string;
  articleSection?: string;
  articleTags?:    string[];
  readTimeMinutes?: number;
  breadcrumbs?:    BreadcrumbItem[];
  noIndex?:        boolean;
  /** og:video — YouTube embed URL for video pages */
  videoUrl?:       string;
  videoDuration?:  number;
  videoThumbnail?: string;
  /** FAQPage schema items */
  faq?:            FAQItem[];
  /** HowTo schema */
  howTo?:          { name: string; description?: string; steps: HowToStep[] };
  /** Event schema */
  event?:          EventSchema;
  /** Course schema */
  course?:         CourseSchema;
  /** Number of views / interactions for video / article pages */
  viewCount?:      number;
  /** Topic name for sermon / article pages (links to /topics/:slug) */
  topicName?:      string;
  topicSlug?:      string;
}

/* ── Constants ─────────────────────────────────────────────────────────────── */

const SITE_NAME    = "Jesus Christ Temple Ministry (JCTM)";
const BASE_URL     = "https://jctm.org.ng";
const FOUNDER      = "Prophet Amos Evomobor";
const FB_APP_ID    = "";
const DEFAULT_IMAGE        = `${BASE_URL}/opengraph.jpg`;
const DEFAULT_IMAGE_WIDTH  = 1200;
const DEFAULT_IMAGE_HEIGHT = 630;

const DEFAULT_KEYWORDS =
  "Jesus Christ Temple Ministry, JCTM, Temple TV, JCTM Warri, Prophet Amos Evomobor, " +
  "Correction Mandate, holiness church Nigeria, apostolic Christianity, primitive Christianity Nigeria, " +
  "JCTM Digital Sanctuary, Temple TV rebroadcast, JCTM rebroadcast now, church Nigeria, " +
  "Christian ministry Nigeria, holiness preaching, end time message Nigeria";

/* ── Global Organization schema (emitted on every page) ────────────────────── */
const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "ReligiousOrganization",
  "@id": "https://jctm.org.ng/#organization",
  "name": "Jesus Christ Temple Ministry (JCTM)",
  "alternateName": ["JCTM", "Temple TV", "Jesus Christ Temple Ministry Warri"],
  "description": "Jesus Christ Temple Ministry (JCTM) is a holiness-centred, apostolic ministry in Warri, Nigeria, operating under the Correction Mandate — a divine assignment to restore primitive Christianity and correct false doctrines in the global church.",
  "url": "https://jctm.org.ng",
  "logo": {
    "@type": "ImageObject",
    "url": "https://jctm.org.ng/favicon.png",
    "width": 512,
    "height": 512,
  },
  "image": "https://jctm.org.ng/opengraph.jpg",
  "foundingDate": "2013-01-03",
  "founder": {
    "@type": "Person",
    "@id": "https://jctm.org.ng/#prophet",
    "name": "Prophet Amos Evomobor",
    "honorificPrefix": "Prophet",
    "jobTitle": "Prophet, Founder and Senior Pastor",
    "url": "https://jctm.org.ng/leadership",
    "sameAs": [
      "https://www.youtube.com/@TEMPLETVJCTM",
      "https://jctm.org.ng/leadership",
    ],
  },
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Km1 East West Rd., Ebrumede Roundabout, Effurun",
    "addressLocality": "Warri",
    "addressRegion": "Delta State",
    "postalCode": "330105",
    "addressCountry": "NG",
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 5.5167,
    "longitude": 5.75,
  },
  "telephone": "+2348081313111",
  "email": "info@jctm.org.ng",
  "sameAs": [
    "https://www.youtube.com/@TEMPLETVJCTM",
    "https://www.facebook.com/templetvjctm",
    "https://www.instagram.com/templetv.jctm/",
    "https://twitter.com/templetvjctm",
  ],
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Sunday",
      "opens": "08:00",
      "closes": "13:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Wednesday",
      "opens": "17:00",
      "closes": "20:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Friday",
      "opens": "17:00",
      "closes": "20:00",
    },
  ],
  "knowsAbout": [
    "Correction Mandate",
    "Primitive Christianity",
    "Holiness Doctrine",
    "Apostolic Christianity",
    "End Times Prophecy",
    "Water Baptism",
    "Doctrinal Correction",
    "Temple TV",
  ],
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "JCTM Ministry Resources",
    "itemListElement": [
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Temple TV Sermon Streaming", "url": "https://jctm.org.ng/sermons" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Daily Devotionals", "url": "https://jctm.org.ng/" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Online Giving", "url": "https://jctm.org.ng/give" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "AI Ministry Assistant (TempleBots)", "url": "https://jctm.org.ng/sermon-assistant" } },
    ],
  },
};

/* ── Global WebSite schema with SearchAction sitelinks box ──────────────────── */
const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://jctm.org.ng/#website",
  "name": "JCTM Digital Sanctuary",
  "alternateName": "Jesus Christ Temple Ministry",
  "url": "https://jctm.org.ng",
  "description": "Official digital home of Jesus Christ Temple Ministry (JCTM), Warri Nigeria — sermons, devotionals, testimonies, events, and ministry resources.",
  "inLanguage": "en-NG",
  "publisher": { "@id": "https://jctm.org.ng/#organization" },
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://jctm.org.ng/sermons?search={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

/* ── Component ─────────────────────────────────────────────────────────────── */

export function SEO({
  title,
  description,
  path              = "/",
  canonicalPath,
  image             = DEFAULT_IMAGE,
  imageWidth        = DEFAULT_IMAGE_WIDTH,
  imageHeight       = DEFAULT_IMAGE_HEIGHT,
  imageAlt,
  type              = "website",
  keywords,
  jsonLd,
  publishedTime,
  modifiedTime,
  articleSection,
  articleTags,
  readTimeMinutes,
  breadcrumbs,
  noIndex           = false,
  videoUrl,
  videoDuration,
  videoThumbnail,
  faq,
  howTo,
  event,
  course,
  viewCount,
  topicName,
  topicSlug,
}: SEOProps) {
  /* Canonical path: prefer explicit canonicalPath over path prop */
  const resolvedPath  = canonicalPath ?? path;
  const canonicalUrl  = `${BASE_URL}${resolvedPath}`;
  const fullTitle     = `${title} | JCTM`;
  const resolvedAlt   = imageAlt ?? title;
  const allKeywords   = keywords ? `${keywords}, ${DEFAULT_KEYWORDS}` : DEFAULT_KEYWORDS;

  const robotsContent = noIndex
    ? "noindex, nofollow"
    : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

  const isVideo   = type === "video"   || Boolean(videoUrl);
  const isArticle = type === "article";
  const isFaq     = type === "faq"     || Boolean(faq?.length);
  const isHowTo   = type === "howto"   || Boolean(howTo);
  const isEvent   = type === "event"   || Boolean(event);
  const isCourse  = type === "course"  || Boolean(course);

  /* ── Breadcrumb schema ───────────────────────────────────────────────────── */
  const breadcrumbSchema = breadcrumbs && breadcrumbs.length > 0
    ? {
        "@context":        "https://schema.org",
        "@type":           "BreadcrumbList",
        "itemListElement": breadcrumbs.map((item, idx) => ({
          "@type":    "ListItem",
          "position": idx + 1,
          "name":     item.name,
          "item":     item.url,
        })),
      }
    : null;

  /* ── WebPage / Article / VideoGallery schema ─────────────────────────────── */
  const schemaType = isArticle ? "Article"
    : isVideo   ? "VideoObject"
    : isFaq     ? "FAQPage"
    : isEvent   ? "EventPage"
    : isCourse  ? "Course"
    : isHowTo   ? "HowTo"
    : "WebPage";

  const webPageSchema: Record<string, unknown> = {
    "@context":   "https://schema.org",
    "@type":      schemaType,
    "name":       fullTitle,
    "description": description,
    "url":        canonicalUrl,
    "isPartOf":   { "@type": "WebSite", "url": BASE_URL, "name": SITE_NAME },
    "publisher":  {
      "@type": "ReligiousOrganization",
      "name":  SITE_NAME,
      "url":   BASE_URL,
      "logo":  { "@type": "ImageObject", "url": `${BASE_URL}/favicon.png` },
    },
    "speakable": {
      "@type":       "SpeakableSpecification",
      "cssSelector": ["h1", "h2", "h3", ".speakable", "[data-speakable]", "article p:first-of-type"],
      "xpath":       ["/html/body/main/h1", "/html/body/main/article/p[1]"],
    },
    ...(publishedTime  ? { "datePublished": publishedTime }  : {}),
    ...(modifiedTime   ? { "dateModified":  modifiedTime }   : {}),
    "inLanguage": "en-NG",
    "image": { "@type": "ImageObject", "url": image, "width": imageWidth, "height": imageHeight },
    ...(isArticle ? {
      "author":    { "@type": "Person", "name": FOUNDER, "url": `${BASE_URL}/leadership` },
      "headline":  title,
      ...(readTimeMinutes ? { "timeRequired": `PT${readTimeMinutes}M` } : {}),
      "accessibilityFeature":  ["alternativeText", "readingOrder", "tableOfContents"],
      "accessibilityHazard":   "none",
      "accessibilitySummary":  "Article contains structured headings and semantic markup",
    } : {}),
    ...(topicName && topicSlug ? {
      "about": {
        "@type": "Thing",
        "name":  topicName,
        "url":   `${BASE_URL}/topics/${topicSlug}`,
      },
    } : {}),
    ...(viewCount !== undefined ? {
      "interactionStatistic": {
        "@type":              "InteractionCounter",
        "interactionType":    "https://schema.org/WatchAction",
        "userInteractionCount": viewCount,
      },
    } : {}),
  };

  /* ── FAQPage schema ──────────────────────────────────────────────────────── */
  const faqSchema = faq && faq.length > 0
    ? {
        "@context":    "https://schema.org",
        "@type":       "FAQPage",
        "name":        fullTitle,
        "url":         canonicalUrl,
        "mainEntity":  faq.map(item => ({
          "@type":          "Question",
          "name":           item.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text":  item.answer,
          },
        })),
      }
    : null;

  /* ── HowTo schema ────────────────────────────────────────────────────────── */
  const howToSchema = howTo
    ? {
        "@context":    "https://schema.org",
        "@type":       "HowTo",
        "name":        howTo.name,
        "description": howTo.description ?? description,
        "url":         canonicalUrl,
        "image":       { "@type": "ImageObject", "url": image },
        "step":        howTo.steps.map((step, idx) => ({
          "@type":    "HowToStep",
          "position": idx + 1,
          "name":     step.name,
          "text":     step.text,
          ...(step.imageUrl ? { "image": { "@type": "ImageObject", "url": step.imageUrl } } : {}),
          ...(step.url      ? { "url":   step.url } : {}),
        })),
      }
    : null;

  /* ── Event schema ────────────────────────────────────────────────────────── */
  const eventSchema = event
    ? {
        "@context":         "https://schema.org",
        "@type":            "Event",
        "name":             event.name,
        "startDate":        event.startDate,
        ...(event.endDate   ? { "endDate": event.endDate } : {}),
        "description":      event.description ?? description,
        "url":              canonicalUrl,
        "image":            event.imageUrl ?? image,
        "eventStatus":      `https://schema.org/${event.status ?? "EventScheduled"}`,
        "eventAttendanceMode": `https://schema.org/${event.attendance ?? "MixedEventAttendanceMode"}`,
        "location": event.location
          ? {
              "@type":  "Place",
              "name":   event.location,
              "address": { "@type": "PostalAddress", "addressLocality": "Warri", "addressRegion": "Delta State", "addressCountry": "NG" },
              ...(event.locationUrl ? { "url": event.locationUrl } : {}),
            }
          : {
              "@type":  "Place",
              "name":   "Ebrumede Temple, Warri",
              "address": { "@type": "PostalAddress", "streetAddress": "Ebrumede Temple, Off Sapele Road", "addressLocality": "Warri", "addressRegion": "Delta State", "addressCountry": "NG" },
            },
        "organizer": {
          "@type": "Organization",
          "name":  event.organizer ?? SITE_NAME,
          "url":   BASE_URL,
        },
        ...(event.performer ? {
          "performer": { "@type": "Person", "name": event.performer },
        } : {}),
        ...(event.isAccessibleForFree !== undefined ? { "isAccessibleForFree": event.isAccessibleForFree } : {}),
      }
    : null;

  /* ── Course schema ───────────────────────────────────────────────────────── */
  const courseSchema = course
    ? {
        "@context":    "https://schema.org",
        "@type":       "Course",
        "name":        course.name,
        "description": course.description,
        "url":         canonicalUrl,
        "provider":    {
          "@type": "Organization",
          "name":  course.provider ?? SITE_NAME,
          "url":   BASE_URL,
        },
        "inLanguage": "en-NG",
        "isAccessibleForFree": true,
        "educationalLevel": "beginner",
        "teaches":     course.description,
      }
    : null;

  /* ── VideoObject schema (for sermon detail pages) ────────────────────────── */
  const videoSchema = isVideo && videoUrl
    ? {
        "@context":      "https://schema.org",
        "@type":         "VideoObject",
        "name":          title,
        "description":   description,
        "thumbnailUrl":  videoThumbnail ?? image,
        "contentUrl":    videoUrl,
        "embedUrl":      videoUrl,
        "uploadDate":    publishedTime ?? new Date().toISOString(),
        "duration":      videoDuration ? `PT${Math.floor(videoDuration / 60)}M${videoDuration % 60}S` : undefined,
        "publisher": {
          "@type": "Organization",
          "name":  SITE_NAME,
          "url":   BASE_URL,
          "logo":  { "@type": "ImageObject", "url": `${BASE_URL}/favicon.png` },
        },
        "author":  { "@type": "Person", "name": FOUNDER },
        "inLanguage": "en-NG",
        "isFamilyFriendly": true,
        ...(viewCount !== undefined ? {
          "interactionStatistic": {
            "@type":             "InteractionCounter",
            "interactionType":   "https://schema.org/WatchAction",
            "userInteractionCount": viewCount,
          },
        } : {}),
      }
    : null;

  /* ── Podcast episode schema (secondary type for sermons) ─────────────────── */
  const podcastEpisodeSchema = isVideo && videoUrl
    ? {
        "@context":    "https://schema.org",
        "@type":       "PodcastEpisode",
        "name":        title,
        "description": description,
        "url":         canonicalUrl,
        "datePublished": publishedTime ?? new Date().toISOString(),
        "partOfSeries": {
          "@type":     "PodcastSeries",
          "name":      "Temple TV — JCTM",
          "url":       `${BASE_URL}/sermons`,
          "webFeed":   `${BASE_URL}/rss.xml`,
        },
        "author":    { "@type": "Person", "name": FOUNDER },
        "publisher": { "@type": "Organization", "name": SITE_NAME, "url": BASE_URL },
      }
    : null;

  /* ── Collect all schemas ─────────────────────────────────────────────────── */
  const allSchemas: object[] = [
    ORGANIZATION_SCHEMA,
    WEBSITE_SCHEMA,
    webPageSchema,
    ...(Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : []),
    ...(breadcrumbSchema      ? [breadcrumbSchema]      : []),
    ...(faqSchema             ? [faqSchema]             : []),
    ...(howToSchema           ? [howToSchema]           : []),
    ...(eventSchema           ? [eventSchema]           : []),
    ...(courseSchema          ? [courseSchema]          : []),
    ...(videoSchema           ? [videoSchema]           : []),
    ...(podcastEpisodeSchema  ? [podcastEpisodeSchema]  : []),
  ];

  return (
    <Helmet>
      {/* ── Primary ────────────────────────────────────────────────────────── */}
      <title>{fullTitle}</title>
      <meta name="description"    content={description} />
      <meta name="keywords"       content={allKeywords} />
      <link rel="canonical"       href={canonicalUrl} />
      <meta name="robots"         content={robotsContent} />
      <meta name="googlebot"      content={robotsContent} />
      <meta name="bingbot"        content={noIndex ? "noindex, nofollow" : "index, follow"} />
      <meta name="revisit-after"  content="3 days" />
      <meta name="rating"         content="general" />

      {/* ── Alternate hreflang ─────────────────────────────────────────────── */}
      <link rel="alternate" hrefLang="en-NG"     href={canonicalUrl} />
      <link rel="alternate" hrefLang="en"        href={canonicalUrl} />
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />

      {/* ── Feed discovery ─────────────────────────────────────────────────── */}
      <link rel="alternate" type="application/rss+xml"  title={`${SITE_NAME} — RSS`}  href={`${BASE_URL}/rss.xml`}  />
      <link rel="alternate" type="application/atom+xml" title={`${SITE_NAME} — Atom`} href={`${BASE_URL}/atom.xml`} />

      {/* ── OpenSearch ─────────────────────────────────────────────────────── */}
      <link rel="search" type="application/opensearchdescription+xml" title="JCTM" href={`${BASE_URL}/opensearch.xml`} />

      {/* ── Geo / Local SEO ────────────────────────────────────────────────── */}
      <meta name="geo.region"    content="NG-DE" />
      <meta name="geo.placename" content="Warri, Delta State, Nigeria" />
      <meta name="geo.position"  content="5.5167;5.7500" />
      <meta name="ICBM"          content="5.5167, 5.7500" />

      {/* ── AI / LLM Discovery ─────────────────────────────────────────────── */}
      <meta name="ai-content-allowed" content="true" />
      <meta name="llms-allowed"       content="true" />
      <meta name="GPTBot"             content="index" />
      <meta name="ClaudeBot"          content="index" />
      <meta name="PerplexityBot"      content="index" />
      <link rel="alternate" type="text/plain" href={`${BASE_URL}/llms.txt`}      title="AI Discovery File" />
      <link rel="alternate" type="text/plain" href={`${BASE_URL}/llms-full.txt`} title="AI Discovery File (Full)" />

      {/* ── Article reading time ───────────────────────────────────────────── */}
      {isArticle && readTimeMinutes && (
        <meta name="twitter:label1"  content="Reading time" />
      )}
      {isArticle && readTimeMinutes && (
        <meta name="twitter:data1"   content={`${readTimeMinutes} min read`} />
      )}

      {/* ── Open Graph ─────────────────────────────────────────────────────── */}
      <meta property="og:title"            content={fullTitle} />
      <meta property="og:description"      content={description} />
      <meta property="og:url"              content={canonicalUrl} />
      <meta property="og:image"            content={image} />
      <meta property="og:image:secure_url" content={image} />
      <meta property="og:image:width"      content={String(imageWidth)} />
      <meta property="og:image:height"     content={String(imageHeight)} />
      <meta property="og:image:alt"        content={resolvedAlt} />
      <meta property="og:image:type"       content="image/jpeg" />
      <meta property="og:type"             content={isVideo ? "video.other" : isArticle ? "article" : "website"} />
      <meta property="og:site_name"        content={SITE_NAME} />
      <meta property="og:locale"           content="en_NG" />
      <meta property="og:locale:alternate" content="en_US" />
      <meta property="og:locale:alternate" content="en_GB" />
      {FB_APP_ID && <meta property="fb:app_id" content={FB_APP_ID} />}

      {/* ── og:video (sermon / video pages) ───────────────────────────────── */}
      {isVideo && videoUrl && <meta property="og:video"              content={videoUrl} />}
      {isVideo && videoUrl && <meta property="og:video:secure_url"   content={videoUrl} />}
      {isVideo && videoUrl && <meta property="og:video:type"         content="text/html" />}
      {isVideo && videoUrl && <meta property="og:video:width"        content="1280" />}
      {isVideo && videoUrl && <meta property="og:video:height"       content="720" />}
      {isVideo && videoDuration && <meta property="video:duration"   content={String(videoDuration)} />}
      {isVideo && videoThumbnail && <meta property="og:image"        content={videoThumbnail} />}

      {/* ── Article metadata ───────────────────────────────────────────────── */}
      {isArticle && publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {isArticle && modifiedTime  && <meta property="article:modified_time"  content={modifiedTime} />}
      {isArticle && <meta property="article:author"    content={`${BASE_URL}/leadership`} />}
      {isArticle && <meta property="article:publisher" content={BASE_URL} />}
      {isArticle && articleSection && <meta property="article:section" content={articleSection} />}
      {isArticle && articleTags && articleTags.map(tag => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}

      {/* ── Twitter / X ────────────────────────────────────────────────────── */}
      <meta name="twitter:card"        content={isVideo ? "player" : "summary_large_image"} />
      <meta name="twitter:site"        content="@templetvjctm" />
      <meta name="twitter:creator"     content="@templetvjctm" />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image"       content={videoThumbnail ?? image} />
      <meta name="twitter:image:alt"   content={resolvedAlt} />
      {isVideo && videoUrl && <meta name="twitter:player"        content={videoUrl} />}
      {isVideo && videoUrl && <meta name="twitter:player:width"  content="1280" />}
      {isVideo && videoUrl && <meta name="twitter:player:height" content="720" />}

      {/* ── Pinterest rich pins ────────────────────────────────────────────── */}
      <meta name="pinterest-rich-pin"   content="true" />

      {/* ── Speakable selector (Google Assistant / voice search) ─────────── */}
      <meta name="speakable-selector"   content="h1, h2, h3, .speakable, [data-speakable], article p:first-of-type" />

      {/* ── JSON-LD Schemas ────────────────────────────────────────────────── */}
      {allSchemas.length > 0 && (
        <script type="application/ld+json">
          {JSON.stringify(allSchemas.length === 1 ? allSchemas[0] : allSchemas)}
        </script>
      )}
    </Helmet>
  );
}

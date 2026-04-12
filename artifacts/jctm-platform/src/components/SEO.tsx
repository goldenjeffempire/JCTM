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
  type?: "website" | "article";
  keywords?: string;
  jsonLd?: object | object[];
  publishedTime?: string;
  modifiedTime?: string;
  breadcrumbs?: BreadcrumbItem[];
  noIndex?: boolean;
}

const SITE_NAME = "Jesus Christ Temple Ministry (JCTM)";
const BASE_URL = "https://jctm.org.ng";
const DEFAULT_IMAGE = `${BASE_URL}/opengraph.jpg`;
const DEFAULT_IMAGE_WIDTH = 1200;
const DEFAULT_IMAGE_HEIGHT = 630;
const DEFAULT_KEYWORDS =
  "Jesus Christ Temple Ministry, JCTM, Temple TV, JCTM Warri, Prophet Amos Evomobor, Correction Mandate, holiness church Nigeria, apostolic Christianity, primitive Christianity Nigeria, JCTM Digital Sanctuary, Temple TV rebroadcast, JCTM rebroadcast now";

export function SEO({
  title,
  description,
  path = "/",
  image = DEFAULT_IMAGE,
  imageWidth = DEFAULT_IMAGE_WIDTH,
  imageHeight = DEFAULT_IMAGE_HEIGHT,
  type = "website",
  keywords,
  jsonLd,
  publishedTime,
  modifiedTime,
  breadcrumbs,
  noIndex = false,
}: SEOProps) {
  const canonicalUrl = `${BASE_URL}${path}`;
  const fullTitle = `${title} | JCTM`;
  const allKeywords = keywords
    ? `${keywords}, ${DEFAULT_KEYWORDS}`
    : DEFAULT_KEYWORDS;

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

  const allSchemas = [
    ...(Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : []),
    ...(breadcrumbSchema ? [breadcrumbSchema] : []),
  ];

  return (
    <Helmet>
      {/* Primary */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={allKeywords} />
      <link rel="canonical" href={canonicalUrl} />
      <meta name="robots" content={noIndex ? "noindex, nofollow" : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"} />
      <meta name="googlebot" content={noIndex ? "noindex, nofollow" : "index, follow, max-snippet:-1, max-image-preview:large"} />

      {/* Geo (Local SEO) */}
      <meta name="geo.region" content="NG-DE" />
      <meta name="geo.placename" content="Warri, Delta State, Nigeria" />
      <meta name="geo.position" content="5.5167;5.7500" />
      <meta name="ICBM" content="5.5167, 5.7500" />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content={String(imageWidth)} />
      <meta property="og:image:height" content={String(imageHeight)} />
      <meta property="og:image:alt" content={title} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_NG" />

      {/* Article metadata */}
      {type === "article" && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === "article" && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {type === "article" && (
        <meta property="article:author" content="Prophet Amos Evomobor — Jesus Christ Temple Ministry" />
      )}
      {type === "article" && (
        <meta property="article:publisher" content="https://jctm.org.ng" />
      )}

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@templetvjctm" />
      <meta name="twitter:creator" content="@templetvjctm" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={title} />

      {/* Speakable (Google Assistant / Voice) */}
      <meta name="speakable-selector" content="h1, h2, .speakable" />

      {/* JSON-LD Schemas */}
      {allSchemas.length > 0 && (
        <script type="application/ld+json">
          {JSON.stringify(allSchemas)}
        </script>
      )}
    </Helmet>
  );
}

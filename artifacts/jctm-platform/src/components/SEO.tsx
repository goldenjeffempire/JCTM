import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  keywords?: string;
  jsonLd?: object | object[];
}

const SITE_NAME = "Jesus Christ Temple Ministry (JCTM)";
const BASE_URL = "https://jctm.org.ng";
const DEFAULT_IMAGE = `${BASE_URL}/opengraph.jpg`;
const DEFAULT_KEYWORDS =
  "Jesus Christ Temple Ministry, JCTM, Temple TV, JCTM Warri, Prophet Amos Evomobor, Correction Mandate, holiness church Nigeria, apostolic Christianity";

export function SEO({
  title,
  description,
  path = "/",
  image = DEFAULT_IMAGE,
  type = "website",
  keywords,
  jsonLd,
}: SEOProps) {
  const canonicalUrl = `${BASE_URL}${path}`;
  const fullTitle = `${title} | JCTM`;
  const allKeywords = keywords
    ? `${keywords}, ${DEFAULT_KEYWORDS}`
    : DEFAULT_KEYWORDS;

  return (
    <Helmet>
      {/* Primary */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={allKeywords} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content={title} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@templetvjctm" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={title} />

      {/* JSON-LD */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(Array.isArray(jsonLd) ? jsonLd : [jsonLd])}
        </script>
      )}
    </Helmet>
  );
}

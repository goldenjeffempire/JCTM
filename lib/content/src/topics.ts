/**
 * Canonical list of JCTM topic pages.
 *
 * This is the single source of truth for topic slugs, titles, and descriptions.
 * Both the frontend (artifacts/jctm-platform) and the API server sitemap route
 * (artifacts/api-server/src/routes/seo.ts) import from here so that a rename
 * or addition is reflected in both places automatically.
 *
 * Keep this file free of React, Lucide, and any other browser/framework
 * dependencies — it must be importable by the Node.js API server as-is.
 */

export interface TopicEntry {
  /** URL slug, e.g. "holiness" → /topics/holiness */
  slug: string;
  /** Human-readable page label used in sitemaps and navigation */
  label: string;
  /** Short description used in sitemap <desc> and meta tags */
  desc: string;
}

export const TOPIC_ENTRIES = [
  {
    slug: "holiness",
    label: "Holiness",
    desc: "The doctrine of holiness — 'without holiness, no man shall see the Lord' (Hebrews 12:14)",
  },
  {
    slug: "correction-mandate",
    label: "The Correction Mandate",
    desc: "JCTM's divine assignment to identify and correct five major doctrinal errors in the global church",
  },
  {
    slug: "primitive-christianity",
    label: "Primitive Christianity",
    desc: "A return to the original, unadulterated first-century apostolic faith",
  },
  {
    slug: "healing-miracles",
    label: "Healing & Miracles",
    desc: "God's healing power at work through prayer and faith — divine healing, miracles, and deliverance",
  },
  {
    slug: "end-times",
    label: "End Times & Rapture",
    desc: "Signs of the last days, the imminent return of Christ, and how to be ready for His coming",
  },
  {
    slug: "water-baptism",
    label: "Water Baptism",
    desc: "New Testament doctrine of water baptism — its true meaning, mode, and JCTM's teaching",
  },
  {
    slug: "prayer-intercession",
    label: "Prayer & Intercession",
    desc: "Biblical principles of prayer, intercession, and fasting — communion with God and standing in the gap",
  },
  {
    slug: "family-marriage",
    label: "Family & Marriage",
    desc: "God's design for the family — marriage, parenting, and building a home that honours Christ",
  },
] as const satisfies TopicEntry[];

/** Inferred union of all valid topic slugs — used for type-safe route params. */
export type TopicSlug = (typeof TOPIC_ENTRIES)[number]["slug"];

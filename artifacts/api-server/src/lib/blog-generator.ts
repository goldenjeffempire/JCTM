/**
 * Local Blog Generator — Zero External API
 *
 * Generates SEO-optimized faith-based blog posts for JCTM.
 * Uses local content intelligence templates — no OpenAI required.
 */

import { db, sermonsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logger } from "./logger.js";
import { generateBlogContent, categorize } from "./local-content-intelligence.js";

export const BLOG_TOPICS = [
  { title: "What Is Primitive Christianity? A Return to Apostolic Faith", category: "correction", tags: ["primitive-christianity", "apostolic", "correction-mandate"] },
  { title: "The Prosperity Gospel Exposed: What the Bible Really Says About Wealth", category: "correction", tags: ["prosperity-gospel", "false-doctrine", "biblical-truth"] },
  { title: "Baptism by Full Immersion: Why Mode Matters in Scripture", category: "doctrine", tags: ["baptism", "immersion", "ordinance"] },
  { title: "Speaking in Tongues: The Biblical Evidence for Spirit Baptism", category: "holiness", tags: ["tongues", "spirit-baptism", "pentecost"] },
  { title: "Who Are the True Five-Fold Ministers? Apostles, Prophets, and the Modern Church", category: "ministry", tags: ["five-fold", "apostle", "prophet"] },
  { title: "The Correction Mandate: God's Call to Restore the Gospel", category: "correction", tags: ["correction-mandate", "jctm", "prophet-amos"] },
  { title: "False Prophets in the Modern Church: A Biblical Checklist", category: "doctrine", tags: ["false-prophets", "discernment", "scripture"] },
  { title: "Holiness in the 21st Century: Is It Still Required?", category: "holiness", tags: ["holiness", "sanctification", "christian-living"] },
  { title: "The Original Gospel: What Christianity Looked Like Before Corruption", category: "correction", tags: ["church-history", "early-church", "apostolic"] },
  { title: "Prophet Amos Evomobor and the JCTM Mission: A Ministry Profile", category: "ministry", tags: ["prophet-amos", "jctm", "warri-nigeria"] },
  { title: "Without Holiness No Man Shall See the Lord — What This Means Today", category: "holiness", tags: ["holiness", "hebrews-12-14", "salvation"] },
  { title: "Water Baptism vs Sprinkling: The Shocking Biblical Truth", category: "doctrine", tags: ["baptism", "sprinkling", "full-immersion"] },
  { title: "How to Test the Spirits: A Biblical Guide to Discernment", category: "doctrine", tags: ["discernment", "false-prophets", "1-john-4"] },
  { title: "What the First-Century Church Got Right (And We Got Wrong)", category: "correction", tags: ["early-church", "apostolic", "primitive-christianity"] },
  { title: "The Holy Spirit Baptism: Evidence, Purpose, and Power", category: "holiness", tags: ["holy-spirit", "spirit-baptism", "pentecost"] },
];

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export interface GeneratedBlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  topic: string;
  category: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  schemaJson: string;
}

export async function generateBlogPost(
  topic: (typeof BLOG_TOPICS)[0],
  _openai?: unknown,
): Promise<GeneratedBlogPost> {
  let sermonContext = "";

  try {
    const sermons = await db
      .select({ title: sermonsTable.title, description: sermonsTable.description })
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.publishedAt))
      .limit(3);

    sermonContext = sermons
      .map(s => s.description?.slice(0, 80) ?? "")
      .filter(Boolean)
      .join(" ");
  } catch (err) {
    logger.warn({ err }, "Could not fetch sermon context for blog generation");
  }

  const { content, excerpt } = generateBlogContent(topic.title, topic.category, sermonContext);

  const BASE_URL = "https://jctm.org.ng";
  const slug = generateSlug(topic.title);

  const seoTitle = topic.title.slice(0, 60);
  const seoDescription = `${topic.title} — ${excerpt.slice(0, 110).trim()} | JCTM`.slice(0, 155);

  const schemaJson = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": topic.title,
    "description": seoDescription,
    "author": {
      "@type": "Organization",
      "name": "Jesus Christ Temple Ministry (JCTM)",
      "url": BASE_URL,
    },
    "publisher": {
      "@type": "Organization",
      "name": "JCTM Digital Sanctuary",
      "logo": { "@type": "ImageObject", "url": `${BASE_URL}/jctm-logo.png` },
    },
    "url": `${BASE_URL}/blog/${slug}`,
    "keywords": topic.tags.join(", "),
    "inLanguage": "en-NG",
    "datePublished": new Date().toISOString().split("T")[0],
  });

  return {
    slug,
    title: topic.title,
    excerpt,
    content,
    topic: topic.category,
    category: topic.category,
    tags: topic.tags,
    seoTitle,
    seoDescription,
    schemaJson,
  };
}

export async function generateSermonTranscriptSummary(
  sermonTitle: string,
  description: string,
  _openai?: unknown,
): Promise<string> {
  const { summarizeSermon } = await import("./local-content-intelligence.js");
  const result = summarizeSermon(sermonTitle, description);
  return [
    result.summary,
    result.bulletPoints.map((b, i) => `${i + 1}. ${b}`).join("\n"),
  ].filter(Boolean).join("\n\n");
}

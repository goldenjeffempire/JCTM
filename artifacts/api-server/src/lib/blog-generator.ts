/**
 * AI Blog Generator
 *
 * Generates SEO-optimized faith-based blog posts for the JCTM platform.
 * Topics are drawn from JCTM doctrine, sermon themes, Bible passages,
 * and ministry events to dominate Google search rankings.
 */

import type OpenAI from "openai";
import { db, sermonsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logger } from "./logger.js";

export const BLOG_TOPICS = [
  { title: "What Is Primitive Christianity? A Return to Apostolic Faith", category: "doctrine", tags: ["primitive-christianity", "apostolic", "correction-mandate"] },
  { title: "The Prosperity Gospel Exposed: What the Bible Really Says About Wealth", category: "correction", tags: ["prosperity-gospel", "false-doctrine", "biblical-truth"] },
  { title: "Baptism by Full Immersion: Why Mode Matters in Scripture", category: "sacraments", tags: ["baptism", "immersion", "ordinance"] },
  { title: "Speaking in Tongues: The Biblical Evidence for Spirit Baptism", category: "holy-spirit", tags: ["tongues", "spirit-baptism", "pentecost"] },
  { title: "Who Are the True Five-Fold Ministers? Apostles, Prophets, and the Modern Church", category: "ministry", tags: ["five-fold", "apostle", "prophet"] },
  { title: "The Correction Mandate: God's Call to Restore the Gospel", category: "mandate", tags: ["correction-mandate", "jctm", "prophet-amos"] },
  { title: "False Prophets in the Modern Church: A Biblical Checklist", category: "discernment", tags: ["false-prophets", "discernment", "scripture"] },
  { title: "Holiness in the 21st Century: Is It Still Required?", category: "holiness", tags: ["holiness", "sanctification", "christian-living"] },
  { title: "The Original Gospel: What Christianity Looked Like Before Corruption", category: "history", tags: ["church-history", "early-church", "apostolic"] },
  { title: "Prophet Amos Evomobor and the JCTM Mission: A Ministry Profile", category: "ministry", tags: ["prophet-amos", "jctm", "warri-nigeria"] },
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
  topic: typeof BLOG_TOPICS[0],
  openai: OpenAI,
): Promise<GeneratedBlogPost> {
  const sermons = await db
    .select({ title: sermonsTable.title, description: sermonsTable.description })
    .from(sermonsTable)
    .orderBy(desc(sermonsTable.publishedAt))
    .limit(5);

  const sermonContext = sermons
    .map(s => `- ${s.title}: ${s.description?.slice(0, 100) ?? ""}`)
    .join("\n");

  const prompt = `You are a content writer for Jesus Christ Temple Ministry (JCTM), the digital ministry of Prophet Amos Evomobor in Warri, Nigeria.

Write a comprehensive, SEO-optimized blog post on this topic:
Title: "${topic.title}"
Category: ${topic.category}

Recent JCTM sermons for context:
${sermonContext}

Requirements:
- 800-1200 words, well-structured with H2 subheadings
- Scripture references (KJV preferred)
- JCTM doctrinal voice: bold, apostolic, rooted in Primitive Christianity
- End with a call to watch Temple TV (@TEMPLETVJCTM on YouTube)
- No prosperity gospel endorsement
- SEO-rich naturally (include topic keywords organically)

Also provide:
- excerpt: 2-sentence summary (max 200 chars)
- metaTitle: SEO title (max 60 chars)
- metaDescription: SEO description (max 155 chars)

Format as JSON:
{
  "content": "full blog post HTML with h2 tags",
  "excerpt": "...",
  "metaTitle": "...",
  "metaDescription": "..."
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2000,
    temperature: 0.6,
    response_format: { type: "json_object" },
  });

  let parsed: Record<string, string> = {};
  try {
    parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  } catch {
    logger.warn("Failed to parse blog generation response");
  }

  const BASE_URL = "https://jctm.org.ng";
  const slug = generateSlug(topic.title);

  const schemaJson = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": topic.title,
    "description": parsed.metaDescription ?? topic.title,
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
  });

  return {
    slug,
    title: topic.title,
    excerpt: parsed.excerpt ?? "",
    content: parsed.content ?? "",
    topic: topic.category,
    category: topic.category,
    tags: topic.tags,
    seoTitle: parsed.metaTitle ?? topic.title.slice(0, 60),
    seoDescription: parsed.metaDescription ?? "",
    schemaJson,
  };
}

export async function generateSermonTranscriptSummary(
  sermonTitle: string,
  description: string,
  openai: OpenAI,
): Promise<string> {
  const prompt = `Create a detailed transcript-style summary of this JCTM sermon for SEO indexing.

Title: "${sermonTitle}"
Description: "${description}"

Write 3-4 paragraphs that:
1. Summarize the key teaching points
2. Quote likely scripture references
3. Explain the doctrinal significance in JCTM's context
4. Include searchable theological terms

This will be indexed for semantic search. Be thorough and specific.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 600,
    temperature: 0.4,
  });

  return completion.choices[0]?.message?.content ?? "";
}

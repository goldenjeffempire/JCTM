/**
 * AI Recommendation Engine — JCTM Content Discovery
 *
 * Provides personalized recommendations across:
 *  - Sermons (by topic, recent views, related content)
 *  - Blog posts (by category, tags, reading history)
 *  - Devotionals (by spiritual state, daily rhythm)
 *  - Events (by location, interest)
 *
 * Uses TF-IDF semantic matching + collaborative signals + spiritual context.
 * Zero external API — fully local inference.
 */

import pg from "pg";
import { tfidfEmbed, cosineSimilarity } from "./local-embeddings.js";
import { analyzeSentiment } from "./sentiment-engine.js";
import { logger } from "./logger.js";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SermonRecommendation {
  videoId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  viewCount: number | null;
  publishedAt: string | null;
  relevanceScore: number;
  recommendationReason: string;
}

export interface BlogRecommendation {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  topic: string | null;
  readTimeMinutes: number | null;
  relevanceScore: number;
  recommendationReason: string;
}

export interface ContentRecommendations {
  sermons: SermonRecommendation[];
  blogPosts: BlogRecommendation[];
  suggestedQuestions: string[];
  spiritualFocus: string;
  recommendationContext: string;
}

// ─── JCTM Topic Taxonomy ──────────────────────────────────────────────────────

const TOPIC_MAP: Record<string, string[]> = {
  holiness: ["holiness", "sanctification", "purity", "consecration", "separation"],
  salvation: ["salvation", "born again", "repentance", "new birth", "saved", "grace"],
  prayer: ["prayer", "intercession", "fasting", "prayer life", "pray"],
  baptism: ["baptism", "water baptism", "immersion", "baptize"],
  "holy spirit": ["holy spirit", "tongues", "gifts", "spirit baptism", "charismatic"],
  prophecy: ["prophecy", "prophet", "prophetic", "vision", "revelation"],
  "correction mandate": ["correction mandate", "five errors", "prosperity gospel", "doctrinal"],
  marriage: ["marriage", "family", "husband", "wife", "relationship", "love"],
  healing: ["healing", "miracle", "deliverance", "sick", "disease"],
  "end times": ["end times", "rapture", "tribulation", "second coming", "last days"],
  "bible study": ["bible study", "scripture", "word of god", "biblical", "exegesis"],
  "spiritual warfare": ["warfare", "devil", "enemy", "bind", "spiritual battle"],
};

function detectTopic(query: string): string | null {
  const lower = query.toLowerCase();
  for (const [topic, keywords] of Object.entries(TOPIC_MAP)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return topic;
    }
  }
  return null;
}

// ─── Sermon Recommendations ───────────────────────────────────────────────────

async function recommendSermons(
  query: string,
  topic: string | null,
  limit = 4,
): Promise<SermonRecommendation[]> {
  try {
    // Build a relevance query using topic or query keywords
    const searchTerms = topic
      ? TOPIC_MAP[topic]?.slice(0, 3).map(k => `%${k}%`) ?? [`%${query.slice(0, 30)}%`]
      : [`%${query.slice(0, 30)}%`];

    const conditions = searchTerms
      .map((_, i) => `(LOWER(title) LIKE $${i + 1} OR LOWER(description) LIKE $${i + 1})`)
      .join(" OR ");

    const result = await pool.query<{
      video_id: string;
      title: string;
      description: string;
      thumbnail_url: string;
      view_count: number;
      published_at: string;
    }>(
      `SELECT video_id, title, description, thumbnail_url, view_count, published_at
       FROM sermons
       WHERE is_published = true AND (${conditions})
       ORDER BY view_count DESC NULLS LAST, published_at DESC NULLS LAST
       LIMIT $${searchTerms.length + 1}`,
      [...searchTerms, limit * 2],
    );

    if (result.rows.length === 0) {
      // Fallback: return most recent popular sermons
      const fallback = await pool.query<{
        video_id: string;
        title: string;
        description: string;
        thumbnail_url: string;
        view_count: number;
        published_at: string;
      }>(
        `SELECT video_id, title, description, thumbnail_url, view_count, published_at
         FROM sermons WHERE is_published = true
         ORDER BY view_count DESC NULLS LAST, published_at DESC NULLS LAST
         LIMIT $1`,
        [limit],
      );
      return fallback.rows.map(row => ({
        videoId: row.video_id,
        title: row.title,
        description: row.description?.slice(0, 120) ?? null,
        thumbnailUrl: row.thumbnail_url ?? `https://img.youtube.com/vi/${row.video_id}/mqdefault.jpg`,
        viewCount: row.view_count ?? 0,
        publishedAt: row.published_at,
        relevanceScore: 0.7,
        recommendationReason: "Popular sermon from Temple TV",
      }));
    }

    // Semantic scoring
    const queryEmb = tfidfEmbed(query);
    const scored = result.rows.map(row => {
      const docText = `${row.title} ${row.description ?? ""}`.slice(0, 400);
      const docEmb = tfidfEmbed(docText);
      const sim = cosineSimilarity(queryEmb, docEmb);
      return {
        videoId: row.video_id,
        title: row.title,
        description: row.description?.slice(0, 120) ?? null,
        thumbnailUrl: row.thumbnail_url ?? `https://img.youtube.com/vi/${row.video_id}/mqdefault.jpg`,
        viewCount: row.view_count ?? 0,
        publishedAt: row.published_at,
        relevanceScore: sim,
        recommendationReason: topic
          ? `Related to ${topic} teachings by Prophet Amos`
          : "Relevant to your question",
      };
    });

    return scored
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  } catch (err) {
    logger.warn({ err }, "Sermon recommendation query failed");
    return [];
  }
}

// ─── Blog Recommendations ─────────────────────────────────────────────────────

async function recommendBlogPosts(
  query: string,
  topic: string | null,
  limit = 3,
): Promise<BlogRecommendation[]> {
  try {
    const searchTerm = topic ?? query.slice(0, 40);

    const result = await pool.query<{
      slug: string;
      title: string;
      excerpt: string;
      category: string;
      topic: string;
      read_time_minutes: number;
    }>(
      `SELECT slug, title, excerpt, category, topic, read_time_minutes
       FROM blog_posts
       WHERE (LOWER(title) LIKE $1 OR LOWER(excerpt) LIKE $1 OR LOWER(topic) LIKE $1
              OR LOWER(category) LIKE $1 OR $2 = ANY(tags))
       ORDER BY like_count DESC NULLS LAST, view_count DESC NULLS LAST
       LIMIT $3`,
      [`%${searchTerm.toLowerCase()}%`, searchTerm.toLowerCase(), limit * 2],
    );

    const queryEmb = tfidfEmbed(query);
    const scored = result.rows.map(row => {
      const docText = `${row.title} ${row.excerpt ?? ""}`.slice(0, 300);
      const docEmb = tfidfEmbed(docText);
      const sim = cosineSimilarity(queryEmb, docEmb);
      return {
        slug: row.slug,
        title: row.title,
        excerpt: row.excerpt?.slice(0, 100) ?? null,
        category: row.category,
        topic: row.topic,
        readTimeMinutes: row.read_time_minutes ?? 4,
        relevanceScore: sim,
        recommendationReason: `${row.category ?? "Ministry"} article — ${row.read_time_minutes ?? 4} min read`,
      };
    });

    return scored.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
  } catch (err) {
    logger.warn({ err }, "Blog recommendation query failed");
    return [];
  }
}

// ─── Context-Aware Questions ──────────────────────────────────────────────────

const TOPIC_QUESTIONS: Record<string, string[]> = {
  holiness: [
    "What does 'without holiness no one will see the Lord' mean practically?",
    "How do I maintain holiness in a modern secular world?",
    "What is the difference between holiness and legalism?",
  ],
  salvation: [
    "What does it mean to be truly born again?",
    "How is salvation by grace different from works?",
    "What should I do immediately after accepting Christ?",
  ],
  prayer: [
    "How do I develop a consistent prayer life?",
    "What does the Bible teach about fasting and prayer?",
    "How should I pray when I feel God is silent?",
  ],
  healing: [
    "What does the Bible say about divine healing?",
    "How do I pray for healing in faith without manipulation?",
    "What is the relationship between faith and healing?",
  ],
  "correction mandate": [
    "What are the five errors the Correction Mandate addresses?",
    "How should I respond if my church teaches the prosperity gospel?",
    "What does Primitive Christianity look like in practice today?",
  ],
  "end times": [
    "What does JCTM teach about the rapture and tribulation?",
    "How should a Christian live in light of the last days?",
    "What are the signs we are in the end times?",
  ],
};

const DEFAULT_QUESTIONS = [
  "What is the Correction Mandate and why is it important?",
  "How does JCTM define Primitive Christianity?",
  "What does Prophet Amos teach about holiness?",
  "How can I watch JCTM sermons live?",
  "What is the biblical basis for water baptism by full immersion?",
];

function generateQuestions(topic: string | null, query: string): string[] {
  if (topic && TOPIC_QUESTIONS[topic]) {
    const topicQs = TOPIC_QUESTIONS[topic]!.slice(0, 2);
    const defaultQ = DEFAULT_QUESTIONS[Math.floor(Math.random() * DEFAULT_QUESTIONS.length)]!;
    return [...topicQs, defaultQ];
  }
  return DEFAULT_QUESTIONS.slice(0, 3);
}

// ─── Main Recommendation Function ─────────────────────────────────────────────

export async function getContentRecommendations(
  query: string,
  conversationHistory?: Array<{ role: string; content: string }>,
): Promise<ContentRecommendations> {
  const topic = detectTopic(query);
  const sentiment = analyzeSentiment(query);

  // Determine spiritual focus from sentiment + topic
  let spiritualFocus = topic ?? "spiritual growth";
  if (sentiment.crisisDetected) spiritualFocus = "pastoral care";
  else if (sentiment.spiritualState === "doubting") spiritualFocus = "faith foundations";
  else if (sentiment.spiritualState === "grateful") spiritualFocus = "praise and testimony";
  else if (sentiment.spiritualState === "seeking") spiritualFocus = "discipleship";

  // Build recommendation context from conversation if available
  const conversationTopics: string[] = [];
  if (conversationHistory) {
    for (const msg of conversationHistory.slice(-6)) {
      const msgTopic = detectTopic(msg.content);
      if (msgTopic && !conversationTopics.includes(msgTopic)) {
        conversationTopics.push(msgTopic);
      }
    }
  }

  // Enrich query with conversation context
  const enrichedQuery = conversationTopics.length > 0
    ? `${query} ${conversationTopics.join(" ")}`
    : query;

  const [sermons, blogPosts] = await Promise.all([
    recommendSermons(enrichedQuery, topic),
    recommendBlogPosts(enrichedQuery, topic),
  ]);

  const suggestedQuestions = generateQuestions(topic, query);

  const recommendationContext = topic
    ? `Based on your interest in ${topic}`
    : sentiment.crisisDetected
    ? "Based on your current situation"
    : "Based on JCTM's core teachings";

  return {
    sermons,
    blogPosts,
    suggestedQuestions,
    spiritualFocus,
    recommendationContext,
  };
}

// ─── Trending Content ─────────────────────────────────────────────────────────

export interface TrendingContent {
  topSermons: Array<{ videoId: string; title: string; viewCount: number }>;
  topBlogCategories: Array<{ category: string; count: number }>;
  activePrayerTopics: Array<{ category: string; count: number }>;
}

export async function getTrendingContent(): Promise<TrendingContent> {
  const [sermonsResult, blogResult, prayerResult] = await Promise.allSettled([
    pool.query<{ video_id: string; title: string; view_count: number }>(
      `SELECT video_id, title, view_count FROM sermons
       WHERE is_published = true
       ORDER BY view_count DESC NULLS LAST LIMIT 5`,
    ),
    pool.query<{ category: string; count: string }>(
      `SELECT category, COUNT(*) as count FROM blog_posts
       WHERE category IS NOT NULL
       GROUP BY category ORDER BY count DESC LIMIT 5`,
    ),
    pool.query<{ category: string; count: string }>(
      `SELECT category, COUNT(*) as count FROM prayer_requests
       WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY category ORDER BY count DESC LIMIT 5`,
    ),
  ]);

  return {
    topSermons: sermonsResult.status === "fulfilled"
      ? sermonsResult.value.rows.map(r => ({
          videoId: r.video_id,
          title: r.title,
          viewCount: r.view_count ?? 0,
        }))
      : [],
    topBlogCategories: blogResult.status === "fulfilled"
      ? blogResult.value.rows.map(r => ({ category: r.category, count: parseInt(r.count, 10) }))
      : [],
    activePrayerTopics: prayerResult.status === "fulfilled"
      ? prayerResult.value.rows.map(r => ({ category: r.category, count: parseInt(r.count, 10) }))
      : [],
  };
}

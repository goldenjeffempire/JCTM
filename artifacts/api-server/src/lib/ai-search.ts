/**
 * Universal Semantic Search Engine — JCTM Platform
 *
 * Searches across all content types simultaneously:
 *  - Sermons (title, description, transcript keywords)
 *  - Blog posts (title, excerpt, tags, topic)
 *  - Devotionals (title, scripture, reflection)
 *  - Gallery (title, description, category)
 *  - Events (title, description, location)
 *  - Knowledge chunks (RAG knowledge base)
 *
 * Uses TF-IDF semantic similarity + keyword weighting + recency boosting.
 * Returns unified, ranked results across all content types.
 *
 * Zero external API — fully local.
 */

import pg from "pg";
import { tfidfEmbed, cosineSimilarity } from "./local-embeddings.js";
import { logger } from "./logger.js";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentType = "sermon" | "blog" | "gallery" | "event" | "knowledge" | "devotion";

export interface SearchResult {
  type: ContentType;
  id: string;
  title: string;
  excerpt: string;
  url: string;
  thumbnailUrl?: string;
  relevanceScore: number;
  recencyBoost: number;
  finalScore: number;
  metadata: Record<string, string | number | null>;
}

export interface SearchResponse {
  query: string;
  normalizedQuery: string;
  totalResults: number;
  results: SearchResult[];
  resultsByType: Partial<Record<ContentType, SearchResult[]>>;
  searchTimeMs: number;
  suggestions: string[];
}

// ─── Query Normalization ──────────────────────────────────────────────────────

function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 200);
}

function buildLikeTerms(query: string): string[] {
  const words = query
    .split(/\s+/)
    .filter(w => w.length >= 3)
    .slice(0, 5);
  return words.map(w => `%${w}%`);
}

// ─── Recency Boost ────────────────────────────────────────────────────────────

function recencyBoost(dateStr: string | null | undefined): number {
  if (!dateStr) return 0.8;
  const date = new Date(dateStr);
  const ageMs = Date.now() - date.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < 7) return 1.0;
  if (ageDays < 30) return 0.95;
  if (ageDays < 90) return 0.9;
  if (ageDays < 365) return 0.85;
  return 0.8;
}

// ─── Sermon Search ────────────────────────────────────────────────────────────

async function searchSermons(
  query: string,
  embedding: number[],
  limit: number,
): Promise<SearchResult[]> {
  try {
    const terms = buildLikeTerms(query);
    if (terms.length === 0) return [];

    const conditions = terms.map((_, i) =>
      `(LOWER(title) LIKE $${i + 1} OR LOWER(description) LIKE $${i + 1})`
    ).join(" OR ");

    const result = await pool.query<{
      video_id: string; title: string; description: string;
      thumbnail_url: string; view_count: number; published_at: string;
    }>(
      `SELECT video_id, title, description, thumbnail_url, view_count, published_at
       FROM sermons WHERE is_published = true AND (${conditions})
       ORDER BY view_count DESC NULLS LAST LIMIT $${terms.length + 1}`,
      [...terms, limit * 3],
    );

    return result.rows.map(row => {
      const docEmb = tfidfEmbed(`${row.title} ${row.description ?? ""}`.slice(0, 300));
      const relevance = cosineSimilarity(embedding, docEmb);
      const recency = recencyBoost(row.published_at);
      const popularity = Math.min(0.2, (row.view_count ?? 0) / 100000 * 0.2);
      return {
        type: "sermon" as ContentType,
        id: row.video_id,
        title: row.title,
        excerpt: row.description?.slice(0, 150) ?? "Temple TV sermon by Prophet Amos Evomobor",
        url: `/sermons?v=${row.video_id}`,
        thumbnailUrl: row.thumbnail_url ?? `https://img.youtube.com/vi/${row.video_id}/mqdefault.jpg`,
        relevanceScore: relevance,
        recencyBoost: recency,
        finalScore: relevance * 0.7 + recency * 0.15 + popularity,
        metadata: { viewCount: row.view_count ?? 0, publishedAt: row.published_at },
      };
    });
  } catch (err) {
    logger.warn({ err }, "Sermon search failed");
    return [];
  }
}

// ─── Blog Search ──────────────────────────────────────────────────────────────

async function searchBlog(
  query: string,
  embedding: number[],
  limit: number,
): Promise<SearchResult[]> {
  try {
    const terms = buildLikeTerms(query);
    if (terms.length === 0) return [];

    const conditions = terms.map((_, i) =>
      `(LOWER(title) LIKE $${i + 1} OR LOWER(excerpt) LIKE $${i + 1} OR LOWER(topic) LIKE $${i + 1})`
    ).join(" OR ");

    const result = await pool.query<{
      slug: string; title: string; excerpt: string; category: string;
      topic: string; read_time_minutes: number; published_at: string;
    }>(
      `SELECT slug, title, excerpt, category, topic, read_time_minutes, published_at
       FROM blog_posts WHERE ${conditions}
       ORDER BY view_count DESC NULLS LAST LIMIT $${terms.length + 1}`,
      [...terms, limit * 2],
    );

    return result.rows.map(row => {
      const docEmb = tfidfEmbed(`${row.title} ${row.excerpt ?? ""} ${row.topic ?? ""}`.slice(0, 300));
      const relevance = cosineSimilarity(embedding, docEmb);
      const recency = recencyBoost(row.published_at);
      return {
        type: "blog" as ContentType,
        id: row.slug,
        title: row.title,
        excerpt: row.excerpt?.slice(0, 150) ?? `${row.category ?? "Article"} — ${row.read_time_minutes ?? 4} min read`,
        url: `/blog/${row.slug}`,
        relevanceScore: relevance,
        recencyBoost: recency,
        finalScore: relevance * 0.75 + recency * 0.1,
        metadata: { category: row.category, topic: row.topic, readTime: row.read_time_minutes ?? 4 },
      };
    });
  } catch (err) {
    logger.warn({ err }, "Blog search failed");
    return [];
  }
}

// ─── Gallery Search ───────────────────────────────────────────────────────────

async function searchGallery(
  query: string,
  embedding: number[],
  limit: number,
): Promise<SearchResult[]> {
  try {
    const terms = buildLikeTerms(query);
    if (terms.length === 0) return [];

    const conditions = terms.map((_, i) =>
      `(LOWER(title) LIKE $${i + 1} OR LOWER(description) LIKE $${i + 1} OR LOWER(category) LIKE $${i + 1})`
    ).join(" OR ");

    const result = await pool.query<{
      id: number; title: string; description: string; thumbnail_path: string;
      category: string; service_date: string;
    }>(
      `SELECT id, title, description, thumbnail_path, category, service_date
       FROM gallery_items WHERE is_published = true AND (${conditions})
       ORDER BY service_date DESC NULLS LAST LIMIT $${terms.length + 1}`,
      [...terms, limit],
    );

    return result.rows.map(row => {
      const docEmb = tfidfEmbed(`${row.title} ${row.description ?? ""} ${row.category ?? ""}`.slice(0, 200));
      const relevance = cosineSimilarity(embedding, docEmb);
      const recency = recencyBoost(row.service_date);
      return {
        type: "gallery" as ContentType,
        id: String(row.id),
        title: row.title,
        excerpt: row.description?.slice(0, 120) ?? `${row.category ?? "Gallery"} photo`,
        url: `/gallery`,
        thumbnailUrl: row.thumbnail_path,
        relevanceScore: relevance,
        recencyBoost: recency,
        finalScore: relevance * 0.6 + recency * 0.2,
        metadata: { category: row.category, serviceDate: row.service_date },
      };
    });
  } catch (err) {
    logger.warn({ err }, "Gallery search failed");
    return [];
  }
}

// ─── Event Search ─────────────────────────────────────────────────────────────

async function searchEvents(
  query: string,
  embedding: number[],
  limit: number,
): Promise<SearchResult[]> {
  try {
    const terms = buildLikeTerms(query);
    if (terms.length === 0) return [];

    const conditions = terms.map((_, i) =>
      `(LOWER(title) LIKE $${i + 1} OR LOWER(description) LIKE $${i + 1})`
    ).join(" OR ");

    const result = await pool.query<{
      id: number; title: string; description: string; start_date: string; location: string;
    }>(
      `SELECT id, title, description, start_date, location
       FROM event_calendar WHERE (${conditions})
       ORDER BY start_date ASC LIMIT $${terms.length + 1}`,
      [...terms, limit],
    );

    return result.rows.map(row => {
      const docEmb = tfidfEmbed(`${row.title} ${row.description ?? ""} ${row.location ?? ""}`.slice(0, 200));
      const relevance = cosineSimilarity(embedding, docEmb);
      return {
        type: "event" as ContentType,
        id: String(row.id),
        title: row.title,
        excerpt: row.description?.slice(0, 120) ?? `Event on ${row.start_date}${row.location ? ` at ${row.location}` : ""}`,
        url: `/events`,
        relevanceScore: relevance,
        recencyBoost: 1.0, // Events always get full recency score
        finalScore: relevance * 0.8 + 0.2,
        metadata: { startDate: row.start_date, location: row.location },
      };
    });
  } catch (err) {
    logger.warn({ err }, "Event search failed");
    return [];
  }
}

// ─── Knowledge Chunk Search ───────────────────────────────────────────────────

async function searchKnowledge(
  query: string,
  embedding: number[],
  limit: number,
): Promise<SearchResult[]> {
  try {
    const vectorStr = `[${embedding.join(",")}]`;

    // Try pgvector similarity search first
    const result = await pool.query<{ content: string; source: string; similarity: number }>(
      `SELECT content, source, 1 - (embedding <=> $1::vector) AS similarity
       FROM knowledge_chunks WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector LIMIT $2`,
      [vectorStr, limit],
    );

    if (result.rows.length > 0) {
      return result.rows
        .filter(row => row.similarity > 0.3)
        .map(row => ({
          type: "knowledge" as ContentType,
          id: `knowledge_${row.source}`,
          title: `JCTM Teaching: ${row.source}`,
          excerpt: row.content.slice(0, 150),
          url: `/templebots`,
          relevanceScore: row.similarity,
          recencyBoost: 0.9,
          finalScore: row.similarity * 0.9,
          metadata: { source: row.source },
        }));
    }

    // Fallback: keyword search
    const terms = buildLikeTerms(query);
    if (terms.length === 0) return [];
    const conditions = terms.map((_, i) => `content ILIKE $${i + 1}`).join(" OR ");
    const kbResult = await pool.query<{ content: string; source: string }>(
      `SELECT content, source FROM knowledge_chunks WHERE ${conditions} LIMIT $${terms.length + 1}`,
      [...terms, limit],
    );

    return kbResult.rows.map(row => {
      const docEmb = tfidfEmbed(row.content.slice(0, 300));
      const relevance = cosineSimilarity(embedding, docEmb);
      return {
        type: "knowledge" as ContentType,
        id: `knowledge_${row.source}`,
        title: `JCTM Teaching: ${row.source}`,
        excerpt: row.content.slice(0, 150),
        url: `/templebots`,
        relevanceScore: relevance,
        recencyBoost: 0.9,
        finalScore: relevance * 0.85,
        metadata: { source: row.source },
      };
    });
  } catch (err) {
    logger.warn({ err }, "Knowledge search failed");
    return [];
  }
}

// ─── Search Suggestions ───────────────────────────────────────────────────────

const JCTM_TOPICS = [
  "holiness teaching", "correction mandate", "primitive christianity",
  "water baptism", "holy spirit baptism", "end times prophecy",
  "salvation grace", "prosperity gospel warning", "five fold ministry",
  "prophet amos sermon", "temple tv live", "sunday service warri",
  "spiritual warfare prayer", "marriage family blessing", "divine healing",
];

function generateSuggestions(query: string): string[] {
  const lower = query.toLowerCase();
  return JCTM_TOPICS
    .filter(t => t.includes(lower.slice(0, 5)) || lower.includes(t.split(" ")[0]!))
    .slice(0, 3)
    .concat(JCTM_TOPICS.slice(0, 2));
}

// ─── Main Search Function ─────────────────────────────────────────────────────

export async function universalSearch(
  query: string,
  options: {
    types?: ContentType[];
    limit?: number;
    boostType?: ContentType;
  } = {},
): Promise<SearchResponse> {
  const start = Date.now();
  const { types = ["sermon", "blog", "gallery", "event", "knowledge"], limit = 3, boostType } = options;

  const normalized = normalizeQuery(query);
  const embedding = tfidfEmbed(normalized);

  // Run all enabled search types in parallel
  const searchPromises: Array<Promise<SearchResult[]>> = [];
  if (types.includes("sermon")) searchPromises.push(searchSermons(normalized, embedding, limit));
  if (types.includes("blog")) searchPromises.push(searchBlog(normalized, embedding, limit));
  if (types.includes("gallery")) searchPromises.push(searchGallery(normalized, embedding, limit));
  if (types.includes("event")) searchPromises.push(searchEvents(normalized, embedding, limit));
  if (types.includes("knowledge")) searchPromises.push(searchKnowledge(normalized, embedding, limit));

  const resultSets = await Promise.all(searchPromises);
  let allResults = resultSets.flat();

  // Apply boost for preferred type
  if (boostType) {
    allResults = allResults.map(r => ({
      ...r,
      finalScore: r.type === boostType ? r.finalScore * 1.3 : r.finalScore,
    }));
  }

  // Sort by final score and deduplicate
  const seen = new Set<string>();
  const deduped = allResults
    .sort((a, b) => b.finalScore - a.finalScore)
    .filter(r => {
      const key = `${r.type}_${r.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit * types.length);

  // Group by type
  const resultsByType: Partial<Record<ContentType, SearchResult[]>> = {};
  for (const result of deduped) {
    if (!resultsByType[result.type]) resultsByType[result.type] = [];
    resultsByType[result.type]!.push(result);
  }

  return {
    query,
    normalizedQuery: normalized,
    totalResults: deduped.length,
    results: deduped,
    resultsByType,
    searchTimeMs: Date.now() - start,
    suggestions: generateSuggestions(normalized),
  };
}

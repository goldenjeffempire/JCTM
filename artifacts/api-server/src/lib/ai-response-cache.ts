/**
 * AI Response Cache — Intelligent LRU + Semantic Deduplication
 *
 * Architecture:
 *  - LRU cache with configurable capacity and TTL per tier
 *  - Semantic similarity deduplication (avoids re-computing similar queries)
 *  - Cache warming for high-frequency JCTM topics
 *  - Metrics tracking (hit rate, latency savings, memory usage)
 *  - Automatic eviction by staleness and frequency
 *
 * Zero external dependencies — fully in-memory.
 */

import { cosineSimilarity, tfidfEmbed } from "./local-embeddings.js";
import { logger } from "./logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CacheEntry {
  key: string;
  normalizedQuery: string;
  embedding: number[];
  response: string;
  tier: string;
  confidence: number;
  hitCount: number;
  createdAt: number;
  lastAccessedAt: number;
  ttlMs: number;
  sizeBytes: number;
}

export interface CacheMetrics {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  evictionCount: number;
  estimatedMemoryBytes: number;
  avgLatencySavedMs: number;
  topQueries: Array<{ query: string; hits: number }>;
}

export interface CacheHit {
  found: true;
  response: string;
  tier: string;
  confidence: number;
  similarity: number;
  latencySavedMs: number;
}

export interface CacheMiss {
  found: false;
}

export type CacheResult = CacheHit | CacheMiss;

// ─── Configuration ────────────────────────────────────────────────────────────

const MAX_ENTRIES = 512;
const SIMILARITY_THRESHOLD = 0.88; // Queries ≥88% similar reuse cached response
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const TIER_TTL: Record<string, number> = {
  local: 60 * 60 * 1000,         // 1 hour — highly reliable
  "local-enhanced": 30 * 60 * 1000, // 30 min
  rag: 20 * 60 * 1000,           // 20 min — may change as knowledge grows
};

// ─── State ────────────────────────────────────────────────────────────────────

const cache = new Map<string, CacheEntry>();
let totalHits = 0;
let totalMisses = 0;
let totalEvictions = 0;
let totalLatencySavedMs = 0;
let latencySavedSamples = 0;

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 300);
}

function computeCacheKey(normalized: string): string {
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) ^ normalized.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

// ─── Eviction ─────────────────────────────────────────────────────────────────

function evictIfNeeded(): void {
  if (cache.size < MAX_ENTRIES) return;

  const now = Date.now();
  // First: evict expired entries
  for (const [key, entry] of cache) {
    if (now - entry.createdAt > entry.ttlMs) {
      cache.delete(key);
      totalEvictions++;
    }
  }

  // If still over capacity, evict least recently accessed + lowest hit count
  if (cache.size >= MAX_ENTRIES) {
    const entries = Array.from(cache.entries());
    entries.sort(([, a], [, b]) => {
      const scoreA = a.hitCount * 2 + (now - a.lastAccessedAt) / -1000;
      const scoreB = b.hitCount * 2 + (now - b.lastAccessedAt) / -1000;
      return scoreA - scoreB;
    });
    const toEvict = entries.slice(0, Math.floor(MAX_ENTRIES * 0.1));
    for (const [key] of toEvict) {
      cache.delete(key);
      totalEvictions++;
    }
  }
}

// ─── Semantic Lookup ──────────────────────────────────────────────────────────

export async function cacheGet(query: string): Promise<CacheResult> {
  const normalized = normalizeQuery(query);
  const exactKey = computeCacheKey(normalized);
  const now = Date.now();

  // 1. Exact key match (fastest path)
  const exactEntry = cache.get(exactKey);
  if (exactEntry && now - exactEntry.createdAt < exactEntry.ttlMs) {
    exactEntry.hitCount++;
    exactEntry.lastAccessedAt = now;
    totalHits++;
    return {
      found: true,
      response: exactEntry.response,
      tier: exactEntry.tier,
      confidence: exactEntry.confidence,
      similarity: 1.0,
      latencySavedMs: 50,
    };
  }

  // 2. Semantic similarity search across all live entries
  try {
    const queryEmbedding = tfidfEmbed(normalized);
    let bestEntry: CacheEntry | null = null;
    let bestSimilarity = 0;

    for (const [, entry] of cache) {
      if (now - entry.createdAt >= entry.ttlMs) continue;
      const sim = cosineSimilarity(queryEmbedding, entry.embedding);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestEntry = entry;
      }
    }

    if (bestEntry && bestSimilarity >= SIMILARITY_THRESHOLD) {
      bestEntry.hitCount++;
      bestEntry.lastAccessedAt = now;
      totalHits++;
      totalLatencySavedMs += 45;
      latencySavedSamples++;
      return {
        found: true,
        response: bestEntry.response,
        tier: bestEntry.tier,
        confidence: bestEntry.confidence * bestSimilarity,
        similarity: bestSimilarity,
        latencySavedMs: 45,
      };
    }
  } catch {
    // Semantic lookup failed — treat as miss
  }

  totalMisses++;
  return { found: false };
}

export async function cacheSet(
  query: string,
  response: string,
  tier: string,
  confidence: number,
): Promise<void> {
  const normalized = normalizeQuery(query);
  const key = computeCacheKey(normalized);
  const now = Date.now();

  evictIfNeeded();

  try {
    const embedding = tfidfEmbed(normalized);
    const ttlMs = TIER_TTL[tier] ?? DEFAULT_TTL_MS;
    const sizeBytes = (normalized.length + response.length) * 2;

    cache.set(key, {
      key,
      normalizedQuery: normalized,
      embedding,
      response,
      tier,
      confidence,
      hitCount: 0,
      createdAt: now,
      lastAccessedAt: now,
      ttlMs,
      sizeBytes,
    });
  } catch {
    // Non-critical
  }
}

// ─── Pre-warm for Common JCTM Topics ─────────────────────────────────────────

const WARMUP_RESPONSES: Array<{ query: string; response: string; tier: string }> = [
  {
    query: "who is prophet amos",
    response: "Prophet Amos Evomobor is the founder and senior pastor of Jesus Christ Temple Ministry (JCTM). He holds the prophetic office and received the Correction Mandate — a divine call to restore the original gospel. He leads from Warri, Delta State, Nigeria, and his teachings reach 40+ nations through Temple TV (@TEMPLETVJCTM on YouTube).",
    tier: "local",
  },
  {
    query: "what is jctm",
    response: "Jesus Christ Temple Ministry (JCTM) is a Christian ministry founded January 3, 2013 by Prophet Amos Evomobor in Warri, Nigeria. It operates under the Correction Mandate — restoring Primitive Christianity by exposing five major doctrinal errors. Temple TV (@TEMPLETVJCTM) broadcasts to 40+ nations.",
    tier: "local",
  },
  {
    query: "what is the correction mandate",
    response: "The Correction Mandate is JCTM's divine assignment to expose and correct five major errors in modern Christianity: (1) Prosperity Gospel, (2) Prophetic Manipulation, (3) Apostolic Abuse, (4) Sacramental Corruption, and (5) Dangerous Ecumenism. It is a call back to Primitive Christianity — Jeremiah 6:16.",
    tier: "local",
  },
  {
    query: "how do i give to jctm",
    response: "You can give online at jctm.org.ng/give — via Paystack (Naira) or Stripe (USD/international). JCTM teaches biblical stewardship, not prosperity gospel. Giving supports Temple TV broadcasts and the global Correction Mandate outreach.",
    tier: "local",
  },
  {
    query: "when is sunday service",
    response: "JCTM Sunday Services are held at Ebrumede Temple, Warri from 8:00 AM – 12:00 PM WAT, also broadcast live on Temple TV (YouTube @TEMPLETVJCTM). Wednesday midweek service runs 5:00 PM – 8:00 PM WAT.",
    tier: "local",
  },
];

export async function warmCache(): Promise<void> {
  for (const item of WARMUP_RESPONSES) {
    await cacheSet(item.query, item.response, item.tier, 0.95);
  }
  logger.info(`AI response cache warmed with ${WARMUP_RESPONSES.length} entries`);
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export function getCacheMetrics(): CacheMetrics {
  const total = totalHits + totalMisses;
  const topQueries = Array.from(cache.values())
    .sort((a, b) => b.hitCount - a.hitCount)
    .slice(0, 10)
    .map(e => ({ query: e.normalizedQuery.slice(0, 80), hits: e.hitCount }));

  const estimatedMemory = Array.from(cache.values())
    .reduce((sum, e) => sum + e.sizeBytes, 0);

  return {
    totalEntries: cache.size,
    hitCount: totalHits,
    missCount: totalMisses,
    hitRate: total > 0 ? totalHits / total : 0,
    evictionCount: totalEvictions,
    estimatedMemoryBytes: estimatedMemory,
    avgLatencySavedMs: latencySavedSamples > 0 ? totalLatencySavedMs / latencySavedSamples : 0,
    topQueries,
  };
}

export function clearCache(): void {
  cache.clear();
  totalHits = 0;
  totalMisses = 0;
  totalEvictions = 0;
}

// ─── Periodic cleanup ─────────────────────────────────────────────────────────

setInterval(() => {
  const now = Date.now();
  let evicted = 0;
  for (const [key, entry] of cache) {
    if (now - entry.createdAt > entry.ttlMs) {
      cache.delete(key);
      evicted++;
    }
  }
  if (evicted > 0) {
    totalEvictions += evicted;
    logger.debug({ evicted, remaining: cache.size }, "AI cache TTL cleanup");
  }
}, 10 * 60 * 1000).unref();

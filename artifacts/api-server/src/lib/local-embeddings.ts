/**
 * Local Embedding Engine — Zero External API
 *
 * Generates semantic embeddings locally using:
 *   Primary  — @xenova/transformers with all-MiniLM-L6-v2 (384-dim ONNX, ~22MB)
 *   Fallback — Deterministic TF-IDF hash-based pseudo-embeddings (384-dim)
 *
 * No OpenAI, no external API, no internet needed after first model download.
 */

import { logger } from "./logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmbeddingVector = number[];

export interface EmbedResult {
  embedding: EmbeddingVector;
  method: "transformer" | "tfidf";
  dims: number;
}

// ─── Singleton Transformer Pipeline ──────────────────────────────────────────

let _pipeline: ((text: string | string[], opts?: object) => Promise<{ data: Float32Array }[]>) | null = null;
let _pipelineLoading = false;
let _pipelineFailed = false;

async function getTransformerPipeline() {
  if (_pipeline) return _pipeline;
  if (_pipelineFailed) return null;
  if (_pipelineLoading) {
    await new Promise(r => setTimeout(r, 2000));
    return _pipeline;
  }

  _pipelineLoading = true;
  try {
    const { pipeline, env } = await import("@xenova/transformers");
    env.allowLocalModels = false;
    env.useBrowserCache = false;

    const pipe = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      { quantized: true }
    );

    _pipeline = pipe as unknown as typeof _pipeline;
    logger.info("Local embedding model loaded: Xenova/all-MiniLM-L6-v2");
    return _pipeline;
  } catch (err) {
    _pipelineFailed = true;
    logger.warn({ err }, "Transformer pipeline unavailable — using TF-IDF fallback embeddings");
    return null;
  } finally {
    _pipelineLoading = false;
  }
}

// ─── TF-IDF Fallback Embeddings (384-dim deterministic) ──────────────────────

const VOCAB_SIZE = 384;

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 2 && t.length < 30);
}

const STOP_WORDS = new Set([
  "the", "and", "is", "in", "at", "of", "to", "a", "an", "on", "for",
  "with", "this", "that", "are", "was", "be", "have", "has", "had",
  "it", "as", "by", "from", "or", "but", "not", "we", "you", "your",
  "our", "his", "her", "they", "their", "what", "which", "who", "will",
  "can", "all", "one", "more", "out", "up", "about", "than", "also",
]);

export function tfidfEmbed(text: string): EmbeddingVector {
  const tokens = tokenize(text).filter(t => !STOP_WORDS.has(t));
  const vec = new Float64Array(VOCAB_SIZE);

  const tf: Record<string, number> = {};
  for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;

  const total = tokens.length || 1;
  for (const [term, count] of Object.entries(tf)) {
    const termFreq = count / total;
    const idx = hashCode(term) % VOCAB_SIZE;
    const bigram = term.slice(0, 4);
    const idx2 = hashCode(bigram) % VOCAB_SIZE;
    vec[idx] = (vec[idx] ?? 0) + termFreq;
    vec[idx2] = (vec[idx2] ?? 0) + termFreq * 0.5;
  }

  const magnitude = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return Array.from(vec).map(v => v / magnitude);
}

// ─── Primary Embedding Function ───────────────────────────────────────────────

export async function embed(text: string): Promise<EmbedResult> {
  const cleanText = text.slice(0, 512).trim();

  const pipe = await getTransformerPipeline();
  if (pipe) {
    try {
      const output = await pipe(cleanText, { pooling: "mean", normalize: true });
      const data = output[0];
      if (data && data.data) {
        return {
          embedding: Array.from(data.data as Float32Array),
          method: "transformer",
          dims: (data.data as Float32Array).length,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Transformer embedding failed — falling back to TF-IDF");
    }
  }

  return {
    embedding: tfidfEmbed(cleanText),
    method: "tfidf",
    dims: VOCAB_SIZE,
  };
}

export async function embedBatch(texts: string[]): Promise<EmbedResult[]> {
  return Promise.all(texts.map(t => embed(t)));
}

// ─── Cosine Similarity ────────────────────────────────────────────────────────

export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  const len = Math.min(a.length, b.length);
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < len; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    magA += (a[i] ?? 0) ** 2;
    magB += (b[i] ?? 0) ** 2;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-10);
}

// ─── Semantic Search (in-memory) ──────────────────────────────────────────────

export interface SemanticDoc {
  id: string;
  text: string;
  embedding?: EmbeddingVector;
  metadata?: Record<string, unknown>;
}

export async function semanticSearch(
  query: string,
  docs: SemanticDoc[],
  topK = 5,
): Promise<Array<SemanticDoc & { score: number }>> {
  const { embedding: queryEmbed } = await embed(query);

  const scored = await Promise.all(
    docs.map(async doc => {
      const embedding = doc.embedding ?? (await embed(doc.text)).embedding;
      return { ...doc, embedding, score: cosineSimilarity(queryEmbed, embedding) };
    })
  );

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ─── Warm up (call at startup) ────────────────────────────────────────────────

export async function warmUpEmbeddingModel(): Promise<void> {
  try {
    await embed("Jesus Christ Temple Ministry JCTM Warri Nigeria");
    logger.info("Embedding model warm-up complete");
  } catch {
    logger.info("Embedding model warm-up skipped (will use TF-IDF fallback)");
  }
}

/**
 * Sermon Transcription Pipeline — JCTM AI Intelligence v1
 *
 * Fetches YouTube auto-generated captions and processes them into
 * searchable transcript chunks in the knowledge_chunks table.
 *
 * When captions are unavailable, uses OpenAI GPT-4o to generate a
 * structured teaching summary from the sermon title + description.
 * This gives TempleBots rich topical content even without full transcripts.
 */

import pg from "pg";
import OpenAI from "openai";
import type { Logger } from "pino";
import { embed } from "./local-embeddings.js";

const { Pool } = pg;

function normalizeDbUrl(url: string): string {
  return url.replace(
    /([?&])sslmode=(prefer|require|verify-ca)(&|$)/g,
    (_m, prefix, _mode, suffix) => `${prefix}sslmode=verify-full${suffix}`,
  );
}

const pool = new Pool({ connectionString: normalizeDbUrl(process.env.DATABASE_URL ?? "") });
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const BATCH_SIZE = 15;
const ENRICHMENT_MAX_TOKENS = 600;

interface SermonRow {
  video_id: string;
  title: string;
  description: string | null;
  published_at: string | null;
  category: string | null;
  tags: string[] | null;
  ai_summary: string | null;
  view_count: number | null;
}

// ─── YouTube Caption Fetcher ──────────────────────────────────────────────────

async function fetchYouTubeCaptions(videoId: string): Promise<string | null> {
  try {
    const url = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=json3`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JCTM-AI/1.0)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const data = await res.json() as {
      events?: Array<{ segs?: Array<{ utf8?: string }> }>;
    };

    if (!data.events?.length) return null;

    const text = data.events
      .flatMap(e => e.segs?.map(s => s.utf8 ?? "") ?? [])
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return text.length >= 200 ? text : null;
  } catch {
    return null;
  }
}

// ─── GPT-4o Sermon Enrichment ─────────────────────────────────────────────────

async function enrichSermonWithGPT(sermon: SermonRow): Promise<string | null> {
  if (!openai) return null;

  try {
    const descSnippet = sermon.description
      ? sermon.description.slice(0, 800)
      : "No description available.";

    const dateStr = sermon.published_at
      ? new Date(sermon.published_at).toLocaleDateString("en-GB", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "";

    const prompt = `You are analyzing a sermon by Prophet Amos Evomobor of Jesus Christ Temple Ministry (JCTM), Warri, Nigeria.

Sermon Title: "${sermon.title}"
${dateStr ? `Date: ${dateStr}` : ""}
${sermon.category ? `Category: ${sermon.category}` : ""}
${sermon.tags?.length ? `Topics: ${sermon.tags.slice(0, 8).join(", ")}` : ""}

YouTube Description:
${descSnippet}

Based on the title and description, write a concise JCTM sermon teaching summary (150-200 words) covering:
1. The main biblical theme or topic of the sermon
2. Key scriptures likely referenced based on the topic
3. JCTM doctrinal connections (Correction Mandate, Primitive Christianity, holiness, etc.)
4. The practical application for believers
5. Who this sermon would help most

Write in third person. Be specific, theologically grounded, and factual based only on the information provided. Do NOT invent specific quotes or claims not supported by the description.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: ENRICHMENT_MAX_TOKENS,
      temperature: 0.3,
    });

    const summary = completion.choices[0]?.message?.content?.trim();
    return summary && summary.length >= 50 ? summary : null;
  } catch {
    return null;
  }
}

// ─── Text Chunking ────────────────────────────────────────────────────────────

function chunkText(text: string, chunkWords = 400, overlapWords = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkWords, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end >= words.length) break;
    start = end - overlapWords;
  }

  return chunks.filter(c => c.length > 100);
}

// ─── Generate Embedding Vector ─────────────────────────────────────────────────

async function generateEmbeddingVector(text: string): Promise<string | null> {
  try {
    const result = await embed(text);
    return `[${result.embedding.join(",")}]`;
  } catch {
    return null;
  }
}

// ─── Store Transcript Chunks ──────────────────────────────────────────────────

async function storeTranscriptChunks(
  client: pg.PoolClient,
  sermon: SermonRow,
  transcriptText: string,
  source: "youtube-captions" | "gpt-enrichment",
): Promise<number> {
  const chunks =
    source === "youtube-captions"
      ? chunkText(transcriptText, 400, 60)
      : [transcriptText];

  const dateStr = sermon.published_at
    ? new Date(sermon.published_at).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  let stored = 0;

  await client.query(
    `DELETE FROM knowledge_chunks WHERE source LIKE $1 AND chunk_type = 'transcript'`,
    [`sermon-transcript-${sermon.video_id}-%`],
  );

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const chunkSource = `sermon-transcript-${sermon.video_id}-${i}`;
    const header = [
      `Transcript from JCTM sermon by Prophet Amos Evomobor: "${sermon.title}"`,
      dateStr ? `Date: ${dateStr}` : "",
      `Watch: https://www.youtube.com/watch?v=${sermon.video_id}`,
      `[Source: ${source === "youtube-captions" ? "YouTube Captions" : "AI Teaching Summary"}]`,
      "",
    ]
      .filter(Boolean)
      .join("\n");

    const content = `${header}${chunk}`;
    const vectorStr = await generateEmbeddingVector(content);

    await client.query(
      `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding, metadata)
       VALUES ($1, $2, 0, 'transcript', $3, $4)
       ON CONFLICT (source, chunk_index)
       DO UPDATE SET content = EXCLUDED.content, chunk_type = EXCLUDED.chunk_type,
                     embedding = EXCLUDED.embedding, metadata = EXCLUDED.metadata, updated_at = now()`,
      [
        content,
        chunkSource,
        vectorStr ?? null,
        JSON.stringify({
          video_id: sermon.video_id,
          title: sermon.title,
          transcript_source: source,
          chunk_index: i,
          total_chunks: chunks.length,
        }),
      ],
    );
    stored++;
  }

  return stored;
}

// ─── Main Batch Transcription Job ─────────────────────────────────────────────

export interface TranscriptionResult {
  processed: number;
  captionsFound: number;
  enriched: number;
  failed: number;
}

export async function transcribeSermonBatch(
  limit = BATCH_SIZE,
  log?: Logger,
): Promise<TranscriptionResult> {
  if (!openai) {
    log?.warn("OpenAI API key not configured — GPT-4o enrichment unavailable");
  }

  const result: TranscriptionResult = {
    processed: 0,
    captionsFound: 0,
    enriched: 0,
    failed: 0,
  };

  const client = await pool.connect();
  try {
    const sermonsRes = await client.query<SermonRow>(
      `SELECT video_id, title, description, published_at, category, tags, ai_summary, view_count
       FROM sermon_data
       WHERE transcript_status = 'none'
         AND title IS NOT NULL
       ORDER BY view_count DESC NULLS LAST, published_at DESC NULLS LAST
       LIMIT $1`,
      [limit],
    );

    const sermons = sermonsRes.rows;
    if (sermons.length === 0) {
      log?.info("No sermons needing transcription — all caught up");
      return result;
    }

    log?.info({ count: sermons.length }, "Starting sermon transcription batch...");

    for (const sermon of sermons) {
      try {
        const captions = await fetchYouTubeCaptions(sermon.video_id);

        if (captions && captions.length >= 200) {
          const stored = await storeTranscriptChunks(client, sermon, captions, "youtube-captions");
          await client.query(
            `UPDATE sermon_data
             SET transcript = $1, transcript_status = 'captions', transcript_source = 'youtube-timedtext', updated_at = now()
             WHERE video_id = $2`,
            [captions.slice(0, 50000), sermon.video_id],
          );
          result.captionsFound++;
          result.processed++;
          log?.debug({ videoId: sermon.video_id, chunks: stored }, "Sermon captioned from YouTube");
          continue;
        }

        const enrichment = await enrichSermonWithGPT(sermon);

        if (enrichment) {
          const stored = await storeTranscriptChunks(client, sermon, enrichment, "gpt-enrichment");
          await client.query(
            `UPDATE sermon_data
             SET transcript = $1, transcript_status = 'enriched', transcript_source = 'gpt-4o', updated_at = now()
             WHERE video_id = $2`,
            [enrichment, sermon.video_id],
          );
          result.enriched++;
          result.processed++;
          log?.debug({ videoId: sermon.video_id, chunks: stored }, "Sermon enriched with GPT-4o");
        } else {
          await client.query(
            `UPDATE sermon_data SET transcript_status = 'failed', updated_at = now() WHERE video_id = $1`,
            [sermon.video_id],
          );
          result.failed++;
        }
      } catch (err) {
        result.failed++;
        log?.warn({ err, videoId: sermon.video_id }, "Sermon transcription error (non-fatal)");
        try {
          await client.query(
            `UPDATE sermon_data SET transcript_status = 'error', updated_at = now() WHERE video_id = $1`,
            [sermon.video_id],
          );
        } catch { /* non-fatal */ }
      }
    }

    log?.info({ ...result }, "Sermon transcription batch complete");
    return result;
  } finally {
    client.release();
  }
}

// ─── Reset Failed Transcriptions ─────────────────────────────────────────────

export async function resetFailedTranscriptions(log?: Logger): Promise<number> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE sermon_data SET transcript_status = 'none'
       WHERE transcript_status IN ('failed', 'error')`,
    );
    const count = res.rowCount ?? 0;
    log?.info({ count }, "Reset failed transcriptions for retry");
    return count;
  } finally {
    client.release();
  }
}

// ─── Transcription Statistics ─────────────────────────────────────────────────

export async function getTranscriptionStats(): Promise<{
  total: number;
  none: number;
  captions: number;
  enriched: number;
  failed: number;
  transcriptChunks: number;
}> {
  const client = await pool.connect();
  try {
    const [statsRes, chunkRes, totalRes] = await Promise.all([
      client.query<{ status: string; count: string }>(
        `SELECT transcript_status AS status, COUNT(*) AS count FROM sermon_data GROUP BY transcript_status`,
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM knowledge_chunks WHERE chunk_type = 'transcript'`,
      ),
      client.query<{ count: string }>(`SELECT COUNT(*) as count FROM sermon_data`),
    ]);

    const stats: Record<string, number> = {};
    for (const row of statsRes.rows) {
      stats[row.status] = parseInt(row.count, 10);
    }

    return {
      total: parseInt(totalRes.rows[0]?.count ?? "0", 10),
      none: stats["none"] ?? 0,
      captions: stats["captions"] ?? 0,
      enriched: stats["enriched"] ?? 0,
      failed: (stats["failed"] ?? 0) + (stats["error"] ?? 0),
      transcriptChunks: parseInt(chunkRes.rows[0]?.count ?? "0", 10),
    };
  } finally {
    client.release();
  }
}

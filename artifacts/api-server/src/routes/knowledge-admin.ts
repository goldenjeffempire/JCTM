/**
 * Knowledge Admin API — Real-time JCTM Knowledge Base Management
 *
 * Endpoints:
 *   POST /api/admin/knowledge/ingest      — paste any text → auto-embed → store
 *   POST /api/admin/knowledge/transcript  — ingest sermon transcript in chunks
 *   GET  /api/admin/knowledge/stats       — knowledge base statistics
 *   POST /api/admin/knowledge/sync        — trigger full content re-sync
 *   DELETE /api/admin/knowledge/:source   — remove chunks by source
 */

import { Router, type IRouter, type Request, type Response } from "express";
import pg from "pg";
import { embed } from "../lib/local-embeddings.js";
import { runFullContentSync } from "../lib/knowledge-ingestion.js";
import { logger } from "../lib/logger.js";

const { Pool } = pg;

const router: IRouter = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function normalizeDbUrl(url: string): string {
  return url.replace(/([?&])sslmode=(prefer|require|verify-ca)(&|$)/g,
    (_m, prefix, _mode, suffix) => `${prefix}sslmode=verify-full${suffix}`);
}
const knPool = new Pool({ connectionString: normalizeDbUrl(process.env.DATABASE_URL ?? "") });

async function embedAndStore(opts: {
  content: string;
  source: string;
  chunkIndex: number;
  chunkType: string;
}): Promise<{ hasEmbedding: boolean }> {
  const { content, source, chunkIndex, chunkType } = opts;
  let vectorStr: string | null = null;
  try {
    const result = await embed(content.slice(0, 512));
    vectorStr = `[${result.embedding.join(",")}]`;
  } catch { /* embedding optional */ }

  await knPool.query(
    `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (source, chunk_index) DO UPDATE
       SET content = EXCLUDED.content, chunk_type = EXCLUDED.chunk_type,
           embedding = EXCLUDED.embedding, updated_at = now()`,
    [content, source, chunkIndex, chunkType, vectorStr],
  );
  return { hasEmbedding: vectorStr !== null };
}

function chunkText(text: string, maxChars = 800, overlap = 100): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      const words = current.split(" ");
      current = words.slice(-Math.floor(overlap / 5)).join(" ") + " " + sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length > 20);
}

// ─── POST /api/admin/knowledge/ingest ─────────────────────────────────────────
// Paste any JCTM-related text → auto-chunk → embed → store in knowledge_chunks.

router.post("/admin/knowledge/ingest", async (req: Request, res: Response): Promise<void> => {
  const { content, source, chunk_type = "doctrine", label } = req.body as {
    content?: string; source?: string; chunk_type?: string; label?: string;
  };

  if (!content || content.trim().length < 20) {
    res.status(400).json({ error: "content must be at least 20 characters." });
    return;
  }
  if (!source || source.trim().length < 3) {
    res.status(400).json({ error: "source identifier is required (e.g. 'jctm-2026-crusade-teaching')." });
    return;
  }

  const safeSource = source.trim().replace(/[^a-z0-9\-_]/gi, "-").toLowerCase();
  const chunks = chunkText(content.trim());
  const results: Array<{ chunkIndex: number; hasEmbedding: boolean; preview: string }> = [];

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = label ? `[${label}]\n${chunks[i]}` : chunks[i]!;
      const r = await embedAndStore({ content: chunkContent!, source: safeSource, chunkIndex: i, chunkType: chunk_type });
      results.push({ chunkIndex: i, hasEmbedding: r.hasEmbedding, preview: chunkContent!.slice(0, 80) });
    }

    logger.info({ source: safeSource, chunks: chunks.length, chunk_type }, "Manual knowledge ingested via admin API");

    res.json({
      success: true,
      source: safeSource,
      chunksStored: results.length,
      embeddingsGenerated: results.filter(r => r.hasEmbedding).length,
      chunks: results,
    });
  } catch (err) {
    logger.error({ err, source: safeSource }, "Knowledge ingestion failed");
    res.status(500).json({ error: "Ingestion failed. Check server logs." });
  }
});

// ─── POST /api/admin/knowledge/transcript ────────────────────────────────────
// Ingest a sermon transcript (can be large — auto-chunked into overlapping segments).

router.post("/admin/knowledge/transcript", async (req: Request, res: Response): Promise<void> => {
  const { transcript, sermon_title, preacher = "Prophet Amos Evomobor", video_id, date } = req.body as {
    transcript?: string; sermon_title?: string; preacher?: string; video_id?: string; date?: string;
  };

  if (!transcript || transcript.trim().length < 50) {
    res.status(400).json({ error: "transcript must be at least 50 characters." });
    return;
  }
  if (!sermon_title) {
    res.status(400).json({ error: "sermon_title is required." });
    return;
  }

  const safeId = video_id?.trim() ?? `manual-${Date.now()}`;
  const source = `sermon-transcript-${safeId}`;
  const header = [
    `Sermon Transcript: "${sermon_title}" by ${preacher} (JCTM)`,
    date ? `Date: ${date}` : "",
    video_id ? `Watch: https://www.youtube.com/watch?v=${video_id}` : "",
  ].filter(Boolean).join("\n");

  const rawChunks = chunkText(transcript.trim(), 900, 120);
  let stored = 0;
  let withEmbeddings = 0;

  try {
    for (let i = 0; i < rawChunks.length; i++) {
      const chunkContent = `${header}\n\nTranscript segment ${i + 1}/${rawChunks.length}:\n${rawChunks[i]}`;
      const r = await embedAndStore({ content: chunkContent, source, chunkIndex: i, chunkType: "sermon" });
      stored++;
      if (r.hasEmbedding) withEmbeddings++;
    }

    logger.info({ source, chunks: stored, sermon_title }, "Sermon transcript ingested");

    res.json({
      success: true,
      source,
      sermon_title,
      chunksStored: stored,
      embeddingsGenerated: withEmbeddings,
      message: `Transcript for "${sermon_title}" is now in TempleBots' knowledge base.`,
    });
  } catch (err) {
    logger.error({ err, source }, "Transcript ingestion failed");
    res.status(500).json({ error: "Transcript ingestion failed." });
  }
});

// ─── GET /api/admin/knowledge/stats ──────────────────────────────────────────

router.get("/admin/knowledge/stats", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [total, byType, embedded, recentSources] = await Promise.all([
      knPool.query<{ count: string }>("SELECT COUNT(*) FROM knowledge_chunks"),
      knPool.query<{ chunk_type: string; count: string }>(
        "SELECT chunk_type, COUNT(*) FROM knowledge_chunks GROUP BY chunk_type ORDER BY count DESC"
      ),
      knPool.query<{ count: string }>("SELECT COUNT(*) FROM knowledge_chunks WHERE embedding IS NOT NULL"),
      knPool.query<{ source: string; updated_at: string; chunk_type: string }>(
        `SELECT DISTINCT ON (source) source, updated_at, chunk_type
         FROM knowledge_chunks ORDER BY source, updated_at DESC LIMIT 30`
      ),
    ]);

    res.json({
      totalChunks: parseInt(total.rows[0]!.count, 10),
      embeddedChunks: parseInt(embedded.rows[0]!.count, 10),
      byType: byType.rows.reduce((acc, r) => ({ ...acc, [r.chunk_type]: parseInt(r.count, 10) }), {}),
      recentSources: recentSources.rows.slice(0, 20),
    });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch stats." });
  }
});

// ─── POST /api/admin/knowledge/sync ──────────────────────────────────────────
// Trigger a full re-ingestion of all content types (sermons, devotionals, etc.)

router.post("/admin/knowledge/sync", async (_req: Request, res: Response): Promise<void> => {
  try {
    const results = await runFullContentSync(logger);
    res.json({ success: true, results, message: "Full knowledge sync complete." });
  } catch (err) {
    logger.error({ err }, "Knowledge sync failed");
    res.status(500).json({ error: "Sync failed." });
  }
});

// ─── DELETE /api/admin/knowledge/:source ─────────────────────────────────────

router.delete("/admin/knowledge/:source", async (req: Request, res: Response): Promise<void> => {
  const { source } = req.params;
  if (!source || source.length < 2) {
    res.status(400).json({ error: "source parameter required." });
    return;
  }
  try {
    const result = await knPool.query(
      "DELETE FROM knowledge_chunks WHERE source = $1 RETURNING id",
      [source]
    );
    res.json({ success: true, deleted: result.rowCount, source });
  } catch (err) {
    res.status(500).json({ error: "Delete failed." });
  }
});

// ─── GET /api/admin/knowledge/search ─────────────────────────────────────────

router.get("/admin/knowledge/search", async (req: Request, res: Response): Promise<void> => {
  const q = (req.query["q"] as string ?? "").trim();
  if (!q) { res.json({ results: [] }); return; }

  try {
    const rows = await knPool.query<{ source: string; chunk_type: string; content: string; updated_at: string }>(
      `SELECT source, chunk_type, content, updated_at FROM knowledge_chunks
       WHERE content ILIKE $1 ORDER BY updated_at DESC LIMIT 20`,
      [`%${q}%`]
    );
    res.json({ results: rows.rows.map(r => ({ ...r, preview: r.content.slice(0, 200) })) });
  } catch {
    res.status(500).json({ error: "Search failed." });
  }
});

export default router;

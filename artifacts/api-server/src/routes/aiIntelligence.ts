/**
 * AI Intelligence Admin Routes — JCTM TempleBots Observability
 *
 * Endpoints for monitoring, managing, and improving the TempleBots AI system.
 * These routes expose knowledge base stats, interaction metrics, and admin
 * controls for the sermon transcription pipeline and knowledge sync.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import pg from "pg";
import { getContentSyncStats } from "../lib/content-sync-scheduler.js";
import {
  getTranscriptionStats,
  transcribeSermonBatch,
  resetFailedTranscriptions,
} from "../lib/sermon-transcription.js";

const { Pool } = pg;
const router: IRouter = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── GET /api/admin/ai/health ─────────────────────────────────────────────────

router.get("/admin/ai/health", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [chunksRes, byTypeRes, coverageRes, transcriptionStats] = await Promise.all([
      pool.query<{ total: string; with_embeddings: string }>(
        `SELECT COUNT(*) as total, COUNT(embedding) as with_embeddings FROM knowledge_chunks`,
      ),
      pool.query<{ chunk_type: string; count: string }>(
        `SELECT chunk_type, COUNT(*) as count FROM knowledge_chunks GROUP BY chunk_type ORDER BY count DESC`,
      ),
      pool.query<{ coverage_pct: string }>(
        `SELECT ROUND(100.0 * COUNT(embedding) / NULLIF(COUNT(*), 0), 1) as coverage_pct FROM knowledge_chunks`,
      ),
      getTranscriptionStats(),
    ]);

    const syncStats = getContentSyncStats();

    const byType: Record<string, number> = {};
    for (const row of byTypeRes.rows) {
      byType[row.chunk_type] = parseInt(row.count, 10);
    }

    res.json({
      status: "healthy",
      knowledgeBase: {
        totalChunks: parseInt(chunksRes.rows[0]?.total ?? "0", 10),
        withEmbeddings: parseInt(chunksRes.rows[0]?.with_embeddings ?? "0", 10),
        vectorCoveragePct: parseFloat(coverageRes.rows[0]?.coverage_pct ?? "0"),
        byType,
      },
      transcription: transcriptionStats,
      syncJobs: syncStats,
      models: {
        chat: "gpt-4o",
        embeddings: "local/all-MiniLM-L6-v2 (384-dim)",
        transcription: "gpt-4o + YouTube timedtext",
      },
      openaiEnabled: !!process.env.OPENAI_API_KEY,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "AI health check failed", detail: String(err) });
  }
});

// ─── GET /api/admin/ai/metrics ────────────────────────────────────────────────

router.get("/admin/ai/metrics", async (req: Request, res: Response): Promise<void> => {
  const days = Math.min(parseInt(String(req.query["days"] ?? "7"), 10), 90);

  try {
    const [tierRes, langRes, sentimentRes, latencyRes, totalRes, recentRes] = await Promise.all([
      pool.query<{ tier: string; count: string; avg_latency: string; cache_hits: string }>(
        `SELECT tier, COUNT(*) as count,
                ROUND(AVG(latency_ms)) as avg_latency,
                SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits
         FROM ai_interactions
         WHERE created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY tier ORDER BY count DESC`,
      ),
      pool.query<{ language: string; count: string }>(
        `SELECT language, COUNT(*) as count FROM ai_interactions
         WHERE created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY language ORDER BY count DESC LIMIT 10`,
      ),
      pool.query<{ sentiment: string; count: string }>(
        `SELECT sentiment, COUNT(*) as count FROM ai_interactions
         WHERE created_at >= NOW() - INTERVAL '${days} days' AND sentiment IS NOT NULL
         GROUP BY sentiment ORDER BY count DESC`,
      ),
      pool.query<{ p50: string; p95: string; p99: string }>(
        `SELECT
           ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms)) as p50,
           ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)) as p95,
           ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms)) as p99
         FROM ai_interactions
         WHERE created_at >= NOW() - INTERVAL '${days} days' AND latency_ms IS NOT NULL`,
      ),
      pool.query<{ total: string; openai_total: string; cache_total: string }>(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN openai_used THEN 1 ELSE 0 END) as openai_total,
                SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_total
         FROM ai_interactions
         WHERE created_at >= NOW() - INTERVAL '${days} days'`,
      ),
      pool.query<{
        query: string; tier: string; latency_ms: number;
        openai_used: boolean; created_at: string;
      }>(
        `SELECT query, tier, latency_ms, openai_used, created_at
         FROM ai_interactions
         ORDER BY created_at DESC LIMIT 10`,
      ),
    ]);

    res.json({
      period: `${days}d`,
      totals: {
        queries: parseInt(totalRes.rows[0]?.total ?? "0", 10),
        openaiQueries: parseInt(totalRes.rows[0]?.openai_total ?? "0", 10),
        cacheHits: parseInt(totalRes.rows[0]?.cache_total ?? "0", 10),
      },
      byTier: tierRes.rows.map(r => ({
        tier: r.tier,
        count: parseInt(r.count, 10),
        avgLatencyMs: parseFloat(r.avg_latency ?? "0"),
        cacheHits: parseInt(r.cache_hits, 10),
      })),
      byLanguage: langRes.rows.map(r => ({
        language: r.language,
        count: parseInt(r.count, 10),
      })),
      bySentiment: sentimentRes.rows.map(r => ({
        sentiment: r.sentiment,
        count: parseInt(r.count, 10),
      })),
      latencyPercentiles: {
        p50: parseFloat(latencyRes.rows[0]?.p50 ?? "0"),
        p95: parseFloat(latencyRes.rows[0]?.p95 ?? "0"),
        p99: parseFloat(latencyRes.rows[0]?.p99 ?? "0"),
      },
      recentQueries: recentRes.rows.map(r => ({
        query: r.query.slice(0, 80),
        tier: r.tier,
        latencyMs: r.latency_ms,
        openaiUsed: r.openai_used,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "AI metrics query failed", detail: String(err) });
  }
});

// ─── POST /api/admin/ai/transcribe ───────────────────────────────────────────

router.post("/admin/ai/transcribe", async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(parseInt(String(req.body?.limit ?? "15"), 10), 50);
  const reset = req.body?.reset === true;

  try {
    if (reset) {
      const resetCount = await resetFailedTranscriptions(req.log);
      req.log.info({ resetCount }, "Reset failed transcriptions for retry");
    }

    transcribeSermonBatch(limit, req.log)
      .then(result => req.log.info({ result }, "Admin transcription batch complete"))
      .catch(err => req.log.warn({ err }, "Admin transcription batch failed"));

    res.json({
      message: `Sermon transcription batch started (up to ${limit} sermons)`,
      note: "Runs in background — check /api/admin/ai/health for updated status.",
      reset,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to start transcription batch", detail: String(err) });
  }
});

// ─── POST /api/admin/ai/ingest ────────────────────────────────────────────────

router.post("/admin/ai/ingest", async (req: Request, res: Response): Promise<void> => {
  try {
    const { runFullContentSync } = await import("../lib/knowledge-ingestion.js");

    runFullContentSync(req.log)
      .then(results => req.log.info({ results }, "Admin full AI knowledge sync complete"))
      .catch(err => req.log.warn({ err }, "Admin full AI knowledge sync failed"));

    res.json({
      message: "Full AI knowledge sync started (sermons, devotionals, FAQs, live stream, conferences, shorts, activity)",
      note: "Runs in background — check /api/admin/ai/health for updated chunk counts.",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to start knowledge sync", detail: String(err) });
  }
});

// ─── GET /api/admin/ai/knowledge ──────────────────────────────────────────────

router.get("/admin/ai/knowledge", async (req: Request, res: Response): Promise<void> => {
  const chunkType = String(req.query["type"] ?? "");
  const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10));
  const limit = Math.min(50, parseInt(String(req.query["limit"] ?? "20"), 10));
  const offset = (page - 1) * limit;

  try {
    const whereClause = chunkType ? "WHERE chunk_type = $3" : "";
    const params: (string | number)[] = [limit, offset];
    if (chunkType) params.push(chunkType);

    const [rows, countRes] = await Promise.all([
      pool.query<{
        id: number; source: string; chunk_type: string; content: string; updated_at: string | null;
      }>(
        `SELECT id, source, chunk_type, LEFT(content, 200) as content, updated_at
         FROM knowledge_chunks ${whereClause}
         ORDER BY updated_at DESC NULLS LAST, id DESC
         LIMIT $1 OFFSET $2`,
        params,
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) FROM knowledge_chunks ${whereClause}`,
        chunkType ? [chunkType] : [],
      ),
    ]);

    res.json({
      chunks: rows.rows,
      total: parseInt(countRes.rows[0]?.count ?? "0", 10),
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: "Knowledge query failed", detail: String(err) });
  }
});

export default router;

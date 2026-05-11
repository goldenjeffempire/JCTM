/**
 * Media Download Routes — JCTM Digital Sanctuary
 *
 * POST   /api/media/request     — Create a download/conversion job (with dedup)
 * POST   /api/media/batch       — Create multiple jobs at once
 * GET    /api/media/jobs/:id    — Poll a job's status
 * GET    /api/media/progress/:id — SSE real-time progress stream
 * GET    /api/media/download/:id — Stream completed file (range-request enabled)
 * GET    /api/media/jobs        — List recent jobs (last 20)
 * GET    /api/media/stats       — Queue health stats
 * DELETE /api/media/jobs/:id    — Cancel / discard a job
 * POST   /api/media/token/:id   — Issue a 30-min signed download token
 * GET    /api/media/dl/:token   — Serve file via validated token (audit-logged)
 */

import { Router, type IRouter, type Request, type Response } from "express";
import fs from "fs";
import { randomBytes } from "crypto";
import { z } from "zod";
import {
  createJob,
  getJob,
  getUserJobs,
  getFilePath,
  formatFileSize,
  findDuplicateJob,
  subscribeToJobProgress,
  getQueueStats,
  cancelJob,
  type JobType,
  type JobFormat,
  type JobQuality,
} from "../lib/media-processor.js";
import { pool } from "@workspace/db";
import pino from "pino";

const router: IRouter = Router();
const logger = pino({ name: "media-routes" });

// ─── Validation ───────────────────────────────────────────────────────────────

const CreateJobBody = z.object({
  type:         z.enum(["youtube_audio", "youtube_video", "gallery_image"]),
  sourceId:     z.string().min(1).max(512),
  format:       z.enum(["mp3", "m4a", "mp4", "jpeg", "png", "webp"]).optional(),
  quality:      z.enum(["low", "medium", "high", "ultra"]).optional().default("high"),
  title:        z.string().max(200).optional(),
  thumbnailUrl: z.string().url().optional().or(z.literal("")).optional(),
  duration:     z.number().int().positive().optional(),
  deduplicate:  z.boolean().optional().default(true),
});

const BatchJobBody = z.object({
  jobs: z.array(CreateJobBody).min(1).max(10),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferFormat(type: JobType, requested?: string): JobFormat {
  if (requested) return requested as JobFormat;
  if (type === "youtube_audio") return "mp3";
  if (type === "youtube_video") return "mp4";
  return "jpeg";
}

function safeFilename(job: { title: string | null; format: string; id: string }): string {
  const sanitized = (job.title ?? "")
    .replace(/[^a-zA-Z0-9\s\-_()]/g, "")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")  // trim leading/trailing underscores
    .slice(0, 80);
  const base = sanitized || `jctm_media_${job.id.slice(0, 8)}`;
  return `${base}.${job.format}`;
}

function mimeFor(format: string): string {
  const map: Record<string, string> = {
    mp3:  "audio/mpeg",
    m4a:  "audio/mp4",
    mp4:  "video/mp4",
    jpeg: "image/jpeg",
    png:  "image/png",
    webp: "image/webp",
  };
  return map[format] ?? "application/octet-stream";
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

async function writeAuditLog(event: string, data: {
  ip?: string; videoId?: string; format?: string;
  quality?: string; bytesServed?: number; jobId?: string;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO media_audit_log (event, ip, video_id, format, quality, bytes_served, job_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [event, data.ip ?? "", data.videoId ?? null, data.format ?? null,
       data.quality ?? null, data.bytesServed ?? null, data.jobId ?? null],
    );
  } catch (err) {
    logger.warn({ err }, "Failed to write audit log — non-fatal");
  }
}

// Rate limit: 30 job requests per IP per hour
const ipJobCount = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipJobCount.get(ip);
  if (!entry || entry.resetAt < now) {
    ipJobCount.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count++;
  return true;
}
// Sweep expired rate-limit buckets every hour to prevent unbounded Map growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipJobCount) {
    if (entry.resetAt < now) ipJobCount.delete(ip);
  }
}, 60 * 60 * 1000).unref();

// Token rate limit: max 10 per IP per 10 minutes (prevents flood attacks)
const ipTokenCount = new Map<string, { count: number; resetAt: number }>();
function checkTokenRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipTokenCount.get(ip);
  if (!entry || entry.resetAt < now) {
    ipTokenCount.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of ipTokenCount) if (e.resetAt < now) ipTokenCount.delete(ip);
}, 60 * 60 * 1000).unref();

// ─── Shared range-aware file server ──────────────────────────────────────────
//
// Handles: ETag / Last-Modified conditional requests, suffix ranges (bytes=-N),
// invalid-range → 416, proper Content-Range clamping, and common security headers.
// Used by both /download/:id and /dl/:token so the logic stays in one place.

function serveFile(
  req: Request, res: Response,
  filePath: string, stats: fs.Stats,
  mime: string, fname: string,
  cacheMaxAge: number,
): void {
  const etag        = `"${stats.size.toString(16)}-${stats.mtimeMs.toString(16)}"`;
  const lastModified = stats.mtime.toUTCString();

  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Expose-Headers",
    "Content-Disposition, Content-Length, Content-Range, ETag, Last-Modified, Accept-Ranges");
  res.setHeader("Content-Encoding",       "identity");
  res.setHeader("ETag",                   etag);
  res.setHeader("Last-Modified",          lastModified);
  res.setHeader("Accept-Ranges",          "bytes");
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Conditional request — skip body if client already has this version
  const ifNoneMatch    = req.headers["if-none-match"];
  const ifModifiedSince = req.headers["if-modified-since"];
  if (
    (ifNoneMatch && ifNoneMatch === etag) ||
    (!ifNoneMatch && ifModifiedSince && new Date(ifModifiedSince) >= stats.mtime)
  ) {
    res.status(304).end();
    return;
  }

  const rawRange = req.headers.range;
  if (rawRange) {
    // Only handle the simple single-range format: bytes=start-end
    const m = /^bytes=(\d*)-(\d*)$/.exec(rawRange.trim());
    if (!m) {
      res.status(416).setHeader("Content-Range", `bytes */${stats.size}`).end();
      return;
    }

    const hasStart = m[1] !== "";
    const hasEnd   = m[2] !== "";
    let start: number;
    let end: number;

    if (!hasStart && hasEnd) {
      // Suffix range: bytes=-500  →  last 500 bytes
      const suffix = parseInt(m[2]!, 10);
      start = Math.max(0, stats.size - suffix);
      end   = stats.size - 1;
    } else {
      start = parseInt(m[1]!, 10);
      end   = hasEnd ? Math.min(parseInt(m[2]!, 10), stats.size - 1) : stats.size - 1;
    }

    if (isNaN(start) || isNaN(end) || start < 0 || start > end || start >= stats.size) {
      res.status(416).setHeader("Content-Range", `bytes */${stats.size}`).end();
      return;
    }

    res.status(206);
    res.setHeader("Content-Range",       `bytes ${start}-${end}/${stats.size}`);
    res.setHeader("Content-Length",      String(end - start + 1));
    res.setHeader("Content-Type",        mime);
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"; filename*=UTF-8''${encodeURIComponent(fname)}`);
    res.setHeader("Cache-Control",       `private, max-age=${cacheMaxAge}`);

    const stream = fs.createReadStream(filePath, { start, end, highWaterMark: 4 * 1024 * 1024 });
    stream.pipe(res);
    stream.on("error", (err) => { logger.warn({ err }, "Range stream error"); if (!res.writableEnded) res.end(); });
  } else {
    res.status(200);
    res.setHeader("Content-Type",        mime);
    res.setHeader("Content-Length",      String(stats.size));
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"; filename*=UTF-8''${encodeURIComponent(fname)}`);
    res.setHeader("Cache-Control",       `private, max-age=${cacheMaxAge}`);

    const stream = fs.createReadStream(filePath, { highWaterMark: 4 * 1024 * 1024 });
    stream.pipe(res);
    stream.on("error", (err) => { logger.warn({ err }, "Download stream error"); if (!res.writableEnded) res.end(); });
  }
}

type AnyJob = Awaited<ReturnType<typeof getJob>>;

function serializeJob(job: AnyJob) {
  if (!job) return null;
  return {
    jobId:              job.id,
    type:               job.type,
    sourceId:           job.sourceId,
    format:             job.format,
    quality:            job.quality,
    status:             job.status,
    progress:           job.progress,
    title:              job.title,
    duration:           job.duration,
    thumbnailUrl:       job.thumbnailUrl,
    fileSize:           job.fileSize,
    fileSizeFormatted:  job.fileSize ? formatFileSize(job.fileSize) : null,
    error:              job.error,
    retryCount:         job.retryCount ?? 0,
    downloadUrl:        job.status === "ready" ? `/api/media/download/${job.id}` : null,
    createdAt:          job.createdAt.toISOString(),
    expiresAt:          job.expiresAt.toISOString(),
    cached:             false,
  };
}

// ─── POST /api/media/request ─────────────────────────────────────────────────

router.post("/media/request", async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const ip = String(req.ip ?? req.socket?.remoteAddress ?? "unknown");
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: "Too many conversion requests. Please wait before requesting more downloads." });
    return;
  }

  const { type, sourceId, quality = "high", title, thumbnailUrl, duration, deduplicate = true } = parsed.data;
  const format = inferFormat(type as JobType, parsed.data.format);

  try {
    // Source validation + live stream guard (single query)
    if (type === "youtube_audio" || type === "youtube_video") {
      const { rows } = await pool.query<{ is_live: boolean }>(
        `SELECT is_live FROM sermon_data WHERE video_id = $1 LIMIT 1`,
        [sourceId],
      );
      if (rows.length === 0) {
        res.status(403).json({
          error: "This video is not available for download from the JCTM library.",
          code: "NOT_IN_LIBRARY",
        });
        return;
      }
      if (rows[0]?.is_live) {
        res.status(409).json({
          error: "This sermon is currently live — download becomes available after the stream ends.",
          code: "LIVE_STREAM",
        });
        return;
      }
    }

    if (deduplicate) {
      const existing = await findDuplicateJob({
        type: type as JobType, sourceId,
        format: format as JobFormat, quality: quality as JobQuality,
        title, thumbnailUrl: thumbnailUrl || undefined, duration,
      });
      if (existing) {
        logger.info({ jobId: existing.id, status: existing.status }, "Returning deduplicated job");
        res.status(200).json({
          ...serializeJob(existing),
          cached: existing.status === "ready",
          message: existing.status === "ready"
            ? "File already converted — instant download available!"
            : "Conversion already in progress.",
        });
        return;
      }
    }

    const job = await createJob({
      type: type as JobType, sourceId,
      format: format as JobFormat, quality: quality as JobQuality,
      title, thumbnailUrl: thumbnailUrl || undefined, duration,
    });

    void writeAuditLog("job_created", {
      ip, videoId: job.sourceId, format: job.format, quality: job.quality, jobId: job.id,
    });

    res.status(201).json({
      ...serializeJob(job),
      estimatedSeconds: type === "youtube_video" ? 60 : type === "youtube_audio" ? 35 : 5,
      message: "Media conversion job created.",
    });
  } catch (err) {
    logger.error({ err }, "Failed to create media job");
    res.status(500).json({ error: "Failed to start conversion. Please try again." });
  }
});

// ─── POST /api/media/batch ───────────────────────────────────────────────────

router.post("/media/batch", async (req: Request, res: Response): Promise<void> => {
  const parsed = BatchJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid batch request", details: parsed.error.flatten() });
    return;
  }

  const ip = String(req.ip ?? req.socket?.remoteAddress ?? "unknown");
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: "Rate limit exceeded." });
    return;
  }

  try {
    const results = await Promise.all(
      parsed.data.jobs.map(async (jobInput) => {
        const format = inferFormat(jobInput.type as JobType, jobInput.format);
        const input = {
          type:         jobInput.type as JobType,
          sourceId:     jobInput.sourceId,
          format:       format as JobFormat,
          quality:      (jobInput.quality ?? "high") as JobQuality,
          title:        jobInput.title,
          thumbnailUrl: jobInput.thumbnailUrl || undefined,
          duration:     jobInput.duration,
        };
        const existing = await findDuplicateJob(input);
        if (existing) return { ...serializeJob(existing), cached: existing.status === "ready" };
        return serializeJob(await createJob(input));
      })
    );
    res.status(201).json({ jobs: results, total: results.length });
  } catch (err) {
    logger.error({ err }, "Failed to create batch jobs");
    res.status(500).json({ error: "Failed to start batch conversion." });
  }
});

// ─── GET /api/media/progress/:id  (SSE) ──────────────────────────────────────

router.get("/media/progress/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    res.status(400).json({ error: "Invalid job ID" });
    return;
  }

  try {
    const job = await getJob(id);
    if (!job) {
      res.status(404).json({ error: "Job not found or expired." });
      return;
    }

    // Already done — return JSON immediately, no SSE needed
    if (job.status === "ready" || job.status === "failed") {
      res.setHeader("Content-Type", "application/json");
      res.json(serializeJob(job));
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Tell the browser to reconnect after 5 s if the connection drops
    res.write("retry: 5000\n\n");

    // Send current state immediately
    res.write(`event: progress\ndata: ${JSON.stringify(serializeJob(job))}\n\n`);

    const unsub = subscribeToJobProgress(id, (update) => {
      if (res.writableEnded) return;
      try {
        res.write(`event: progress\ndata: ${JSON.stringify(update)}\n\n`);
        if (update.status === "ready" || update.status === "failed") {
          res.write(`event: done\ndata: ${JSON.stringify({ status: update.status })}\n\n`);
          res.end();
        }
      } catch { unsub(); }
    });

    const ping = setInterval(() => {
      if (!res.writableEnded) res.write(`event: ping\ndata: {}\n\n`);
      else { clearInterval(ping); unsub(); }
    }, 20_000);

    res.once("close",  () => { clearInterval(ping); unsub(); });
    res.once("finish", () => { clearInterval(ping); unsub(); });

  } catch (err) {
    logger.error({ err }, "SSE progress stream error");
    if (!res.headersSent) res.status(500).json({ error: "Failed to open progress stream." });
  }
});

// ─── GET /api/media/jobs/:id ─────────────────────────────────────────────────

router.get("/media/jobs/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    res.status(400).json({ error: "Invalid job ID" });
    return;
  }
  try {
    const job = await getJob(id);
    if (!job) { res.status(404).json({ error: "Job not found or expired." }); return; }
    res.setHeader("Cache-Control", "no-store");
    res.json(serializeJob(job));
  } catch (err) {
    logger.error({ err }, "Failed to fetch job");
    res.status(500).json({ error: "Failed to fetch job status." });
  }
});

// ─── GET /api/media/download/:id ─────────────────────────────────────────────

router.get("/media/download/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    res.status(400).json({ error: "Invalid job ID" });
    return;
  }

  try {
    const job = await getJob(id);
    if (!job) { res.status(404).json({ error: "Job not found or expired." }); return; }
    if (job.status !== "ready") {
      res.status(409).json({ error: `File not ready. Status: ${job.status} (${job.progress}%)` });
      return;
    }

    const filePath = getFilePath(job);
    if (!filePath) {
      res.status(410).json({ error: "File has been deleted or expired. Please re-convert." });
      return;
    }

    const stats = await fs.promises.stat(filePath);
    const mime  = mimeFor(job.format);
    const fname = safeFilename({ title: job.title, format: job.format, id: job.id });

    serveFile(req, res, filePath, stats, mime, fname, 3600);
  } catch (err) {
    logger.error({ err }, "Failed to serve download");
    if (!res.headersSent) res.status(500).json({ error: "Failed to serve file." });
  }
});

// ─── GET /api/media/jobs ─────────────────────────────────────────────────────

router.get("/media/jobs", async (_req: Request, res: Response): Promise<void> => {
  try {
    const jobs = await getUserJobs(20);
    res.setHeader("Cache-Control", "no-store");
    res.json(jobs.map(j => serializeJob(j)));
  } catch (err) {
    logger.error({ err }, "Failed to list jobs");
    res.status(500).json({ error: "Failed to load recent downloads." });
  }
});

// ─── GET /api/media/stats ─────────────────────────────────────────────────────

router.get("/media/stats", (_req: Request, res: Response): void => {
  res.setHeader("Cache-Control", "no-store");
  res.json(getQueueStats());
});

// ─── DELETE /api/media/jobs/:id ───────────────────────────────────────────────

router.delete("/media/jobs/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    res.status(400).json({ error: "Invalid job ID" });
    return;
  }
  try {
    const job = await getJob(id);
    if (!job) { res.status(404).json({ error: "Job not found." }); return; }

    cancelJob(id);

    if (job.outputPath && fs.existsSync(job.outputPath)) {
      fs.unlinkSync(job.outputPath);
    }
    await pool.query("DELETE FROM media_download_jobs WHERE id = $1", [id]);
    res.json({ ok: true, message: "Job cancelled and deleted." });
  } catch (err) {
    logger.error({ err }, "Failed to delete job");
    res.status(500).json({ error: "Failed to delete job." });
  }
});

// ─── POST /api/media/token/:id ────────────────────────────────────────────────

router.post("/media/token/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const ip = String(req.ip ?? req.socket?.remoteAddress ?? "unknown");

  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    res.status(400).json({ error: "Invalid job ID" });
    return;
  }

  if (!checkTokenRateLimit(ip)) {
    res.status(429).json({ error: "Too many token requests — please wait a moment before downloading again." });
    return;
  }

  try {
    const job = await getJob(id);
    if (!job) { res.status(404).json({ error: "Job not found or expired." }); return; }
    if (job.status !== "ready") {
      res.status(409).json({ error: `File not ready. Status: ${job.status}` });
      return;
    }

    // Reject blocked IPs
    const { rows: blocked } = await pool.query(`SELECT 1 FROM blocked_ips WHERE ip = $1`, [ip]);
    if (blocked.length > 0) {
      res.status(403).json({ error: "Download access is restricted for this network." });
      return;
    }

    const token     = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      `INSERT INTO download_tokens (token, job_id, ip, expires_at) VALUES ($1, $2, $3, $4)`,
      [token, id, ip, expiresAt],
    );

    void writeAuditLog("token_issued", {
      ip, videoId: job.sourceId, format: job.format, quality: job.quality, jobId: id,
    });

    res.json({ token, expiresAt: expiresAt.toISOString(), downloadUrl: `/api/media/dl/${token}` });
  } catch (err) {
    logger.error({ err }, "Failed to issue download token");
    res.status(500).json({ error: "Failed to issue download token." });
  }
});

// ─── GET /api/media/dl/:token ────────────────────────────────────────────────

router.get("/media/dl/:token", async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  const ip = String(req.ip ?? req.socket?.remoteAddress ?? "unknown");

  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    res.status(400).json({ error: "Invalid download token" });
    return;
  }

  try {
    // Reject blocked IPs
    const { rows: blocked } = await pool.query(`SELECT 1 FROM blocked_ips WHERE ip = $1`, [ip]);
    if (blocked.length > 0) {
      res.status(403).json({ error: "Download access is restricted for this network." });
      return;
    }

    const { rows } = await pool.query<{ job_id: string; expires_at: Date; used_at: Date | null }>(
      `SELECT job_id, expires_at, used_at FROM download_tokens WHERE token = $1`,
      [token],
    );
    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: "Invalid or expired download token." });
      return;
    }
    if (new Date(row.expires_at) < new Date()) {
      res.status(410).json({
        error: "Download link has expired. Please open the sermon and tap Download again.",
        code:  "TOKEN_EXPIRED",
      });
      return;
    }

    const job = await getJob(row.job_id);
    if (!job || job.status !== "ready") {
      res.status(410).json({ error: "File no longer available. Please re-convert." });
      return;
    }

    const filePath = getFilePath(job);
    if (!filePath) {
      res.status(410).json({ error: "File has been deleted. Please re-convert." });
      return;
    }

    const stats = await fs.promises.stat(filePath);
    const mime  = mimeFor(job.format);
    const fname = safeFilename({ title: job.title, format: job.format, id: job.id });

    // Record first use (non-blocking — token stays valid for its full TTL)
    void pool.query(
      `UPDATE download_tokens SET used_at = now() WHERE token = $1 AND used_at IS NULL`,
      [token],
    );
    void writeAuditLog("download_served", {
      ip, videoId: job.sourceId, format: job.format,
      quality: job.quality, bytesServed: stats.size, jobId: job.id,
    });

    serveFile(req, res, filePath, stats, mime, fname, 1800);
  } catch (err) {
    logger.error({ err }, "Failed to serve tokenized download");
    if (!res.headersSent) res.status(500).json({ error: "Failed to serve file." });
  }
});

export default router;

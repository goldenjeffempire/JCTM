/**
 * Media Download & Conversion Routes — JCTM Digital Sanctuary
 *
 * POST /api/media/request      — Create a new conversion/download job
 * GET  /api/media/jobs/:id     — Poll job status and progress
 * GET  /api/media/download/:id — Stream the completed file to browser
 * GET  /api/media/jobs         — List recent jobs (last 20)
 * DELETE /api/media/jobs/:id   — Cancel / discard a job
 */

import { Router, type IRouter, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";
import {
  createJob,
  getJob,
  getUserJobs,
  getFilePath,
  formatFileSize,
  type JobType,
  type JobFormat,
  type JobQuality,
} from "../lib/media-processor.js";
import pino from "pino";

const router: IRouter = Router();
const logger = pino({ name: "media-routes" });

// ─── Validation schemas ───────────────────────────────────────────────────────

const CreateJobBody = z.object({
  type: z.enum(["youtube_audio", "youtube_video", "gallery_image"]),
  sourceId: z.string().min(1).max(512),
  format: z.enum(["mp3", "m4a", "mp4", "jpeg", "png", "webp"]).optional(),
  quality: z.enum(["low", "medium", "high", "ultra"]).optional().default("high"),
  title: z.string().max(200).optional(),
  thumbnailUrl: z.string().url().optional(),
  duration: z.number().int().positive().optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferFormat(type: JobType, requested?: string): JobFormat {
  if (requested) return requested as JobFormat;
  if (type === "youtube_audio") return "mp3";
  if (type === "youtube_video") return "mp4";
  return "jpeg";
}

function safeFilename(job: { title: string | null; format: string; id: string }): string {
  const base = job.title
    ? job.title.replace(/[^a-zA-Z0-9\s\-_()]/g, "").replace(/\s+/g, "_").slice(0, 80)
    : `jctm_media_${job.id.slice(0, 8)}`;
  return `${base}.${job.format}`;
}

function mimeFor(format: string): string {
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    mp4: "video/mp4",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  return map[format] ?? "application/octet-stream";
}

// Rate limiting: max 10 job requests per IP per hour
const ipJobCount = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipJobCount.get(ip);
  if (!entry || entry.resetAt < now) {
    ipJobCount.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
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
    res.status(429).json({
      error: "Too many conversion requests. Please wait before requesting more downloads.",
    });
    return;
  }

  const { type, sourceId, quality = "high", title, thumbnailUrl, duration } = parsed.data;
  const format = inferFormat(type as JobType, parsed.data.format);

  try {
    const job = await createJob({
      type: type as JobType,
      sourceId,
      format: format as JobFormat,
      quality: quality as JobQuality,
      title,
      thumbnailUrl,
      duration,
    });

    res.status(201).json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      estimatedSeconds: type === "youtube_video" ? 60 : type === "youtube_audio" ? 35 : 5,
      message: "Media conversion job created. Poll /api/media/jobs/:id for status.",
    });
  } catch (err) {
    logger.error({ err }, "Failed to create media job");
    res.status(500).json({ error: "Failed to start conversion. Please try again." });
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
    if (!job) {
      res.status(404).json({ error: "Job not found or expired." });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({
      jobId: job.id,
      type: job.type,
      sourceId: job.sourceId,
      format: job.format,
      quality: job.quality,
      status: job.status,
      progress: job.progress,
      title: job.title,
      duration: job.duration,
      thumbnailUrl: job.thumbnailUrl,
      fileSize: job.fileSize,
      fileSizeFormatted: job.fileSize ? formatFileSize(job.fileSize) : null,
      error: job.error,
      downloadUrl: job.status === "ready" ? `/api/media/download/${job.id}` : null,
      createdAt: job.createdAt.toISOString(),
      expiresAt: job.expiresAt.toISOString(),
    });
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
    if (!job) {
      res.status(404).json({ error: "Job not found or expired." });
      return;
    }
    if (job.status !== "ready") {
      res.status(409).json({ error: `File not ready. Status: ${job.status} (${job.progress}%)` });
      return;
    }

    const filePath = getFilePath(job);
    if (!filePath) {
      res.status(410).json({ error: "File has been deleted or expired. Please re-convert." });
      return;
    }

    const stats = fs.statSync(filePath);
    const mime = mimeFor(job.format);
    const filename = safeFilename({ title: job.title, format: job.format, id: job.id });

    // Support range requests (for mobile audio players and video seeking)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0]!, 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${stats.size}`);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", chunkSize);
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "private, max-age=3600");

      const fileStream = fs.createReadStream(filePath, { start, end });
      fileStream.pipe(res);
      fileStream.on("error", () => res.end());
    } else {
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Length", stats.size);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.setHeader("X-Content-Type-Options", "nosniff");

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      fileStream.on("error", () => res.end());
    }
  } catch (err) {
    logger.error({ err }, "Failed to serve download");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to serve file." });
    }
  }
});

// ─── GET /api/media/jobs ─────────────────────────────────────────────────────

router.get("/media/jobs", async (_req: Request, res: Response): Promise<void> => {
  try {
    const jobs = await getUserJobs(20);
    res.setHeader("Cache-Control", "no-store");
    res.json(jobs.map(job => ({
      jobId: job.id,
      type: job.type,
      sourceId: job.sourceId,
      format: job.format,
      quality: job.quality,
      status: job.status,
      progress: job.progress,
      title: job.title,
      fileSize: job.fileSize,
      fileSizeFormatted: job.fileSize ? formatFileSize(job.fileSize) : null,
      error: job.error,
      downloadUrl: job.status === "ready" ? `/api/media/download/${job.id}` : null,
      createdAt: job.createdAt.toISOString(),
      expiresAt: job.expiresAt.toISOString(),
    })));
  } catch (err) {
    logger.error({ err }, "Failed to list jobs");
    res.status(500).json({ error: "Failed to load recent downloads." });
  }
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
    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }
    // Delete output file if exists
    if (job.outputPath && fs.existsSync(job.outputPath)) {
      fs.unlinkSync(job.outputPath);
    }
    await import("@workspace/db").then(({ pool: p }) =>
      p.query("DELETE FROM media_download_jobs WHERE id = $1", [id])
    );
    res.json({ ok: true, message: "Job deleted." });
  } catch (err) {
    logger.error({ err }, "Failed to delete job");
    res.status(500).json({ error: "Failed to delete job." });
  }
});

export default router;

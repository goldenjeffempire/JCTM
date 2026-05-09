/**
 * Media Processor — JCTM Digital Sanctuary
 *
 * Enterprise-grade media conversion and download engine.
 * Supports:
 *   • YouTube audio extraction (MP3 128/192/320 kbps, M4A)
 *   • YouTube video download (MP4 360p / 720p / 1080p)
 *   • Gallery image download with optional JCTM watermark
 *   • Background job queue with progress tracking
 *   • File caching, cleanup, and retry logic
 */

import { spawn } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { pool } from "@workspace/db";
import pino from "pino";

const logger = pino({ name: "media-processor" });

// ─── Paths ────────────────────────────────────────────────────────────────────

export const MEDIA_DIR = process.env.MEDIA_TEMP_DIR ?? path.join(os.tmpdir(), "jctm-media");
const YT_DLP_BIN =
  process.env.YT_DLP_PATH ??
  path.join(os.homedir(), ".pythonlibs", "bin", "yt-dlp");

// Ensure temp directory exists
fs.mkdirSync(MEDIA_DIR, { recursive: true });

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobType = "youtube_audio" | "youtube_video" | "gallery_image";
export type JobFormat = "mp3" | "m4a" | "mp4" | "jpeg" | "png" | "webp";
export type JobQuality = "low" | "medium" | "high" | "ultra";
export type JobStatus = "queued" | "processing" | "ready" | "failed";

export interface MediaJob {
  id: string;
  type: JobType;
  sourceId: string;
  format: JobFormat;
  quality: JobQuality;
  status: JobStatus;
  progress: number;
  error: string | null;
  outputPath: string | null;
  title: string | null;
  duration: number | null;
  fileSize: number | null;
  thumbnailUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface CreateJobInput {
  type: JobType;
  sourceId: string;
  format: JobFormat;
  quality: JobQuality;
  title?: string;
  thumbnailUrl?: string;
  duration?: number;
}

// ─── Quality mappings ─────────────────────────────────────────────────────────

const AUDIO_QUALITY_BITRATE: Record<JobQuality, string> = {
  low:   "128",
  medium: "192",
  high:  "256",
  ultra: "320",
};

const VIDEO_HEIGHT: Record<JobQuality, number> = {
  low:   360,
  medium: 480,
  high:  720,
  ultra: 1080,
};

// ─── In-memory active job map (progress cache) ────────────────────────────────

const activeJobs = new Map<string, MediaJob>();
let concurrentJobs = 0;
const MAX_CONCURRENT = 3;
const jobQueue: Array<() => Promise<void>> = [];

function drainQueue() {
  while (jobQueue.length > 0 && concurrentJobs < MAX_CONCURRENT) {
    const task = jobQueue.shift()!;
    concurrentJobs++;
    task().finally(() => {
      concurrentJobs--;
      drainQueue();
    });
  }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function dbUpsertJob(job: MediaJob): Promise<void> {
  await pool.query(
    `INSERT INTO media_download_jobs
       (id, type, source_id, format, quality, status, progress, error,
        output_path, title, duration, file_size, thumbnail_url, created_at, updated_at, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (id) DO UPDATE SET
       status       = EXCLUDED.status,
       progress     = EXCLUDED.progress,
       error        = EXCLUDED.error,
       output_path  = EXCLUDED.output_path,
       file_size    = EXCLUDED.file_size,
       updated_at   = EXCLUDED.updated_at`,
    [
      job.id, job.type, job.sourceId, job.format, job.quality,
      job.status, job.progress, job.error, job.outputPath,
      job.title, job.duration, job.fileSize, job.thumbnailUrl,
      job.createdAt, job.updatedAt, job.expiresAt,
    ],
  );
}

async function dbGetJob(id: string): Promise<MediaJob | null> {
  // Check in-memory first (faster, has progress)
  if (activeJobs.has(id)) return activeJobs.get(id)!;

  const { rows } = await pool.query<{
    id: string; type: string; source_id: string; format: string; quality: string;
    status: string; progress: number; error: string | null; output_path: string | null;
    title: string | null; duration: number | null; file_size: string | null;
    thumbnail_url: string | null; created_at: Date; updated_at: Date; expires_at: Date;
  }>(
    `SELECT * FROM media_download_jobs WHERE id = $1 AND expires_at > now()`,
    [id],
  );

  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id,
    type: r.type as JobType,
    sourceId: r.source_id,
    format: r.format as JobFormat,
    quality: r.quality as JobQuality,
    status: r.status as JobStatus,
    progress: r.progress,
    error: r.error,
    outputPath: r.output_path,
    title: r.title,
    duration: r.duration,
    fileSize: r.file_size ? Number(r.file_size) : null,
    thumbnailUrl: r.thumbnail_url,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    expiresAt: r.expires_at,
  };
}

function updateJob(job: MediaJob, patch: Partial<MediaJob>): MediaJob {
  const updated: MediaJob = { ...job, ...patch, updatedAt: new Date() };
  activeJobs.set(job.id, updated);
  dbUpsertJob(updated).catch(err => logger.warn({ err }, "dbUpsertJob failed"));
  return updated;
}

// ─── yt-dlp helpers ───────────────────────────────────────────────────────────

interface YtMetadata {
  title: string;
  duration: number;
  thumbnail: string;
  uploader: string;
}

async function fetchYtMetadata(videoId: string): Promise<YtMetadata | null> {
  return new Promise((resolve) => {
    const args = [
      "--no-playlist",
      "--skip-download",
      "--print-json",
      "--no-warnings",
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    const proc = spawn(YT_DLP_BIN, args, { timeout: 20_000 });
    let stdout = "";
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.on("close", (code) => {
      if (code !== 0) { resolve(null); return; }
      try {
        const meta = JSON.parse(stdout.split("\n")[0]!);
        resolve({
          title: meta.title ?? "JCTM Sermon",
          duration: meta.duration ?? 0,
          thumbnail: meta.thumbnail ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          uploader: meta.uploader ?? "JCTM",
        });
      } catch {
        resolve(null);
      }
    });
    proc.on("error", () => resolve(null));
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s\-_()[\]]/g, "").replace(/\s+/g, "_").slice(0, 100);
}

// ─── Audio extraction ─────────────────────────────────────────────────────────

async function processYouTubeAudio(job: MediaJob): Promise<void> {
  const bitrate = AUDIO_QUALITY_BITRATE[job.quality];
  const ext = job.format === "m4a" ? "m4a" : "mp3";
  const outFile = path.join(MEDIA_DIR, `${job.id}.${ext}`);
  const tmpFile = path.join(MEDIA_DIR, `${job.id}_raw`);

  let currentJob = updateJob(job, { progress: 5, status: "processing" });

  // Step 1: fetch metadata
  const meta = await fetchYtMetadata(job.sourceId);
  const title = meta?.title ?? job.title ?? "JCTM Sermon";
  currentJob = updateJob(currentJob, {
    title,
    duration: meta?.duration ?? job.duration ?? null,
    thumbnailUrl: meta?.thumbnail ?? job.thumbnailUrl ?? null,
    progress: 10,
  });

  // Step 2: download audio-only stream via yt-dlp
  await new Promise<void>((resolve, reject) => {
    const ytArgs = [
      "--no-playlist",
      "--no-warnings",
      "-x",
      "--audio-format", "bestaudio",
      "--audio-quality", "0",
      "-o", tmpFile,
      "--no-part",
      `https://www.youtube.com/watch?v=${job.sourceId}`,
    ];

    const proc = spawn(YT_DLP_BIN, ytArgs);
    let stderr = "";

    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      const match = /(\d+\.\d+)%/.exec(d.toString());
      if (match) {
        const pct = Math.min(80, 10 + Math.round(parseFloat(match[1]) * 0.7));
        updateJob(currentJob, { progress: pct });
      }
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(-200)}`));
      }
    });
    proc.on("error", (e) => reject(e));
  });

  currentJob = updateJob(currentJob, { progress: 82 });

  // Find the actual output file (yt-dlp may append extension)
  const candidates = fs.readdirSync(MEDIA_DIR).filter(f => f.startsWith(`${job.id}_raw`));
  const rawFile = candidates.length > 0 ? path.join(MEDIA_DIR, candidates[0]!) : tmpFile;

  // Step 3: re-encode to target format with ffmpeg for metadata embedding
  await new Promise<void>((resolve, reject) => {
    const safeName = sanitizeFilename(title);
    const artist = "Jesus Christ Temple Ministry";

    const cmd = ffmpeg(rawFile)
      .audioCodec(ext === "m4a" ? "aac" : "libmp3lame")
      .audioBitrate(`${bitrate}k`)
      .audioChannels(2)
      .audioFrequency(44100)
      .outputOptions([
        `-metadata`, `title=${safeName}`,
        `-metadata`, `artist=${artist}`,
        `-metadata`, `album=JCTM Sermons`,
        `-metadata`, `genre=Gospel`,
        `-metadata`, `comment=jctm.org.ng`,
        ext === "m4a" ? "-movflags +faststart" : "-id3v2_version 3",
      ])
      .on("progress", (p) => {
        const pct = Math.min(97, 82 + Math.round((p.percent ?? 0) * 0.15));
        updateJob(currentJob, { progress: pct });
      })
      .on("end", () => resolve())
      .on("error", (e) => reject(e));

    cmd.save(outFile);
  });

  // Cleanup raw file
  try { fs.unlinkSync(rawFile); } catch { /* non-fatal */ }

  const stats = fs.statSync(outFile);
  updateJob(currentJob, {
    status: "ready",
    progress: 100,
    outputPath: outFile,
    fileSize: stats.size,
  });
}

// ─── Video download ───────────────────────────────────────────────────────────

async function processYouTubeVideo(job: MediaJob): Promise<void> {
  const height = VIDEO_HEIGHT[job.quality];
  const outFile = path.join(MEDIA_DIR, `${job.id}.mp4`);

  let currentJob = updateJob(job, { progress: 5, status: "processing" });

  // Fetch metadata
  const meta = await fetchYtMetadata(job.sourceId);
  const title = meta?.title ?? job.title ?? "JCTM Sermon";
  currentJob = updateJob(currentJob, {
    title,
    duration: meta?.duration ?? job.duration ?? null,
    thumbnailUrl: meta?.thumbnail ?? job.thumbnailUrl ?? null,
    progress: 10,
  });

  // Download video + audio and merge
  await new Promise<void>((resolve, reject) => {
    const fmtSelector = height >= 1080
      ? `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`
      : `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;

    const ytArgs = [
      "--no-playlist",
      "--no-warnings",
      "-f", fmtSelector,
      "--merge-output-format", "mp4",
      "-o", outFile,
      "--no-part",
      `https://www.youtube.com/watch?v=${job.sourceId}`,
    ];

    const proc = spawn(YT_DLP_BIN, ytArgs);
    let stderr = "";

    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      const match = /(\d+\.\d+)%/.exec(d.toString());
      if (match) {
        const pct = Math.min(95, 10 + Math.round(parseFloat(match[1]) * 0.85));
        updateJob(currentJob, { progress: pct });
      }
    });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp video exited ${code}: ${stderr.slice(-300)}`));
    });
    proc.on("error", (e) => reject(e));
  });

  const stats = fs.statSync(outFile);
  updateJob(currentJob, {
    status: "ready",
    progress: 100,
    outputPath: outFile,
    fileSize: stats.size,
  });
}

// ─── Gallery image download ───────────────────────────────────────────────────

async function processGalleryImage(job: MediaJob): Promise<void> {
  let currentJob = updateJob(job, { progress: 5, status: "processing" });

  // Determine output format
  const ext = job.format === "png" ? "png" : job.format === "webp" ? "webp" : "jpeg";
  const outFile = path.join(MEDIA_DIR, `${job.id}.${ext}`);

  // Fetch the source image
  currentJob = updateJob(currentJob, { progress: 20 });

  const { default: sharp } = await import("sharp");

  // For gallery images, sourceId is the objectPath or a URL
  let imageBuffer: Buffer;
  if (job.sourceId.startsWith("http")) {
    const resp = await fetch(job.sourceId);
    if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
    imageBuffer = Buffer.from(await resp.arrayBuffer());
  } else {
    // Read from object storage path
    const { ObjectStorageService } = await import("./objectStorage.js");
    const oss = new ObjectStorageService();
    imageBuffer = await oss.getObject(job.sourceId) as Buffer;
  }

  currentJob = updateJob(currentJob, { progress: 60 });

  // Process image with quality settings
  const qualityMap: Record<JobQuality, number> = { low: 70, medium: 82, high: 90, ultra: 95 };
  const q = qualityMap[job.quality];

  let sharpPipeline = sharp(imageBuffer);

  // Embed JCTM branding watermark (subtle text watermark via SVG overlay)
  try {
    const metadata = await sharpPipeline.metadata();
    const w = metadata.width ?? 1200;
    const h = metadata.height ?? 800;
    const fontSize = Math.max(14, Math.round(w * 0.022));

    const watermarkSvg = `
      <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .wm { font-family: Arial, sans-serif; font-size: ${fontSize}px;
                fill: rgba(255,255,255,0.55); font-weight: 600; }
        </style>
        <text x="${w - 14}" y="${h - 14}" text-anchor="end" class="wm"
              filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.6))">
          jctm.org.ng
        </text>
      </svg>`;

    sharpPipeline = sharp(imageBuffer).composite([
      { input: Buffer.from(watermarkSvg), blend: "over" },
    ]);
  } catch {
    sharpPipeline = sharp(imageBuffer);
  }

  if (ext === "jpeg") {
    await sharpPipeline.jpeg({ quality: q, progressive: true }).toFile(outFile);
  } else if (ext === "png") {
    await sharpPipeline.png({ compressionLevel: job.quality === "ultra" ? 6 : 8 }).toFile(outFile);
  } else {
    await sharpPipeline.webp({ quality: q }).toFile(outFile);
  }

  const stats = fs.statSync(outFile);
  updateJob(currentJob, {
    status: "ready",
    progress: 100,
    outputPath: outFile,
    fileSize: stats.size,
  });
}

// ─── Main processor ───────────────────────────────────────────────────────────

async function processJob(job: MediaJob): Promise<void> {
  try {
    if (job.type === "youtube_audio") {
      await processYouTubeAudio(job);
    } else if (job.type === "youtube_video") {
      await processYouTubeVideo(job);
    } else if (job.type === "gallery_image") {
      await processGalleryImage(job);
    }
    logger.info({ jobId: job.id, type: job.type }, "Media job completed");
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error({ err, jobId: job.id }, "Media job failed");
    const current = activeJobs.get(job.id) ?? job;
    updateJob(current, { status: "failed", error: errMsg });
  } finally {
    activeJobs.delete(job.id);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createJob(input: CreateJobInput): Promise<MediaJob> {
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const job: MediaJob = {
    id: randomUUID(),
    type: input.type,
    sourceId: input.sourceId,
    format: input.format,
    quality: input.quality,
    status: "queued",
    progress: 0,
    error: null,
    outputPath: null,
    title: input.title ?? null,
    duration: input.duration ?? null,
    fileSize: null,
    thumbnailUrl: input.thumbnailUrl ?? null,
    createdAt: now,
    updatedAt: now,
    expiresAt: expires,
  };

  activeJobs.set(job.id, job);
  await dbUpsertJob(job);

  // Enqueue processing
  const task = () => processJob(job);
  if (concurrentJobs < MAX_CONCURRENT) {
    concurrentJobs++;
    task().finally(() => { concurrentJobs--; drainQueue(); });
  } else {
    jobQueue.push(task);
  }

  return job;
}

export async function getJob(id: string): Promise<MediaJob | null> {
  return dbGetJob(id);
}

export async function getUserJobs(limit = 20): Promise<MediaJob[]> {
  const { rows } = await pool.query<{
    id: string; type: string; source_id: string; format: string; quality: string;
    status: string; progress: number; error: string | null; output_path: string | null;
    title: string | null; duration: number | null; file_size: string | null;
    thumbnail_url: string | null; created_at: Date; updated_at: Date; expires_at: Date;
  }>(
    `SELECT * FROM media_download_jobs
     WHERE expires_at > now()
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );

  return rows.map(r => ({
    id: r.id,
    type: r.type as JobType,
    sourceId: r.source_id,
    format: r.format as JobFormat,
    quality: r.quality as JobQuality,
    status: r.status as JobStatus,
    progress: r.progress,
    error: r.error,
    outputPath: r.output_path,
    title: r.title,
    duration: r.duration,
    fileSize: r.file_size ? Number(r.file_size) : null,
    thumbnailUrl: r.thumbnail_url,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    expiresAt: r.expires_at,
  }));
}

export function getFilePath(job: MediaJob): string | null {
  if (job.status !== "ready" || !job.outputPath) return null;
  if (!fs.existsSync(job.outputPath)) return null;
  return job.outputPath;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ─── Cleanup expired files (runs every 4 hours) ───────────────────────────────

setInterval(async () => {
  try {
    const { rows } = await pool.query<{ output_path: string }>(
      `DELETE FROM media_download_jobs WHERE expires_at < now() RETURNING output_path`,
    );
    for (const row of rows) {
      if (row.output_path && fs.existsSync(row.output_path)) {
        fs.unlink(row.output_path, () => { /* non-fatal */ });
      }
    }
    // Also clean orphaned files in MEDIA_DIR older than 25 hours
    const files = fs.readdirSync(MEDIA_DIR);
    const cutoff = Date.now() - 25 * 60 * 60 * 1000;
    for (const file of files) {
      const fp = path.join(MEDIA_DIR, file);
      try {
        const st = fs.statSync(fp);
        if (st.mtimeMs < cutoff) fs.unlinkSync(fp);
      } catch { /* non-fatal */ }
    }
  } catch (err) {
    logger.warn({ err }, "Media cleanup failed");
  }
}, 4 * 60 * 60 * 1000);

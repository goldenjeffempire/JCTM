/**
 * Media Processor — JCTM Digital Sanctuary
 *
 * Enterprise-grade media conversion and download engine.
 * Supports:
 *   • YouTube audio extraction (MP3 128/192/256/320 kbps, M4A)
 *   • YouTube video download (MP4 360p / 480p / 720p / 1080p)
 *   • Gallery image download with JCTM watermark
 *   • Background job queue with concurrency control (5 parallel)
 *   • Per-job SSE real-time progress broadcasting
 *   • Job deduplication — reuses existing ready/active jobs
 *   • Retry with exponential backoff (3 attempts)
 *   • File caching, cleanup, and orphan removal
 *   • Batch job creation
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

// yt-dlp binary: check known locations in priority order
function resolveYtDlpBin(): string {
  if (process.env.YT_DLP_PATH) return process.env.YT_DLP_PATH;
  const candidates = [
    path.join(process.cwd(), ".pythonlibs", "bin", "yt-dlp"),
    path.join(os.homedir(), ".pythonlibs", "bin", "yt-dlp"),
    "/home/runner/workspace/.pythonlibs/bin/yt-dlp",
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch { /* skip */ }
  }
  return candidates[0]!;
}

const YT_DLP_BIN = resolveYtDlpBin();

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
  retryCount: number;
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

export interface JobProgressUpdate {
  jobId: string;
  status: JobStatus;
  progress: number;
  title: string | null;
  duration: number | null;
  fileSize: number | null;
  fileSizeFormatted: string | null;
  thumbnailUrl: string | null;
  error: string | null;
  downloadUrl: string | null;
  expiresAt: string;
}

// ─── Quality mappings ─────────────────────────────────────────────────────────

const AUDIO_QUALITY_BITRATE: Record<JobQuality, string> = {
  low:    "128",
  medium: "192",
  high:   "256",
  ultra:  "320",
};

const VIDEO_HEIGHT: Record<JobQuality, number> = {
  low:    360,
  medium: 480,
  high:   720,
  ultra:  1080,
};

// ─── Concurrency control ──────────────────────────────────────────────────────

const activeJobs = new Map<string, MediaJob>();
let concurrentJobs = 0;
const MAX_CONCURRENT = 5;
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

// ─── Per-job SSE broadcaster ──────────────────────────────────────────────────

type ProgressCallback = (update: JobProgressUpdate) => void;
const jobProgressListeners = new Map<string, Set<ProgressCallback>>();

export function subscribeToJobProgress(jobId: string, cb: ProgressCallback): () => void {
  if (!jobProgressListeners.has(jobId)) {
    jobProgressListeners.set(jobId, new Set());
  }
  jobProgressListeners.get(jobId)!.add(cb);
  return () => {
    const set = jobProgressListeners.get(jobId);
    if (set) {
      set.delete(cb);
      if (set.size === 0) jobProgressListeners.delete(jobId);
    }
  };
}

function notifyJobProgress(job: MediaJob): void {
  const listeners = jobProgressListeners.get(job.id);
  if (!listeners?.size) return;
  const update: JobProgressUpdate = buildProgressUpdate(job);
  for (const cb of listeners) {
    try { cb(update); } catch { listeners.delete(cb); }
  }
}

function buildProgressUpdate(job: MediaJob): JobProgressUpdate {
  return {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    title: job.title,
    duration: job.duration,
    fileSize: job.fileSize,
    fileSizeFormatted: job.fileSize ? formatFileSize(job.fileSize) : null,
    thumbnailUrl: job.thumbnailUrl,
    error: job.error,
    downloadUrl: job.status === "ready" ? `/api/media/download/${job.id}` : null,
    expiresAt: job.expiresAt.toISOString(),
  };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

type JobRow = {
  id: string; type: string; source_id: string; format: string; quality: string;
  status: string; progress: number; error: string | null; output_path: string | null;
  title: string | null; duration: number | null; file_size: string | null;
  thumbnail_url: string | null; retry_count: number;
  created_at: Date; updated_at: Date; expires_at: Date;
};

function mapRow(r: JobRow): MediaJob {
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
    retryCount: r.retry_count ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    expiresAt: r.expires_at,
  };
}

async function dbUpsertJob(job: MediaJob): Promise<void> {
  await pool.query(
    `INSERT INTO media_download_jobs
       (id, type, source_id, format, quality, status, progress, error,
        output_path, title, duration, file_size, thumbnail_url, retry_count,
        created_at, updated_at, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (id) DO UPDATE SET
       status      = EXCLUDED.status,
       progress    = EXCLUDED.progress,
       error       = EXCLUDED.error,
       output_path = EXCLUDED.output_path,
       file_size   = EXCLUDED.file_size,
       title       = EXCLUDED.title,
       retry_count = EXCLUDED.retry_count,
       updated_at  = EXCLUDED.updated_at`,
    [
      job.id, job.type, job.sourceId, job.format, job.quality,
      job.status, job.progress, job.error, job.outputPath,
      job.title, job.duration, job.fileSize, job.thumbnailUrl,
      job.retryCount ?? 0,
      job.createdAt, job.updatedAt, job.expiresAt,
    ],
  );
}

async function dbGetJob(id: string): Promise<MediaJob | null> {
  if (activeJobs.has(id)) return activeJobs.get(id)!;
  const { rows } = await pool.query<JobRow>(
    `SELECT *, COALESCE(retry_count, 0) AS retry_count FROM media_download_jobs WHERE id = $1 AND expires_at > now()`,
    [id],
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
}

function updateJob(job: MediaJob, patch: Partial<MediaJob>): MediaJob {
  const updated: MediaJob = { ...job, ...patch, updatedAt: new Date() };
  activeJobs.set(job.id, updated);
  notifyJobProgress(updated);
  dbUpsertJob(updated).catch(err => logger.warn({ err }, "dbUpsertJob failed"));
  return updated;
}

// ─── Deduplication: find existing usable job ─────────────────────────────────

export async function findDuplicateJob(input: CreateJobInput): Promise<MediaJob | null> {
  // Check in-memory first (fastest)
  for (const job of activeJobs.values()) {
    if (
      job.sourceId === input.sourceId &&
      job.format === input.format &&
      job.quality === input.quality &&
      job.type === input.type &&
      (job.status === "ready" || job.status === "processing" || job.status === "queued")
    ) {
      // Verify file still exists if ready
      if (job.status === "ready") {
        if (job.outputPath && fs.existsSync(job.outputPath)) return job;
        continue; // file gone, skip
      }
      return job;
    }
  }

  // Check DB for recent ready job
  const { rows } = await pool.query<JobRow>(
    `SELECT *, COALESCE(retry_count, 0) AS retry_count FROM media_download_jobs
     WHERE source_id = $1 AND format = $2 AND quality = $3 AND type = $4
       AND status = 'ready' AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [input.sourceId, input.format, input.quality, input.type],
  );
  if (!rows[0]) return null;
  const job = mapRow(rows[0]);
  // Verify file still on disk
  if (job.outputPath && fs.existsSync(job.outputPath)) return job;
  return null;
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
      "--socket-timeout", "15",
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    const proc = spawn(YT_DLP_BIN, args, { timeout: 25_000 });
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

  // Step 1: fetch metadata (non-blocking fetch — use thumbnail from job if available)
  const meta = await fetchYtMetadata(job.sourceId);
  const title = meta?.title ?? job.title ?? "JCTM Sermon";
  currentJob = updateJob(currentJob, {
    title,
    duration: meta?.duration ?? job.duration ?? null,
    thumbnailUrl: meta?.thumbnail ?? job.thumbnailUrl ?? null,
    progress: 12,
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
      "--socket-timeout", "30",
      "--retries", "3",
      "--fragment-retries", "3",
      "--concurrent-fragments", "4",
      `https://www.youtube.com/watch?v=${job.sourceId}`,
    ];

    const proc = spawn(YT_DLP_BIN, ytArgs);
    let stderr = "";

    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      const match = /(\d+\.\d+)%/.exec(d.toString());
      if (match) {
        const pct = Math.min(80, 12 + Math.round(parseFloat(match[1]) * 0.68));
        updateJob(currentJob, { progress: pct });
      }
    });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(-300)}`));
    });
    proc.on("error", (e) => reject(new Error(`yt-dlp spawn error: ${e.message}. Binary: ${YT_DLP_BIN}`)));
  });

  currentJob = updateJob(currentJob, { progress: 83 });

  // Find the actual output file (yt-dlp may append extension)
  const candidates = fs.readdirSync(MEDIA_DIR).filter(f => f.startsWith(`${job.id}_raw`));
  const rawFile = candidates.length > 0 ? path.join(MEDIA_DIR, candidates[0]!) : tmpFile;

  // Step 3: re-encode to target format via ffmpeg with ID3 metadata
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
        const pct = Math.min(97, 83 + Math.round((p.percent ?? 0) * 0.14));
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

  const meta = await fetchYtMetadata(job.sourceId);
  const title = meta?.title ?? job.title ?? "JCTM Sermon";
  currentJob = updateJob(currentJob, {
    title,
    duration: meta?.duration ?? job.duration ?? null,
    thumbnailUrl: meta?.thumbnail ?? job.thumbnailUrl ?? null,
    progress: 12,
  });

  await new Promise<void>((resolve, reject) => {
    const fmtSelector = `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;

    const ytArgs = [
      "--no-playlist",
      "--no-warnings",
      "-f", fmtSelector,
      "--merge-output-format", "mp4",
      "-o", outFile,
      "--no-part",
      "--socket-timeout", "30",
      "--retries", "3",
      "--fragment-retries", "3",
      "--concurrent-fragments", "4",
      `https://www.youtube.com/watch?v=${job.sourceId}`,
    ];

    const proc = spawn(YT_DLP_BIN, ytArgs);
    let stderr = "";

    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      const match = /(\d+\.\d+)%/.exec(d.toString());
      if (match) {
        const pct = Math.min(96, 12 + Math.round(parseFloat(match[1]) * 0.84));
        updateJob(currentJob, { progress: pct });
      }
    });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp video exited ${code}: ${stderr.slice(-300)}`));
    });
    proc.on("error", (e) => reject(new Error(`yt-dlp spawn error: ${e.message}`)));
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

  const ext = job.format === "png" ? "png" : job.format === "webp" ? "webp" : "jpeg";
  const outFile = path.join(MEDIA_DIR, `${job.id}.${ext}`);

  currentJob = updateJob(currentJob, { progress: 20 });

  const { default: sharp } = await import("sharp");

  let imageBuffer: Buffer;
  if (job.sourceId.startsWith("http")) {
    const resp = await fetch(job.sourceId, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
    imageBuffer = Buffer.from(await resp.arrayBuffer());
  } else {
    const { ObjectStorageService } = await import("./objectStorage.js");
    const oss = new ObjectStorageService();
    imageBuffer = await oss.getObject(job.sourceId) as Buffer;
  }

  currentJob = updateJob(currentJob, { progress: 55 });

  const qualityMap: Record<JobQuality, number> = { low: 70, medium: 82, high: 90, ultra: 95 };
  const q = qualityMap[job.quality];

  let sharpPipeline = sharp(imageBuffer);

  // Embed JCTM branding watermark
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

  currentJob = updateJob(currentJob, { progress: 75 });

  if (ext === "jpeg") {
    await sharpPipeline
      .jpeg({ quality: q, progressive: true, mozjpeg: true })
      .toFile(outFile);
  } else if (ext === "png") {
    await sharpPipeline
      .png({ compressionLevel: job.quality === "ultra" ? 6 : 8, adaptiveFiltering: true })
      .toFile(outFile);
  } else {
    await sharpPipeline
      .webp({ quality: q, effort: 4 })
      .toFile(outFile);
  }

  const stats = fs.statSync(outFile);
  updateJob(currentJob, {
    status: "ready",
    progress: 100,
    outputPath: outFile,
    fileSize: stats.size,
  });
}

// ─── Core processor with retry ────────────────────────────────────────────────

async function processJob(job: MediaJob): Promise<void> {
  if (job.type === "youtube_audio") {
    await processYouTubeAudio(job);
  } else if (job.type === "youtube_video") {
    await processYouTubeVideo(job);
  } else if (job.type === "gallery_image") {
    await processGalleryImage(job);
  }
}

const MAX_RETRY_ATTEMPTS = 3;

async function processJobWithRetry(job: MediaJob): Promise<void> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      await processJob(job);
      logger.info({ jobId: job.id, type: job.type, attempt }, "Media job completed");
      return;
    } catch (err) {
      lastErr = err;
      const isLast = attempt === MAX_RETRY_ATTEMPTS;

      if (!isLast) {
        const delayMs = Math.pow(2, attempt - 1) * 2000; // 2s, 4s
        logger.warn({ err, jobId: job.id, attempt, delayMs }, "Media job failed — retrying");
        // Update job to queued state for retry
        const current = activeJobs.get(job.id) ?? job;
        updateJob(current, {
          status: "queued",
          progress: 0,
          error: null,
          retryCount: attempt,
        });
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }

  const errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  logger.error({ err: lastErr, jobId: job.id }, "Media job failed after all retries");
  const current = activeJobs.get(job.id) ?? job;
  updateJob(current, { status: "failed", error: errMsg, retryCount: MAX_RETRY_ATTEMPTS });
  activeJobs.delete(job.id);
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
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: expires,
  };

  activeJobs.set(job.id, job);
  await dbUpsertJob(job);

  // Enqueue with concurrency control
  const task = () => processJobWithRetry(job).finally(() => {
    activeJobs.delete(job.id);
  });

  if (concurrentJobs < MAX_CONCURRENT) {
    concurrentJobs++;
    task().finally(() => { concurrentJobs--; drainQueue(); });
  } else {
    jobQueue.push(() => {
      concurrentJobs++;
      return task().finally(() => { concurrentJobs--; drainQueue(); });
    });
  }

  return job;
}

export async function createBatchJobs(inputs: CreateJobInput[]): Promise<MediaJob[]> {
  const jobs: MediaJob[] = [];
  for (const input of inputs) {
    const job = await createJob(input);
    jobs.push(job);
  }
  return jobs;
}

export async function getJob(id: string): Promise<MediaJob | null> {
  return dbGetJob(id);
}

export async function getUserJobs(limit = 20): Promise<MediaJob[]> {
  const { rows } = await pool.query<JobRow>(
    `SELECT *, COALESCE(retry_count, 0) AS retry_count FROM media_download_jobs
     WHERE expires_at > now()
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map(mapRow);
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

export function getQueueStats(): { queued: number; processing: number; concurrent: number; max: number } {
  let queued = 0;
  let processing = 0;
  for (const job of activeJobs.values()) {
    if (job.status === "queued") queued++;
    if (job.status === "processing") processing++;
  }
  return { queued, processing, concurrent: concurrentJobs, max: MAX_CONCURRENT };
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
    try {
      const files = fs.readdirSync(MEDIA_DIR);
      const cutoff = Date.now() - 25 * 60 * 60 * 1000;
      for (const file of files) {
        const fp = path.join(MEDIA_DIR, file);
        try {
          const st = fs.statSync(fp);
          if (st.mtimeMs < cutoff) fs.unlinkSync(fp);
        } catch { /* non-fatal */ }
      }
    } catch { /* non-fatal */ }
  } catch (err) {
    logger.warn({ err }, "Media cleanup failed");
  }
}, 4 * 60 * 60 * 1000);

/**
 * Media Processor — JCTM Digital Sanctuary
 *
 * Handles:
 *   • YouTube audio extraction  (MP3 128–320 kbps, M4A)
 *   • YouTube video download    (MP4 360p – 1080p)
 *   • Gallery image download    (JPEG/PNG/WebP with watermark)
 *
 * Architecture:
 *   • In-memory job map + PostgreSQL persistence (survives restarts)
 *   • Concurrency-limited queue (5 parallel jobs max)
 *   • Per-job SSE progress broadcasting
 *   • Deduplication — reuses existing ready/active jobs
 *   • Retry with exponential back-off (3 attempts)
 *   • Process registry — cancelJob actually kills yt-dlp/ffmpeg
 *   • Automatic temp-file and expired-job cleanup
 */

import { spawn, execSync, type ChildProcess } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { pool } from "@workspace/db";
import pino from "pino";

const logger = pino({ name: "media-processor" });

// ─── Paths ────────────────────────────────────────────────────────────────────

export const MEDIA_DIR =
  process.env.MEDIA_TEMP_DIR ?? path.join(os.tmpdir(), "jctm-media");

fs.mkdirSync(MEDIA_DIR, { recursive: true });

// ── ffmpeg path resolution ────────────────────────────────────────────────────

(function initFfmpegPath() {
  try {
    const found = execSync("which ffmpeg", { encoding: "utf8", timeout: 5000 }).trim();
    if (found) { ffmpeg.setFfmpegPath(found); return; }
  } catch { /* not on PATH */ }

  for (const p of [
    process.env.FFMPEG_PATH,
    "/nix/store/x5hwjkyng8385q1pqhz8wyqkq0izmhpi-replit-runtime-path/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
  ].filter(Boolean) as string[]) {
    try { if (fs.existsSync(p)) { ffmpeg.setFfmpegPath(p); return; } } catch { /* skip */ }
  }
  logger.warn("ffmpeg not found — audio conversion may fail");
})();

// ── yt-dlp binary resolution ──────────────────────────────────────────────────

const YT_DLP_BIN: string = ((): string => {
  const fromEnv = process.env.YT_DLP_PATH;
  if (fromEnv) {
    try { if (fs.existsSync(fromEnv)) return fromEnv; } catch { /* skip */ }
  }

  try {
    const found = execSync("which yt-dlp", { encoding: "utf8", timeout: 5000 }).trim();
    if (found) return found;
  } catch { /* not on PATH */ }

  for (const p of [
    "/nix/store/am2x1y1qyja0hbyjpffj7rcvycp9d644-yt-dlp-2025.6.30/bin/yt-dlp",
    "/nix/var/nix/profiles/default/bin/yt-dlp",
    "/run/current-system/sw/bin/yt-dlp",
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
    path.join(os.homedir(), ".local", "bin", "yt-dlp"),
    path.join(os.homedir(), ".pythonlibs", "bin", "yt-dlp"),
    "/home/runner/workspace/.pythonlibs/bin/yt-dlp",
  ]) {
    try { if (fs.existsSync(p)) return p; } catch { /* skip */ }
  }

  try {
    const scan = execSync('ls /nix/store | grep "^yt-dlp-" | head -3', {
      encoding: "utf8", timeout: 5000, shell: true,
    }).trim();
    for (const entry of scan.split("\n")) {
      const candidate = `/nix/store/${entry.trim()}/bin/yt-dlp`;
      try { if (fs.existsSync(candidate)) return candidate; } catch { /* skip */ }
    }
  } catch { /* /nix/store not accessible */ }

  logger.error("yt-dlp NOT FOUND — downloads will fail. Install yt-dlp or set YT_DLP_PATH.");
  return "yt-dlp";
})();

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobType    = "youtube_audio" | "youtube_video" | "gallery_image";
export type JobFormat  = "mp3" | "m4a" | "mp4" | "jpeg" | "png" | "webp";
export type JobQuality = "low" | "medium" | "high" | "ultra";
export type JobStatus  = "queued" | "processing" | "ready" | "failed";

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
  nextRetryAt: Date | null;
  isPermanentFailure: boolean;
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
  format: JobFormat;
  type: JobType;
}

// ─── Quality maps ─────────────────────────────────────────────────────────────

const AUDIO_BITRATE: Record<JobQuality, string> = {
  low: "128", medium: "192", high: "256", ultra: "320",
};

const VIDEO_HEIGHT: Record<JobQuality, number> = {
  low: 360, medium: 480, high: 720, ultra: 1080,
};

// ─── Timeouts ─────────────────────────────────────────────────────────────────

const AUDIO_KILL_MS = 12 * 60 * 1000;
const VIDEO_KILL_MS = 25 * 60 * 1000;
const META_KILL_MS  = 30 * 1000;
const STALL_AUDIO_MS = 90_000;
const STALL_VIDEO_MS = 120_000;

// ─── Permanent error patterns (no retry) ─────────────────────────────────────

const PERMANENT_ERROR_RE = [
  /video unavailable/i,
  /this video has been removed/i,
  /this video is private/i,
  /private video/i,
  /age.?restrict/i,
  /sign in to confirm your age/i,
  /members.only/i,
  /this video is not available/i,
  /video is no longer available/i,
  /copyright/i,
  /account.*terminated/i,
  /not available in your country/i,
  /geo.?restrict/i,
];

function isPermanentError(msg: string): boolean {
  return PERMANENT_ERROR_RE.some(re => re.test(msg));
}

function isStallError(msg: string): boolean {
  return /stalled — no progress/i.test(msg) || /killed after timeout/i.test(msg);
}

function sanitizeYtDlpError(stderr: string): string {
  const lines = stderr.split("\n").map(l => l.trim()).filter(Boolean);
  const errLine = [...lines].reverse().find(l => /^ERROR:/i.test(l));
  if (errLine) return errLine.replace(/^ERROR:\s*/i, "").slice(0, 220);
  const last = [...lines].reverse().find(l => l.length > 10);
  if (last) return last.replace(/https?:\/\/\S+/g, "[url]").slice(0, 220);
  return "yt-dlp failed with no parseable output";
}

// ─── Concurrency control ──────────────────────────────────────────────────────

const activeJobs = new Map<string, MediaJob>();
let concurrentJobs = 0;
const MAX_CONCURRENT = 5;
const jobQueue: Array<() => Promise<void>> = [];

/** Registry of live child processes keyed by job ID — enables true cancellation. */
const activeProcesses = new Map<string, ChildProcess>();

function drainQueue() {
  while (jobQueue.length > 0 && concurrentJobs < MAX_CONCURRENT) {
    const task = jobQueue.shift()!;
    concurrentJobs++;
    task().finally(() => { concurrentJobs--; drainQueue(); });
  }
}

// ─── SSE broadcaster ──────────────────────────────────────────────────────────

type ProgressCallback = (update: JobProgressUpdate) => void;
const jobProgressListeners = new Map<string, Set<ProgressCallback>>();

export function subscribeToJobProgress(jobId: string, cb: ProgressCallback): () => void {
  if (!jobProgressListeners.has(jobId)) jobProgressListeners.set(jobId, new Set());
  jobProgressListeners.get(jobId)!.add(cb);
  return () => {
    const set = jobProgressListeners.get(jobId);
    if (set) { set.delete(cb); if (set.size === 0) jobProgressListeners.delete(jobId); }
  };
}

function notifyProgress(job: MediaJob): void {
  const listeners = jobProgressListeners.get(job.id);
  if (!listeners?.size) return;
  const update = buildUpdate(job);
  for (const cb of listeners) {
    try { cb(update); } catch { listeners.delete(cb); }
  }
}

function buildUpdate(job: MediaJob): JobProgressUpdate {
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
    format: job.format,
    type: job.type,
  };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

type JobRow = {
  id: string; type: string; source_id: string; format: string; quality: string;
  status: string; progress: number; error: string | null; output_path: string | null;
  title: string | null; duration: number | null; file_size: string | null;
  thumbnail_url: string | null; retry_count: number;
  next_retry_at: Date | null; is_permanent_failure: boolean;
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
    nextRetryAt: r.next_retry_at ?? null,
    isPermanentFailure: r.is_permanent_failure ?? false,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    expiresAt: r.expires_at,
  };
}

async function dbUpsert(job: MediaJob): Promise<void> {
  await pool.query(
    `INSERT INTO media_download_jobs
       (id, type, source_id, format, quality, status, progress, error,
        output_path, title, duration, file_size, thumbnail_url, retry_count,
        next_retry_at, is_permanent_failure,
        created_at, updated_at, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     ON CONFLICT (id) DO UPDATE SET
       status               = EXCLUDED.status,
       progress             = EXCLUDED.progress,
       error                = EXCLUDED.error,
       output_path          = EXCLUDED.output_path,
       file_size            = EXCLUDED.file_size,
       title                = EXCLUDED.title,
       retry_count          = EXCLUDED.retry_count,
       next_retry_at        = EXCLUDED.next_retry_at,
       is_permanent_failure = EXCLUDED.is_permanent_failure,
       updated_at           = EXCLUDED.updated_at`,
    [
      job.id, job.type, job.sourceId, job.format, job.quality,
      job.status, job.progress, job.error, job.outputPath,
      job.title, job.duration, job.fileSize, job.thumbnailUrl,
      job.retryCount ?? 0,
      job.nextRetryAt ?? null, job.isPermanentFailure ?? false,
      job.createdAt, job.updatedAt, job.expiresAt,
    ],
  );
}

async function dbGet(id: string): Promise<MediaJob | null> {
  if (activeJobs.has(id)) return activeJobs.get(id)!;
  const { rows } = await pool.query<JobRow>(
    `SELECT *, COALESCE(retry_count, 0) AS retry_count
       FROM media_download_jobs WHERE id = $1 AND expires_at > now()`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

function patch(job: MediaJob, changes: Partial<MediaJob>): MediaJob {
  const updated: MediaJob = { ...job, ...changes, updatedAt: new Date() };
  activeJobs.set(job.id, updated);
  notifyProgress(updated);
  dbUpsert(updated).catch(err => logger.warn({ err }, "dbUpsert failed (non-fatal)"));
  return updated;
}

// ─── Deduplication ────────────────────────────────────────────────────────────

export async function findDuplicateJob(input: CreateJobInput): Promise<MediaJob | null> {
  for (const job of activeJobs.values()) {
    if (
      job.sourceId === input.sourceId &&
      job.format   === input.format &&
      job.quality  === input.quality &&
      job.type     === input.type &&
      (job.status === "ready" || job.status === "processing" || job.status === "queued")
    ) {
      if (job.status === "ready") {
        if (job.outputPath && fs.existsSync(job.outputPath)) return job;
        continue;
      }
      return job;
    }
  }

  const { rows } = await pool.query<JobRow>(
    `SELECT *, COALESCE(retry_count, 0) AS retry_count
       FROM media_download_jobs
      WHERE source_id = $1 AND format = $2 AND quality = $3 AND type = $4
        AND status = 'ready' AND expires_at > now()
      ORDER BY created_at DESC LIMIT 1`,
    [input.sourceId, input.format, input.quality, input.type],
  );
  if (!rows[0]) return null;
  const job = mapRow(rows[0]);
  if (job.outputPath && fs.existsSync(job.outputPath)) return job;
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s\-_()[\]]/g, "").replace(/\s+/g, "_").slice(0, 100);
}

function cleanupTempFiles(jobId: string): void {
  try {
    const files = fs.readdirSync(MEDIA_DIR);
    for (const f of files) {
      if (f.startsWith(`${jobId}_raw`) || f === `${jobId}.mp4.part`) {
        try { fs.unlinkSync(path.join(MEDIA_DIR, f)); } catch { /* non-fatal */ }
      }
    }
  } catch { /* non-fatal */ }
}

// ─── yt-dlp metadata fetch ────────────────────────────────────────────────────

interface YtMeta { title: string; duration: number; thumbnail: string }

async function fetchYtMeta(videoId: string): Promise<YtMeta | null> {
  return new Promise((resolve) => {
    const proc = spawn(YT_DLP_BIN, [
      "--no-playlist", "--skip-download", "--print-json",
      "--no-warnings", "--socket-timeout", "15",
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);
    let stdout = "";
    const kill = setTimeout(() => { try { proc.kill("SIGKILL"); } catch {} }, META_KILL_MS);
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.on("close", (code) => {
      clearTimeout(kill);
      if (code !== 0) { resolve(null); return; }
      try {
        const m = JSON.parse(stdout.split("\n")[0]!);
        resolve({
          title: m.title ?? "JCTM Sermon",
          duration: m.duration ?? 0,
          thumbnail: m.thumbnail ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        });
      } catch { resolve(null); }
    });
    proc.on("error", () => { clearTimeout(kill); resolve(null); });
  });
}

// ─── Audio processor ──────────────────────────────────────────────────────────

async function processYouTubeAudio(job: MediaJob): Promise<void> {
  const ext      = job.format === "m4a" ? "m4a" : "mp3";
  const outFile  = path.join(MEDIA_DIR, `${job.id}.${ext}`);
  const tmpFile  = path.join(MEDIA_DIR, `${job.id}_raw`);
  const bitrate  = AUDIO_BITRATE[job.quality];

  let cur = patch(job, { status: "processing", progress: 5 });

  const meta = await fetchYtMeta(job.sourceId);
  cur = patch(cur, {
    title:        meta?.title        ?? job.title        ?? "JCTM Sermon",
    duration:     meta?.duration     ?? job.duration     ?? null,
    thumbnailUrl: meta?.thumbnail    ?? job.thumbnailUrl ?? null,
    progress:     12,
  });

  // ── Step 1: yt-dlp download ───────────────────────────────────────────────
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(YT_DLP_BIN, [
      "--no-playlist", "--no-warnings", "--progress", "--newline",
      "-f", "bestaudio/best", "-x",
      "-o", tmpFile,
      "--no-part", "--socket-timeout", "30",
      "--retries", "3", "--fragment-retries", "3",
      "--concurrent-fragments", "1",
      "--throttled-rate", "100K",
      `https://www.youtube.com/watch?v=${job.sourceId}`,
    ]);

    activeProcesses.set(job.id, proc);

    let stderr = "";
    let stderrBuf = "";

    const hardKill = setTimeout(() => {
      clearTimeout(stallKill);
      try { proc.kill("SIGKILL"); } catch {}
      reject(new Error("yt-dlp killed after timeout — audio download took too long"));
    }, AUDIO_KILL_MS);

    let stallKill = setTimeout(() => {
      clearTimeout(hardKill);
      try { proc.kill("SIGKILL"); } catch {}
      reject(new Error("yt-dlp stalled — no progress for 90 s. YouTube may be throttling. Please retry."));
    }, STALL_AUDIO_MS);

    proc.stderr.on("data", (d: Buffer) => {
      clearTimeout(stallKill);
      stallKill = setTimeout(() => {
        clearTimeout(hardKill);
        try { proc.kill("SIGKILL"); } catch {}
        reject(new Error("yt-dlp stalled — no progress for 90 s. YouTube may be throttling. Please retry."));
      }, STALL_AUDIO_MS);

      stderrBuf += d.toString();
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() ?? "";
      for (const line of lines) {
        stderr += line + "\n";
        const m = /(\d+(?:\.\d+)?)%/.exec(line);
        if (m) patch(cur, { progress: Math.min(80, 12 + Math.round(parseFloat(m[1]!) * 0.68)) });
      }
    });

    proc.on("close", (code) => {
      clearTimeout(hardKill);
      clearTimeout(stallKill);
      activeProcesses.delete(job.id);
      if (code === 0) resolve();
      else reject(new Error(sanitizeYtDlpError(stderr) || `yt-dlp exited ${code}`));
    });
    proc.on("error", (e) => {
      clearTimeout(hardKill);
      clearTimeout(stallKill);
      activeProcesses.delete(job.id);
      reject(new Error(`yt-dlp spawn error: ${e.message}`));
    });
  });

  cur = patch(cur, { progress: 83 });

  // Find the actual output file (yt-dlp may append extension)
  const candidates = fs.readdirSync(MEDIA_DIR)
    .filter(f => f.startsWith(`${job.id}_raw`) && !f.endsWith(".ytdl") && !/-Frag\d+$/.test(f));
  const rawFile = candidates.length > 0 ? path.join(MEDIA_DIR, candidates[0]!) : tmpFile;

  // ── Step 2: ffmpeg re-encode ──────────────────────────────────────────────
  await new Promise<void>((resolve, reject) => {
    const safeName = sanitizeFilename(cur.title ?? "JCTM_Sermon");
    let ffmpegDone = false;

    const ffmpegKill = setTimeout(() => {
      if (!ffmpegDone) {
        try { cmd.kill("SIGKILL"); } catch {}
        reject(new Error("ffmpeg timed out during audio encoding — please retry"));
      }
    }, 8 * 60 * 1000);

    const cmd = ffmpeg(rawFile)
      .audioCodec(ext === "m4a" ? "aac" : "libmp3lame")
      .audioBitrate(`${bitrate}k`)
      .audioChannels(2)
      .audioFrequency(44100)
      .outputOptions([
        `-metadata title=${safeName}`,
        `-metadata artist=Jesus_Christ_Temple_Ministry`,
        `-metadata album=JCTM_Sermons`,
        `-metadata genre=Gospel`,
        `-metadata comment=jctm.org.ng`,
        ext === "m4a" ? "-movflags +faststart" : "-id3v2_version 3",
      ])
      .on("progress", (p) => {
        patch(cur, { progress: Math.min(97, 83 + Math.round((p.percent ?? 0) * 0.14)) });
      })
      .on("end", () => { ffmpegDone = true; clearTimeout(ffmpegKill); resolve(); })
      .on("error", (e) => { ffmpegDone = true; clearTimeout(ffmpegKill); reject(e); });

    cmd.save(outFile);
  });

  cleanupTempFiles(job.id);

  const stats = fs.statSync(outFile);
  patch(cur, { status: "ready", progress: 100, outputPath: outFile, fileSize: stats.size });
}

// ─── Video processor ──────────────────────────────────────────────────────────

async function processYouTubeVideo(job: MediaJob): Promise<void> {
  const height  = VIDEO_HEIGHT[job.quality];
  const outFile = path.join(MEDIA_DIR, `${job.id}.mp4`);

  let cur = patch(job, { status: "processing", progress: 5 });

  const meta = await fetchYtMeta(job.sourceId);
  cur = patch(cur, {
    title:        meta?.title        ?? job.title        ?? "JCTM Sermon",
    duration:     meta?.duration     ?? job.duration     ?? null,
    thumbnailUrl: meta?.thumbnail    ?? job.thumbnailUrl ?? null,
    progress:     12,
  });

  await new Promise<void>((resolve, reject) => {
    const fmtSel = `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;

    const proc = spawn(YT_DLP_BIN, [
      "--no-playlist", "--no-warnings", "--progress", "--newline",
      "-f", fmtSel,
      "--merge-output-format", "mp4",
      "-o", outFile,
      "--no-part", "--socket-timeout", "30",
      "--retries", "3", "--fragment-retries", "3",
      "--concurrent-fragments", "1",
      "--throttled-rate", "100K",
      `https://www.youtube.com/watch?v=${job.sourceId}`,
    ]);

    activeProcesses.set(job.id, proc);

    let stderr = "";
    let stderrBuf = "";

    const hardKill = setTimeout(() => {
      clearTimeout(stallKill);
      try { proc.kill("SIGKILL"); } catch {}
      reject(new Error("yt-dlp killed after timeout — video download took too long"));
    }, VIDEO_KILL_MS);

    let stallKill = setTimeout(() => {
      clearTimeout(hardKill);
      try { proc.kill("SIGKILL"); } catch {}
      reject(new Error("yt-dlp stalled — no progress for 2 minutes. Please retry."));
    }, STALL_VIDEO_MS);

    proc.stderr.on("data", (d: Buffer) => {
      clearTimeout(stallKill);
      stallKill = setTimeout(() => {
        clearTimeout(hardKill);
        try { proc.kill("SIGKILL"); } catch {}
        reject(new Error("yt-dlp stalled — no progress for 2 minutes. Please retry."));
      }, STALL_VIDEO_MS);

      stderrBuf += d.toString();
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() ?? "";
      for (const line of lines) {
        stderr += line + "\n";
        const m = /(\d+(?:\.\d+)?)%/.exec(line);
        if (m) patch(cur, { progress: Math.min(96, 12 + Math.round(parseFloat(m[1]!) * 0.84)) });
      }
    });

    proc.on("close", (code) => {
      clearTimeout(hardKill);
      clearTimeout(stallKill);
      activeProcesses.delete(job.id);
      if (code === 0) resolve();
      else reject(new Error(sanitizeYtDlpError(stderr) || `yt-dlp video exited ${code}`));
    });
    proc.on("error", (e) => {
      clearTimeout(hardKill);
      clearTimeout(stallKill);
      activeProcesses.delete(job.id);
      reject(new Error(`yt-dlp spawn error: ${e.message}`));
    });
  });

  if (!fs.existsSync(outFile)) {
    throw new Error("yt-dlp completed but output file is missing — possible mux failure");
  }

  const stats = fs.statSync(outFile);
  patch(cur, { status: "ready", progress: 100, outputPath: outFile, fileSize: stats.size });
}

// ─── Gallery image processor ──────────────────────────────────────────────────

async function processGalleryImage(job: MediaJob): Promise<void> {
  let cur = patch(job, { status: "processing", progress: 5 });

  const ext     = job.format === "png" ? "png" : job.format === "webp" ? "webp" : "jpeg";
  const outFile = path.join(MEDIA_DIR, `${job.id}.${ext}`);

  cur = patch(cur, { progress: 20 });

  const { default: sharp } = await import("sharp");

  // ── Fetch source image ────────────────────────────────────────────────────
  let imageBuffer: Buffer;

  const src = job.sourceId;

  if (/^https?:\/\//i.test(src)) {
    // Absolute HTTP URL — fetch directly
    const resp = await fetch(src, { signal: AbortSignal.timeout(20_000) });
    if (!resp.ok) throw new Error(`Failed to fetch gallery image (HTTP ${resp.status})`);
    imageBuffer = Buffer.from(await resp.arrayBuffer());

  } else if (/^\/api\/storage/.test(src)) {
    // Relative internal storage URL — fetch from localhost
    const port = process.env.PORT ?? "5000";
    const resp = await fetch(`http://localhost:${port}${src}`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) throw new Error(`Failed to fetch gallery image via internal API (HTTP ${resp.status})`);
    imageBuffer = Buffer.from(await resp.arrayBuffer());

  } else {
    // Raw object path like /objects/uploads/uuid.webp — use object storage directly
    const { ObjectStorageService } = await import("./objectStorage.js");
    const oss = new ObjectStorageService();
    imageBuffer = await oss.downloadObjectAsBuffer(src);
  }

  cur = patch(cur, { progress: 55 });

  // ── Watermark ─────────────────────────────────────────────────────────────
  const qualityMap: Record<JobQuality, number> = { low: 70, medium: 82, high: 90, ultra: 95 };
  const q = qualityMap[job.quality];

  let pipeline = sharp(imageBuffer);

  try {
    const meta = await pipeline.metadata();
    const w = meta.width ?? 1200;
    const h = meta.height ?? 800;
    const fontSize = Math.max(14, Math.round(w * 0.022));

    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <style>.wm{font-family:Arial,sans-serif;font-size:${fontSize}px;fill:rgba(255,255,255,0.55);font-weight:600;}</style>
      <text x="${w - 14}" y="${h - 14}" text-anchor="end" class="wm"
            filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.6))">jctm.org.ng</text>
    </svg>`;

    pipeline = sharp(imageBuffer).composite([{ input: Buffer.from(svg), blend: "over" }]);
  } catch {
    pipeline = sharp(imageBuffer);
  }

  cur = patch(cur, { progress: 75 });

  if (ext === "jpeg") {
    await pipeline.jpeg({ quality: q, progressive: true, mozjpeg: true }).toFile(outFile);
  } else if (ext === "png") {
    await pipeline.png({ compressionLevel: job.quality === "ultra" ? 6 : 8, adaptiveFiltering: true }).toFile(outFile);
  } else {
    await pipeline.webp({ quality: q, effort: 4 }).toFile(outFile);
  }

  const stats = fs.statSync(outFile);
  patch(cur, { status: "ready", progress: 100, outputPath: outFile, fileSize: stats.size });
}

// ─── Retry wrapper ────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;

// Total attempt budget across all server runs (3 in-process × 3 restart cycles).
// When a job exhausts its in-process retries, the persistent scheduler re-queues
// it up to (TOTAL_MAX_RETRIES / MAX_RETRIES - 1) additional times.
const TOTAL_MAX_RETRIES = 9;

// Backoff between scheduler-driven restart cycles (grows with total attempt count).
// cycle 1 (retries 0-3) → 15 min · cycle 2 (retries 3-6) → 45 min · cycle 3+ → no more
function schedulerBackoffMs(baseRetryCount: number): number | null {
  const cycle = Math.floor(baseRetryCount / MAX_RETRIES); // 1, 2
  if (cycle >= Math.floor(TOTAL_MAX_RETRIES / MAX_RETRIES)) return null; // exhausted
  return Math.pow(3, cycle) * 5 * 60_000; // 15 min, 45 min
}

async function processWithRetry(job: MediaJob): Promise<void> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (job.type === "youtube_audio") await processYouTubeAudio(job);
      else if (job.type === "youtube_video") await processYouTubeVideo(job);
      else if (job.type === "gallery_image") await processGalleryImage(job);
      logger.info({ jobId: job.id, type: job.type, attempt }, "Media job completed");
      return;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isLast = attempt === MAX_RETRIES;
      const totalCount = (job.retryCount ?? 0) + attempt;

      if (isPermanentError(msg)) {
        logger.warn({ err, jobId: job.id, attempt }, "Permanent error — not retrying");
        cleanupTempFiles(job.id);
        const cur = activeJobs.get(job.id) ?? job;
        patch(cur, { status: "failed", error: msg, retryCount: totalCount, isPermanentFailure: true, nextRetryAt: null });
        activeJobs.delete(job.id);
        return;
      }

      if (!isLast) {
        const stall = isStallError(msg);
        const delayMs = stall
          ? Math.pow(2, attempt - 1) * 60_000
          : Math.pow(2, attempt - 1) * 3_000;

        logger.warn({ err, jobId: job.id, attempt, delayMs, stall }, "Job failed — retrying");
        cleanupTempFiles(job.id);

        const cur = activeJobs.get(job.id) ?? job;

        if (stall) {
          const retryAt = Date.now() + delayMs;
          const secsLeft = () => Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));

          patch(cur, {
            status: "queued", progress: 0, retryCount: totalCount,
            error: `Throttled by YouTube — retrying in ${secsLeft()}s…`,
          });

          const ticker = setInterval(() => {
            const live = activeJobs.get(job.id) ?? cur;
            const s = secsLeft();
            if (s <= 0) { clearInterval(ticker); return; }
            patch(live, { error: `Throttled by YouTube — retrying in ${s}s…` });
          }, 10_000);

          await new Promise(r => setTimeout(r, delayMs));
          clearInterval(ticker);

          const live = activeJobs.get(job.id) ?? cur;
          patch(live, { error: null });
        } else {
          patch(cur, { status: "queued", progress: 0, error: null, retryCount: totalCount });
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  const totalCount = (job.retryCount ?? 0) + MAX_RETRIES;
  const backoffMs = schedulerBackoffMs(totalCount);
  const nextRetryAt = backoffMs !== null ? new Date(Date.now() + backoffMs) : null;

  if (nextRetryAt) {
    logger.warn({ jobId: job.id, totalCount, nextRetryAt }, "Job exhausted in-process retries — scheduled for auto-retry");
  } else {
    logger.error({ jobId: job.id, totalCount }, "Job permanently failed after all retry cycles");
  }

  cleanupTempFiles(job.id);
  const cur = activeJobs.get(job.id) ?? job;
  patch(cur, { status: "failed", error: msg, retryCount: totalCount, nextRetryAt, isPermanentFailure: false });
  activeJobs.delete(job.id);
}

// ─── Startup recovery ─────────────────────────────────────────────────────────

export async function recoverOrphanedJobs(): Promise<void> {
  try {
    // Jobs interrupted by a restart get a 30-second next_retry_at so the
    // scheduler picks them up on its first tick after startup warmup.
    // Jobs that have already hit TOTAL_MAX_RETRIES get no next_retry_at
    // (they are permanently exhausted).
    const { rowCount } = await pool.query(
      `UPDATE media_download_jobs
          SET status        = 'failed',
              error         = 'Server restarted while this job was running — retrying automatically…',
              next_retry_at = CASE WHEN retry_count < $1
                                   THEN now() + INTERVAL '30 seconds'
                                   ELSE NULL END,
              updated_at    = now()
        WHERE status IN ('processing', 'queued')
          AND expires_at > now()`,
      [TOTAL_MAX_RETRIES],
    );
    if (rowCount && rowCount > 0) {
      logger.info({ recovered: rowCount }, "Recovered orphaned media jobs — scheduled for automatic retry");
    }
  } catch (err) {
    logger.warn({ err }, "recoverOrphanedJobs non-fatal error");
  }
}

// ─── Persistent retry scheduler ───────────────────────────────────────────────
// Jobs that exhaust their 3 in-process retries are marked failed with a
// next_retry_at timestamp. This scheduler picks those rows back up and re-queues
// them so they get another full 3-attempt window after a backoff period.
// Backoff schedule: 15 min → 45 min → permanently failed (TOTAL_MAX_RETRIES = 9).

const RETRY_SCHEDULER_INTERVAL_MS = 5 * 60_000; // poll every 5 minutes
let retrySchedulerHandle: ReturnType<typeof setInterval> | null = null;

async function requeueEligibleFailedJobs(): Promise<number> {
  const { rows } = await pool.query<JobRow>(
    `UPDATE media_download_jobs
        SET status        = 'queued',
            progress      = 0,
            error         = 'Scheduled for automatic retry…',
            next_retry_at = NULL,
            updated_at    = now()
      WHERE status                = 'failed'
        AND is_permanent_failure  = false
        AND retry_count           < $1
        AND next_retry_at IS NOT NULL
        AND next_retry_at         <= now()
        AND expires_at            > now()
        AND NOT EXISTS (
          SELECT 1 FROM media_download_jobs dup
           WHERE dup.source_id = media_download_jobs.source_id
             AND dup.format    = media_download_jobs.format
             AND dup.quality   = media_download_jobs.quality
             AND dup.status    IN ('queued', 'processing', 'ready')
             AND dup.id        != media_download_jobs.id
        )
      RETURNING *,
        COALESCE(retry_count, 0)    AS retry_count,
        COALESCE(is_permanent_failure, false) AS is_permanent_failure`,
    [TOTAL_MAX_RETRIES],
  );

  for (const row of rows) {
    const job = mapRow(row);
    activeJobs.set(job.id, job);
    const task = () => processWithRetry(job).finally(() => { activeJobs.delete(job.id); });
    if (concurrentJobs < MAX_CONCURRENT) {
      concurrentJobs++;
      task().finally(() => { concurrentJobs--; drainQueue(); });
    } else {
      jobQueue.push(() => {
        concurrentJobs++;
        return task().finally(() => { concurrentJobs--; drainQueue(); });
      });
    }
  }

  return rows.length;
}

export function startMediaRetryScheduler(): void {
  if (retrySchedulerHandle) return;

  // Run once shortly after startup so jobs from a previous crash are picked up.
  const startupTimer = setTimeout(async () => {
    try {
      const n = await requeueEligibleFailedJobs();
      if (n > 0) logger.info({ requeued: n }, "Media retry scheduler: re-queued failed jobs on startup");
    } catch (err) {
      logger.warn({ err }, "Media retry scheduler startup tick failed (non-fatal)");
    }
  }, 20_000);
  startupTimer.unref();

  retrySchedulerHandle = setInterval(async () => {
    try {
      const n = await requeueEligibleFailedJobs();
      if (n > 0) logger.info({ requeued: n }, "Media retry scheduler: re-queued failed jobs");
    } catch (err) {
      logger.warn({ err }, "Media retry scheduler tick failed (non-fatal)");
    }
  }, RETRY_SCHEDULER_INTERVAL_MS);
  retrySchedulerHandle.unref();

  logger.info({ intervalMs: RETRY_SCHEDULER_INTERVAL_MS, totalMax: TOTAL_MAX_RETRIES }, "Media retry scheduler started (5-min interval, 9-attempt budget)");
}

export function stopMediaRetryScheduler(): void {
  if (retrySchedulerHandle) {
    clearInterval(retrySchedulerHandle);
    retrySchedulerHandle = null;
  }
}

export function cleanupOrphanedTempFiles(): void {
  try {
    const files = fs.readdirSync(MEDIA_DIR);
    const activeIds = new Set<string>(activeJobs.keys());
    let removed = 0;
    for (const f of files) {
      if (!/_raw/.test(f) && !f.endsWith(".part") && !f.endsWith(".ytdl")) continue;
      const jobId = f.split("_raw")[0] ?? "";
      if (!activeIds.has(jobId)) {
        try { fs.unlinkSync(path.join(MEDIA_DIR, f)); removed++; } catch { /* non-fatal */ }
      }
    }
    if (removed > 0) logger.info({ removed }, "Cleaned up orphaned temp files");
  } catch { /* non-fatal */ }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createJob(input: CreateJobInput): Promise<MediaJob> {
  const now     = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const job: MediaJob = {
    id:                 randomUUID(),
    type:               input.type,
    sourceId:           input.sourceId,
    format:             input.format,
    quality:            input.quality,
    status:             "queued",
    progress:           0,
    error:              null,
    outputPath:         null,
    title:              input.title        ?? null,
    duration:           input.duration     ?? null,
    fileSize:           null,
    thumbnailUrl:       input.thumbnailUrl ?? null,
    retryCount:         0,
    nextRetryAt:        null,
    isPermanentFailure: false,
    createdAt:          now,
    updatedAt:          now,
    expiresAt:          expires,
  };

  activeJobs.set(job.id, job);
  await dbUpsert(job);

  const task = () => processWithRetry(job).finally(() => { activeJobs.delete(job.id); });

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

export async function getJob(id: string): Promise<MediaJob | null> {
  return dbGet(id);
}

export async function getUserJobs(limit = 20): Promise<MediaJob[]> {
  const { rows } = await pool.query<JobRow>(
    `SELECT *, COALESCE(retry_count, 0) AS retry_count
       FROM media_download_jobs
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
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * Cancel a job and kill any running child process.
 * The DB row is NOT deleted here — the caller deletes it after cancellation.
 */
export function cancelJob(id: string): void {
  // Kill the running process if any
  const proc = activeProcesses.get(id);
  if (proc) {
    try { proc.kill("SIGKILL"); } catch { /* non-fatal */ }
    activeProcesses.delete(id);
  }

  const job = activeJobs.get(id);
  if (job) {
    patch(job, { status: "failed", error: "Cancelled" });
    activeJobs.delete(id);
  }

  cleanupTempFiles(id);
}

export function getQueueStats(): { queued: number; processing: number; concurrent: number; max: number } {
  let queued = 0;
  let processing = 0;
  for (const job of activeJobs.values()) {
    if (job.status === "queued")     queued++;
    if (job.status === "processing") processing++;
  }
  return { queued, processing, concurrent: concurrentJobs, max: MAX_CONCURRENT };
}

// ─── Periodic cleanup (every 4 hours) ────────────────────────────────────────

setInterval(async () => {
  try {
    const { rows } = await pool.query<{ output_path: string }>(
      `DELETE FROM media_download_jobs WHERE expires_at < now() RETURNING output_path`,
    );
    for (const row of rows) {
      if (row.output_path && fs.existsSync(row.output_path)) {
        fs.unlink(row.output_path, () => {});
      }
    }
    // Also remove orphaned files older than 25 hours
    try {
      const cutoff = Date.now() - 25 * 60 * 60 * 1000;
      for (const file of fs.readdirSync(MEDIA_DIR)) {
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

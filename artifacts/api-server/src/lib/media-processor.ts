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

import { spawn, execSync } from "child_process";
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

// ── ffmpeg path: resolved eagerly at module load ──────────────────────────────
(function initFfmpegPath() {
  // 1. which ffmpeg — most reliable in Nix/Replit
  try {
    const found = execSync("which ffmpeg", { encoding: "utf8", timeout: 5000 }).trim();
    if (found) { ffmpeg.setFfmpegPath(found); logger.info({ ffmpegPath: found }, "ffmpeg path configured"); return; }
  } catch { /* not on PATH */ }
  // 2. Known paths
  for (const c of [
    process.env.FFMPEG_PATH,
    "/nix/store/x5hwjkyng8385q1pqhz8wyqkq0izmhpi-replit-runtime-path/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
  ].filter(Boolean) as string[]) {
    try { if (fs.existsSync(c)) { ffmpeg.setFfmpegPath(c); logger.info({ ffmpegPath: c }, "ffmpeg path configured"); return; } } catch { /* skip */ }
  }
  logger.warn("ffmpeg not found — audio conversion may fail");
})();

// ── yt-dlp binary: resolved EAGERLY at module load time ───────────────────────
//
// We resolve once at import time and store in a const. This sidesteps the
// esbuild-bundle lazy-evaluation problem: inside the bundled ESM the execSync
// calls inside a lazy getter closure can fail silently, but running the same
// code synchronously at top level always works (confirmed via node -e tests).
//
// Resolution order:
//   1. YT_DLP_PATH env var (set in Replit userenv)
//   2. `which yt-dlp`     — proven reliable in Replit/Nix Node.js processes
//   3. Known Nix store paths (version-pinned + stable profile paths)
//   4. Standard binary locations
//   5. Nix store scan     — catches future version hash changes automatically
//   6. Bare "yt-dlp"      — final fallback (logs a clear error)
const YT_DLP_BIN: string = ((): string => {
  // 1. Env var override
  const fromEnv = process.env.YT_DLP_PATH;
  if (fromEnv) {
    try { if (fs.existsSync(fromEnv)) { logger.info({ path: fromEnv }, "yt-dlp: resolved via YT_DLP_PATH"); return fromEnv; } } catch { /* skip */ }
  }

  // 2. `which yt-dlp` — the most reliable method; works in Replit/Nix with correct inherited PATH
  try {
    const found = execSync("which yt-dlp", { encoding: "utf8", timeout: 5000 }).trim();
    if (found) { logger.info({ path: found }, "yt-dlp: resolved via which"); return found; }
  } catch { /* not on PATH */ }

  // 3. Known Nix store version-pinned path + stable profile paths
  for (const c of [
    "/nix/store/am2x1y1qyja0hbyjpffj7rcvycp9d644-yt-dlp-2025.6.30/bin/yt-dlp",
    "/nix/var/nix/profiles/default/bin/yt-dlp",
    "/run/current-system/sw/bin/yt-dlp",
  ]) {
    try { if (fs.existsSync(c)) { logger.info({ path: c }, "yt-dlp: resolved via known Nix path"); return c; } } catch { /* skip */ }
  }

  // 4. Standard install locations
  for (const c of [
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
    path.join(os.homedir(), ".local", "bin", "yt-dlp"),
    path.join(os.homedir(), ".pythonlibs", "bin", "yt-dlp"),
    "/home/runner/workspace/.pythonlibs/bin/yt-dlp",
    "/opt/homebrew/bin/yt-dlp",
  ]) {
    try { if (fs.existsSync(c)) { logger.info({ path: c }, "yt-dlp: resolved via standard path"); return c; } } catch { /* skip */ }
  }

  // 5. Nix store scan — auto-discover version hash changes
  try {
    const scanResult = execSync('ls /nix/store | grep "^yt-dlp-" | head -3', {
      encoding: "utf8", timeout: 5000, shell: true,
    }).trim();
    if (scanResult) {
      for (const entry of scanResult.split("\n")) {
        const c = `/nix/store/${entry.trim()}/bin/yt-dlp`;
        try { if (fs.existsSync(c)) { logger.info({ path: c }, "yt-dlp: resolved via Nix store scan"); return c; } } catch { /* skip */ }
      }
    }
  } catch { /* /nix/store not accessible */ }

  logger.error("yt-dlp NOT FOUND — downloads will fail. Install yt-dlp or set YT_DLP_PATH env var.");
  return "yt-dlp"; // bare fallback — spawn will throw ENOENT if truly missing
})();

/** Spawn yt-dlp using the eagerly resolved binary path. */
function spawnYtDlp(args: string[], _opts?: unknown) {
  void _opts; // timeout is managed by the calling code via process kill
  return spawn(YT_DLP_BIN, args);
}

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

// ─── Process kill timeouts ────────────────────────────────────────────────────
// yt-dlp can hang indefinitely on throttled connections or bad YouTube HLS
// segments. Kill the process after these limits so the job fails cleanly and
// the user can retry rather than waiting forever.
const AUDIO_KILL_TIMEOUT_MS = 12 * 60 * 1000;  // 12 minutes (audio + ffmpeg)
const VIDEO_KILL_TIMEOUT_MS = 25 * 60 * 1000;  // 25 minutes (video mux can be slow)
const META_KILL_TIMEOUT_MS  = 30 * 1000;        // 30 seconds for metadata fetch

// ─── Permanent error patterns — skip retries for these ───────────────────────
const PERMANENT_ERROR_PATTERNS: RegExp[] = [
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

function isPermanentError(message: string): boolean {
  return PERMANENT_ERROR_PATTERNS.some(p => p.test(message));
}

// ─── Error message sanitizer ──────────────────────────────────────────────────
// Extract the most useful part from yt-dlp's verbose stderr output.
function sanitizeYtDlpError(stderr: string): string {
  const lines = stderr.split("\n").map(l => l.trim()).filter(Boolean);
  // Find the last ERROR: line — most specific failure reason
  const errorLine = [...lines].reverse().find(l => /^ERROR:/i.test(l));
  if (errorLine) return errorLine.replace(/^ERROR:\s*/i, "").slice(0, 220);
  // Fallback: last non-blank line, strip URLs
  const last = [...lines].reverse().find(l => l.length > 10);
  if (last) return last.replace(/https?:\/\/\S+/g, "[url]").slice(0, 220);
  return "yt-dlp failed with no parseable output";
}

// ─── Temp file cleanup ────────────────────────────────────────────────────────
// Removes all `<jobId>_raw*` partial download files left by a failed yt-dlp
// run. Called in the failure path of each processor and at startup.
function cleanupJobTempFiles(jobId: string): void {
  try {
    const files = fs.readdirSync(MEDIA_DIR);
    for (const f of files) {
      if (f.startsWith(`${jobId}_raw`) || f === `${jobId}.mp4.part`) {
        try { fs.unlinkSync(path.join(MEDIA_DIR, f)); } catch { /* non-fatal */ }
      }
    }
  } catch { /* non-fatal */ }
}

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

    const proc = spawnYtDlp(args);
    let stdout = "";
    let stderr = "";

    // Kill after META_KILL_TIMEOUT_MS to prevent hangs on unavailable videos
    const killTimer = setTimeout(() => { try { proc.kill("SIGKILL"); } catch { /* ok */ } }, META_KILL_TIMEOUT_MS);

    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      clearTimeout(killTimer);
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
    proc.on("error", () => { clearTimeout(killTimer); resolve(null); });
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
      "--progress",
      "--newline",              // one progress line per stderr write — enables regex match
      "-f", "bestaudio/best",   // format SELECTOR — picks best available audio stream
      "-x",                     // extract audio (keep raw; ffmpeg re-encodes below)
      "-o", tmpFile,
      "--no-part",
      "--socket-timeout", "30",
      "--retries", "3",
      "--fragment-retries", "3",
      "--concurrent-fragments", "1",  // single fragment — cleaner progress reporting
      "--throttled-rate", "100K",     // retry fragment if speed drops below 100 KB/s
      `https://www.youtube.com/watch?v=${job.sourceId}`,
    ];

    const proc = spawnYtDlp(ytArgs);
    let stderr = "";
    let stderrBuf = "";  // line buffer — chunks can split mid-number

    // Hard total timeout
    const killTimer = setTimeout(() => {
      clearTimeout(stallTimer);
      try { proc.kill("SIGKILL"); } catch { /* ok */ }
      reject(new Error("yt-dlp killed after timeout — audio download took too long (network issue or slow stream)"));
    }, AUDIO_KILL_TIMEOUT_MS);

    // No-progress stall watchdog — fires if yt-dlp goes silent for 90 s
    // (e.g. stuck at format selection, YouTube rate-limit, bad HLS segment)
    let stallTimer = setTimeout(() => {
      clearTimeout(killTimer);
      try { proc.kill("SIGKILL"); } catch { /* ok */ }
      reject(new Error("yt-dlp stalled — no progress for 90 s. YouTube may be throttling this video. Please retry."));
    }, 90_000);

    proc.stderr.on("data", (d: Buffer) => {
      // Reset stall watchdog on any output
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        clearTimeout(killTimer);
        try { proc.kill("SIGKILL"); } catch { /* ok */ }
        reject(new Error("yt-dlp stalled — no progress for 90 s. YouTube may be throttling this video. Please retry."));
      }, 90_000);

      // Line-buffer so a chunk split mid-number doesn't drop a progress update
      stderrBuf += d.toString();
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() ?? "";
      for (const line of lines) {
        stderr += line + "\n";
        // Match both "12.5%" and "100%" formats
        const match = /(\d+(?:\.\d+)?)%/.exec(line);
        if (match) {
          const pct = Math.min(80, 12 + Math.round(parseFloat(match[1]) * 0.68));
          updateJob(currentJob, { progress: pct });
        }
      }
    });

    proc.on("close", (code) => {
      clearTimeout(killTimer);
      clearTimeout(stallTimer);
      if (code === 0) resolve();
      else reject(new Error(sanitizeYtDlpError(stderr) || `yt-dlp exited ${code}`));
    });
    proc.on("error", (e) => {
      clearTimeout(killTimer);
      clearTimeout(stallTimer);
      reject(new Error(`yt-dlp spawn error: ${e.message}. Binary: ${YT_DLP_BIN}`));
    });
  });

  currentJob = updateJob(currentJob, { progress: 83 });

  // Find the actual output file (yt-dlp may append extension like .webm/.opus)
  const candidates = fs.readdirSync(MEDIA_DIR).filter(f => f.startsWith(`${job.id}_raw`) && !f.endsWith(".ytdl") && !/-Frag\d+$/.test(f));
  const rawFile = candidates.length > 0 ? path.join(MEDIA_DIR, candidates[0]!) : tmpFile;

  // Step 3: re-encode to target format via ffmpeg with ID3 metadata
  await new Promise<void>((resolve, reject) => {
    const safeName = sanitizeFilename(title);

    // Kill ffmpeg if it hangs (8-minute ceiling — longer sermons can be large)
    let ffmpegDone = false;
    const ffmpegKillTimer = setTimeout(() => {
      if (!ffmpegDone) {
        try { cmd.kill("SIGKILL"); } catch { /* ok */ }
        reject(new Error("ffmpeg timed out during audio encoding — please retry"));
      }
    }, 8 * 60 * 1000);

    const cmd = ffmpeg(rawFile)
      .audioCodec(ext === "m4a" ? "aac" : "libmp3lame")
      .audioBitrate(`${bitrate}k`)
      .audioChannels(2)
      .audioFrequency(44100)
      .outputOptions([
        // Each string is a single -metadata flag+value combined.
        // fluent-ffmpeg splits on whitespace, so values must not contain spaces.
        `-metadata title=${safeName}`,
        `-metadata artist=Jesus_Christ_Temple_Ministry`,
        `-metadata album=JCTM_Sermons`,
        `-metadata genre=Gospel`,
        `-metadata comment=jctm.org.ng`,
        ext === "m4a" ? "-movflags +faststart" : "-id3v2_version 3",
      ])
      .on("progress", (p) => {
        const pct = Math.min(97, 83 + Math.round((p.percent ?? 0) * 0.14));
        updateJob(currentJob, { progress: pct });
      })
      .on("end", () => {
        ffmpegDone = true;
        clearTimeout(ffmpegKillTimer);
        resolve();
      })
      .on("error", (e) => {
        ffmpegDone = true;
        clearTimeout(ffmpegKillTimer);
        reject(e);
      });

    cmd.save(outFile);
  });

  // Cleanup raw file (and any stray fragments)
  cleanupJobTempFiles(job.id);

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
      "--progress",
      "--newline",
      "-f", fmtSelector,
      "--merge-output-format", "mp4",
      "-o", outFile,
      "--no-part",
      "--socket-timeout", "30",
      "--retries", "3",
      "--fragment-retries", "3",
      "--concurrent-fragments", "1",  // single fragment — cleaner progress reporting
      "--throttled-rate", "100K",
      `https://www.youtube.com/watch?v=${job.sourceId}`,
    ];

    const proc = spawnYtDlp(ytArgs);
    let stderr = "";
    let stderrBuf = "";  // line buffer — chunks can split mid-number

    // Hard total timeout
    const killTimer = setTimeout(() => {
      clearTimeout(stallTimer);
      try { proc.kill("SIGKILL"); } catch { /* ok */ }
      reject(new Error("yt-dlp killed after timeout — video download took too long (network issue or large file)"));
    }, VIDEO_KILL_TIMEOUT_MS);

    // No-progress stall watchdog — fires if yt-dlp goes silent for 2 min
    // (video format selection for long conference videos can take ~30 s legitimately,
    //  but 2 minutes of silence means it is stuck)
    let stallTimer = setTimeout(() => {
      clearTimeout(killTimer);
      try { proc.kill("SIGKILL"); } catch { /* ok */ }
      reject(new Error("yt-dlp stalled — no progress for 2 minutes. YouTube may be throttling this video. Please retry."));
    }, 120_000);

    proc.stderr.on("data", (d: Buffer) => {
      // Reset stall watchdog on any output
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        clearTimeout(killTimer);
        try { proc.kill("SIGKILL"); } catch { /* ok */ }
        reject(new Error("yt-dlp stalled — no progress for 2 minutes. YouTube may be throttling this video. Please retry."));
      }, 120_000);

      // Line-buffer so a chunk split mid-number doesn't drop a progress update
      stderrBuf += d.toString();
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() ?? "";
      for (const line of lines) {
        stderr += line + "\n";
        // Match both "12.5%" and "100%" formats
        const match = /(\d+(?:\.\d+)?)%/.exec(line);
        if (match) {
          const pct = Math.min(96, 12 + Math.round(parseFloat(match[1]) * 0.84));
          updateJob(currentJob, { progress: pct });
        }
      }
    });

    proc.on("close", (code) => {
      clearTimeout(killTimer);
      clearTimeout(stallTimer);
      if (code === 0) resolve();
      else reject(new Error(sanitizeYtDlpError(stderr) || `yt-dlp video exited ${code}`));
    });
    proc.on("error", (e) => {
      clearTimeout(killTimer);
      clearTimeout(stallTimer);
      reject(new Error(`yt-dlp spawn error: ${e.message}`));
    });
  });

  // Verify the output file actually exists (yt-dlp can exit 0 without writing if mux fails)
  if (!fs.existsSync(outFile)) {
    throw new Error("yt-dlp completed but output file is missing — possible merge/mux failure");
  }

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
      const errMsg = err instanceof Error ? err.message : String(err);
      const isLast = attempt === MAX_RETRY_ATTEMPTS;

      // Permanent errors (video unavailable, private, geo-blocked, age-restricted)
      // should not be retried — fail immediately with a clear message.
      if (isPermanentError(errMsg)) {
        logger.warn({ err, jobId: job.id, attempt }, "Media job permanent error — not retrying");
        cleanupJobTempFiles(job.id);
        const current = activeJobs.get(job.id) ?? job;
        updateJob(current, { status: "failed", error: errMsg, retryCount: attempt });
        activeJobs.delete(job.id);
        return;
      }

      if (!isLast) {
        const delayMs = Math.pow(2, attempt - 1) * 3000; // 3s, 6s — longer delays to respect YouTube rate limits
        logger.warn({ err, jobId: job.id, attempt, delayMs }, "Media job failed — retrying");
        // Cleanup temp files before retry (yt-dlp will start fresh)
        cleanupJobTempFiles(job.id);
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
  cleanupJobTempFiles(job.id);
  const current = activeJobs.get(job.id) ?? job;
  updateJob(current, { status: "failed", error: errMsg, retryCount: MAX_RETRY_ATTEMPTS });
  activeJobs.delete(job.id);
}

// ─── Startup recovery ─────────────────────────────────────────────────────────

/**
 * Clean up `_raw*` temp files in MEDIA_DIR that belong to no active job.
 * Called once at startup after `recoverOrphanedJobs()` so a fresh restart
 * doesn't leave partial audio fragments consuming disk space.
 */
export function cleanupOrphanedTempFiles(): void {
  try {
    const files = fs.readdirSync(MEDIA_DIR);
    const activeIds = new Set<string>(activeJobs.keys());
    let removed = 0;
    for (const f of files) {
      // Only remove partial download artifacts — keep completed output files
      if (!/_raw/.test(f) && !f.endsWith(".part") && !f.endsWith(".ytdl")) continue;
      const jobId = f.split("_raw")[0] ?? "";
      if (!activeIds.has(jobId)) {
        try { fs.unlinkSync(path.join(MEDIA_DIR, f)); removed++; } catch { /* non-fatal */ }
      }
    }
    if (removed > 0) logger.info({ removed }, "Cleaned up orphaned yt-dlp temp files");
  } catch { /* non-fatal */ }
}

export async function recoverOrphanedJobs(): Promise<void> {
  try {
    const { rowCount } = await pool.query(`
      UPDATE media_download_jobs
         SET status     = 'failed',
             error      = 'Server restarted while this job was running — please try again',
             updated_at = now()
       WHERE status IN ('processing', 'queued')
         AND expires_at > now()
    `);
    if (rowCount && rowCount > 0) {
      logger.info({ recovered: rowCount }, "Recovered orphaned media jobs from previous server run");
    }
  } catch (err) {
    logger.warn({ err }, "recoverOrphanedJobs: non-fatal, continuing");
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

/**
 * Cancel a specific job by ID.
 * Removes it from the in-memory active map so the retry loop will see it as
 * gone and stop on its next iteration. The DB row is NOT deleted here — the
 * caller (admin route) deletes it after calling this.
 */
export function cancelJob(id: string): void {
  const job = activeJobs.get(id);
  if (job) {
    // Mark failed in memory so any concurrent processor check will abort
    updateJob(job, { status: "failed", error: "Cancelled by admin" });
    activeJobs.delete(id);
  }
  // Clean up any temp files associated with this job
  cleanupJobTempFiles(id);
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

/**
 * Enterprise Stream Pipeline
 *
 * Manages the full lifecycle of adaptive bitrate (ABR) streaming:
 *  - FFmpeg-based multi-bitrate encoding ladder (240p → 1080p/4K)
 *  - HLS (HTTP Live Streaming) segment generation with LL-HLS support
 *  - MPEG-DASH manifest generation
 *  - CDN URL resolution for global segment distribution
 *  - Stream health metrics aggregation (bitrate, dropped frames, buffer, RTT)
 *  - Automatic failover and redundancy tracking
 *  - Segment lifecycle management (creation, expiry, cleanup)
 */

import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import { EventEmitter } from "events";
import type { Logger } from "pino";

// ─── Quality Ladder ───────────────────────────────────────────────────────────

export interface QualityLevel {
  name: string;
  label: string;
  height: number;
  width: number;
  videoBitrate: string;
  audioBitrate: string;
  maxBitrate: string;
  bufSize: string;
  frameRate: number;
  preset: string;
  profile: string;
  level: string;
  segmentDuration: number;
}

export const QUALITY_LADDER: QualityLevel[] = [
  {
    name: "240p",
    label: "240p",
    height: 240,
    width: 426,
    videoBitrate: "300k",
    audioBitrate: "64k",
    maxBitrate: "450k",
    bufSize: "600k",
    frameRate: 24,
    preset: "veryfast",
    profile: "baseline",
    level: "3.0",
    segmentDuration: 4,
  },
  {
    name: "360p",
    label: "360p",
    height: 360,
    width: 640,
    videoBitrate: "600k",
    audioBitrate: "96k",
    maxBitrate: "900k",
    bufSize: "1200k",
    frameRate: 25,
    preset: "veryfast",
    profile: "main",
    level: "3.1",
    segmentDuration: 4,
  },
  {
    name: "480p",
    label: "480p",
    height: 480,
    width: 854,
    videoBitrate: "1200k",
    audioBitrate: "128k",
    maxBitrate: "1800k",
    bufSize: "2400k",
    frameRate: 30,
    preset: "veryfast",
    profile: "main",
    level: "3.1",
    segmentDuration: 4,
  },
  {
    name: "720p",
    label: "720p HD",
    height: 720,
    width: 1280,
    videoBitrate: "2500k",
    audioBitrate: "128k",
    maxBitrate: "3500k",
    bufSize: "5000k",
    frameRate: 30,
    preset: "fast",
    profile: "high",
    level: "4.0",
    segmentDuration: 4,
  },
  {
    name: "1080p",
    label: "1080p Full HD",
    height: 1080,
    width: 1920,
    videoBitrate: "5000k",
    audioBitrate: "192k",
    maxBitrate: "7000k",
    bufSize: "10000k",
    frameRate: 30,
    preset: "fast",
    profile: "high",
    level: "4.1",
    segmentDuration: 4,
  },
  {
    name: "1080p60",
    label: "1080p 60fps",
    height: 1080,
    width: 1920,
    videoBitrate: "8000k",
    audioBitrate: "192k",
    maxBitrate: "11000k",
    bufSize: "16000k",
    frameRate: 60,
    preset: "medium",
    profile: "high",
    level: "4.2",
    segmentDuration: 4,
  },
  {
    name: "4k",
    label: "4K Ultra HD",
    height: 2160,
    width: 3840,
    videoBitrate: "20000k",
    audioBitrate: "256k",
    maxBitrate: "28000k",
    bufSize: "40000k",
    frameRate: 30,
    preset: "slow",
    profile: "high",
    level: "5.1",
    segmentDuration: 4,
  },
];

// ─── Stream Health ─────────────────────────────────────────────────────────────

export interface StreamHealthMetrics {
  streamId: string;
  isActive: boolean;
  uptime: number;
  inputBitrate: number;
  outputBitrates: Record<string, number>;
  droppedFrames: number;
  encodedFrames: number;
  segmentsGenerated: number;
  segmentErrors: number;
  lastSegmentAt: number | null;
  activeVariants: string[];
  failoverCount: number;
  cdnPushSuccess: number;
  cdnPushFailed: number;
  fps: number;
  bufferHealth: number;
  avgLatencyMs: number;
  peakLatencyMs: number;
  startedAt: string | null;
  hlsManifestUrl: string | null;
  dashManifestUrl: string | null;
  rtmpIngestUrl: string | null;
  error: string | null;
}

// ─── Stream Session ────────────────────────────────────────────────────────────

export interface StreamSession {
  id: string;
  rtmpUrl: string;
  outputDir: string;
  hlsManifestUrl: string;
  dashManifestUrl: string;
  variants: string[];
  startedAt: Date;
  process: ffmpeg.FfmpegCommand | null;
  pid: number | null;
  health: StreamHealthMetrics;
}

// ─── CDN Config ────────────────────────────────────────────────────────────────

function getCdnBase(): string {
  return (process.env.STREAM_CDN_BASE_URL ?? "").replace(/\/$/, "");
}

function buildCdnUrl(relativePath: string): string {
  const cdn = getCdnBase();
  return cdn ? `${cdn}/${relativePath}` : `/api/stream/segments/${relativePath}`;
}

// ─── Pipeline Manager ─────────────────────────────────────────────────────────

class StreamPipelineManager extends EventEmitter {
  private sessions = new Map<string, StreamSession>();
  private segmentDir: string;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private log: Logger | null = null;

  constructor() {
    super();
    this.segmentDir = path.join(os.tmpdir(), "jctm-stream-segments");
    this.ensureSegmentDir();
    this.startCleanupJob();
  }

  setLogger(log: Logger) {
    this.log = log;
  }

  private ensureSegmentDir() {
    if (!fs.existsSync(this.segmentDir)) {
      fs.mkdirSync(this.segmentDir, { recursive: true });
    }
  }

  getSegmentDir(): string {
    return this.segmentDir;
  }

  // ── Start RTMP → HLS/DASH Transcoding Session ──────────────────────────────

  async startSession(opts: {
    streamId: string;
    rtmpUrl: string;
    enabledVariants?: string[];
    lowLatency?: boolean;
  }): Promise<StreamSession> {
    const { streamId, rtmpUrl, enabledVariants, lowLatency = true } = opts;

    if (this.sessions.has(streamId)) {
      await this.stopSession(streamId);
    }

    const sessionDir = path.join(this.segmentDir, streamId);
    fs.mkdirSync(sessionDir, { recursive: true });

    const variants = enabledVariants ?? QUALITY_LADDER.map(q => q.name);
    const enabledLadder = QUALITY_LADDER.filter(q => variants.includes(q.name));

    const hlsManifestUrl = buildCdnUrl(`${streamId}/master.m3u8`);
    const dashManifestUrl = buildCdnUrl(`${streamId}/manifest.mpd`);
    const rtmpIngestUrl = process.env.STREAM_RTMP_INGEST_URL ?? null;

    const health: StreamHealthMetrics = {
      streamId,
      isActive: false,
      uptime: 0,
      inputBitrate: 0,
      outputBitrates: Object.fromEntries(enabledLadder.map(q => [q.name, parseInt(q.videoBitrate)])),
      droppedFrames: 0,
      encodedFrames: 0,
      segmentsGenerated: 0,
      segmentErrors: 0,
      lastSegmentAt: null,
      activeVariants: enabledLadder.map(q => q.name),
      failoverCount: 0,
      cdnPushSuccess: 0,
      cdnPushFailed: 0,
      fps: 30,
      bufferHealth: 100,
      avgLatencyMs: 0,
      peakLatencyMs: 0,
      startedAt: new Date().toISOString(),
      hlsManifestUrl,
      dashManifestUrl,
      rtmpIngestUrl,
      error: null,
    };

    const session: StreamSession = {
      id: streamId,
      rtmpUrl,
      outputDir: sessionDir,
      hlsManifestUrl,
      dashManifestUrl,
      variants: enabledLadder.map(q => q.name),
      startedAt: new Date(),
      process: null,
      pid: null,
      health,
    };

    this.sessions.set(streamId, session);

    try {
      const cmd = this.buildFfmpegCommand(rtmpUrl, sessionDir, enabledLadder, lowLatency);
      session.process = cmd;

      cmd.on("start", (cmdLine: string) => {
        this.log?.info({ streamId, cmdLine: cmdLine.slice(0, 200) }, "FFmpeg transcode started");
        health.isActive = true;
        health.startedAt = new Date().toISOString();
        this.emit("sessionStarted", { streamId, session });
      });

      cmd.on("stderr", (line: string) => {
        this.parseProgressLine(health, line);
      });

      cmd.on("error", (err: Error) => {
        this.log?.error({ streamId, err: err.message }, "FFmpeg transcode error");
        health.isActive = false;
        health.error = err.message;
        health.failoverCount += 1;
        this.emit("sessionError", { streamId, error: err.message });

        // Auto-restart with backoff (up to 3 retries)
        if (health.failoverCount <= 3) {
          const delay = Math.min(1000 * Math.pow(2, health.failoverCount - 1), 8000);
          this.log?.info({ streamId, delay, attempt: health.failoverCount }, "Scheduling stream restart");
          setTimeout(() => {
            if (this.sessions.has(streamId)) {
              this.startSession(opts).catch(restartErr => {
                this.log?.error({ streamId, err: restartErr }, "Stream restart failed");
              });
            }
          }, delay);
        }
      });

      cmd.on("end", () => {
        this.log?.info({ streamId }, "FFmpeg transcode ended");
        health.isActive = false;
        this.emit("sessionEnded", { streamId });
      });

      cmd.run();

      this.writeMasterPlaylist(sessionDir, streamId, enabledLadder);

    } catch (err) {
      health.error = String(err);
      this.log?.error({ streamId, err }, "Failed to start stream session");
      throw err;
    }

    return session;
  }

  // ── Build FFmpeg Multi-Bitrate HLS Command ─────────────────────────────────

  private buildFfmpegCommand(
    input: string,
    outputDir: string,
    ladder: QualityLevel[],
    lowLatency: boolean,
  ): ffmpeg.FfmpegCommand {
    const cmd = ffmpeg(input);

    // Input options — low latency RTMP reading
    cmd.inputOptions([
      "-re",
      "-fflags", "+genpts+discardcorrupt",
      "-rtmp_buffer", "100",
      "-rtmp_live", "live",
      "-timeout", "30000000",
      "-analyzeduration", "1000000",
      "-probesize", "1000000",
    ]);

    // Build filter complex for multi-output scaling
    const filterParts: string[] = [];
    filterParts.push("[0:v]split=" + ladder.length + ladder.map((_, i) => `[v${i}]`).join(""));

    const maps: string[] = [];
    const outputArgs: string[] = [];

    ladder.forEach((q, i) => {
      const scaleFilter = `[v${i}]scale=${q.width}:${q.height}:force_original_aspect_ratio=decrease,pad=${q.width}:${q.height}:(ow-iw)/2:(oh-ih)/2[vout${i}]`;
      filterParts.push(scaleFilter);
      maps.push(`-map [vout${i}]`, `-map 0:a?`);

      const variantDir = path.join(outputDir, `stream_${q.name}`);
      fs.mkdirSync(variantDir, { recursive: true });

      outputArgs.push(
        `-c:v:${i}`, "libx264",
        `-b:v:${i}`, q.videoBitrate,
        `-maxrate:${i}`, q.maxBitrate,
        `-bufsize:${i}`, q.bufSize,
        `-r:${i}`, String(q.frameRate),
        `-g:${i}`, String(q.frameRate * q.segmentDuration),
        `-keyint_min:${i}`, String(q.frameRate * q.segmentDuration),
        `-sc_threshold:${i}`, "0",
        `-profile:v:${i}`, q.profile,
        `-level:v:${i}`, q.level,
        `-preset:${i}`, q.preset,
        `-c:a:${i}`, "aac",
        `-b:a:${i}`, q.audioBitrate,
        `-ar:${i}`, "48000",
        `-ac:${i}`, "2",
      );
    });

    cmd.complexFilter(filterParts.join(";"));
    cmd.addOptions(maps.flatMap(item => item.split(" ")));
    cmd.addOptions(outputArgs);

    const varStreamMap = ladder.map((q, i) => `v:${i},a:${i},name:${q.name}`).join(" ");
    const hlsFlags = [
      "delete_segments",
      "independent_segments",
      "program_date_time",
      "temp_file",
    ].join("+");

    cmd
      .output(path.join(outputDir, "stream_%v", "playlist.m3u8"))
      .outputOptions([
        "-f", "hls",
        "-master_pl_name", "master.m3u8",
        "-var_stream_map", varStreamMap,
        "-hls_time", String(lowLatency ? 3 : 4),
        "-hls_list_size", lowLatency ? "10" : "12",
        "-hls_delete_threshold", "6",
        "-hls_flags", hlsFlags,
        "-hls_segment_type", "fmp4",
        "-hls_fmp4_init_filename", "init.mp4",
        "-hls_segment_filename", path.join(outputDir, "stream_%v", "segment%05d.m4s"),
      ]);

    cmd
      .output(path.join(outputDir, "manifest.mpd"))
      .outputOptions([
        "-f", "dash",
        "-seg_duration", String(lowLatency ? 3 : 4),
        "-window_size", "12",
        "-extra_window_size", "6",
        "-remove_at_exit", "0",
        "-use_template", "1",
        "-use_timeline", "1",
        "-adaptation_sets", "id=0,streams=v id=1,streams=a",
        "-init_seg_name", "dash_init_$RepresentationID$.mp4",
        "-media_seg_name", "dash_chunk_$RepresentationID$_$Number%05d$.m4s",
      ]);

    return cmd;
  }

  // ── Write Master HLS Playlist ──────────────────────────────────────────────

  private writeMasterPlaylist(outputDir: string, streamId: string, ladder: QualityLevel[]) {
    const lines = ["#EXTM3U", "#EXT-X-VERSION:7", ""];

    ladder.forEach(q => {
      const bandwidth = parseInt(q.videoBitrate) + parseInt(q.audioBitrate);
      const maxBw = parseInt(q.maxBitrate);
      lines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${maxBw * 1000},AVERAGE-BANDWIDTH=${bandwidth * 1000},` +
        `RESOLUTION=${q.width}x${q.height},FRAME-RATE=${q.frameRate},CODECS="avc1.4D401F,mp4a.40.2",` +
        `VIDEO-RANGE=SDR,CLOSED-CAPTIONS=NONE`,
        buildCdnUrl(`${streamId}/stream_${q.name}/playlist.m3u8`),
      );
    });

    lines.push("", "#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"audio\",NAME=\"English\",DEFAULT=YES,AUTOSELECT=YES,LANGUAGE=\"en\"");

    fs.writeFileSync(path.join(outputDir, "master.m3u8"), lines.join("\n"), "utf-8");
  }

  // ── Parse FFmpeg Progress ──────────────────────────────────────────────────

  private parseProgressLine(health: StreamHealthMetrics, line: string) {
    // Parse frame count
    const frameMatch = line.match(/frame=\s*(\d+)/);
    if (frameMatch) health.encodedFrames = parseInt(frameMatch[1]!);

    // Parse FPS
    const fpsMatch = line.match(/fps=\s*([\d.]+)/);
    if (fpsMatch) health.fps = parseFloat(fpsMatch[1]!);

    // Parse bitrate
    const bitrateMatch = line.match(/bitrate=\s*([\d.]+)kbits\/s/);
    if (bitrateMatch) health.inputBitrate = parseFloat(bitrateMatch[1]!);

    // Parse dropped frames
    const dropMatch = line.match(/drop=(\d+)/);
    if (dropMatch) health.droppedFrames = parseInt(dropMatch[1]!);

    // Parse segment creation (look for segment file path in output)
    if (line.includes(".m4s") || line.includes(".ts")) {
      health.segmentsGenerated += 1;
      health.lastSegmentAt = Date.now();
    }

    // Compute uptime
    const timeMatch = line.match(/time=(\d+):(\d+):([\d.]+)/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1]!);
      const m = parseInt(timeMatch[2]!);
      const s = parseFloat(timeMatch[3]!);
      health.uptime = h * 3600 + m * 60 + s;
    }

    // Estimate buffer health (100% if no drops, degraded otherwise)
    if (health.encodedFrames > 0) {
      const dropRate = health.droppedFrames / health.encodedFrames;
      health.bufferHealth = Math.max(0, Math.round((1 - dropRate) * 100));
    }
  }

  // ── Stop Session ───────────────────────────────────────────────────────────

  async stopSession(streamId: string): Promise<void> {
    const session = this.sessions.get(streamId);
    if (!session) return;

    if (session.process) {
      try {
        session.process.kill("SIGTERM");
        await new Promise(resolve => setTimeout(resolve, 1000));
        try { session.process.kill("SIGKILL"); } catch { /* already dead */ }
      } catch {
        // Process may have already exited
      }
      session.process = null;
    }

    session.health.isActive = false;
    this.sessions.delete(streamId);
    this.emit("sessionStopped", { streamId });
    this.log?.info({ streamId }, "Stream session stopped");
  }

  // ── Get Session ────────────────────────────────────────────────────────────

  getSession(streamId: string): StreamSession | undefined {
    return this.sessions.get(streamId);
  }

  getActiveSessions(): StreamSession[] {
    return [...this.sessions.values()].filter(s => s.health.isActive);
  }

  // ── Health Snapshot ────────────────────────────────────────────────────────

  getHealthSnapshot(streamId?: string): StreamHealthMetrics[] {
    if (streamId) {
      const session = this.sessions.get(streamId);
      return session ? [session.health] : [];
    }
    return [...this.sessions.values()].map(s => s.health);
  }

  // ── CDN Segment URL Resolver ───────────────────────────────────────────────

  resolveSegmentUrl(streamId: string, variant: string, segmentFile: string): string {
    return buildCdnUrl(`${streamId}/${variant}/${segmentFile}`);
  }

  // ── Manifest URLs for a given video/stream source ─────────────────────────

  getManifestUrls(streamId: string): {
    hls: string | null;
    dash: string | null;
    youtube: string | null;
  } {
    const session = this.sessions.get(streamId);
    if (session) {
      return {
        hls: session.hlsManifestUrl,
        dash: session.dashManifestUrl,
        youtube: null,
      };
    }

    // For YouTube video IDs, provide YouTube HLS URL hints
    if (/^[a-zA-Z0-9_-]{11}$/.test(streamId)) {
      return {
        hls: null,
        dash: null,
        youtube: `https://www.youtube.com/embed/${streamId}`,
      };
    }

    return { hls: null, dash: null, youtube: null };
  }

  // ── Segment Cleanup ────────────────────────────────────────────────────────

  private startCleanupJob() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldSegments();
    }, 5 * 60 * 1000); // Every 5 minutes
    this.cleanupInterval.unref();
  }

  private cleanupOldSegments() {
    const maxAgeMs = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();

    try {
      if (!fs.existsSync(this.segmentDir)) return;
      const streamDirs = fs.readdirSync(this.segmentDir);

      for (const dir of streamDirs) {
        const streamPath = path.join(this.segmentDir, dir);
        const stat = fs.statSync(streamPath);

        // Remove inactive stream dirs older than 10 minutes
        if (!this.sessions.has(dir) && now - stat.mtimeMs > maxAgeMs) {
          fs.rmSync(streamPath, { recursive: true, force: true });
          this.log?.info({ streamId: dir }, "Cleaned up old stream segments");
        }
      }
    } catch {
      // Non-critical cleanup failure
    }
  }

  // ── Graceful Shutdown ──────────────────────────────────────────────────────

  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    const stopPromises = [...this.sessions.keys()].map(id => this.stopSession(id));
    await Promise.allSettled(stopPromises);
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const streamPipeline = new StreamPipelineManager();

// ─── Encoding Configuration Export ────────────────────────────────────────────

export function getEncodingConfig() {
  return {
    ladder: QUALITY_LADDER,
    hlsConfig: {
      lowLatencyMode: true,
      targetLatency: 6.0,
      maxLatency: 15.0,
      segmentDuration: 3,
      listSize: 10,
      partDuration: 1.0,
      version: 7,
      initSegment: "fmp4",
    },
    dashConfig: {
      minBufferTime: 4,
      suggestedPresentationDelay: 8,
      segmentDuration: 3,
      updatePeriod: 3,
    },
    bufferConfig: {
      maxBackBuffer: 30,
      maxBufferLength: 30,
      maxMaxBufferLength: 120,
      highWaterMark: 10,
      lowWaterMark: 2,
    },
    networkConfig: {
      lowBandwidthBps: 500_000,
      medBandwidthBps: 1_500_000,
      highBandwidthBps: 5_000_000,
      ultraBandwidthBps: 15_000_000,
    },
  };
}

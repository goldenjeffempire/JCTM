/**
 * Stream Pipeline API Routes
 *
 * Provides enterprise-grade stream management endpoints:
 *   GET  /api/stream/health          — Real-time stream health metrics
 *   GET  /api/stream/quality-ladder  — Available encoding ladder config
 *   GET  /api/stream/config          — Full HLS/DASH/buffer config
 *   GET  /api/stream/manifest/:id    — Get HLS/DASH manifest URLs for a stream
 *   POST /api/stream/ingest/start    — Start RTMP → HLS/DASH transcoding (admin)
 *   POST /api/stream/ingest/stop     — Stop active transcoding session (admin)
 *   GET  /api/stream/segments/*      — Serve HLS segments (dev/local CDN fallback)
 */

import { Router, type IRouter, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { streamPipeline, getEncodingConfig } from "../lib/stream-pipeline.js";
import { requireAdminRole } from "../lib/adminAuth.js";

const router: IRouter = Router();

// ─── GET /api/stream/health ───────────────────────────────────────────────────

router.get("/stream/health", (_req: Request, res: Response): void => {
  const sessions = streamPipeline.getHealthSnapshot();

  res.setHeader("Cache-Control", "no-store");
  res.json({
    activeSessions: sessions.length,
    sessions,
    pipeline: {
      ffmpegAvailable: true,
      cdnConfigured: Boolean(process.env.STREAM_CDN_BASE_URL),
      rtmpIngestUrl: process.env.STREAM_RTMP_INGEST_URL ?? null,
      cdnBaseUrl: process.env.STREAM_CDN_BASE_URL ?? null,
    },
  });
});

// ─── GET /api/stream/quality-ladder ──────────────────────────────────────────

router.get("/stream/quality-ladder", (_req: Request, res: Response): void => {
  const config = getEncodingConfig();
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    ladder: config.ladder.map(q => ({
      name: q.name,
      label: q.label,
      height: q.height,
      width: q.width,
      videoBitrate: q.videoBitrate,
      audioBitrate: q.audioBitrate,
      frameRate: q.frameRate,
    })),
    hlsConfig: config.hlsConfig,
    dashConfig: config.dashConfig,
    bufferConfig: config.bufferConfig,
    networkConfig: config.networkConfig,
  });
});

// ─── GET /api/stream/config ───────────────────────────────────────────────────

router.get("/stream/config", (_req: Request, res: Response): void => {
  const config = getEncodingConfig();
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json(config);
});

// ─── GET /api/stream/manifest/:id ────────────────────────────────────────────

router.get("/stream/manifest/:id", (req: Request, res: Response): void => {
  const { id } = req.params as { id: string };
  const urls = streamPipeline.getManifestUrls(id);

  res.setHeader("Cache-Control", "no-store");
  res.json({
    streamId: id,
    hls: urls.hls,
    dash: urls.dash,
    youtube: urls.youtube,
    hasActiveSession: Boolean(streamPipeline.getSession(id)),
  });
});

// ─── POST /api/stream/ingest/start ───────────────────────────────────────────

router.post(
  "/stream/ingest/start",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const {
      streamId = "live",
      rtmpUrl,
      variants,
      lowLatency = true,
    } = req.body as {
      streamId?: string;
      rtmpUrl?: string;
      variants?: string[];
      lowLatency?: boolean;
    };

    if (!rtmpUrl) {
      res.status(400).json({ error: "rtmpUrl is required" });
      return;
    }

    try {
      const session = await streamPipeline.startSession({
        streamId,
        rtmpUrl,
        enabledVariants: variants,
        lowLatency,
      });

      res.json({
        success: true,
        streamId: session.id,
        hlsManifestUrl: session.hlsManifestUrl,
        dashManifestUrl: session.dashManifestUrl,
        variants: session.variants,
        startedAt: session.startedAt.toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        error: "Failed to start transcoding session",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  },
);

// ─── POST /api/stream/ingest/stop ────────────────────────────────────────────

router.post(
  "/stream/ingest/stop",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const { streamId = "live" } = req.body as { streamId?: string };

    await streamPipeline.stopSession(streamId);

    res.json({ success: true, streamId, stoppedAt: new Date().toISOString() });
  },
);

// ─── GET /api/stream/sessions ─────────────────────────────────────────────────

router.get("/stream/sessions", requireAdminRole("livestream"), (_req: Request, res: Response): void => {
  const sessions = streamPipeline.getActiveSessions().map(s => ({
    id: s.id,
    rtmpUrl: s.rtmpUrl,
    variants: s.variants,
    startedAt: s.startedAt.toISOString(),
    hlsManifestUrl: s.hlsManifestUrl,
    dashManifestUrl: s.dashManifestUrl,
    health: s.health,
  }));

  res.setHeader("Cache-Control", "no-store");
  res.json({ sessions });
});

// ─── GET /api/stream/segments/* ───────────────────────────────────────────────
// Local segment serving — fallback when STREAM_CDN_BASE_URL is not set.
// In production, segments should be served from CDN (Cloudflare, Akamai, etc.)

router.get("/stream/segments/*path", (req: Request, res: Response): void => {
  const segPath = (req.params as Record<string, string>).path ?? "";

  if (!segPath || segPath.includes("..")) {
    res.status(400).json({ error: "Invalid segment path" });
    return;
  }

  const segmentDir = streamPipeline.getSegmentDir();
  const filePath = path.join(segmentDir, segPath);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Segment not found" });
    return;
  }

  const ext = path.extname(filePath);

  const mimeTypes: Record<string, string> = {
    ".m3u8": "application/vnd.apple.mpegurl",
    ".m4s": "video/iso.segment",
    ".mp4": "video/mp4",
    ".ts": "video/MP2T",
    ".mpd": "application/dash+xml",
    ".mp4a": "audio/mp4",
  };

  const contentType = mimeTypes[ext] ?? "application/octet-stream";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");

  // HLS manifests: no-cache for live streams
  if (ext === ".m3u8" || ext === ".mpd") {
    res.setHeader("Cache-Control", "no-cache, no-store");
  } else {
    // Segments can be cached for 10 minutes
    res.setHeader("Cache-Control", "public, max-age=600");
  }

  // Range request support for DASH segments
  const stat = fs.statSync(filePath);
  const { range } = req.headers;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0]!, 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;

    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    res.setHeader("Content-Length", chunkSize);

    const readStream = fs.createReadStream(filePath, { start, end });
    readStream.pipe(res);
  } else {
    res.setHeader("Content-Length", stat.size);
    fs.createReadStream(filePath).pipe(res);
  }
});

export default router;

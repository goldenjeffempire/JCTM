/**
 * Client-Side Stream Configuration
 *
 * Defines the quality ladder, HLS.js/DASH.js tuning parameters,
 * buffer targets, ABR thresholds, and CDN configuration used
 * by the enterprise StreamPlayer component.
 */

// ─── Quality Levels ───────────────────────────────────────────────────────────

export interface QualityLevel {
  name: string;
  label: string;
  height: number;
  bitrateBps: number;
  icon?: string;
}

export const QUALITY_LEVELS: QualityLevel[] = [
  { name: "auto",   label: "Auto",       height: 0,    bitrateBps: 0 },
  { name: "240p",   label: "240p",       height: 240,  bitrateBps: 300_000 },
  { name: "360p",   label: "360p",       height: 360,  bitrateBps: 600_000 },
  { name: "480p",   label: "480p SD",    height: 480,  bitrateBps: 1_200_000 },
  { name: "720p",   label: "720p HD",    height: 720,  bitrateBps: 2_500_000 },
  { name: "1080p",  label: "1080p FHD",  height: 1080, bitrateBps: 5_000_000 },
  { name: "1080p60",label: "1080p 60fps",height: 1080, bitrateBps: 8_000_000 },
  { name: "4k",     label: "4K UHD",     height: 2160, bitrateBps: 20_000_000 },
];

// ─── HLS.js Configuration ─────────────────────────────────────────────────────
// Tuned for both low-latency live and VOD rebroadcast scenarios.

export const HLS_CONFIG = {
  // ── Core ──────────────────────────────────────────────────────────────────
  enableWorker: true,
  workerPath: undefined,
  startLevel: -1,               // -1 = auto-start ABR
  autoStartLoad: true,

  // ── Low-Latency HLS (LL-HLS) ──────────────────────────────────────────────
  lowLatencyMode: true,
  targetLatency: 5.0,
  liveSyncDurationCount: 4,
  liveMaxLatencyDurationCount: 10,
  liveDurationInfinity: true,

  // ── Buffer Control ────────────────────────────────────────────────────────
  maxBufferLength: 45,
  maxMaxBufferLength: 180,
  maxBufferSize: 90 * 1000 * 1000,
  maxBufferHole: 0.8,
  highBufferWatchdogPeriod: 2,
  nudgeOffset: 0.15,
  nudgeMaxRetry: 5,
  maxFragLookUpTolerance: 0.35,

  // ── ABR Bandwidth Estimation ──────────────────────────────────────────────
  abrEwmaDefaultEstimate: 1_500_000,
  abrEwmaFastLive: 4.0,
  abrEwmaSlowLive: 12.0,
  abrEwmaFastVoD: 4.0,
  abrEwmaSlowVoD: 15.0,
  abrBandWidthFactor: 0.85,
  abrBandWidthUpFactor: 0.65,
  abrMaxWithRealBitrate: true,

  // ── Network Retry / Error Recovery ───────────────────────────────────────
  manifestLoadingMaxRetry: 8,
  manifestLoadingRetryDelay: 1000,
  manifestLoadingMaxRetryTimeout: 30000,
  levelLoadingMaxRetry: 8,
  levelLoadingRetryDelay: 1000,
  levelLoadingMaxRetryTimeout: 30000,
  fragLoadingMaxRetry: 8,
  fragLoadingRetryDelay: 800,
  fragLoadingMaxRetryTimeout: 30000,

  // ── Stall Recovery ────────────────────────────────────────────────────────
  stallDetected: undefined,
  highBufferDetected: undefined,

  // ── XHR / Fetch Setup ─────────────────────────────────────────────────────
  fetchSetup: undefined,
  xhrSetup: undefined,

  // ── Debug ─────────────────────────────────────────────────────────────────
  debug: false,
} as const;

// ─── DASH.js Configuration ────────────────────────────────────────────────────

export const DASH_CONFIG = {
  streaming: {
    abr: {
      autoSwitchBitrate: { video: true, audio: true },
      bandwidthSafetyFactor: 0.9,
      useDefaultABRRules: true,
      fetchThroughputCalculationMode: "abrFetchThroughputCalculationDownloadedData",
    },
    buffer: {
      initialBufferingTime: 4,
      bufferToKeep: 20,
      bufferPruningInterval: 10,
      bufferTimeAtTopQuality: 30,
      bufferTimeAtTopQualityLongForm: 60,
    },
    liveCatchup: {
      enabled: true,
      mode: "liveCatchupModeDefault",
      minDrift: 0.15,
      maxDrift: 8,
      playbackRate: { min: -0.25, max: 0.25 },
      latencyThreshold: 12,
      playbackBufferMin: 4,
    },
    lowLatencyEnabled: true,
    retryAttempts: { MPD: 6, XLinkExpansion: 3, InitializationSegment: 5, BitstreamSwitchingSegment: 5, IndexSegment: 5, MediaSegment: 8, BitrateSwitch: 5 },
    retryIntervals: { MPD: 1000, XLinkExpansion: 1000, InitializationSegment: 1000, BitstreamSwitchingSegment: 1000, IndexSegment: 1000, MediaSegment: 800, BitrateSwitch: 1000 },
  },
};

// ─── Network Quality Thresholds ───────────────────────────────────────────────

export type NetworkQuality = "slow" | "medium" | "fast" | "ultra";

export function detectNetworkQuality(): NetworkQuality {
  if (typeof navigator === "undefined") return "fast";

  const conn = (navigator as Navigator & {
    connection?: {
      effectiveType?: string;
      downlink?: number;
      saveData?: boolean;
    };
  }).connection;

  if (!conn) return "fast";
  if (conn.saveData) return "slow";

  const downlinkMbps = conn.downlink ?? 10;
  if (downlinkMbps < 0.5 || conn.effectiveType === "slow-2g" || conn.effectiveType === "2g") return "slow";
  if (downlinkMbps < 1.5 || conn.effectiveType === "3g") return "medium";
  if (downlinkMbps < 10) return "fast";
  return "ultra";
};

export function networkQualityToDefaultLevel(q: NetworkQuality): string {
  switch (q) {
    case "slow":   return "360p";
    case "medium": return "480p";
    case "fast":   return "720p";
    case "ultra":  return "1080p";
  }
}

// ─── Source Types ─────────────────────────────────────────────────────────────

export type StreamSourceType = "hls" | "dash" | "youtube" | "mp4";

export interface StreamSource {
  type: StreamSourceType;
  url: string;
  label?: string;
  priority: number; // lower = try first
}

export function buildStreamSources(opts: {
  hlsManifestUrl?: string | null;
  dashManifestUrl?: string | null;
  youtubeVideoId?: string | null;
  mp4Url?: string | null;
}): StreamSource[] {
  const sources: StreamSource[] = [];

  if (opts.hlsManifestUrl) {
    sources.push({ type: "hls", url: opts.hlsManifestUrl, label: "HLS ABR", priority: 1 });
  }
  if (opts.dashManifestUrl) {
    sources.push({ type: "dash", url: opts.dashManifestUrl, label: "DASH ABR", priority: 2 });
  }
  if (opts.mp4Url) {
    sources.push({ type: "mp4", url: opts.mp4Url, label: "Direct MP4", priority: 3 });
  }
  if (opts.youtubeVideoId) {
    sources.push({ type: "youtube", url: opts.youtubeVideoId, label: "YouTube", priority: 99 });
  }

  return sources.sort((a, b) => a.priority - b.priority);
}

/**
 * StreamPlayer — Enterprise Adaptive Bitrate Player
 *
 * A production-grade video player with:
 *  - HLS.js ABR playback with LL-HLS low-latency mode
 *  - MPEG-DASH playback via dash.js
 *  - YouTube iframe fallback (always available)
 *  - Multi-source failover: HLS → DASH → YouTube
 *  - Quality selector (Auto, 240p → 4K)
 *  - Real-time buffer health indicator
 *  - Network quality badge
 *  - Stall detection and live-edge recovery
 *  - Exponential backoff error recovery
 *  - Fullscreen support (native API + YouTube)
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Settings, Wifi, WifiOff, Signal, AlertCircle, RefreshCw,
  Activity, Zap, Radio, Tv2, Maximize2, Minimize2,
  PictureInPicture2, PictureInPictureIcon,
  Share2, Check, Link2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { useStreamPlayer } from "@/hooks/useStreamPlayer";
import { buildStreamSources, detectNetworkQuality, type NetworkQuality } from "@/lib/stream-config";
import { buildYouTubeUrl } from "@/components/DualStreamToggle";

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Viewer Count Badge ────────────────────────────────────────────────────────

function ViewerCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 border border-white/10 text-[10px] font-semibold text-white/70 backdrop-blur-sm">
      <Users className="w-3 h-3 text-red-400" />
      <span className="tabular-nums">{count.toLocaleString()}</span>
      <span className="text-white/40">watching</span>
    </span>
  );
}

export interface StreamPlayerProps {
  hlsManifestUrl?: string | null;
  dashManifestUrl?: string | null;
  youtubeVideoId?: string | null;
  isLive?: boolean;
  title?: string;
  autoPlay?: boolean;
  muted?: boolean;
  preferredQuality?: string;
  className?: string;
  viewerCount?: number;
  onLoad?: () => void;
  onError?: (err: string) => void;
}

// ─── Buffer Health Bar ─────────────────────────────────────────────────────────

function BufferHealthBar({ health, playerState }: { health: number; playerState: string }) {
  const isBuffering = playerState === "buffering" || playerState === "stalled";
  const color = health > 70 ? "bg-emerald-500" : health > 40 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
      <motion.div
        className={`h-full ${color} transition-all duration-500`}
        style={{ width: `${health}%` }}
        animate={isBuffering ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
        transition={isBuffering ? { repeat: Infinity, duration: 1 } : {}}
      />
    </div>
  );
}

// ─── Network Quality Badge ────────────────────────────────────────────────────

function NetworkBadge({ quality }: { quality: NetworkQuality | string }) {
  const badges: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    slow:   { icon: <WifiOff className="w-3 h-3" />, label: "Slow", cls: "text-red-400 bg-red-500/15 border-red-500/30" },
    medium: { icon: <Signal className="w-3 h-3" />,  label: "Fair", cls: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
    fast:   { icon: <Wifi className="w-3 h-3" />,    label: "Good", cls: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
    ultra:  { icon: <Zap className="w-3 h-3" />,     label: "Ultra", cls: "text-sky-400 bg-sky-500/15 border-sky-500/30" },
  };
  const b = badges[quality] ?? badges["fast"]!;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${b.cls}`}>
      {b.icon}{b.label}
    </span>
  );
}

// ─── Quality Selector ─────────────────────────────────────────────────────────

interface QualitySelectorProps {
  levels: { index: number; name: string; height: number; bitrate: number }[];
  currentLevel: number;
  isAuto: boolean;
  onSelect: (level: number) => void;
  onClose: () => void;
}

function QualitySelector({ levels, currentLevel, isAuto, onSelect, onClose }: QualitySelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-12 right-3 z-20 bg-black/90 backdrop-blur-md border border-white/15 rounded-xl shadow-2xl overflow-hidden min-w-[140px]"
      onClick={e => e.stopPropagation()}
    >
      <div className="px-3 pt-2.5 pb-1">
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Quality</span>
      </div>

      {/* Auto option */}
      <button
        onClick={() => { onSelect(-1); onClose(); }}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10 ${
          isAuto ? "text-sky-400 bg-sky-500/10" : "text-white/80"
        }`}
      >
        <span>Auto (ABR)</span>
        {isAuto && <span className="text-[10px] font-bold text-sky-400 bg-sky-500/20 px-1.5 py-0.5 rounded">ON</span>}
      </button>

      {/* Quality levels — sorted high to low */}
      {[...levels].sort((a, b) => b.height - a.height).map(level => (
        <button
          key={level.index}
          onClick={() => { onSelect(level.index); onClose(); }}
          className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10 ${
            !isAuto && currentLevel === level.index ? "text-sky-400 bg-sky-500/10" : "text-white/70"
          }`}
        >
          <span>{level.name}</span>
          <span className="text-[10px] text-white/30 tabular-nums">
            {Math.round(level.bitrate / 1000)}k
          </span>
        </button>
      ))}
    </motion.div>
  );
}

// ─── Stream Status Overlay ────────────────────────────────────────────────────

function StreamStatusOverlay({
  playerState,
  engine,
  lastError,
  onRetry,
}: {
  playerState: string;
  engine: string;
  lastError: string | null;
  onRetry: () => void;
}) {
  if (playerState === "playing") return null;

  if (playerState === "error") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10 gap-3 px-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-white font-semibold text-sm">Stream Unavailable</p>
        {lastError && <p className="text-white/40 text-xs font-mono leading-snug max-w-xs">{lastError.slice(0, 120)}</p>}
        <button
          onClick={onRetry}
          className="mt-1 flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (playerState === "buffering" || playerState === "loading") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 pointer-events-none">
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-2 border-white/10" />
            <div className="absolute inset-0 rounded-full border-2 border-t-white border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <span className="text-white/50 text-xs font-medium">
            {playerState === "loading" ? "Loading…" : "Buffering…"}
          </span>
        </div>
      </div>
    );
  }

  if (playerState === "recovering" || playerState === "stalled") {
    return (
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-300 text-xs font-semibold">
            {playerState === "stalled" ? "Reconnecting to stream…" : "Stabilizing stream…"}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Fullscreen Button ────────────────────────────────────────────────────────

function FullscreenButton({
  isFullscreen,
  onToggle,
}: {
  isFullscreen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle(); }}
      title={isFullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/50 border border-white/15 text-white/70 hover:text-white hover:bg-white/20 hover:border-white/30 transition-all backdrop-blur-sm"
    >
      {isFullscreen
        ? <Minimize2 className="w-4 h-4" />
        : <Maximize2 className="w-4 h-4" />
      }
    </button>
  );
}

// ─── Picture-in-Picture Button ────────────────────────────────────────────────

function PipButton({
  isPip,
  onToggle,
}: {
  isPip: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle(); }}
      title={isPip ? "Exit picture-in-picture (P)" : "Picture-in-picture (P)"}
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/50 border border-white/15 text-white/70 hover:text-white hover:bg-white/20 hover:border-white/30 transition-all backdrop-blur-sm"
    >
      {isPip
        ? <PictureInPictureIcon className="w-4 h-4 text-sky-400" />
        : <PictureInPicture2 className="w-4 h-4" />
      }
    </button>
  );
}

// ─── Share Button ──────────────────────────────────────────────────────────────

function ShareButton({ onShare }: { onShare: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onShare();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onShare]);

  return (
    <button
      onClick={handleClick}
      title="Share stream (S)"
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full border transition-all backdrop-blur-sm ${
        copied
          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
          : "bg-black/50 border-white/15 text-white/70 hover:text-white hover:bg-white/20 hover:border-white/30"
      }`}
    >
      {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
    </button>
  );
}

// ─── Player Controls Bar ──────────────────────────────────────────────────────

interface PlayerControlsProps {
  engine: string;
  currentQualityName: string;
  isAuto: boolean;
  bufferedSeconds: number;
  networkQuality: string;
  bitrateMbps: number;
  latencyMs: number;
  isLive: boolean;
  showQuality: boolean;
  isFullscreen: boolean;
  isPip: boolean;
  isPipSupported: boolean;
  viewerCount: number;
  onToggleQuality: () => void;
  onSeekLive: () => void;
  onToggleFullscreen: () => void;
  onTogglePip: () => void;
  onShare: () => void;
}

function PlayerControls({
  engine,
  currentQualityName,
  isAuto,
  bufferedSeconds,
  networkQuality,
  bitrateMbps,
  latencyMs,
  isLive,
  showQuality,
  isFullscreen,
  isPip,
  isPipSupported,
  viewerCount,
  onToggleQuality,
  onSeekLive,
  onToggleFullscreen,
  onTogglePip,
  onShare,
}: PlayerControlsProps) {
  const isNative = engine !== "youtube";

  return (
    <div className="absolute bottom-0 left-0 right-0 px-3 py-2 z-10 flex items-center justify-between gap-2">
      {/* Left: engine badge + viewer count + latency */}
      <div className="flex items-center gap-2">
        {isNative && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 border border-white/10 text-[10px] font-bold text-white/60 backdrop-blur-sm">
            <Activity className="w-3 h-3" />
            {engine.toUpperCase()}
          </span>
        )}
        <ViewerCountBadge count={viewerCount} />
        {isLive && isNative && latencyMs > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 border border-white/10 text-[10px] font-medium text-white/50 backdrop-blur-sm">
            <Radio className="w-3 h-3 text-red-400" />
            {latencyMs < 1000 ? `${Math.round(latencyMs)}ms` : `${(latencyMs / 1000).toFixed(1)}s`} lag
          </span>
        )}
        {isLive && isNative && latencyMs > 5000 && (
          <button
            onClick={onSeekLive}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-[10px] font-semibold text-red-400 hover:bg-red-500/30 transition-colors"
          >
            <Radio className="w-3 h-3" />
            Go Live
          </button>
        )}
      </div>

      {/* Right: quality + network + share + pip + fullscreen */}
      <div className="flex items-center gap-2">
        {isNative && (
          <>
            <NetworkBadge quality={networkQuality} />
            {bitrateMbps > 0 && (
              <span className="text-[10px] text-white/30 font-mono tabular-nums hidden sm:inline">
                {bitrateMbps.toFixed(1)} Mbps
              </span>
            )}
            <button
              onClick={onToggleQuality}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${
                showQuality
                  ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                  : "bg-black/50 border-white/15 text-white/70 hover:text-white hover:border-white/25"
              } backdrop-blur-sm`}
            >
              <Settings className={`w-3 h-3 ${showQuality ? "text-sky-400" : ""}`} />
              <span>{isAuto ? "Auto" : currentQualityName}</span>
            </button>

            {/* Share */}
            <ShareButton onShare={onShare} />

            {/* PiP — only shown when the browser supports it */}
            {isPipSupported && (
              <PipButton isPip={isPip} onToggle={onTogglePip} />
            )}
          </>
        )}

        {/* Fullscreen button — always shown */}
        <FullscreenButton isFullscreen={isFullscreen} onToggle={onToggleFullscreen} />
      </div>
    </div>
  );
}

// ─── Share stream hook ─────────────────────────────────────────────────────────
//
// Builds the best shareable URL for the current stream and delivers it via:
//   1. Web Share API (native share sheet on mobile / supported desktops)
//   2. Clipboard copy fallback with a toast confirmation
//
// URL priority:
//   • isLive + youtubeVideoId → YouTube live watch URL
//   • youtubeVideoId           → standard YouTube watch URL
//   • otherwise                → current page URL (HLS/DASH direct stream)

function useShareStream(opts: {
  youtubeVideoId?: string | null;
  isLive?: boolean;
  title?: string;
}) {
  const { youtubeVideoId, isLive, title } = opts;

  const shareStream = useCallback(async () => {
    const shareTitle = title ?? "JCTM Temple TV";
    const shareText = isLive
      ? `Watch "${shareTitle}" live on JCTM Temple TV`
      : `Watch "${shareTitle}" on JCTM Temple TV`;

    // Build the best URL to share
    const url = youtubeVideoId
      ? `https://www.youtube.com/watch?v=${youtubeVideoId}`
      : window.location.href;

    // Try native Web Share API (mobile browsers, desktop Chrome/Edge 89+)
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url });
        return;
      } catch (err) {
        // User cancelled share sheet — no toast needed
        if ((err as DOMException)?.name === "AbortError") return;
        // Any other error: fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Stream link copied!", {
        description: url.length > 60 ? `${url.slice(0, 60)}…` : url,
        icon: <Link2 className="w-4 h-4 text-sky-400" />,
        duration: 3000,
      });
    } catch {
      toast.error("Could not copy link — please copy it manually.", {
        description: url,
        duration: 5000,
      });
    }
  }, [youtubeVideoId, isLive, title]);

  return { shareStream };
}

// ─── Fullscreen hook ──────────────────────────────────────────────────────────
//
// Strategy:
//   1. Try the native Fullscreen API (works in normal browser tabs and most
//      browsers that support it even inside iframes with allow="fullscreen").
//   2. If native API throws or is unavailable (sandboxed iframe, older Safari,
//      embedded preview panes), fall back to a CSS "pseudo-fullscreen" that
//      pins the container to the viewport with position:fixed + z-index max.
//
// The hook returns `isFullscreen` (true in either mode) and `isCssFullscreen`
// (true only when the CSS fallback is active) so the component can apply the
// correct inline styles.

function useFullscreen(containerRef: React.RefObject<HTMLElement | null>) {
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isCssFullscreen, setIsCssFullscreen] = useState(false);

  const isFullscreen = isNativeFullscreen || isCssFullscreen;

  // ── Sync native fullscreen state ──────────────────────────────────────────
  useEffect(() => {
    const onChange = () => {
      const active =
        !!document.fullscreenElement ||
        !!(document as any).webkitFullscreenElement;
      setIsNativeFullscreen(active);
      // When the browser exits native fullscreen (e.g. user presses Escape),
      // make sure our state follows.
      if (!active) setIsNativeFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // ── Escape key exits CSS fullscreen ───────────────────────────────────────
  useEffect(() => {
    if (!isCssFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsCssFullscreen(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [isCssFullscreen]);

  // ── Apply / remove CSS fullscreen styles imperatively on the element ──────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (isCssFullscreen) {
      // Store original inline style so we can restore it exactly on exit
      const orig = el.getAttribute("style") ?? "";
      el.dataset.origStyle = orig;
      el.style.cssText =
        "position:fixed!important;inset:0!important;" +
        "width:100vw!important;height:100vh!important;" +
        "z-index:2147483647!important;background:#000!important;" +
        "border-radius:0!important;overflow:hidden!important;";
      // Prevent body scroll while in CSS fullscreen
      document.body.style.overflow = "hidden";
    } else {
      // Restore original style
      const orig = el.dataset.origStyle ?? "";
      el.style.cssText = orig;
      delete el.dataset.origStyle;
      document.body.style.overflow = "";
    }
    return () => {
      // Safety cleanup if component unmounts while in CSS FS mode
      document.body.style.overflow = "";
    };
  }, [isCssFullscreen, containerRef]);

  // ── Toggle ────────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;

    // ── EXIT paths ──────────────────────────────────────────────────────────
    if (isCssFullscreen) {
      setIsCssFullscreen(false);
      return;
    }
    if (
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement
    ) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen)
          (document as any).webkitExitFullscreen();
      } catch { /* ignore */ }
      return;
    }

    // ── ENTER paths ─────────────────────────────────────────────────────────
    // 1. Try native API
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        return;                       // success — state updated by the event listener
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
        return;
      }
    } catch {
      // Native API blocked (sandboxed iframe / browser policy) → fall through
    }

    // 2. CSS pseudo-fullscreen fallback
    setIsCssFullscreen(true);
  }, [containerRef, isCssFullscreen]);

  return { isFullscreen, isCssFullscreen, toggleFullscreen };
}

// ─── Picture-in-Picture hook ──────────────────────────────────────────────────
//
// Wraps the Picture-in-Picture API for native <video> elements.
// Only available in browsers that support document.pictureInPictureEnabled.
// Safari uses the webkit-prefixed API with identical semantics.
//
// Returns:
//   isPipSupported — true when the browser can do PiP for video elements
//   isPip          — true while the video is currently in a PiP window
//   togglePip      — enter or exit PiP; safe to call even if unsupported

function usePictureInPicture(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [isPip, setIsPip] = useState(false);

  // Check browser support once on mount
  const isPipSupported =
    typeof document !== "undefined" &&
    ("pictureInPictureEnabled" in document
      ? (document as Document & { pictureInPictureEnabled: boolean }).pictureInPictureEnabled
      : typeof (HTMLVideoElement.prototype as any).webkitSetPresentationMode === "function");

  // Sync state with native PiP events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnter = () => setIsPip(true);
    const onLeave = () => setIsPip(false);

    video.addEventListener("enterpictureinpicture", onEnter);
    video.addEventListener("leavepictureinpicture", onLeave);
    // Safari webkit prefix
    video.addEventListener("webkitpresentationmodechanged", () => {
      setIsPip((video as any).webkitPresentationMode === "picture-in-picture");
    });

    return () => {
      video.removeEventListener("enterpictureinpicture", onEnter);
      video.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, [videoRef]);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      // Standard API (Chrome, Edge, Firefox)
      if ("pictureInPictureElement" in document) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await video.requestPictureInPicture();
        }
        return;
      }

      // Safari webkit prefix
      const webkitVideo = video as any;
      if (typeof webkitVideo.webkitSetPresentationMode === "function") {
        webkitVideo.webkitSetPresentationMode(
          webkitVideo.webkitPresentationMode === "picture-in-picture"
            ? "inline"
            : "picture-in-picture"
        );
      }
    } catch {
      // PiP blocked (e.g. video not playing yet, or browser policy)
    }
  }, [videoRef]);

  return { isPip, isPipSupported, togglePip };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StreamPlayer({
  hlsManifestUrl,
  dashManifestUrl,
  youtubeVideoId,
  isLive = false,
  title = "JCTM Temple TV",
  autoPlay = true,
  muted = false,
  preferredQuality,
  className = "",
  viewerCount = 0,
  onLoad,
  onError,
}: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showQuality, setShowQuality] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [networkQuality, setNetworkQuality] = useState<string>(detectNetworkQuality());
  const lastTapRef = useRef<number>(0);

  const { isFullscreen, isCssFullscreen, toggleFullscreen } = useFullscreen(containerRef);
  const { isPip, isPipSupported, togglePip } = usePictureInPicture(videoRef);
  const { shareStream } = useShareStream({ youtubeVideoId, isLive, title });

  // Build ordered source list
  const sources = buildStreamSources({
    hlsManifestUrl,
    dashManifestUrl,
    youtubeVideoId,
  });

  const {
    state,
    setQualityLevel,
    seekToLiveEdge,
    forceRetry,
    isUsingYoutube,
  } = useStreamPlayer({
    videoRef,
    sources,
    isLive,
    autoPlay,
    muted,
    preferredQuality,
    onStateChange: (s) => {
      if (s.playerState === "playing") onLoad?.();
      if (s.playerState === "error") onError?.(s.lastError ?? "Unknown error");
    },
  });

  // Update network quality every 10s
  useEffect(() => {
    const id = setInterval(() => setNetworkQuality(detectNetworkQuality()), 10_000);
    return () => clearInterval(id);
  }, []);

  // Keyboard shortcuts:
  //   F — toggle fullscreen  (Escape for CSS FS is handled inside useFullscreen)
  //   P — toggle picture-in-picture
  //   S — share stream
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        togglePip();
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        shareStream();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleFullscreen, togglePip, shareStream]);

  // Always show controls when in any fullscreen mode so the exit button is reachable
  useEffect(() => {
    if (isFullscreen) showControlsTemporarily();
  }, [isFullscreen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Controls auto-hide
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
      setShowQuality(false);
    }, 3000);
  }, []);

  const handleMouseMove = useCallback(() => {
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  const handleMouseLeave = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
      setShowQuality(false);
    }, 1500);
  }, []);

  // Double-click or double-tap to toggle fullscreen
  const handleDoubleClick = useCallback(() => {
    toggleFullscreen();
  }, [toggleFullscreen]);

  // Touch: single tap = show controls, double tap = fullscreen
  const handleTouchStart = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      toggleFullscreen();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      showControlsTemporarily();
    }
  }, [toggleFullscreen, showControlsTemporarily]);

  // If we're using YouTube (no HLS/DASH available), render the iframe
  const shouldUseYouTube = isUsingYoutube || (!hlsManifestUrl && !dashManifestUrl && youtubeVideoId);

  if (shouldUseYouTube && youtubeVideoId) {
    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full bg-black ${className} group`}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
      >
        <iframe
          src={buildYouTubeUrl(youtubeVideoId, "high", {
            autoplay: autoPlay,
            isLive,
            enableJsApi: true,
          })}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="eager"
          className="w-full h-full absolute inset-0 border-0"
          onLoad={onLoad}
        />

        {/*
          Fullscreen button — always rendered (pointer-events-auto) so it is
          reachable. Opacity transitions: hidden at rest, visible on hover OR
          whenever we are already in any fullscreen mode so the user can exit.
        */}
        <div
          className={`absolute bottom-3 right-3 z-20 flex items-center gap-2 transition-opacity duration-200 ${
            isFullscreen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 group-hover:opacity-100 pointer-events-auto"
          }`}
        >
          <ShareButton onShare={shareStream} />
          <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
        </div>

        {/* Fullscreen hint shown only in CSS fullscreen (no YouTube chrome visible) */}
        {isCssFullscreen && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/70 border border-white/15 text-[10px] font-semibold text-white/60 backdrop-blur-md">
              Press Esc or F to exit fullscreen
            </span>
          </div>
        )}

        {/* YouTube ABR badge + viewer count */}
        <div className="absolute bottom-3 left-3 pointer-events-none flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 border border-white/10 text-[10px] font-semibold text-white/50 backdrop-blur-md">
            <Tv2 className="w-3 h-3" />
            YouTube ABR
          </span>
          <ViewerCountBadge count={viewerCount} />
        </div>
      </div>
    );
  }

  // Native HLS/DASH player
  const { playerState, engine, quality, metrics, lastError, errorCount } = state;
  const bitrateMbps = metrics.currentBitrateBps / 1_000_000;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-black overflow-hidden ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onDoubleClick={handleDoubleClick}
      onClick={() => setShowQuality(false)}
    >
      {/* ── Video Element ─────────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        controls={false}
        preload="auto"
        title={title}
        aria-label={title}
      />

      {/* ── Status Overlays ──────────────────────────────────────────────── */}
      <StreamStatusOverlay
        playerState={playerState}
        engine={engine}
        lastError={lastError}
        onRetry={forceRetry}
      />

      {/* ── Recovery counter badge ────────────────────────────────────────── */}
      {errorCount > 0 && playerState !== "error" && (
        <div className="absolute top-3 left-3 pointer-events-none z-10">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] font-semibold text-amber-400 backdrop-blur-md">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Recovery #{errorCount}
          </span>
        </div>
      )}

      {/* ── CSS-fullscreen exit hint (top-center, only in CSS FS mode) ────── */}
      {isCssFullscreen && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/70 border border-white/15 text-[10px] font-semibold text-white/60 backdrop-blur-md">
            Press Esc or F to exit fullscreen
          </span>
        </div>
      )}

      {/* ── Controls Bar (auto-hide; always visible in fullscreen) ───────── */}
      <AnimatePresence>
        {(showControls || isFullscreen || playerState !== "playing") && playerState !== "error" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 pointer-events-none"
          >
            {/* Gradient scrim */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/70 to-transparent pointer-events-auto" />

            <div className="pointer-events-auto">
              <PlayerControls
                engine={engine}
                currentQualityName={quality.currentLevelName}
                isAuto={quality.isAuto}
                bufferedSeconds={metrics.bufferedSeconds}
                networkQuality={networkQuality}
                bitrateMbps={bitrateMbps}
                latencyMs={metrics.latencyMs}
                isLive={isLive}
                showQuality={showQuality}
                isFullscreen={isFullscreen}
                isPip={isPip}
                isPipSupported={isPipSupported}
                viewerCount={viewerCount}
                onToggleQuality={() => setShowQuality(p => !p)}
                onSeekLive={seekToLiveEdge}
                onToggleFullscreen={toggleFullscreen}
                onTogglePip={togglePip}
                onShare={shareStream}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Quality Selector Popup ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showQuality && quality.levels.length > 0 && (
          <QualitySelector
            levels={quality.levels}
            currentLevel={quality.currentLevel}
            isAuto={quality.isAuto}
            onSelect={setQualityLevel}
            onClose={() => setShowQuality(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Buffer Health Bar ──────────────────────────────────────────────── */}
      <BufferHealthBar health={metrics.bufferHealth} playerState={playerState} />

      {/* ── Engine/source label (always visible, top-right) ───────────────── */}
      {engine !== "idle" && engine !== "youtube" && playerState === "playing" && (
        <div className="absolute top-2 right-2 pointer-events-none z-10">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold tracking-wider uppercase backdrop-blur-md
            ${engine === "hls" ? "bg-sky-500/10 border-sky-500/20 text-sky-400/70"
            : engine === "dash" ? "bg-violet-500/10 border-violet-500/20 text-violet-400/70"
            : "bg-white/5 border-white/10 text-white/30"}`}>
            {engine === "hls" ? "LL-HLS" : engine === "dash" ? "DASH" : "Native"} · ABR
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Compact Stream Health Badge ─────────────────────────────────────────────

export function StreamHealthBadge({
  bufferHealth = 100,
  engine = "youtube",
  networkQuality = "fast",
}: {
  bufferHealth?: number;
  engine?: string;
  networkQuality?: string;
}) {
  const healthColor = bufferHealth > 70 ? "text-emerald-400" : bufferHealth > 40 ? "text-amber-400" : "text-red-400";
  const netIcons: Record<string, React.ReactNode> = {
    slow: <WifiOff className="w-3 h-3 text-red-400" />,
    medium: <Signal className="w-3 h-3 text-amber-400" />,
    fast: <Wifi className="w-3 h-3 text-emerald-400" />,
    ultra: <Zap className="w-3 h-3 text-sky-400" />,
  };

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 border border-white/10 text-[10px] font-semibold text-white/60 backdrop-blur-md">
      {netIcons[networkQuality] ?? netIcons["fast"]}
      <span className={healthColor}>{bufferHealth}%</span>
      <span className="text-white/30">·</span>
      <span className="uppercase text-white/40">{engine}</span>
    </span>
  );
}

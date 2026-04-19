import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Wifi, WifiOff, Zap, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { safeLocalGet, safeLocalSet } from "@/lib/utils";

export type StreamQuality = "low" | "high";

interface DualStreamToggleProps {
  quality: StreamQuality;
  onToggle: (q: StreamQuality) => void;
  className?: string;
}

export function DualStreamToggle({ quality, onToggle, className = "" }: DualStreamToggleProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center bg-muted rounded-full p-0.5 gap-0.5 border border-border">
        <button
          onClick={() => onToggle("low")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            quality === "low"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <WifiOff className="w-3.5 h-3.5" />
          <span>Low Data</span>
        </button>
        <button
          onClick={() => onToggle("high")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            quality === "high"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Tv className="w-3.5 h-3.5" />
          <span>HD</span>
        </button>
      </div>
      {quality === "low" && (
        <Badge variant="secondary" className="text-xs gap-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50">
          <Zap className="w-3 h-3" />
          Data Saver
        </Badge>
      )}
      {quality === "high" && (
        <Badge variant="secondary" className="text-xs gap-1 bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800/50">
          <Wifi className="w-3 h-3" />
          Full HD
        </Badge>
      )}
    </div>
  );
}

// ─── Network speed detection ──────────────────────────────────────────────────

type NetworkConnection = {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  saveData?: boolean;
} & EventTarget;

function detectNetworkQuality(): StreamQuality {
  if (typeof navigator === "undefined") return "high";
  const conn = (navigator as Navigator & { connection?: NetworkConnection }).connection;
  if (!conn) return "high";
  if (conn.saveData) return "low";
  const et = conn.effectiveType;
  if (et === "slow-2g" || et === "2g") return "low";
  return "high";
}

// Hook for managing stream quality with localStorage persistence
export function useStreamQuality() {
  const [quality, setQuality] = useState<StreamQuality>(() => {
    const stored = safeLocalGet("jctm-stream-quality");
    return stored === "low" || stored === "high" ? stored : "high";
  });

  const toggle = (q: StreamQuality) => {
    setQuality(q);
    safeLocalSet("jctm-stream-quality", q);
  };

  return { quality, toggle };
}

// Hook that auto-detects network quality via navigator.connection on mount and
// re-evaluates on connection change events.  An explicit user selection stored
// in localStorage always takes precedence over the auto-detected value.
export function useAdaptiveStreamQuality() {
  const [quality, setQuality] = useState<StreamQuality>(() => {
    const stored = safeLocalGet("jctm-stream-quality");
    if (stored === "low" || stored === "high") return stored;
    return detectNetworkQuality();
  });

  const toggle = useCallback((q: StreamQuality) => {
    setQuality(q);
    safeLocalSet("jctm-stream-quality", q);
  }, []);

  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: NetworkConnection }).connection;
    if (!conn || typeof conn.addEventListener !== "function") return;

    const onchange = () => {
      const stored = safeLocalGet("jctm-stream-quality");
      if (stored === "low" || stored === "high") return;
      setQuality(detectNetworkQuality());
    };

    conn.addEventListener("change", onchange);
    return () => conn.removeEventListener("change", onchange);
  }, []);

  return { quality, toggle };
}

// ─── YouTube embed URL builder ────────────────────────────────────────────────
//
// Options:
//   autoplay    — start playback immediately (use for modal/overlay players).
//   isLive      — when true, the vq quality hint is omitted.  YouTube's ABR
//                 engine handles adaptive bitrate on live streams internally;
//                 passing vq can interfere with the initial level selection.
//   enableJsApi — enables the YouTube iframe Player API so the page can receive
//                 postMessage events (onStateChange, onError) for error
//                 detection, retry, and analytics.  Defaults to true.

export interface YouTubeUrlOptions {
  autoplay?: boolean;
  isLive?: boolean;
  enableJsApi?: boolean;
}

export function buildYouTubeUrl(
  videoId: string,
  quality: StreamQuality,
  opts: YouTubeUrlOptions = {},
): string {
  const { autoplay = false, isLive = false, enableJsApi = true } = opts;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    autoplay: autoplay ? "1" : "0",
    controls: "1",
    enablejsapi: enableJsApi ? "1" : "0",
    fs: "1",
    // Live streams: omit vq — YouTube's internal ABR selects quality.
    // VOD: pass vq as a preference hint for the initial quality level.
    ...(isLive ? {} : quality === "low" ? { vq: "small" } : { vq: "hd1080" }),
    ...(origin ? { origin } : {}),
  });

  return `https://www.youtube.com/embed/${videoId}?${params}`;
}

// Compact quality badge shown inside dark player overlays
export function NetworkQualityBadge({ quality }: { quality: StreamQuality }) {
  return quality === "low" ? (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-500/30"
    >
      <Zap className="w-2.5 h-2.5" />
      Data Saver
    </motion.span>
  ) : (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-1 bg-sky-500/20 text-sky-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-sky-500/30"
    >
      <Wifi className="w-2.5 h-2.5" />
      HD
    </motion.span>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { Wifi, WifiOff, Zap, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

// Hook for managing stream quality with localStorage persistence
export function useStreamQuality() {
  const [quality, setQuality] = useState<StreamQuality>(() => {
    return (localStorage.getItem("jctm-stream-quality") as StreamQuality) ?? "high";
  });

  const toggle = (q: StreamQuality) => {
    setQuality(q);
    localStorage.setItem("jctm-stream-quality", q);
  };

  return { quality, toggle };
}

// YouTube embed URL builder that respects stream quality
export function buildYouTubeUrl(videoId: string, quality: StreamQuality): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    autoplay: "0",
    controls: "1",
    ...(quality === "low" ? { vq: "small" } : { vq: "hd1080" }),
    ...(origin ? { origin } : {}),
  });
  return `https://www.youtube.com/embed/${videoId}?${params}`;
}

/**
 * VideoDownloadButton — reusable download trigger for any YouTube video.
 *
 * Wraps MediaDownloadSheet and emits to the global MediaJobsPanel tracker
 * so every download appears in the floating progress panel automatically.
 *
 * Variants:
 *   "icon"       — circular icon button (for video overlay / TikTok-style sidebars)
 *   "button"     — small labelled button (for card footers / action rows)
 *   "inline"     — text+icon button matching the Watch Now style (for featured sections)
 *   "menu-item"  — plain text row (for dropdown menus)
 */

import { useState } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import MediaDownloadSheet from "./MediaDownloadSheet";
import { emitTrackJob } from "./MediaJobsPanel";

export interface VideoDownloadButtonProps {
  videoId: string;
  title?: string;
  thumbnailUrl?: string;
  duration?: number;
  variant?: "icon" | "button" | "inline" | "menu-item";
  className?: string;
  stopPropagation?: boolean;
}

export function VideoDownloadButton({
  videoId,
  title,
  thumbnailUrl,
  duration,
  variant = "icon",
  className,
  stopPropagation = true,
}: VideoDownloadButtonProps) {
  const [open, setOpen] = useState(false);

  function handleClick(e: React.MouseEvent) {
    if (stopPropagation) e.stopPropagation();
    setOpen(true);
  }

  return (
    <>
      {variant === "icon" && (
        <button
          onClick={handleClick}
          className={cn(
            "flex flex-col items-center gap-1 group",
            className,
          )}
          title="Download this teaching"
          aria-label="Download"
        >
          <div className="h-11 w-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg transition-all duration-200 group-hover:bg-violet-500/40">
            <Download className="h-5 w-5 text-white" />
          </div>
          <span className="text-white text-[10px] font-semibold drop-shadow">Save</span>
        </button>
      )}

      {variant === "button" && (
        <button
          onClick={handleClick}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold",
            "border border-border text-muted-foreground hover:text-primary hover:border-primary/40",
            "transition-all hover:scale-105",
            className,
          )}
          title="Download"
          aria-label="Download"
        >
          <Download className="h-3 w-3" />
          <span className="hidden sm:inline">Download</span>
        </button>
      )}

      {variant === "inline" && (
        <button
          onClick={handleClick}
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl",
            "bg-white/10 hover:bg-white/20 text-white text-sm font-semibold",
            "border border-white/10 transition-all duration-200",
            className,
          )}
          title="Download"
          aria-label="Download"
        >
          <Download className="h-4 w-4" />
          Download
        </button>
      )}

      {variant === "menu-item" && (
        <button
          onClick={handleClick}
          className={cn(
            "flex items-center gap-2.5 w-full px-3 py-2 text-xs",
            "hover:bg-muted/60 transition-colors text-left",
            className,
          )}
          title="Download"
          aria-label="Download"
        >
          <Download className="h-3.5 w-3.5 text-muted-foreground" />
          Download
        </button>
      )}

      <MediaDownloadSheet
        open={open}
        onClose={() => setOpen(false)}
        type="youtube_video"
        sourceId={videoId}
        title={title}
        thumbnailUrl={thumbnailUrl}
        duration={duration}
        onJobCreated={emitTrackJob}
      />
    </>
  );
}

/**
 * DownloadButton — Universal media download trigger for JCTM
 *
 * Compact button that opens the MediaDownloadSheet with pre-filled context.
 * Works for: sermons (YouTube audio/video), moments (YouTube audio/video),
 *            gallery images (direct download with watermark).
 */

import { useState } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import MediaDownloadSheet from "./MediaDownloadSheet";

export type DownloadMediaType = "youtube_audio" | "youtube_video" | "gallery_image";

export interface DownloadButtonProps {
  type: DownloadMediaType;
  sourceId: string;
  title?: string;
  thumbnailUrl?: string;
  duration?: number;
  variant?: "icon" | "compact" | "full";
  className?: string;
  iconClassName?: string;
}

export default function DownloadButton({
  type,
  sourceId,
  title,
  thumbnailUrl,
  duration,
  variant = "compact",
  className,
  iconClassName,
}: DownloadButtonProps) {
  const [open, setOpen] = useState(false);

  if (variant === "icon") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          aria-label="Download media"
          className={cn(
            "inline-flex items-center justify-center rounded-full",
            "w-9 h-9 text-white/80 hover:text-white",
            "bg-white/10 hover:bg-white/20 backdrop-blur-sm",
            "transition-all duration-200 active:scale-95",
            className,
          )}
        >
          <Download className={cn("h-4 w-4", iconClassName)} />
        </button>
        <MediaDownloadSheet
          open={open}
          onClose={() => setOpen(false)}
          type={type}
          sourceId={sourceId}
          title={title}
          thumbnailUrl={thumbnailUrl}
          duration={duration}
        />
      </>
    );
  }

  if (variant === "full") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2.5",
            "bg-primary text-white font-semibold text-sm",
            "hover:bg-primary/90 transition-all duration-200 active:scale-95",
            "shadow-sm",
            className,
          )}
        >
          <Download className="h-4 w-4" />
          Download
        </button>
        <MediaDownloadSheet
          open={open}
          onClose={() => setOpen(false)}
          type={type}
          sourceId={sourceId}
          title={title}
          thumbnailUrl={thumbnailUrl}
          duration={duration}
        />
      </>
    );
  }

  // compact (default)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-3 py-2",
          "bg-white/10 hover:bg-white/20 backdrop-blur-sm",
          "text-white text-xs font-medium",
          "transition-all duration-200 active:scale-95 border border-white/10",
          className,
        )}
      >
        <Download className={cn("h-3.5 w-3.5", iconClassName)} />
        <span>Download</span>
      </button>
      <MediaDownloadSheet
        open={open}
        onClose={() => setOpen(false)}
        type={type}
        sourceId={sourceId}
        title={title}
        thumbnailUrl={thumbnailUrl}
        duration={duration}
      />
    </>
  );
}

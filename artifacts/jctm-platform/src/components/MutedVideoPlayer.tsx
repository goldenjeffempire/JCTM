/**
 * MutedVideoPlayer — wraps YouTubeEmbed with a floating unmute overlay.
 *
 * Designed specifically for autoplay-muted loops. Shows a pulsing button in
 * the bottom-left corner of the video. On tap/click it sends a postMessage
 * `unMute` command to the YouTube iframe (works because enablejsapi=1 is
 * already set in every embed URL) and hides itself.
 */

import { useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { YouTubeEmbed, type YouTubeEmbedHandle, type YouTubeEmbedProps } from "@/components/YouTubeEmbed";

type MutedVideoPlayerProps = YouTubeEmbedProps & {
  /** Extra class on the outer wrapper div */
  wrapperClassName?: string;
};

export function MutedVideoPlayer({ wrapperClassName = "", ...embedProps }: MutedVideoPlayerProps) {
  const iframeRef = useRef<YouTubeEmbedHandle>(null);
  const [muted, setMuted] = useState(true);

  function toggleMute() {
    const iframe = iframeRef.current?.iframe;
    if (!iframe?.contentWindow) return;

    if (muted) {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "unMute", args: [] }),
        "https://www.youtube.com",
      );
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "setVolume", args: [100] }),
        "https://www.youtube.com",
      );
    } else {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "mute", args: [] }),
        "https://www.youtube.com",
      );
    }
    setMuted((prev) => !prev);
  }

  return (
    <div className={`relative ${wrapperClassName}`}>
      <YouTubeEmbed ref={iframeRef} {...embedProps} />

      {/* Floating mute/unmute button — only shown while video is in autoplay-muted mode */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute video" : "Mute video"}
        className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          background: muted
            ? "rgba(0,0,0,0.72)"
            : "rgba(220,38,38,0.85)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.18)",
        }}
      >
        {muted ? (
          <>
            <VolumeX className="h-3.5 w-3.5 shrink-0" />
            <span>Tap to unmute</span>
            {/* Pulsing dot to draw attention */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
          </>
        ) : (
          <>
            <Volume2 className="h-3.5 w-3.5 shrink-0" />
            <span>Mute</span>
          </>
        )}
      </button>
    </div>
  );
}

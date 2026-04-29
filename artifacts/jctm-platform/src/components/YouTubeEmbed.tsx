/**
 * YouTubeEmbed — Canonical, monetization-compliant YouTube iframe component.
 *
 * Single source of truth for every YouTube embed across the JCTM platform.
 * Always uses the official, monetized embed origin (youtube.com/embed) — never
 * youtube-nocookie, never proxied, never restreamed, never muted-autoplay-
 * hidden. Behaves the way YouTube expects so pre-roll/mid-roll ads can serve
 * normally on the official monetized channel.
 *
 * Two render modes:
 *
 *   facade  (default) — Show a high-quality YouTube thumbnail with a play
 *                       overlay. Iframe is only injected when the user clicks.
 *                       Best for monetization (pre-roll fires on user-initiated
 *                       playback) and best for performance (zero iframe weight
 *                       on initial load).
 *
 *   eager           — Iframe rendered immediately. Use only when the user has
 *                       already taken an explicit action that opens this view
 *                       (e.g. a modal, a dedicated /sermons/:id detail page,
 *                       the live-stream player after a "Watch Live" click).
 *
 * Both modes:
 *   - rel=0, modestbranding=1, iv_load_policy=3, playsinline=1
 *   - enablejsapi=1 (so the host page can listen for play/quartile events)
 *   - Permissions-Policy compliant `allow` attribute (autoplay, fullscreen, PIP)
 *   - Stable 16:9 aspect ratio container → zero CLS
 *   - Title / aria-label for screen readers
 *   - Optional VideoObject schema markup
 *
 * The component never sets mute=1 unless the caller explicitly opts in via
 * the `audioOnly` prop — we deliberately do not use the muted-autoplay
 * background-video pattern because (a) YouTube does not serve ads on muted
 * autoplay views and (b) it inflates LCP/CPU for no monetization benefit.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Play } from "lucide-react";
import { attachPlayerAnalytics, recordVideoEvent } from "@/lib/youtube-analytics";

// ─── Public types ────────────────────────────────────────────────────────────

export type YouTubeEmbedMode = "facade" | "eager";

export interface YouTubeEmbedProps {
  /** YouTube video ID (the 11-char string after `v=`). */
  videoId: string;
  /** Human-readable title — used for the iframe title attribute and a11y. */
  title: string;
  /** Defaults to the YouTube max-res thumbnail. */
  thumbnailUrl?: string | null;
  /** facade (default) or eager. */
  mode?: YouTubeEmbedMode;
  /** Autoplay once iframe is mounted. Defaults to true (user already clicked). */
  autoplay?: boolean;
  /** Render with audio muted. Only set true for explicit "audio-only" UIs. */
  audioOnly?: boolean;
  /** Loop the video — automatic when treated as a hero/promo loop. */
  loop?: boolean;
  /** Override aspect ratio (default 16/9). Pass "9/16" for vertical shorts. */
  aspectRatio?: string;
  /** Tailwind classes added to the root container. */
  className?: string;
  /** Tailwind classes added to the iframe element specifically. */
  iframeClassName?: string;
  /** When true, embed VideoObject schema markup inline. */
  emitSchema?: boolean;
  /** Optional structured fields used when emitSchema is true. */
  schema?: {
    description?: string;
    uploadDate?: string;
    duration?: string; // ISO-8601 PT#H#M#S
    publisherName?: string;
    publisherUrl?: string;
  };
  /** Override the analytics page key (defaults to window.location.pathname). */
  analyticsPage?: string;
  /** Disable client-side play analytics. */
  disableAnalytics?: boolean;
  /** Fired when the iframe DOM element loads. */
  onIframeLoad?: () => void;
  /** Fired when the user clicks the facade play button. */
  onPlay?: () => void;
}

export interface YouTubeEmbedHandle {
  iframe: HTMLIFrameElement | null;
  /** Programmatically activate playback (mounts the iframe in facade mode). */
  activate: () => void;
}

// ─── URL builder ─────────────────────────────────────────────────────────────

interface BuildUrlOpts {
  videoId: string;
  autoplay: boolean;
  audioOnly: boolean;
  loop: boolean;
}

function buildEmbedUrl({ videoId, autoplay, audioOnly, loop }: BuildUrlOpts): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    iv_load_policy: "3",
    cc_load_policy: "0",
    enablejsapi: "1",
    fs: "1",
    autoplay: autoplay ? "1" : "0",
    mute: audioOnly ? "1" : "0",
  });
  if (loop) {
    // YouTube requires a `playlist` param matching the video ID for loop to work
    params.set("loop", "1");
    params.set("playlist", videoId);
  }
  if (origin) {
    params.set("origin", origin);
    params.set("widget_referrer", origin);
  }
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

// ─── Schema markup ───────────────────────────────────────────────────────────

function VideoObjectSchema({
  videoId, title, thumbnailUrl, schema,
}: {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  schema?: YouTubeEmbedProps["schema"];
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": title,
    "thumbnailUrl": thumbnailUrl,
    "url":          `https://www.youtube.com/watch?v=${videoId}`,
    "embedUrl":     `https://www.youtube.com/embed/${videoId}`,
    "contentUrl":   `https://www.youtube.com/watch?v=${videoId}`,
    "inLanguage": "en-NG",
  };
  if (schema?.description) data.description = schema.description;
  if (schema?.uploadDate)  data.uploadDate  = schema.uploadDate;
  if (schema?.duration)    data.duration    = schema.duration;
  if (schema?.publisherName) {
    data.publisher = {
      "@type": "Organization",
      "name": schema.publisherName,
      ...(schema.publisherUrl ? { url: schema.publisherUrl } : {}),
    };
  }
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export const YouTubeEmbed = forwardRef<YouTubeEmbedHandle, YouTubeEmbedProps>(
  function YouTubeEmbed(props, ref) {
    const {
      videoId,
      title,
      thumbnailUrl,
      mode = "facade",
      autoplay = true,
      audioOnly = false,
      loop = false,
      aspectRatio = "16/9",
      className = "",
      iframeClassName = "",
      emitSchema = false,
      schema,
      analyticsPage,
      disableAnalytics = false,
      onIframeLoad,
      onPlay,
    } = props;

    const [activated, setActivated] = useState(mode === "eager");
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const sawImpressionRef = useRef(false);
    const titleId = useId();

    const resolvedThumbnail =
      thumbnailUrl && thumbnailUrl.length > 0
        ? thumbnailUrl
        : `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    const fallbackThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const activate = useCallback(() => {
      setActivated(true);
      onPlay?.();
    }, [onPlay]);

    useImperativeHandle(ref, () => ({
      get iframe() { return iframeRef.current; },
      activate,
    }), [activate]);

    // Re-mount iframe whenever videoId changes (e.g. carousel jumping cards)
    useEffect(() => {
      if (mode === "eager") setActivated(true);
      else setActivated(false);
      setIframeLoaded(false);
      sawImpressionRef.current = false;
    }, [videoId, mode]);

    // Impression tracking — once container enters the viewport, log it.
    useEffect(() => {
      if (disableAnalytics) return;
      const node = containerRef.current;
      if (!node || typeof IntersectionObserver === "undefined") return;
      const obs = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !sawImpressionRef.current) {
            sawImpressionRef.current = true;
            recordVideoEvent(videoId, "impression", analyticsPage);
            obs.disconnect();
            break;
          }
        }
      }, { threshold: 0.5 });
      obs.observe(node);
      return () => obs.disconnect();
    }, [videoId, disableAnalytics, analyticsPage]);

    // Wire YouTube postMessage analytics once iframe is mounted.
    useEffect(() => {
      if (!activated || disableAnalytics) return;
      const iframe = iframeRef.current;
      if (!iframe) return;
      const detach = attachPlayerAnalytics(iframe, videoId, analyticsPage);
      return detach;
    }, [activated, iframeLoaded, videoId, disableAnalytics, analyticsPage]);

    const allowAttr =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share";

    return (
      <div
        ref={containerRef}
        className={`relative w-full overflow-hidden bg-black ${className}`}
        style={{ aspectRatio }}
      >
        {emitSchema && (
          <VideoObjectSchema
            videoId={videoId}
            title={title}
            thumbnailUrl={resolvedThumbnail}
            schema={schema}
          />
        )}

        {!activated && (
          <button
            type="button"
            onClick={activate}
            className="group absolute inset-0 w-full h-full focus:outline-none focus-visible:ring-4 focus-visible:ring-red-500/60"
            aria-labelledby={titleId}
          >
            <span id={titleId} className="sr-only">{`Play video: ${title}`}</span>
            <img
              src={resolvedThumbnail}
              alt={title}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src !== fallbackThumbnail) img.src = fallbackThumbnail;
              }}
            />
            {/* Subtle vignette so the play button stays readable on bright stills */}
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/20" />
            {/* YouTube-style play button */}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex items-center justify-center h-16 w-24 sm:h-20 sm:w-28 rounded-2xl bg-red-600/95 shadow-2xl ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-110">
                <Play className="h-7 w-7 sm:h-9 sm:w-9 text-white fill-white" strokeWidth={1.5} />
              </span>
            </span>
            <span className="pointer-events-none absolute bottom-3 left-3 right-3 text-left text-white text-sm font-medium drop-shadow line-clamp-2">
              {title}
            </span>
          </button>
        )}

        {activated && (
          <>
            {!iframeLoaded && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-black"
                aria-hidden="true"
              >
                <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={buildEmbedUrl({ videoId, autoplay, audioOnly, loop })}
              title={title}
              aria-label={title}
              loading={mode === "eager" ? "eager" : "lazy"}
              allow={allowAttr}
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className={`absolute inset-0 w-full h-full border-0 ${iframeClassName}`}
              onLoad={() => {
                setIframeLoaded(true);
                onIframeLoad?.();
              }}
            />
          </>
        )}
      </div>
    );
  },
);

// ─── Convenience: stable thumbnail URL builder ───────────────────────────────

export function youtubeThumbnail(
  videoId: string,
  quality: "default" | "mqdefault" | "hqdefault" | "sddefault" | "maxresdefault" = "maxresdefault",
): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

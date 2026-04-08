import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronUp, ChevronDown, ExternalLink,
  Sparkles, Radio, Flame, Share2, BookOpen,
  Volume2, VolumeX,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface MomentItem {
  id: number;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  isLive?: boolean;
}

const GRADIENT_THEMES = [
  "from-[#003366] via-[#1a4a7a] to-[#0a2a4a]",
  "from-[#1a1a3e] via-[#2d1b69] to-[#0d0d2b]",
  "from-[#0a2a1a] via-[#1a4a2a] to-[#0d2010]",
  "from-[#2a0a0a] via-[#4a1a1a] to-[#1a0505]",
  "from-[#0a1a2a] via-[#1a2a4a] to-[#050d1a]",
  "from-[#1a0a2a] via-[#2a1a4a] to-[#0d0519]",
];

async function fetchShorts(): Promise<MomentItem[]> {
  const res = await fetch(`${BASE}/api/sermons/shorts`);
  if (!res.ok) throw new Error("Failed to fetch shorts");
  return res.json();
}

// ── Single card ────────────────────────────────────────────────────────────
// renderPlayer is true only for the active card ± 1 neighbour (saves memory)
function MomentCard({
  moment,
  index,
  total,
  muted,
  onToggleMute,
  renderPlayer,
}: {
  moment: MomentItem;
  index: number;
  total: number;
  muted: boolean;
  onToggleMute: () => void;
  renderPlayer: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const gradient = GRADIENT_THEMES[index % GRADIENT_THEMES.length]!;
  const ytUrl = `https://www.youtube.com/watch?v=${moment.videoId}`;
  // loop=1 repeats the video; playlist must equal videoId for single-video looping
  const embedSrc =
    `https://www.youtube.com/embed/${moment.videoId}` +
    `?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${moment.videoId}` +
    `&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;

  // Pump volume to 100 via IFrame API after player loads
  const handleLoad = () => {
    const pump = (n: number) => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "setVolume", args: [100] }),
        "*",
      );
      if (n < 6) setTimeout(() => pump(n + 1), 700);
    };
    setTimeout(() => pump(0), 400);
  };

  const handleShare = async () => {
    const data = { title: moment.title, text: `Watch: ${moment.title}`, url: ytUrl };
    if (navigator.share) {
      try { await navigator.share(data); } catch {}
    } else {
      await navigator.clipboard.writeText(ytUrl);
      toast.success("Link copied!");
    }
  };

  return (
    <div
      className={`relative w-full h-full flex-shrink-0 bg-gradient-to-b ${gradient} overflow-hidden`}
    >
      {/* Video layer */}
      {renderPlayer ? (
        <div className="absolute inset-0 bg-black">
          <iframe
            key={`${moment.videoId}-${muted}`}
            ref={iframeRef}
            src={embedSrc}
            title={moment.title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={handleLoad}
          />
          {/* Readability gradients */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 35%, transparent 60%)" }} />
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 25%)" }} />
        </div>
      ) : (
        /* Thumbnail placeholder for off-screen cards */
        <div className="absolute inset-0">
          <img
            src={moment.thumbnailUrl}
            alt={moment.title}
            className="w-full h-full object-cover opacity-35 scale-105"
            onError={e => {
              (e.target as HTMLImageElement).src =
                `https://img.youtube.com/vi/${moment.videoId}/hqdefault.jpg`;
            }}
          />
          <div className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.2) 100%)" }} />
        </div>
      )}

      {/* UI overlay — always on top */}
      <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
        {/* Top bar */}
        <div className="flex items-center justify-between p-4 pointer-events-auto">
          <div className="flex items-center gap-2">
            <img src="/jctm-logo-sm.jpeg" alt="JCTM"
              className="h-8 w-8 rounded-full object-cover border border-white/30 shadow" />
            <div>
              <p className="text-white text-xs font-bold drop-shadow">Temple TV · JCTM</p>
              <p className="text-white/55 text-[10px]">@templetvjctm</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {moment.isLive && (
              <Badge className="bg-red-500 text-white text-[10px] gap-1 animate-pulse border-0">
                <span className="h-1.5 w-1.5 rounded-full bg-white inline-block" />LIVE
              </Badge>
            )}
            <Badge className="bg-black/30 border-white/20 text-white text-[10px] backdrop-blur-sm">
              {index + 1} / {total}
            </Badge>
          </div>
        </div>

        <div className="flex-1" />

        {/* Bottom info */}
        <div className="p-4 space-y-3 pointer-events-auto">
          <div>
            <p className="text-white font-bold text-base leading-snug line-clamp-2 drop-shadow mb-1">
              {moment.title}
            </p>
            <div className="flex items-center gap-2">
              <Radio className="h-3 w-3 text-white/50 animate-pulse" />
              <p className="text-white/55 text-xs">
                {formatDistanceToNow(new Date(moment.publishedAt), { addSuffix: true })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleMute}
              className={`flex-1 h-9 rounded-xl backdrop-blur-md border flex items-center justify-center gap-2 text-white text-xs font-semibold transition-colors ${
                muted
                  ? "bg-white/10 border-white/20 hover:bg-white/20"
                  : "bg-accent/20 border-accent/30 hover:bg-accent/30"
              }`}
            >
              {muted
                ? <><VolumeX className="h-3.5 w-3.5" /> Tap to unmute</>
                : <><Volume2 className="h-3.5 w-3.5" /> Sound on</>}
            </button>
            <button
              onClick={handleShare}
              className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/25 transition-colors"
            ><Share2 className="h-3.5 w-3.5" /></button>
            <a href={ytUrl} target="_blank" rel="noopener noreferrer"
              className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/25 transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="flex items-center gap-1.5 text-white/25 text-[10px]">
            <Sparkles className="h-3 w-3" />
            <span>Jesus Christ Temple Ministry · Warri, Nigeria</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Moments() {
  const [moments, setMoments] = useState<MomentItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Refs for each card — used for programmatic scroll-into-view
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingProgrammatically = useRef(false);

  useEffect(() => {
    fetchShorts()
      .then(setMoments)
      .catch(() => toast.error("Could not load Moments"))
      .finally(() => setLoading(false));
  }, []);

  // IntersectionObserver — updates current as user scrolls (mobile scroll-snap)
  useEffect(() => {
    if (moments.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const idx = cardRefs.current.findIndex(ref => ref === entry.target);
            if (idx !== -1) setCurrent(idx);
          }
        });
      },
      { threshold: 0.5, root: scrollContainerRef.current },
    );
    cardRefs.current.forEach(ref => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, [moments]);

  // Scroll programmatically to a card (desktop arrows / keyboard)
  const scrollTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, moments.length - 1));
    isScrollingProgrammatically.current = true;
    cardRefs.current[clamped]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrent(clamped);
    setTimeout(() => { isScrollingProgrammatically.current = false; }, 600);
  }, [moments.length]);

  const goNext = useCallback(() => scrollTo(current + 1), [current, scrollTo]);
  const goPrev = useCallback(() => scrollTo(current - 1), [current, scrollTo]);
  const jumpTo = useCallback((i: number) => scrollTo(i), [scrollTo]);
  const toggleMute = useCallback(() => setMuted(m => !m), []);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      if (e.key === "m" || e.key === "M") toggleMute();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, toggleMute]);

  return (
    <Layout>
      {/* 
        Two-column layout on desktop, full-screen feed on mobile.
        The scroll container fills all available height below the navbar.
      */}
      <div className="flex h-[calc(100dvh-64px)] max-h-screen overflow-hidden">

        {/* ── Left sidebar — desktop only ── */}
        <div className="hidden lg:flex flex-col gap-4 w-72 p-6 border-r border-border/40 flex-shrink-0 overflow-y-auto">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow">
              <Flame className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold text-primary">Temple Moments</h1>
              <p className="text-xs text-muted-foreground">Temple TV · JCTM</p>
            </div>
          </div>
          {moments.length > 0 && (
            <Badge className="bg-primary/5 text-primary border-primary/10 text-xs w-fit">
              <BookOpen className="h-3 w-3 mr-1" />{moments.length} clips
            </Badge>
          )}
          <p className="text-xs text-muted-foreground">
            ↑ ↓ Arrow keys · Click arrows · Press M to mute
          </p>

          {/* Desktop nav arrows */}
          <div className="flex gap-2 mt-2">
            <button onClick={goPrev} disabled={current === 0}
              className="flex-1 h-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 transition-colors">
              <ChevronUp className="h-4 w-4" />
            </button>
            <button onClick={goNext} disabled={current === moments.length - 1}
              className="flex-1 h-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 transition-colors">
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Progress list — shows nearby clips */}
          {moments.length > 0 && (
            <div className="space-y-1.5 mt-2 flex-1 overflow-y-auto">
              {moments.map((m, i) => (
                <button key={m.videoId} onClick={() => jumpTo(i)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors truncate ${
                    i === current
                      ? "bg-accent/15 text-accent font-semibold border border-accent/25"
                      : "text-muted-foreground hover:bg-muted/40"
                  }`}>
                  {i + 1}. {m.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Video feed ── */}
        <div className="flex-1 relative flex flex-col min-w-0">

          {/* Mobile header strip */}
          <div className="lg:hidden flex items-center justify-between px-4 py-2 border-b border-border/20 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              <span className="text-sm font-bold text-primary">Temple Moments</span>
            </div>
            {moments.length > 0 && (
              <span className="text-xs text-muted-foreground">{current + 1} / {moments.length}</span>
            )}
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <Radio className="h-10 w-10 text-accent animate-spin" />
              <p className="text-muted-foreground text-sm">Loading Temple Moments…</p>
            </div>
          ) : moments.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <BookOpen className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">No moments yet. Sync sermons first.</p>
            </div>
          ) : (
            <>
              {/*
                Scroll-snap container — native mobile scroll.
                Each card snaps into position. No JS swipe handling needed.
                hide scrollbar but keep scrollability.
              */}
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-scroll"
                style={{
                  scrollSnapType: "y mandatory",
                  scrollbarWidth: "none",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {moments.map((moment, i) => (
                  <div
                    key={moment.videoId}
                    ref={el => { cardRefs.current[i] = el; }}
                    style={{ scrollSnapAlign: "start", height: "100%" }}
                    className="w-full flex-shrink-0"
                  >
                    <MomentCard
                      moment={moment}
                      index={i}
                      total={moments.length}
                      muted={muted}
                      onToggleMute={toggleMute}
                      renderPlayer={i === current}
                    />
                  </div>
                ))}
              </div>

              {/* Mobile nav arrows — float over the video, right side */}
              <div className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
                <button onClick={goPrev} disabled={current === 0}
                  className="h-11 w-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white disabled:opacity-20 hover:bg-black/60 transition-colors shadow-lg">
                  <ChevronUp className="h-5 w-5" />
                </button>
                <button onClick={goNext} disabled={current === moments.length - 1}
                  className="h-11 w-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white disabled:opacity-20 hover:bg-black/60 transition-colors shadow-lg">
                  <ChevronDown className="h-5 w-5" />
                </button>
              </div>

              {/* Mobile progress dots */}
              <div className="lg:hidden absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1">
                {moments.slice(0, 15).map((_, i) => (
                  <button key={i} onClick={() => jumpTo(i)}
                    className={`rounded-full transition-all duration-300 ${
                      i === current ? "h-5 w-1.5 bg-white" : "h-1.5 w-1.5 bg-white/30"
                    }`} />
                ))}
                {moments.length > 15 && (
                  <span className="text-white/40 text-[8px] text-center mt-0.5">
                    {moments.length - 15}+
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

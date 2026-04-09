import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronUp, ChevronDown, ExternalLink,
  Sparkles, Radio, Flame, Share2, BookOpen,
  Volume2, VolumeX, Heart, MessageCircle, Eye,
  ThumbsUp,
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
  viewCount?: number | null;
  isLive?: boolean;
}

interface YTStats {
  likeCount: number | null;
  commentCount: number | null;
  viewCount: number;
}

const GRADIENT_THEMES = [
  "from-[#003366] via-[#1a4a7a] to-[#0a2a4a]",
  "from-[#1a1a3e] via-[#2d1b69] to-[#0d0d2b]",
  "from-[#0a2a1a] via-[#1a4a2a] to-[#0d2010]",
  "from-[#2a0a0a] via-[#4a1a1a] to-[#1a0505]",
  "from-[#0a1a2a] via-[#1a2a4a] to-[#050d1a]",
  "from-[#1a0a2a] via-[#2a1a4a] to-[#0d0519]",
];

function formatCount(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

async function fetchShorts(): Promise<MomentItem[]> {
  const res = await fetch(`${BASE}/api/sermons/shorts`);
  if (!res.ok) throw new Error("Failed to fetch shorts");
  return res.json();
}

async function fetchYTStats(videoId: string): Promise<YTStats | null> {
  try {
    const res = await fetch(`${BASE}/api/sermons/youtube-stats/${videoId}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Single card ────────────────────────────────────────────────────────────
function MomentCard({
  moment,
  index,
  total,
  muted,
  onToggleMute,
  renderPlayer,
  isActive,
}: {
  moment: MomentItem;
  index: number;
  total: number;
  muted: boolean;
  onToggleMute: () => void;
  renderPlayer: boolean;
  isActive: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const gradient = GRADIENT_THEMES[index % GRADIENT_THEMES.length]!;
  const ytUrl = `https://www.youtube.com/watch?v=${moment.videoId}`;
  const ytCommentsUrl = `${ytUrl}&lc=`;
  const embedSrc =
    `https://www.youtube.com/embed/${moment.videoId}` +
    `?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${moment.videoId}` +
    `&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;

  const [stats, setStats] = useState<YTStats | null>(null);
  const [liked, setLiked] = useState(false);

  // Fetch YouTube stats when this card becomes active
  useEffect(() => {
    if (!isActive) return;
    fetchYTStats(moment.videoId).then(setStats);
  }, [isActive, moment.videoId]);

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
      toast.success("Link copied to clipboard!");
    }
  };

  const handleLike = () => {
    // Open YouTube where user can like — this makes the like reflect on YouTube
    window.open(ytUrl, "_blank", "noopener,noreferrer");
    // Optimistic UI feedback
    if (!liked) {
      setLiked(true);
      toast.success("Opening YouTube to like this video!");
    }
  };

  const handleComment = () => {
    // Open YouTube comments section
    window.open(ytCommentsUrl, "_blank", "noopener,noreferrer");
    toast.success("Opening YouTube comments!");
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
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.15) 40%, transparent 65%)" }} />
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 25%)" }} />
        </div>
      ) : (
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
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.2) 100%)" }} />
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

        {/* Spacer — pushes bottom content down */}
        <div className="flex-1" />

        {/* Right-side action buttons (TikTok-style) */}
        <div className="absolute right-4 bottom-32 flex flex-col items-center gap-5 pointer-events-auto z-20">

          {/* Like */}
          <button
            onClick={handleLike}
            className="flex flex-col items-center gap-1 group"
            title="Like on YouTube"
          >
            <div className={`h-11 w-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
              liked
                ? "bg-red-500/80 border border-red-400/50 scale-110"
                : "bg-black/40 backdrop-blur-md border border-white/20 group-hover:bg-red-500/40"
            }`}>
              <Heart className={`h-5 w-5 transition-colors ${liked ? "text-white fill-white" : "text-white"}`} />
            </div>
            <span className="text-white text-[10px] font-semibold drop-shadow">
              {formatCount(stats?.likeCount)}
            </span>
          </button>

          {/* Comment */}
          <button
            onClick={handleComment}
            className="flex flex-col items-center gap-1 group"
            title="Comment on YouTube"
          >
            <div className="h-11 w-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg transition-all duration-200 group-hover:bg-white/20">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <span className="text-white text-[10px] font-semibold drop-shadow">
              {formatCount(stats?.commentCount)}
            </span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-1 group"
            title="Share"
          >
            <div className="h-11 w-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg transition-all duration-200 group-hover:bg-white/20">
              <Share2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-white text-[10px] font-semibold drop-shadow">Share</span>
          </button>

          {/* Open on YouTube */}
          <a
            href={ytUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 group"
            title="Watch on YouTube"
          >
            <div className="h-11 w-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg transition-all duration-200 group-hover:bg-red-600/40">
              <ExternalLink className="h-5 w-5 text-white" />
            </div>
            <span className="text-white text-[10px] font-semibold drop-shadow">YouTube</span>
          </a>
        </div>

        {/* Bottom info */}
        <div className="p-4 pb-5 space-y-2 pointer-events-auto pr-20">
          <p className="text-white font-bold text-base leading-snug line-clamp-2 drop-shadow">
            {moment.title}
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Radio className="h-3 w-3 text-white/50 animate-pulse" />
              <p className="text-white/55 text-xs">
                {formatDistanceToNow(new Date(moment.publishedAt), { addSuffix: true })}
              </p>
            </div>
            {(stats?.viewCount != null && stats.viewCount > 0) && (
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3 text-white/40" />
                <span className="text-white/45 text-xs">{formatCount(stats.viewCount)} views</span>
              </div>
            )}
          </div>

          {/* Sound toggle */}
          <button
            onClick={onToggleMute}
            className={`h-9 px-4 rounded-xl backdrop-blur-md border flex items-center gap-2 text-white text-xs font-semibold transition-colors ${
              muted
                ? "bg-white/10 border-white/20 hover:bg-white/20"
                : "bg-accent/20 border-accent/30 hover:bg-accent/30"
            }`}
          >
            {muted
              ? <><VolumeX className="h-3.5 w-3.5" /> Tap to unmute</>
              : <><Volume2 className="h-3.5 w-3.5" /> Sound on</>}
          </button>

          <div className="flex items-center gap-1.5 text-white/20 text-[10px]">
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
  const [newVideoAlert, setNewVideoAlert] = useState(false);

  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingProgrammatically = useRef(false);

  const loadMoments = useCallback(() => {
    return fetchShorts()
      .then(data => {
        setMoments(data);
        setNewVideoAlert(false);
      })
      .catch(() => toast.error("Could not load Moments"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadMoments();
  }, [loadMoments]);

  // ── SSE listener — auto-refresh when new shorts are uploaded on YouTube
  useEffect(() => {
    const es = new EventSource(`${BASE}/api/sermons/stream`);

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { type?: string };
        if (msg.type === "new_sermon" || msg.type === "sync_complete") {
          // Show alert banner so user can tap to refresh (avoids disrupting current playback)
          setNewVideoAlert(true);
        }
      } catch {}
    };

    es.onerror = () => { /* silent — SSE reconnects automatically */ };

    return () => es.close();
  }, []);

  // IntersectionObserver — updates current as user scrolls
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
      <div className="flex h-[calc(100dvh-64px)] max-h-screen overflow-hidden">

        {/* ── Video feed ── */}
        <div className="flex-1 relative flex flex-col min-w-0">

          {/* Header strip */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/20 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              <span className="text-sm font-bold text-primary">Temple Moments</span>
            </div>
            <div className="flex items-center gap-3">
              {moments.length > 0 && (
                <span className="text-xs text-muted-foreground">{current + 1} / {moments.length}</span>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ThumbsUp className="h-3 w-3" />
                <span className="hidden sm:inline">Likes & comments reflect on YouTube</span>
              </div>
            </div>
          </div>

          {/* New video alert banner */}
          {newVideoAlert && (
            <button
              onClick={() => { setLoading(true); loadMoments(); }}
              className="flex-shrink-0 w-full bg-accent/90 text-white text-xs font-semibold py-2 px-4 flex items-center justify-center gap-2 hover:bg-accent transition-colors z-30"
            >
              <Sparkles className="h-3.5 w-3.5" />
              New video uploaded! Tap to refresh Moments
            </button>
          )}

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
                      renderPlayer={Math.abs(i - current) <= 1}
                      isActive={i === current}
                    />
                  </div>
                ))}
              </div>

              {/* Nav arrows — float left-center */}
              <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
                <button onClick={goPrev} disabled={current === 0}
                  className="h-9 w-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white disabled:opacity-20 hover:bg-black/60 transition-colors shadow-lg">
                  <ChevronUp className="h-4 w-4" />
                </button>

                {/* Progress dots */}
                <div className="flex flex-col gap-1 items-center py-1">
                  {moments.slice(0, 12).map((_, i) => (
                    <button key={i} onClick={() => jumpTo(i)}
                      className={`rounded-full transition-all duration-300 ${
                        i === current ? "h-4 w-1.5 bg-white" : "h-1.5 w-1.5 bg-white/30"
                      }`} />
                  ))}
                  {moments.length > 12 && (
                    <span className="text-white/40 text-[8px] text-center mt-0.5">
                      +{moments.length - 12}
                    </span>
                  )}
                </div>

                <button onClick={goNext} disabled={current === moments.length - 1}
                  className="h-9 w-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white disabled:opacity-20 hover:bg-black/60 transition-colors shadow-lg">
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

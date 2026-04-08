import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronUp, ChevronDown, ExternalLink,
  Sparkles, Radio, Flame, Share2, BookOpen, Play,
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

async function fetchMoments(): Promise<MomentItem[]> {
  const res = await fetch(`${BASE}/api/sermons?limit=30&offset=0`);
  if (!res.ok) throw new Error("Failed to fetch");
  const all: MomentItem[] = await res.json();
  return all.slice(0, 25);
}

// ── Single Moment Card ─────────────────────────────────────────────────────
// Each card IS the player — video autoplays, controls sit on top.
// Navigating away unmounts the iframe (stopping playback) and mounts next.
function MomentCard({
  moment, index, total, onPrev, onNext, onJump,
}: {
  moment: MomentItem;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onJump: (i: number) => void;
}) {
  const [started, setStarted] = useState(false);
  const gradient = GRADIENT_THEMES[index % GRADIENT_THEMES.length]!;
  const ytUrl = `https://www.youtube.com/watch?v=${moment.videoId}`;
  const embedSrc = moment.isLive
    ? `https://www.youtube.com/embed/${moment.videoId}?autoplay=1&rel=0&modestbranding=1`
    : `https://www.youtube.com/embed/${moment.videoId}?autoplay=1&rel=0&modestbranding=1`;

  const handleShare = async () => {
    const shareData = { title: moment.title, text: `Watch from Temple TV: ${moment.title}`, url: ytUrl };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      await navigator.clipboard.writeText(ytUrl);
      toast.success("Link copied!");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`relative w-full h-full flex flex-col overflow-hidden rounded-3xl bg-gradient-to-b ${gradient}`}
    >
      {/* ── Thumbnail shown before play ── */}
      {!started && (
        <div className="absolute inset-0 z-0">
          <img
            src={moment.thumbnailUrl}
            alt={moment.title}
            className="w-full h-full object-cover opacity-40 scale-105"
            onError={e => {
              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${moment.videoId}/hqdefault.jpg`;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
        </div>
      )}

      {/* ── YouTube iframe fills the full card once started ── */}
      {started && (
        <div className="absolute inset-0 z-0 rounded-3xl overflow-hidden bg-black">
          <iframe
            src={embedSrc}
            title="Temple TV"
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
          {/* Gradient overlay at bottom so text stays readable */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 30%, transparent 60%)",
          }} />
        </div>
      )}

      {/* ── All controls / info overlaid — always on top ── */}
      <div className="relative z-10 flex flex-col h-full pointer-events-none">

        {/* Top bar */}
        <div className="flex items-center justify-between p-4 pointer-events-auto">
          <div className="flex items-center gap-2">
            <img
              src="/jctm-logo-sm.jpeg"
              alt="JCTM"
              className="h-8 w-8 rounded-full object-cover border border-white/30 shadow"
            />
            <div>
              <p className="text-white text-xs font-bold leading-tight drop-shadow">Temple TV · JCTM</p>
              <p className="text-white/60 text-[10px]">@templetvjctm</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {moment.isLive && (
              <Badge className="bg-red-500 text-white text-[10px] gap-1 animate-pulse border-0">
                <span className="h-1.5 w-1.5 rounded-full bg-white inline-block" />
                LIVE
              </Badge>
            )}
            <Badge className="bg-black/30 border-white/20 text-white text-[10px] backdrop-blur-sm">
              {index + 1} / {total}
            </Badge>
          </div>
        </div>

        {/* Middle — tap-to-play when not started (doesn't interfere with iframe when playing) */}
        <div className="flex-1 flex items-center justify-center pointer-events-auto">
          {!started && (
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setStarted(true)}
              className="relative h-24 w-24 rounded-full bg-white/15 backdrop-blur-md border-2 border-white/35 flex flex-col items-center justify-center shadow-2xl gap-1"
            >
              <div className="absolute inset-0 rounded-full animate-ping opacity-15 bg-white" style={{ animationDuration: "2.2s" }} />
              <Play className="h-9 w-9 text-white fill-white ml-1.5 drop-shadow-lg" />
              <span className="text-white/70 text-[9px] font-semibold tracking-wide">TAP</span>
            </motion.button>
          )}
        </div>

        {/* Bottom info + actions */}
        <div className="p-4 space-y-3 pointer-events-auto">
          <div>
            <p className="text-white font-bold text-base leading-snug line-clamp-2 drop-shadow mb-1">{moment.title}</p>
            <p className="text-white/55 text-xs">
              {formatDistanceToNow(new Date(moment.publishedAt), { addSuffix: true })}
            </p>
          </div>

          {/* Action row */}
          <div className="flex items-center gap-2">
            {!started && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setStarted(true)}
                className="flex-1 h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center gap-1.5 text-white text-xs font-semibold hover:bg-white/25 transition-colors"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                {moment.isLive ? "Watch Live" : "Play Now"}
              </motion.button>
            )}
            {started && (
              <div className="flex-1 h-9 rounded-xl bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center gap-1.5 text-white/60 text-xs">
                <Radio className="h-3 w-3 animate-pulse" />
                Now Playing
              </div>
            )}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleShare}
              className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/25 transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" />
            </motion.button>
            <a
              href={ytUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/25 transition-colors"
              title="Open in YouTube"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="flex items-center gap-1.5 text-white/35 text-[10px]">
            <Sparkles className="h-3 w-3" />
            <span>Jesus Christ Temple Ministry · Warri, Nigeria</span>
          </div>
        </div>
      </div>

      {/* ── Right-side nav arrows — ALWAYS accessible, even while video plays ── */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onPrev}
          disabled={index === 0}
          className="h-11 w-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white disabled:opacity-25 hover:bg-black/60 transition-colors shadow-lg"
        >
          <ChevronUp className="h-5 w-5" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onNext}
          disabled={index === total - 1}
          className="h-11 w-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white disabled:opacity-25 hover:bg-black/60 transition-colors shadow-lg"
        >
          <ChevronDown className="h-5 w-5" />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Moments() {
  const [moments, setMoments] = useState<MomentItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMoments()
      .then(setMoments)
      .catch(() => toast.error("Could not load moments"))
      .finally(() => setLoading(false));
  }, []);

  // Navigate — unmounts current card (stops video) and mounts next
  const goNext = useCallback(() => {
    setCurrent(i => Math.min(i + 1, moments.length - 1));
  }, [moments.length]);

  const goPrev = useCallback(() => {
    setCurrent(i => Math.max(i - 1, 0));
  }, []);

  const jumpTo = useCallback((i: number) => {
    setCurrent(i);
  }, []);

  // Keyboard — works regardless of playback state
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  // Touch swipe — works regardless of playback state
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const diff = (e.changedTouches[0]?.clientY ?? 0) - touchStartY.current;
    if (diff < -55) goNext();
    else if (diff > 55) goPrev();
    touchStartY.current = null;
  };

  const current_moment = moments[current];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow">
              <Flame className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-primary leading-tight">Temple Moments</h1>
              <p className="text-xs text-muted-foreground">Sermons from Prophet Amos Evomobor · Temple TV</p>
            </div>
            <Badge className="ml-auto bg-primary/5 text-primary border-primary/10 text-xs">
              <BookOpen className="h-3 w-3 mr-1" />
              {moments.length} Messages
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Swipe up/down or use arrow keys to skip — even while a video is playing.
          </p>
        </motion.div>

        {/* Viewer */}
        <div
          ref={containerRef}
          className="relative select-none"
          style={{ height: "72vh", minHeight: 520, maxHeight: 800 }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {loading ? (
            <div className="w-full h-full rounded-3xl bg-gradient-to-b from-primary/10 to-primary/5 flex flex-col items-center justify-center gap-4">
              <Radio className="h-10 w-10 text-accent animate-spin" />
              <p className="text-muted-foreground text-sm">Loading Temple Moments…</p>
            </div>
          ) : moments.length === 0 ? (
            <div className="w-full h-full rounded-3xl glass-panel flex flex-col items-center justify-center gap-4">
              <BookOpen className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">No moments found. Sync sermons first.</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {current_moment && (
                // key on videoId ensures full remount (iframe stops) when navigating
                <motion.div key={current_moment.videoId} className="absolute inset-0">
                  <MomentCard
                    moment={current_moment}
                    index={current}
                    total={moments.length}
                    onPrev={goPrev}
                    onNext={goNext}
                    onJump={jumpTo}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Progress dots */}
        {moments.length > 0 && (
          <div className="flex justify-center gap-1.5 mt-4 flex-wrap">
            {moments.slice(0, 20).map((_, i) => (
              <button
                key={i}
                onClick={() => jumpTo(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current ? "w-6 bg-accent" : "w-1.5 bg-primary/20 hover:bg-primary/40"
                }`}
              />
            ))}
            {moments.length > 20 && (
              <span className="text-[10px] text-muted-foreground self-center">+{moments.length - 20}</span>
            )}
          </div>
        )}

        <div className="text-center mt-3 text-xs text-muted-foreground">
          ↑ ↓ Arrow keys · Swipe up/down — navigate any time
        </div>
      </div>
    </Layout>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, ChevronUp, ChevronDown, ExternalLink,
  Sparkles, Radio, Flame, Share2, BookOpen, X,
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

// ── Inline YouTube Player ──────────────────────────────────────────────────
function YouTubePlayer({ videoId, isLive, onClose }: { videoId: string; isLive?: boolean; onClose: () => void }) {
  const embedSrc = isLive
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`
    : `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 z-30 rounded-3xl overflow-hidden bg-black"
    >
      <iframe
        src={embedSrc}
        title="Temple TV"
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
      {/* Close / stop button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClose}
        className="absolute top-3 right-3 h-9 w-9 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-colors shadow-lg"
        title="Stop video"
      >
        <X className="h-4 w-4" />
      </motion.button>
    </motion.div>
  );
}

// ── Single Moment Card ─────────────────────────────────────────────────────
function MomentCard({
  moment, index, onPrev, onNext, total, playing, onPlay, onStopPlay,
}: {
  moment: MomentItem;
  index: number;
  onPrev: () => void;
  onNext: () => void;
  total: number;
  playing: boolean;
  onPlay: () => void;
  onStopPlay: () => void;
}) {
  const gradient = GRADIENT_THEMES[index % GRADIENT_THEMES.length]!;
  const ytUrl = `https://www.youtube.com/watch?v=${moment.videoId}`;

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
      key={moment.id}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`relative w-full h-full flex flex-col overflow-hidden rounded-3xl bg-gradient-to-b ${gradient}`}
    >
      {/* ── Inline YouTube player (shown when playing) ── */}
      <AnimatePresence>
        {playing && (
          <YouTubePlayer videoId={moment.videoId} isLive={moment.isLive} onClose={onStopPlay} />
        )}
      </AnimatePresence>

      {/* ── Thumbnail background (shown when not playing) ── */}
      {!playing && (
        <div className="absolute inset-0 overflow-hidden rounded-3xl">
          <img
            src={moment.thumbnailUrl}
            alt={moment.title}
            className="w-full h-full object-cover opacity-30 scale-110"
            onError={e => {
              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${moment.videoId}/hqdefault.jpg`;
            }}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/45 to-black/15" />
        </div>
      )}

      {/* ── Card content (header + play + info) — hidden while player is open ── */}
      {!playing && (
        <div className="relative z-10 flex flex-col h-full p-5">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <img
                src="/jctm-logo-sm.jpeg"
                alt="JCTM"
                className="h-8 w-8 rounded-full object-cover border border-white/30 shadow"
              />
              <div>
                <p className="text-white text-xs font-bold leading-tight">Temple TV · JCTM</p>
                <p className="text-white/50 text-[10px]">@templetvjctm</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {moment.isLive && (
                <Badge className="bg-red-500 text-white text-[10px] gap-1 animate-pulse border-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-white inline-block" />
                  LIVE
                </Badge>
              )}
              <Badge className="bg-white/10 border-white/20 text-white text-[10px]">
                {index + 1} / {total}
              </Badge>
            </div>
          </div>

          {/* Central play button — clicks to open inline player */}
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={onPlay}
              className="relative h-24 w-24 rounded-full bg-white/15 backdrop-blur-md border-2 border-white/35 flex items-center justify-center shadow-2xl cursor-pointer group"
              aria-label="Play video"
            >
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-full animate-ping opacity-15 bg-white" style={{ animationDuration: "2.2s" }} />
              <div className="absolute inset-0 rounded-full scale-110 opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-500 bg-white/5 rounded-full" />
              <Play className="h-10 w-10 text-white fill-white ml-1.5 drop-shadow-lg" />
            </motion.button>
            <p className="text-white/50 text-[11px] tracking-wide">Tap to play</p>
          </div>

          {/* Bottom info */}
          <div className="space-y-3">
            <div>
              <p className="text-white font-bold text-base leading-snug line-clamp-3 mb-1.5">{moment.title}</p>
              <p className="text-white/50 text-xs">
                {formatDistanceToNow(new Date(moment.publishedAt), { addSuffix: true })}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                onClick={onPlay}
                className="flex-1 h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center gap-1.5 text-white text-xs font-semibold hover:bg-white/25 transition-colors"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                {moment.isLive ? "Watch Live" : "Play Now"}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={handleShare}
                className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/25 transition-colors"
                title="Share"
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
      )}

      {/* ── Right-side nav arrows (always visible unless video covers them) ── */}
      {!playing && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onPrev}
            disabled={index === 0}
            className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white disabled:opacity-25 hover:bg-white/25 transition-colors"
          >
            <ChevronUp className="h-5 w-5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onNext}
            disabled={index === total - 1}
            className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white disabled:opacity-25 hover:bg-white/25 transition-colors"
          >
            <ChevronDown className="h-5 w-5" />
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Moments() {
  const [moments, setMoments] = useState<MomentItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    fetchMoments()
      .then(setMoments)
      .catch(() => toast.error("Could not load moments"))
      .finally(() => setLoading(false));
  }, []);

  const goNext = useCallback(() => {
    setPlaying(false);
    setCurrent(i => Math.min(i + 1, moments.length - 1));
  }, [moments.length]);

  const goPrev = useCallback(() => {
    setPlaying(false);
    setCurrent(i => Math.max(i - 1, 0));
  }, []);

  const jumpTo = useCallback((i: number) => {
    setPlaying(false);
    setCurrent(i);
  }, []);

  // Stop video when navigating away via keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (playing && e.key === "Escape") { setPlaying(false); return; }
      if (!playing) {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") goNext();
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") goPrev();
        if (e.key === " " || e.key === "Enter") setPlaying(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, playing]);

  // Touch/swipe — only when not playing
  const onTouchStart = (e: React.TouchEvent) => {
    if (playing) return;
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (playing || touchStartY.current === null) return;
    const diff = (e.changedTouches[0]?.clientY ?? 0) - touchStartY.current;
    if (diff < -60) goNext();
    else if (diff > 60) goPrev();
    touchStartY.current = null;
  };

  const current_moment = moments[current];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-2">
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
            Tap <strong>Play Now</strong> to watch right here. Swipe or use arrow keys to browse.
          </p>
        </motion.div>

        {/* Viewer */}
        <div
          ref={containerRef}
          className="relative"
          style={{ height: "72vh", minHeight: 520, maxHeight: 780 }}
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
              <p className="text-muted-foreground text-sm">No moments available. Sync sermons first.</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {current_moment && (
                <motion.div key={current_moment.id} className="absolute inset-0">
                  <MomentCard
                    moment={current_moment}
                    index={current}
                    onPrev={goPrev}
                    onNext={goNext}
                    total={moments.length}
                    playing={playing}
                    onPlay={() => setPlaying(true)}
                    onStopPlay={() => setPlaying(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Progress dots — hidden while playing to not distract */}
        {moments.length > 0 && !playing && (
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

        {/* Hint */}
        {!playing && (
          <div className="text-center mt-4 text-xs text-muted-foreground">
            ↑ ↓ Arrow keys · Space/Enter to play · Swipe on mobile
          </div>
        )}
      </div>
    </Layout>
  );
}

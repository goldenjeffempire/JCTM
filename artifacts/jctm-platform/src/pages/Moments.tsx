import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Volume2, VolumeX, ChevronUp, ChevronDown, ExternalLink,
  Sparkles, Radio, Flame, Share2, BookOpen,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
function MomentCard({
  moment, index, isActive, onPrev, onNext, total,
}: {
  moment: MomentItem;
  index: number;
  isActive: boolean;
  onPrev: () => void;
  onNext: () => void;
  total: number;
}) {
  const [muted, setMuted] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const gradient = GRADIENT_THEMES[index % GRADIENT_THEMES.length]!;
  const ytUrl = `https://www.youtube.com/watch?v=${moment.videoId}`;

  const handleShare = async () => {
    const data = { title: moment.title, text: `Watch this from Temple TV: ${moment.title}`, url: ytUrl };
    if (navigator.share) {
      try { await navigator.share(data); } catch {}
    } else {
      await navigator.clipboard.writeText(ytUrl);
      toast.success("Link copied to clipboard!");
    }
    setShowShare(false);
  };

  return (
    <motion.div
      key={moment.id}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`relative w-full h-full flex flex-col overflow-hidden rounded-3xl bg-gradient-to-b ${gradient}`}
    >
      {/* Thumbnail background */}
      <div className="absolute inset-0 overflow-hidden rounded-3xl">
        <img
          src={moment.thumbnailUrl}
          alt={moment.title}
          className="w-full h-full object-cover opacity-25 scale-110"
          onError={e => {
            (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${moment.videoId}/hqdefault.jpg`;
          }}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full p-5">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <img
              src="/jctm-logo-sm.jpeg"
              alt="JCTM"
              className="h-8 w-8 rounded-full object-cover border border-white/30"
            />
            <div>
              <p className="text-white text-xs font-bold leading-tight">Temple TV · JCTM</p>
              <p className="text-white/50 text-[10px]">@templetvjctm</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {moment.isLive && (
              <Badge className="bg-red-500 text-white text-[10px] gap-1 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-white inline-block" />
                LIVE
              </Badge>
            )}
            <Badge className="bg-white/10 border-white/20 text-white text-[10px] backdrop-blur-md">
              {index + 1} / {total}
            </Badge>
          </div>
        </div>

        {/* Central play area */}
        <div className="flex-1 flex items-center justify-center">
          <a href={ytUrl} target="_blank" rel="noopener noreferrer">
            <motion.div
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              className="relative h-20 w-20 rounded-full bg-white/15 backdrop-blur-md border-2 border-white/30 flex items-center justify-center shadow-2xl cursor-pointer"
            >
              <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-white" style={{ animationDuration: "2s" }} />
              <Play className="h-9 w-9 text-white fill-white ml-1" />
            </motion.div>
          </a>
        </div>

        {/* Bottom info */}
        <div className="space-y-3">
          <div>
            <p className="text-white font-bold text-base leading-snug line-clamp-3 mb-1.5">{moment.title}</p>
            <p className="text-white/50 text-xs">
              {formatDistanceToNow(new Date(moment.publishedAt), { addSuffix: true })}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <a href={ytUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button size="sm" className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl gap-1 text-xs h-9">
                <Play className="h-3.5 w-3.5 fill-white" />
                {moment.isLive ? "Join Live" : "Watch on YouTube"}
              </Button>
            </a>
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleShare}
              className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/25 transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" />
            </motion.button>
          </div>

          {/* Scripture tag */}
          <div className="flex items-center gap-1.5 text-white/40 text-[10px]">
            <Sparkles className="h-3 w-3" />
            <span>Jesus Christ Temple Ministry · Warri, Nigeria</span>
          </div>
        </div>
      </div>

      {/* Right-side navigation */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onPrev}
          disabled={index === 0}
          className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white disabled:opacity-30 hover:bg-white/25 transition-colors"
        >
          <ChevronUp className="h-5 w-5" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onNext}
          disabled={index === total - 1}
          className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white disabled:opacity-30 hover:bg-white/25 transition-colors"
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
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    fetchMoments()
      .then(setMoments)
      .catch(() => toast.error("Could not load moments"))
      .finally(() => setLoading(false));
  }, []);

  const goNext = useCallback(() => setCurrent(i => Math.min(i + 1, moments.length - 1)), [moments.length]);
  const goPrev = useCallback(() => setCurrent(i => Math.max(i - 1, 0)), []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") goNext();
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  // Touch/swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const diff = (e.changedTouches[0]?.clientY ?? 0) - touchStartY.current;
    if (diff < -50) goNext();
    else if (diff > 50) goPrev();
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
              <Flame className="h-4.5 w-4.5 text-white" />
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
            Swipe up/down or use arrow keys to navigate. Tap to watch on YouTube.
          </p>
        </motion.div>

        {/* Viewer */}
        <div
          ref={containerRef}
          className="relative"
          style={{ height: "72vh", minHeight: 500, maxHeight: 750 }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {loading ? (
            <div className="w-full h-full rounded-3xl bg-gradient-to-b from-primary/10 to-primary/5 flex flex-col items-center justify-center gap-4 animate-pulse">
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
                    isActive={true}
                    onPrev={goPrev}
                    onNext={goNext}
                    total={moments.length}
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
                onClick={() => setCurrent(i)}
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

        {/* Navigation hint */}
        <div className="text-center mt-4 text-xs text-muted-foreground">
          ↑ ↓ Arrow keys · Swipe on mobile
        </div>
      </div>
    </Layout>
  );
}

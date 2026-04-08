import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

// ── Single Moment Card ─────────────────────────────────────────────────────
function MomentCard({
  moment, index, total, muted, onToggleMute, onPrev, onNext,
}: {
  moment: MomentItem;
  index: number;
  total: number;
  muted: boolean;
  onToggleMute: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const gradient = GRADIENT_THEMES[index % GRADIENT_THEMES.length]!;
  const ytUrl = `https://www.youtube.com/watch?v=${moment.videoId}`;

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Set volume to maximum once the iframe player is ready
  const handleIframeLoad = () => {
    const trySetVolume = (attempt: number) => {
      if (!iframeRef.current) return;
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "setVolume", args: [100] }),
        "*",
      );
      // Retry a few times — the player may not be ready immediately
      if (attempt < 5) setTimeout(() => trySetVolume(attempt + 1), 800);
    };
    setTimeout(() => trySetVolume(0), 500);
  };

  // Muted param reflects live toggle; key change forces iframe reload with new mute state
  const embedSrc =
    `https://www.youtube.com/embed/${moment.videoId}` +
    `?autoplay=1&mute=${muted ? 1 : 0}&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;

  const handleShare = async () => {
    const shareData = { title: moment.title, text: `Watch: ${moment.title}`, url: ytUrl };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      await navigator.clipboard.writeText(ytUrl);
      toast.success("Link copied!");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -30 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`relative w-full h-full flex flex-col overflow-hidden rounded-3xl bg-gradient-to-b ${gradient}`}
    >
      {/* ── YouTube iframe fills the entire card — autoplays immediately ── */}
      {/* key includes muted so toggling mute reloads the iframe */}
      <div className="absolute inset-0 z-0 rounded-3xl overflow-hidden bg-black">
        <iframe
          key={`${moment.videoId}-${muted}`}
          ref={iframeRef}
          src={embedSrc}
          title={moment.title}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          onLoad={handleIframeLoad}
        />
        {/* Bottom gradient so text stays legible over the video */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.25) 35%, transparent 65%)",
          }}
        />
        {/* Top gradient for header legibility */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 25%)",
          }}
        />
      </div>

      {/* ── All UI overlaid on top of video ── */}
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

        {/* Spacer — middle is pure video, no overlay */}
        <div className="flex-1" />

        {/* Bottom info + actions */}
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

          {/* Action row */}
          <div className="flex items-center gap-2">
            {/* Mute toggle — TikTok style */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              onClick={onToggleMute}
              className={`flex-1 h-9 rounded-xl backdrop-blur-md border flex items-center justify-center gap-2 text-white text-xs font-semibold transition-colors ${
                muted
                  ? "bg-white/10 border-white/20 hover:bg-white/20"
                  : "bg-accent/20 border-accent/30 hover:bg-accent/30"
              }`}
            >
              {muted ? (
                <>
                  <VolumeX className="h-3.5 w-3.5" />
                  Tap to unmute
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5" />
                  Sound on
                </>
              )}
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

          <div className="flex items-center gap-1.5 text-white/30 text-[10px]">
            <Sparkles className="h-3 w-3" />
            <span>Jesus Christ Temple Ministry · Warri, Nigeria</span>
          </div>
        </div>
      </div>

      {/* ── Right-side nav arrows — always accessible ── */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onPrev}
          disabled={index === 0}
          className="h-11 w-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white disabled:opacity-20 hover:bg-black/60 transition-colors shadow-lg"
        >
          <ChevronUp className="h-5 w-5" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onNext}
          disabled={index === total - 1}
          className="h-11 w-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white disabled:opacity-20 hover:bg-black/60 transition-colors shadow-lg"
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
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    fetchShorts()
      .then(setMoments)
      .catch(() => toast.error("Could not load Moments"))
      .finally(() => setLoading(false));
  }, []);

  const goNext = useCallback(() => {
    setCurrent(i => Math.min(i + 1, moments.length - 1));
  }, [moments.length]);

  const goPrev = useCallback(() => {
    setCurrent(i => Math.max(i - 1, 0));
  }, []);

  const jumpTo = useCallback((i: number) => setCurrent(i), []);

  const toggleMute = useCallback(() => setMuted(m => !m), []);

  // Keyboard nav — always works
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

  // Swipe nav — always works
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

  const currentMoment = moments[current];

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
              <p className="text-xs text-muted-foreground">Short messages from Prophet Amos Evomobor · Temple TV</p>
            </div>
            {moments.length > 0 && (
              <Badge className="ml-auto bg-primary/5 text-primary border-primary/10 text-xs shrink-0">
                <BookOpen className="h-3 w-3 mr-1" />
                {moments.length} clips
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Swipe or use ↑ ↓ keys to skip · Press M to mute/unmute
          </p>
        </motion.div>

        {/* Player */}
        <div
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
              <p className="text-muted-foreground text-sm">No moments yet. Sync sermons first.</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {currentMoment && (
                <motion.div key={currentMoment.videoId} className="absolute inset-0">
                  <MomentCard
                    moment={currentMoment}
                    index={current}
                    total={moments.length}
                    muted={muted}
                    onToggleMute={toggleMute}
                    onPrev={goPrev}
                    onNext={goNext}
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
              <span className="text-[10px] text-muted-foreground self-center ml-1">+{moments.length - 20}</span>
            )}
          </div>
        )}

        <div className="text-center mt-3 text-xs text-muted-foreground">
          ↑ ↓ Arrow keys · Swipe · M to mute/unmute
        </div>
      </div>
    </Layout>
  );
}

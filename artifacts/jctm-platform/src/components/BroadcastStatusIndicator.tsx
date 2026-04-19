import { useState, useEffect, useRef, useCallback } from "react";
import { Tv2, Radio, PlayCircle, Clock, X, MessageSquare, Wifi, Users } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLivestreamStatus } from "@/hooks/useLivestreamStatus";
import { useLiveViewerCount } from "@/hooks/useLiveViewerCount";
import { LiveChat } from "@/components/LiveChat";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ─────────────────────────────────────────────────────────────────────

interface QueueItem {
  videoId: string;
  title: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (days > 0) return `${days}d ${remainingHours}h`;
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function buildEmbedUrl(videoId: string, isLive: boolean): string {
  const origin = typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : "";
  const base = `https://www.youtube.com/embed/${videoId}`;
  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
    origin: typeof window !== "undefined" ? window.location.origin : "",
    enablejsapi: "1",
    ...(isLive ? { mute: "0" } : { loop: "0" }),
  });
  return `${base}?${params.toString()}&origin=${origin}`;
}

// ─── useRebroadcastQueue — fetch recent sermons as fallback playback queue ─────

function useRebroadcastQueue(primaryVideoId: string | null): QueueItem[] {
  const [queue, setQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    if (!primaryVideoId) { setQueue([]); return; }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE}/api/sermons?limit=10`);
        if (!res.ok || cancelled) return;
        const data = await res.json() as { sermons?: { videoId: string; title: string }[] };
        const sermons = (data.sermons ?? [])
          .filter(s => s.videoId && s.videoId !== primaryVideoId)
          .slice(0, 8)
          .map(s => ({ videoId: s.videoId, title: s.title }));
        if (!cancelled) {
          setQueue([{ videoId: primaryVideoId, title: "" }, ...sermons]);
        }
      } catch {
        if (!cancelled && primaryVideoId) {
          setQueue([{ videoId: primaryVideoId, title: "" }]);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [primaryVideoId]);

  return queue;
}

// ─── useYouTubeEndDetector — listen for YouTube iframe onStateChange=0 ────────

function useYouTubeEndDetector(onEnded: () => void) {
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return;
      try {
        const data = JSON.parse(event.data as string) as { event?: string; info?: number };
        if (data.event === "onStateChange" && data.info === 0) {
          onEndedRef.current();
        }
      } catch {
        // Malformed postMessage — ignore
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);
}

// ─── Unified Player Modal ─────────────────────────────────────────────────────
//
// Single modal that morphs between Live, Scheduled Rebroadcast, and
// Continuous playback in-place, providing zero-downtime seamless transitions.

interface UnifiedPlayerModalProps {
  isLive: boolean;
  liveVideoId: string | null;
  liveTitle: string | null;
  rebroadcastVideoId: string | null;
  rebroadcastTitle: string | null;
  rebroadcastExpiresAt: string | null;
  rebroadcastMode?: "scheduled" | "continuous";
  viewerCount: number;
  onClose: () => void;
}

function UnifiedPlayerModal({
  isLive,
  liveVideoId,
  liveTitle,
  rebroadcastVideoId,
  rebroadcastTitle,
  rebroadcastExpiresAt,
  rebroadcastMode,
  viewerCount,
  onClose,
}: UnifiedPlayerModalProps) {
  const [mobileTab, setMobileTab] = useState<"video" | "chat">("video");
  const [queueIndex, setQueueIndex] = useState(0);
  const [timeDisplay, setTimeDisplay] = useState("");

  const rebroadcastQueue = useRebroadcastQueue(rebroadcastVideoId);

  // Advance queue when a video ends (rebroadcast / continuous mode)
  const handleVideoEnded = useCallback(() => {
    if (isLive) return;
    setQueueIndex(i => Math.min(i + 1, Math.max(0, rebroadcastQueue.length - 1)));
  }, [isLive, rebroadcastQueue.length]);

  useYouTubeEndDetector(handleVideoEnded);

  // Reset queue index when primary video changes
  useEffect(() => { setQueueIndex(0); }, [rebroadcastVideoId]);
  useEffect(() => { if (!isLive) setQueueIndex(0); }, [isLive]);

  // Countdown ticker — only for scheduled rebroadcast
  useEffect(() => {
    if (!rebroadcastExpiresAt || rebroadcastMode === "continuous") return;
    const update = () => setTimeDisplay(formatTimeRemaining(rebroadcastExpiresAt));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [rebroadcastExpiresAt, rebroadcastMode]);

  const currentVideoId = isLive
    ? (liveVideoId ?? "f7TOxaM2Mq4")
    : rebroadcastQueue[queueIndex]?.videoId ?? rebroadcastVideoId ?? "f7TOxaM2Mq4";

  const currentTitle = isLive
    ? (liveTitle ?? "Holy Spirit Sunday Service — Live")
    : rebroadcastQueue[queueIndex]?.title || rebroadcastTitle || "Service Rebroadcast — JCTM";

  const embedSrc = buildEmbedUrl(currentVideoId, isLive);

  // Header accent colours
  const headerDot = isLive ? "bg-red-500" : rebroadcastMode === "continuous" ? "bg-indigo-400" : "bg-amber-500";
  const headerDotPing = isLive ? "animate-ping" : "";
  const modeLabel = isLive
    ? null
    : rebroadcastMode === "continuous"
    ? <span className="text-indigo-300/70 text-xs flex items-center gap-1"><Tv2 className="h-3 w-3" />Temple TV — Now Playing</span>
    : timeDisplay
    ? <span className="text-amber-400/70 text-xs flex items-center gap-1"><Clock className="h-3 w-3" />{timeDisplay} remaining</span>
    : null;

  return (
    <motion.div
      key="unified-player-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[500] flex flex-col sm:items-center sm:justify-center bg-black/90 backdrop-blur-sm sm:p-3 md:p-5 lg:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        className={[
          "relative w-full flex flex-col overflow-hidden shadow-2xl",
          "h-full rounded-t-2xl border-t border-white/10",
          isLive
            ? "sm:h-[88vh] sm:max-h-[88vh] sm:max-w-5xl lg:max-w-6xl"
            : "sm:h-[80vh] sm:max-h-[80vh] sm:max-w-4xl",
          "sm:rounded-3xl sm:border sm:border-white/10 bg-[#0a0a0a]",
        ].join(" ")}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header — morphs between Live / Rebroadcast / Continuous ──────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isLive ? "live-header" : `rb-header-${rebroadcastMode}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[#0a0a0a] flex items-center justify-between px-4 py-3 shrink-0 border-b border-white/10"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {isLive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />}
                <span className={`relative inline-flex rounded-full h-full w-full ${headerDot} ${headerDotPing}`} />
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-white font-bold text-sm truncate">{currentTitle}</span>
                {modeLabel}
              </div>
            </div>
            {isLive && (
              <div className="hidden sm:flex items-center gap-1.5 mr-2 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/70">
                <Users className="h-3.5 w-3.5" />
                <span className="tabular-nums">{viewerCount}</span>
                <span className="hidden lg:inline">watching</span>
              </div>
            )}
            {/* Queue navigation — rebroadcast + continuous modes */}
            {!isLive && rebroadcastQueue.length > 1 && (
              <div className="flex items-center gap-1 mr-2">
                <button
                  onClick={() => setQueueIndex(i => Math.max(0, i - 1))}
                  disabled={queueIndex === 0}
                  className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center text-white/70 text-xs font-bold transition-colors touch-manipulation"
                  aria-label="Previous video"
                >‹</button>
                <span className="text-white/40 text-[10px] font-medium min-w-[2.5rem] text-center">
                  {queueIndex + 1} / {rebroadcastQueue.length}
                </span>
                <button
                  onClick={() => setQueueIndex(i => Math.min(rebroadcastQueue.length - 1, i + 1))}
                  disabled={queueIndex >= rebroadcastQueue.length - 1}
                  className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center text-white/70 text-xs font-bold transition-colors touch-manipulation"
                  aria-label="Next video"
                >›</button>
              </div>
            )}
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-colors touch-manipulation shrink-0"
              aria-label="Close player"
            >
              <X className="h-4 w-4 text-white/70" />
            </button>
          </motion.div>
        </AnimatePresence>

        {/* ── Mobile Tab Switcher (Live only) ─────────────────────────────── */}
        {isLive && (
          <div className="flex md:hidden bg-[#111] border-b border-white/10 shrink-0">
            <button
              onClick={() => setMobileTab("video")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors touch-manipulation ${
                mobileTab === "video" ? "text-white border-b-2 border-red-500" : "text-white/40"
              }`}
            >
              <Tv2 className="w-4 h-4" /> Watch
              {viewerCount > 0 && mobileTab !== "video" && (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums">{viewerCount}</span>
              )}
            </button>
            <button
              onClick={() => setMobileTab("chat")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors touch-manipulation ${
                mobileTab === "chat" ? "text-white border-b-2 border-sky-500" : "text-white/40"
              }`}
            >
              <MessageSquare className="w-4 h-4" /> Live Chat
              {viewerCount > 0 && mobileTab !== "chat" && (
                <span className="rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] tabular-nums">{viewerCount}</span>
              )}
            </button>
          </div>
        )}

        {/* ── Main Content — iframe morphs seamlessly ──────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden bg-[#0d0d0d]">
          <div
            className={[
              "flex-col flex-1 bg-black min-w-0 min-h-0 relative",
              !isLive || mobileTab === "video" ? "flex" : "hidden",
              "md:flex",
            ].join(" ")}
          >
            <AnimatePresence mode="wait">
              <motion.iframe
                key={`${currentVideoId}-${isLive ? "live" : rebroadcastMode ?? "rb"}`}
                src={embedSrc}
                title={currentTitle}
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="w-full h-full absolute inset-0"
                style={{ minHeight: 0, border: "none" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              />
            </AnimatePresence>
          </div>

          {/* Chat pane (Live only) */}
          {isLive && (
            <div
              className={[
                "flex-col border-l border-white/10 bg-[#111]",
                mobileTab === "chat" ? "flex w-full" : "hidden",
                "md:flex md:w-72 lg:w-80 xl:w-96 md:flex-shrink-0",
              ].join(" ")}
            >
              <LiveChat isLive={true} embedded={true} externalViewerCount={viewerCount} />
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Indicator Component ─────────────────────────────────────────────────

export function BroadcastStatusIndicator() {
  const status = useLivestreamStatus();
  const [showPlayer, setShowPlayer] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [timeDisplay, setTimeDisplay] = useState("");
  const prevRef = useRef({ isLive: false, mode: undefined as string | undefined });
  const viewerCount = useLiveViewerCount(showPlayer && status.isLive);

  const { rebroadcast } = status;
  const isContinuous = rebroadcast.available && rebroadcast.mode === "continuous";
  const isScheduled  = rebroadcast.available && rebroadcast.mode === "scheduled";
  const isActive = status.isLive || rebroadcast.available;

  // Dismiss logic:
  //   • Live starts          → always re-show (critical event)
  //   • Scheduled activates  → re-show (post-service window opens)
  //   • Continuous changes   → do NOT re-show (always-on ambient; user may have dismissed)
  useEffect(() => {
    const prev = prevRef.current;
    const wentLive = !prev.isLive && status.isLive;
    const becameScheduled = prev.mode !== "scheduled" && isScheduled;
    if (wentLive || becameScheduled) setDismissed(false);
    prevRef.current = { isLive: status.isLive, mode: rebroadcast.mode };
  }, [status.isLive, isScheduled, rebroadcast.mode]);

  // Close modal if nothing is playing at all
  useEffect(() => {
    if (showPlayer && !status.isLive && !rebroadcast.available) {
      setShowPlayer(false);
    }
  }, [showPlayer, status.isLive, rebroadcast.available]);

  // Countdown ticker — only for scheduled rebroadcast
  useEffect(() => {
    if (!isScheduled || !rebroadcast.expiresAt) { setTimeDisplay(""); return; }
    const update = () => setTimeDisplay(formatTimeRemaining(rebroadcast.expiresAt!));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [isScheduled, rebroadcast.expiresAt]);

  const liveVideoId = status.videoId;
  const rebroadcastVideoId = rebroadcast.videoId;

  // ── IDLE: library is empty or not yet loaded ──────────────────────────────
  if (!isActive) {
    return (
      <div className="fixed top-[4.5rem] right-3 sm:right-4 z-[200]">
        <a
          href="https://www.youtube.com/@templetvjctm"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="JCTM Temple TV on YouTube"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full
            bg-black/20 dark:bg-white/5 border border-white/10
            text-white/25 hover:text-white/50 hover:bg-black/40 hover:border-white/20
            transition-all duration-300 backdrop-blur-md cursor-pointer select-none
            text-[10px] font-semibold tracking-widest uppercase"
        >
          <Tv2 className="h-3 w-3 shrink-0 opacity-50" />
          <span className="hidden sm:inline">Temple TV</span>
          <Wifi className="h-2.5 w-2.5 shrink-0 opacity-40" />
        </a>
      </div>
    );
  }

  // ── DISMISSED: Compact pull tab ───────────────────────────────────────────
  if (dismissed) {
    return (
      <>
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          onClick={() => setDismissed(false)}
          aria-label={status.isLive ? "Rejoin Holy Spirit Sunday Service — Live" : "Reopen player"}
          className={[
            "fixed top-[4.5rem] right-0 z-[200]",
            "flex items-center gap-1.5 pl-3 pr-2 py-2",
            "rounded-l-full border-l border-t border-b shadow-lg",
            "text-[11px] font-bold tracking-wide cursor-pointer select-none",
            "backdrop-blur-md transition-all duration-200 touch-manipulation",
            status.isLive
              ? "bg-red-600 border-red-400/40 text-white hover:bg-red-500"
              : isScheduled
              ? "bg-amber-600 border-amber-400/40 text-white hover:bg-amber-500"
              : "bg-indigo-600/80 border-indigo-400/30 text-white/90 hover:bg-indigo-600",
          ].join(" ")}
        >
          {status.isLive ? (
            <>
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-full w-full bg-white" />
              </span>
              <span className="hidden sm:inline">LIVE</span>
            </>
          ) : isScheduled ? (
            <>
              <PlayCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">RB</span>
            </>
          ) : (
            <>
              <Tv2 className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span className="hidden sm:inline">TV</span>
            </>
          )}
        </motion.button>

        <AnimatePresence>
          {showPlayer && (
            <UnifiedPlayerModal
              key="unified-modal"
              isLive={status.isLive}
              liveVideoId={liveVideoId}
              liveTitle={status.title}
              rebroadcastVideoId={rebroadcastVideoId}
              rebroadcastTitle={rebroadcast.title}
              rebroadcastExpiresAt={rebroadcast.expiresAt}
              rebroadcastMode={rebroadcast.mode}
              viewerCount={viewerCount}
              onClose={() => setShowPlayer(false)}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // ── ACTIVE: Full floating pill indicator ──────────────────────────────────
  return (
    <>
      <AnimatePresence mode="wait">

        {/* 🔴 LIVE */}
        {status.isLive && (
          <motion.div
            key="live-indicator"
            initial={{ opacity: 0, scale: 0.85, x: 24 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.85, x: 24 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="fixed top-[4.5rem] right-3 sm:right-4 z-[200] flex flex-col items-end gap-1.5 max-w-[min(calc(100vw-1.5rem),340px)]"
          >
            <div className="flex items-center gap-0 rounded-full shadow-xl overflow-hidden border border-red-400/30 bg-red-600">
              <button
                onClick={() => setShowPlayer(true)}
                className="flex items-center gap-2 pl-3 pr-2 py-2 cursor-pointer touch-manipulation"
                aria-label="Watch Holy Spirit Sunday Service — Live"
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-70" />
                  <span className="relative inline-flex rounded-full h-full w-full bg-white" />
                </span>
                <span className="text-white text-[11px] sm:text-xs font-bold tracking-widest uppercase leading-none whitespace-nowrap">
                  🔴 Holy Spirit Sunday Service — Live
                </span>
                {viewerCount > 0 && (
                  <span className="hidden sm:flex items-center gap-1 text-white/70 text-[10px] font-semibold">
                    <Users className="h-3 w-3" />
                    <span className="tabular-nums">{viewerCount}</span>
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowPlayer(true)}
                className="bg-white text-red-600 text-[10px] sm:text-xs font-extrabold px-2.5 sm:px-3 py-2 hover:bg-red-50 active:scale-95 transition-all touch-manipulation whitespace-nowrap leading-none"
              >
                Live Now
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="flex items-center justify-center w-7 h-full bg-red-700/60 hover:bg-red-800/80 active:bg-red-900 transition-colors touch-manipulation px-1.5"
                aria-label="Dismiss indicator"
              >
                <X className="h-3 w-3 text-white/80" />
              </button>
            </div>
            {status.title && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/70 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 max-w-full"
              >
                <p className="text-white/80 text-[10px] sm:text-[11px] font-medium truncate leading-snug">
                  {status.title}
                </p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* 📺 SCHEDULED REBROADCAST */}
        {!status.isLive && isScheduled && (
          <motion.div
            key="rebroadcast-indicator"
            initial={{ opacity: 0, scale: 0.85, x: 24 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.85, x: 24 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="fixed top-[4.5rem] right-3 sm:right-4 z-[200] flex flex-col items-end gap-1.5 max-w-[min(calc(100vw-1.5rem),340px)]"
          >
            <div className="flex items-center gap-0 rounded-full shadow-xl overflow-hidden border border-amber-400/30 bg-amber-600">
              <button
                onClick={() => setShowPlayer(true)}
                className="flex items-center gap-2 pl-3 pr-2 py-2 cursor-pointer touch-manipulation"
                aria-label="Watch rebroadcast service"
              >
                <PlayCircle className="h-3.5 w-3.5 text-white/90 shrink-0" />
                <span className="text-white text-[11px] sm:text-xs font-bold tracking-widest uppercase leading-none whitespace-nowrap">
                  📺 Rebroadcast
                </span>
                {timeDisplay && (
                  <span className="hidden sm:flex items-center gap-0.5 text-white/60 text-[10px] font-medium">
                    <Clock className="h-2.5 w-2.5" />
                    {timeDisplay}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowPlayer(true)}
                className="bg-white text-amber-700 text-[10px] sm:text-xs font-extrabold px-2.5 sm:px-3 py-2 hover:bg-amber-50 active:scale-95 transition-all touch-manipulation whitespace-nowrap leading-none"
              >
                Watch
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="flex items-center justify-center w-7 h-full bg-amber-700/60 hover:bg-amber-800/80 active:bg-amber-900 transition-colors touch-manipulation px-1.5"
                aria-label="Dismiss indicator"
              >
                <X className="h-3 w-3 text-white/80" />
              </button>
            </div>
            {rebroadcast.title && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/70 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 max-w-full"
              >
                <p className="text-white/80 text-[10px] sm:text-[11px] font-medium truncate leading-snug">
                  {rebroadcast.title}
                </p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* 📺 CONTINUOUS / NOW PLAYING — subtle ambient indicator */}
        {!status.isLive && isContinuous && (
          <motion.div
            key="continuous-indicator"
            initial={{ opacity: 0, scale: 0.9, x: 24 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 24 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed top-[4.5rem] right-3 sm:right-4 z-[200] flex flex-col items-end gap-1.5 max-w-[min(calc(100vw-1.5rem),320px)]"
          >
            <div className="flex items-center gap-0 rounded-full shadow-lg overflow-hidden border border-indigo-400/20 bg-indigo-700/80 backdrop-blur-sm">
              <button
                onClick={() => setShowPlayer(true)}
                className="flex items-center gap-2 pl-3 pr-2 py-1.5 cursor-pointer touch-manipulation"
                aria-label="Watch now playing"
              >
                <Tv2 className="h-3 w-3 text-indigo-200/80 shrink-0" />
                <span className="text-indigo-100 text-[10px] sm:text-[11px] font-semibold tracking-wide leading-none whitespace-nowrap opacity-90">
                  Now Playing
                </span>
              </button>
              <button
                onClick={() => setShowPlayer(true)}
                className="bg-white/15 hover:bg-white/25 text-white text-[10px] font-bold px-2.5 py-1.5 active:scale-95 transition-all touch-manipulation whitespace-nowrap leading-none"
              >
                Watch
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="flex items-center justify-center w-6 h-full bg-indigo-900/40 hover:bg-indigo-900/70 transition-colors touch-manipulation px-1"
                aria-label="Dismiss indicator"
              >
                <X className="h-2.5 w-2.5 text-white/60" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Unified Video Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showPlayer && isActive && (
          <UnifiedPlayerModal
            key="unified-modal"
            isLive={status.isLive}
            liveVideoId={liveVideoId}
            liveTitle={status.title}
            rebroadcastVideoId={rebroadcastVideoId}
            rebroadcastTitle={rebroadcast.title}
            rebroadcastExpiresAt={rebroadcast.expiresAt}
            rebroadcastMode={rebroadcast.mode}
            viewerCount={viewerCount}
            onClose={() => setShowPlayer(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

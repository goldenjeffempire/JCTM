import { useState, useEffect, useRef } from "react";
import { Tv2, Radio, PlayCircle, Clock, X, MessageSquare } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLivestreamStatus } from "@/hooks/useLivestreamStatus";
import { LiveChat } from "@/components/LiveChat";

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

// ─── Live Player Modal ────────────────────────────────────────────────────────

function LiveModal({ videoId, title, onClose }: { videoId: string; title: string | null; onClose: () => void }) {
  const [mobileTab, setMobileTab] = useState<"video" | "chat">("video");
  const embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0&modestbranding=1&origin=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")}`;

  return (
    <motion.div
      key="live-modal-indicator"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex flex-col sm:items-center sm:justify-center bg-black/90 backdrop-blur-sm sm:p-3 md:p-5 lg:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        className="relative w-full flex flex-col overflow-hidden shadow-2xl h-full rounded-t-2xl border-t border-white/10 sm:h-[88vh] sm:max-h-[88vh] sm:max-w-5xl lg:max-w-6xl sm:rounded-3xl sm:border sm:border-white/10 bg-[#0a0a0a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0a0a0a] flex items-center justify-between px-4 py-3 shrink-0 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-full w-full bg-red-500" />
            </span>
            <span className="text-white font-bold text-sm truncate">
              {title || "Live Service — Jesus Christ Temple Ministry"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-colors touch-manipulation shrink-0"
            aria-label="Close player"
          >
            <X className="h-4 w-4 text-white/70" />
          </button>
        </div>

        {/* Mobile tab switcher */}
        <div className="flex md:hidden bg-[#111] border-b border-white/10 shrink-0">
          <button
            onClick={() => setMobileTab("video")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors touch-manipulation ${mobileTab === "video" ? "text-white border-b-2 border-red-500" : "text-white/40"}`}
          >
            <Tv2 className="w-4 h-4" />
            Watch
          </button>
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors touch-manipulation ${mobileTab === "chat" ? "text-white border-b-2 border-sky-500" : "text-white/40"}`}
          >
            <MessageSquare className="w-4 h-4" />
            Live Chat
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden bg-[#0d0d0d]">
          <div className={["flex-col flex-1 bg-black min-w-0 min-h-0", mobileTab === "video" ? "flex" : "hidden", "md:flex"].join(" ")}>
            <iframe
              key={videoId}
              src={embedSrc}
              title="JCTM Live Service"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full h-full"
              style={{ minHeight: 0 }}
            />
          </div>
          <div className={["flex-col border-l border-white/10 bg-[#111]", mobileTab === "chat" ? "flex w-full" : "hidden", "md:flex md:w-72 lg:w-80 xl:w-96 md:flex-shrink-0"].join(" ")}>
            <LiveChat isLive={true} embedded={true} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Rebroadcast Player Modal ─────────────────────────────────────────────────

function RebroadcastModal({ videoId, title, expiresAt, onClose }: { videoId: string; title: string | null; expiresAt: string | null; onClose: () => void }) {
  const embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&origin=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")}`;

  return (
    <motion.div
      key="rebroadcast-modal-indicator"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex flex-col sm:items-center sm:justify-center bg-black/90 backdrop-blur-sm sm:p-3 md:p-5 lg:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        className="relative w-full flex flex-col overflow-hidden shadow-2xl h-full rounded-t-2xl border-t border-white/10 sm:h-[80vh] sm:max-h-[80vh] sm:max-w-4xl sm:rounded-3xl sm:border sm:border-white/10 bg-[#0a0a0a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#0a0a0a] flex items-center justify-between px-4 py-3 shrink-0 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="relative inline-flex rounded-full h-full w-full bg-amber-500" />
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-white font-bold text-sm truncate">
                {title || "Sunday Service — Jesus Christ Temple Ministry"}
              </span>
              {expiresAt && (
                <span className="text-amber-400/70 text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimeRemaining(expiresAt)} remaining
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-colors touch-manipulation shrink-0"
            aria-label="Close player"
          >
            <X className="h-4 w-4 text-white/70" />
          </button>
        </div>
        <div className="flex flex-1 min-h-0 bg-black">
          <iframe
            key={videoId}
            src={embedSrc}
            title="JCTM Service Rebroadcast"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full"
            style={{ minHeight: 0 }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Indicator Component ─────────────────────────────────────────────────

export function BroadcastStatusIndicator() {
  const status = useLivestreamStatus();
  const [showPlayer, setShowPlayer] = useState(false);
  const [timeDisplay, setTimeDisplay] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const prevStatusRef = useRef({ isLive: false, available: false });

  const { rebroadcast } = status;
  const isActive = status.isLive || rebroadcast.available;

  // Re-show whenever a new broadcast begins
  useEffect(() => {
    const prev = prevStatusRef.current;
    const nowActive = status.isLive || rebroadcast.available;
    const becameActive =
      (!prev.isLive && status.isLive) ||
      (!prev.available && rebroadcast.available);
    if (becameActive) setDismissed(false);
    prevStatusRef.current = { isLive: status.isLive, available: rebroadcast.available };
    if (!nowActive) setDismissed(false);
  }, [status.isLive, rebroadcast.available]);

  // Countdown ticker
  useEffect(() => {
    if (!rebroadcast.available || !rebroadcast.expiresAt) return;
    const update = () => setTimeDisplay(formatTimeRemaining(rebroadcast.expiresAt!));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [rebroadcast.available, rebroadcast.expiresAt]);

  // Auto-close modal when broadcast ends
  useEffect(() => {
    if (showPlayer && !status.isLive && !rebroadcast.available) {
      setShowPlayer(false);
    }
  }, [showPlayer, status.isLive, rebroadcast.available]);

  const liveVideoId = status.videoId ?? "f7TOxaM2Mq4";
  const rebroadcastVideoId = rebroadcast.videoId ?? "f7TOxaM2Mq4";

  // ── Offline (idle) — always render a subtle indicator ─────────────────────
  if (!isActive) {
    return (
      <>
        <div
          className="fixed top-[4.5rem] right-3 sm:right-4 z-[200] pointer-events-none"
          aria-hidden="true"
        >
          <a
            href="https://www.youtube.com/@templetvjctm"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="JCTM Temple TV on YouTube"
            className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-full
              bg-black/30 dark:bg-white/5 border border-white/10
              text-white/30 hover:text-white/60 hover:bg-black/50 hover:border-white/20
              transition-all duration-300 backdrop-blur-md cursor-pointer select-none
              text-[10px] font-semibold tracking-widest uppercase"
          >
            <Tv2 className="h-3 w-3 shrink-0 opacity-60" />
            <span className="hidden sm:inline">Temple TV</span>
          </a>
        </div>

        {/* Modals portal (no active state) */}
        <AnimatePresence>{/* nothing */}</AnimatePresence>
      </>
    );
  }

  // ── Active — dismissed by user → show compact re-open tab ────────────────
  if (dismissed) {
    return (
      <>
        <motion.button
          key="reopen-tab"
          initial={{ opacity: 0, scale: 0.8, x: 20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.8, x: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          onClick={() => setDismissed(false)}
          aria-label={status.isLive ? "Rejoin live service" : "Reopen rebroadcast"}
          className={[
            "fixed top-[4.5rem] right-0 z-[200]",
            "flex items-center gap-1.5 pl-3 pr-2 py-2",
            "rounded-l-full border-l border-t border-b shadow-lg",
            "text-[11px] font-bold tracking-wide cursor-pointer select-none",
            "backdrop-blur-md transition-all duration-200 touch-manipulation",
            status.isLive
              ? "bg-red-600 border-red-400/40 text-white hover:bg-red-500"
              : "bg-amber-600 border-amber-400/40 text-white hover:bg-amber-500",
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
          ) : (
            <>
              <PlayCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">RB</span>
            </>
          )}
        </motion.button>

        <AnimatePresence>
          {showPlayer && status.isLive && (
            <LiveModal key="live-modal" videoId={liveVideoId} title={status.title} onClose={() => setShowPlayer(false)} />
          )}
          {showPlayer && !status.isLive && rebroadcast.available && (
            <RebroadcastModal key="rebroadcast-modal" videoId={rebroadcastVideoId} title={rebroadcast.title} expiresAt={rebroadcast.expiresAt} onClose={() => setShowPlayer(false)} />
          )}
        </AnimatePresence>
      </>
    );
  }

  // ── Active — full indicator visible ──────────────────────────────────────
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
            {/* Badge row */}
            <div className="flex items-center gap-0 rounded-full shadow-xl overflow-hidden border border-red-400/30 bg-red-600">
              {/* Pulse dot + label */}
              <button
                onClick={() => setShowPlayer(true)}
                className="flex items-center gap-2 pl-3 pr-2 py-2 cursor-pointer touch-manipulation group"
                aria-label="Watch live service"
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-70" />
                  <span className="relative inline-flex rounded-full h-full w-full bg-white" />
                </span>
                <span className="text-white text-[11px] sm:text-xs font-bold tracking-widest uppercase leading-none whitespace-nowrap">
                  🔴 Live Service
                </span>
              </button>

              {/* CTA */}
              <button
                onClick={() => setShowPlayer(true)}
                className="bg-white text-red-600 text-[10px] sm:text-xs font-extrabold px-2.5 sm:px-3 py-2 hover:bg-red-50 active:scale-95 transition-all touch-manipulation whitespace-nowrap leading-none"
              >
                Join
              </button>

              {/* Dismiss */}
              <button
                onClick={() => setDismissed(true)}
                className="flex items-center justify-center w-7 h-full bg-red-700/60 hover:bg-red-800/80 active:bg-red-900 transition-colors touch-manipulation px-1.5"
                aria-label="Dismiss indicator"
              >
                <X className="h-3 w-3 text-white/80" />
              </button>
            </div>

            {/* Title chip */}
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

        {/* 📺 REBROADCAST */}
        {!status.isLive && rebroadcast.available && (
          <motion.div
            key="rebroadcast-indicator"
            initial={{ opacity: 0, scale: 0.85, x: 24 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.85, x: 24 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="fixed top-[4.5rem] right-3 sm:right-4 z-[200] flex flex-col items-end gap-1.5 max-w-[min(calc(100vw-1.5rem),340px)]"
          >
            {/* Badge row */}
            <div className="flex items-center gap-0 rounded-full shadow-xl overflow-hidden border border-amber-400/30 bg-amber-600">
              <button
                onClick={() => setShowPlayer(true)}
                className="flex items-center gap-2 pl-3 pr-2 py-2 cursor-pointer touch-manipulation"
                aria-label="Watch rebroadcast service"
              >
                <PlayCircle className="h-3.5 w-3.5 text-white/90 shrink-0" />
                <span className="text-white text-[11px] sm:text-xs font-bold tracking-widest uppercase leading-none whitespace-nowrap">
                  Rebroadcast
                </span>
                {timeDisplay && (
                  <span className="hidden sm:flex items-center gap-0.5 text-white/60 text-[10px] font-medium">
                    <Clock className="h-2.5 w-2.5" />
                    {timeDisplay}
                  </span>
                )}
              </button>

              {/* CTA */}
              <button
                onClick={() => setShowPlayer(true)}
                className="bg-white text-amber-700 text-[10px] sm:text-xs font-extrabold px-2.5 sm:px-3 py-2 hover:bg-amber-50 active:scale-95 transition-all touch-manipulation whitespace-nowrap leading-none"
              >
                Watch
              </button>

              {/* Dismiss */}
              <button
                onClick={() => setDismissed(true)}
                className="flex items-center justify-center w-7 h-full bg-amber-700/60 hover:bg-amber-800/80 active:bg-amber-900 transition-colors touch-manipulation px-1.5"
                aria-label="Dismiss indicator"
              >
                <X className="h-3 w-3 text-white/80" />
              </button>
            </div>

            {/* Title chip */}
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
      </AnimatePresence>

      {/* ── Video Modals ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPlayer && status.isLive && (
          <LiveModal key="live-modal" videoId={liveVideoId} title={status.title} onClose={() => setShowPlayer(false)} />
        )}
        {showPlayer && !status.isLive && rebroadcast.available && (
          <RebroadcastModal key="rebroadcast-modal" videoId={rebroadcastVideoId} title={rebroadcast.title} expiresAt={rebroadcast.expiresAt} onClose={() => setShowPlayer(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

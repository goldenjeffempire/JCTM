import { useState, useEffect } from "react";
import { Radio, X, MessageSquare, Tv2, PlayCircle, Clock } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { LiveChat } from "@/components/LiveChat";
import { useLivestreamStatus } from "@/hooks/useLivestreamStatus";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (days > 0) return `${days}d ${remainingHours}h remaining`;
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

// ─── Rebroadcast Player Modal ─────────────────────────────────────────────────

interface RebroadcastModalProps {
  videoId: string;
  title: string | null;
  expiresAt: string | null;
  onClose: () => void;
}

function RebroadcastModal({ videoId, title, expiresAt, onClose }: RebroadcastModalProps) {
  const embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&origin=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")}`;

  return (
    <motion.div
      key="rebroadcast-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex flex-col sm:items-center sm:justify-center bg-black/90 backdrop-blur-sm sm:p-3 md:p-5 lg:p-6"
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
          "sm:h-[80vh] sm:max-h-[80vh] sm:max-w-4xl",
          "sm:rounded-3xl sm:border sm:border-white/10",
          "bg-[#0a0a0a]",
        ].join(" ")}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
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
                  {formatTimeRemaining(expiresAt)}
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

        {/* Video */}
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

// ─── Live Player Modal ────────────────────────────────────────────────────────

interface LiveModalProps {
  videoId: string;
  title: string | null;
  onClose: () => void;
}

function LiveModal({ videoId, title, onClose }: LiveModalProps) {
  const [mobileTab, setMobileTab] = useState<"video" | "chat">("video");
  const embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0&modestbranding=1&origin=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")}`;

  return (
    <motion.div
      key="live-banner-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex flex-col sm:items-center sm:justify-center bg-black/90 backdrop-blur-sm sm:p-3 md:p-5 lg:p-6"
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
          "sm:h-[88vh] sm:max-h-[88vh] sm:max-w-5xl lg:max-w-6xl",
          "sm:rounded-3xl sm:border sm:border-white/10",
          "bg-[#0a0a0a]",
        ].join(" ")}
        onClick={e => e.stopPropagation()}
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
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors touch-manipulation ${
              mobileTab === "video"
                ? "text-white border-b-2 border-red-500"
                : "text-white/40 active:text-white/70"
            }`}
          >
            <Tv2 className="w-4 h-4" />
            Watch
          </button>
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors touch-manipulation ${
              mobileTab === "chat"
                ? "text-white border-b-2 border-sky-500"
                : "text-white/40 active:text-white/70"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Live Chat
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden bg-[#0d0d0d]">
          <div
            className={[
              "flex-col flex-1 bg-black min-w-0 min-h-0",
              mobileTab === "video" ? "flex" : "hidden",
              "md:flex",
            ].join(" ")}
          >
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

          <div
            className={[
              "flex-col border-l border-white/10 bg-[#111]",
              mobileTab === "chat" ? "flex w-full" : "hidden",
              "md:flex md:w-72 lg:w-80 xl:w-96 md:flex-shrink-0",
            ].join(" ")}
          >
            <LiveChat isLive={true} embedded={true} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Banner Component ────────────────────────────────────────────────────

export function LiveBanner() {
  const status = useLivestreamStatus();
  const [showPlayer, setShowPlayer] = useState(false);
  const [timeDisplay, setTimeDisplay] = useState("");

  const { rebroadcast } = status;

  // Update the countdown display every minute
  useEffect(() => {
    if (!rebroadcast.available || !rebroadcast.expiresAt) return;
    const update = () => setTimeDisplay(formatTimeRemaining(rebroadcast.expiresAt!));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [rebroadcast.available, rebroadcast.expiresAt]);

  // Auto-close rebroadcast player if 3-day window expires while modal is open
  useEffect(() => {
    if (showPlayer && !status.isLive && !rebroadcast.available) {
      setShowPlayer(false);
    }
  }, [showPlayer, status.isLive, rebroadcast.available]);

  const liveVideoId = status.videoId ?? "f7TOxaM2Mq4";
  const rebroadcastVideoId = rebroadcast.videoId ?? "f7TOxaM2Mq4";

  // ── Nothing to show ──────────────────────────────────────────────────────
  if (!status.isLive && !rebroadcast.available) return null;

  return (
    <>
      <AnimatePresence mode="wait">
        {/* ── 🔴 LIVE SERVICE Banner ─────────────────────────────────────────── */}
        {status.isLive && (
          <motion.div
            key="live-bar"
            initial={{ y: -48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -48, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="bg-destructive text-destructive-foreground w-full py-2 px-3 sm:px-4 flex items-center justify-center gap-2 sm:gap-3 shadow-md z-[60] relative"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 animate-pulse shrink-0">
              <Radio className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="font-bold text-xs sm:text-sm tracking-wide">🔴 LIVE SERVICE</span>
            </div>
            <div className="h-4 w-px bg-destructive-foreground/30 hidden sm:block shrink-0" />
            <span className="text-xs sm:text-sm font-medium hidden sm:block truncate max-w-xs md:max-w-sm lg:max-w-md">
              {status.title || "JCTM Sunday Service"}
            </span>
            <button
              onClick={() => setShowPlayer(true)}
              className="ml-auto sm:ml-2 bg-white text-destructive text-xs font-bold px-2.5 py-1 sm:px-3 rounded-full hover:bg-white/90 active:scale-95 transition-all touch-manipulation shrink-0"
            >
              Join Service
            </button>
          </motion.div>
        )}

        {/* ── 📺 REBROADCAST SERVICE Banner ──────────────────────────────────── */}
        {!status.isLive && rebroadcast.available && (
          <motion.div
            key="rebroadcast-bar"
            initial={{ y: -48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -48, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="bg-amber-600 text-white w-full py-2 px-3 sm:px-4 flex items-center justify-center gap-2 sm:gap-3 shadow-md z-[60] relative"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <PlayCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="font-bold text-xs sm:text-sm tracking-wide">REBROADCAST SERVICE</span>
            </div>
            <div className="h-4 w-px bg-white/30 hidden sm:block shrink-0" />
            <span className="text-xs sm:text-sm font-medium hidden sm:block truncate max-w-xs md:max-w-sm">
              {rebroadcast.title || "Sunday Service — JCTM"}
            </span>
            {timeDisplay && (
              <span className="text-xs text-white/60 hidden md:flex items-center gap-1 shrink-0">
                <Clock className="h-3 w-3" />
                {timeDisplay}
              </span>
            )}
            <button
              onClick={() => setShowPlayer(true)}
              className="ml-auto sm:ml-2 bg-white text-amber-700 text-xs font-bold px-2.5 py-1 sm:px-3 rounded-full hover:bg-white/90 active:scale-95 transition-all touch-manipulation shrink-0"
            >
              Watch Service
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPlayer && status.isLive && (
          <LiveModal
            key="live-modal"
            videoId={liveVideoId}
            title={status.title}
            onClose={() => setShowPlayer(false)}
          />
        )}
        {showPlayer && !status.isLive && rebroadcast.available && (
          <RebroadcastModal
            key="rebroadcast-modal"
            videoId={rebroadcastVideoId}
            title={rebroadcast.title}
            expiresAt={rebroadcast.expiresAt}
            onClose={() => setShowPlayer(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

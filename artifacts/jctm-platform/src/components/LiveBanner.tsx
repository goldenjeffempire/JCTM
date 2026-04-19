import { useState, useEffect, useRef } from "react";
import { Radio, X, PlayCircle, Clock, Tv2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
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

// ─── Main Banner ──────────────────────────────────────────────────────────────
//
// Three states the banner can be in:
//   1. 🔴 LIVE       — full-width red alert, re-shows on every new live event
//   2. 📺 REBROADCAST        — amber banner, re-shows when a post-service window opens
//   3. 📺 NOW PLAYING        — subtle indigo banner for continuous/always-on mode
//                              dismissed by default; only re-shows on live/scheduled events

export function LiveBanner() {
  const status = useLivestreamStatus();
  const [timeDisplay, setTimeDisplay] = useState("");

  // Separate dismissed flags for each mode so "continuous" dismissal doesn't
  // affect the more important live/scheduled banners
  const [liveOrScheduledDismissed, setLiveOrScheduledDismissed] = useState(false);
  const [continuousDismissed, setContinuousDismissed] = useState(false);

  const prevRef = useRef({ isLive: false, mode: undefined as string | undefined });

  const { rebroadcast } = status;
  const isContinuous = rebroadcast.available && rebroadcast.mode === "continuous";
  const isScheduled  = rebroadcast.available && rebroadcast.mode === "scheduled";

  // Countdown ticker — only for scheduled rebroadcast
  useEffect(() => {
    if (!isScheduled || !rebroadcast.expiresAt) { setTimeDisplay(""); return; }
    const update = () => setTimeDisplay(formatTimeRemaining(rebroadcast.expiresAt!));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [isScheduled, rebroadcast.expiresAt]);

  // Re-show live/scheduled banner on new events; continuous banner is user-managed
  useEffect(() => {
    const prev = prevRef.current;
    const wentLive = !prev.isLive && status.isLive;
    const becameScheduled = prev.mode !== "scheduled" && isScheduled;
    if (wentLive || becameScheduled) setLiveOrScheduledDismissed(false);
    prevRef.current = { isLive: status.isLive, mode: rebroadcast.mode };
  }, [status.isLive, isScheduled, rebroadcast.mode]);

  // Nothing active
  if (!status.isLive && !rebroadcast.available) return null;

  // ── 🔴 LIVE ────────────────────────────────────────────────────────────────
  if (status.isLive) {
    if (liveOrScheduledDismissed) return null;
    return (
      <AnimatePresence mode="wait">
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
            <span className="font-bold text-xs sm:text-sm tracking-wide">🔴 Now Streaming Live</span>
          </div>
          <div className="h-4 w-px bg-destructive-foreground/30 hidden sm:block shrink-0" />
          <span className="text-xs sm:text-sm font-medium hidden sm:block truncate max-w-xs md:max-w-sm lg:max-w-md">
            {status.title || "Holy Spirit Sunday Service — Live"}
          </span>
          <span className="ml-auto sm:ml-2 bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 sm:px-3 rounded-full shrink-0 select-none">
            See indicator →
          </span>
          <button
            onClick={() => setLiveOrScheduledDismissed(true)}
            className="h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors touch-manipulation shrink-0"
            aria-label="Dismiss banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── 📺 REBROADCAST SERVICE (scheduled post-service window) ─────────────────
  if (isScheduled) {
    if (liveOrScheduledDismissed) return null;
    return (
      <AnimatePresence mode="wait">
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
            <span className="font-bold text-xs sm:text-sm tracking-wide">📺 REBROADCAST SERVICE</span>
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
          <span className="ml-auto sm:ml-2 bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 sm:px-3 rounded-full shrink-0 select-none">
            See indicator →
          </span>
          <button
            onClick={() => setLiveOrScheduledDismissed(true)}
            className="h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors touch-manipulation shrink-0"
            aria-label="Dismiss banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── 📺 NOW PLAYING (continuous always-on mode) ─────────────────────────────
  // Subtler banner — not as urgent as a live/scheduled event.
  // Starts hidden; user can see content via the floating indicator.
  if (isContinuous) {
    if (continuousDismissed) return null;
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="continuous-bar"
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
          className="bg-indigo-700/90 text-white w-full py-1.5 px-3 sm:px-4 flex items-center justify-center gap-2 sm:gap-3 shadow-sm z-[60] relative backdrop-blur-sm"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <Tv2 className="h-3.5 w-3.5 opacity-80" />
            <span className="font-semibold text-[11px] sm:text-xs tracking-wide opacity-90">Temple TV — Now Playing</span>
          </div>
          <div className="h-3.5 w-px bg-white/20 hidden sm:block shrink-0" />
          <span className="text-[11px] sm:text-xs text-white/60 hidden sm:block truncate max-w-xs md:max-w-sm">
            {rebroadcast.title || "Latest Teaching — JCTM"}
          </span>
          <button
            onClick={() => setContinuousDismissed(true)}
            className="ml-auto h-5 w-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors touch-manipulation shrink-0"
            aria-label="Dismiss banner"
          >
            <X className="h-3 w-3" />
          </button>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}

import { useState, useEffect } from "react";
import { Radio, X, PlayCircle, Clock } from "lucide-react";
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
// The banner renders at the very top of the layout (above the Navbar).
// It reflects the same SSE-driven status as the floating indicator and opens
// the player via the BroadcastStatusIndicator's unified modal.

export function LiveBanner() {
  const status = useLivestreamStatus();
  const [timeDisplay, setTimeDisplay] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [prevIsLive, setPrevIsLive] = useState(false);

  const { rebroadcast } = status;

  // Countdown ticker
  useEffect(() => {
    if (!rebroadcast.available || !rebroadcast.expiresAt) return;
    const update = () => setTimeDisplay(formatTimeRemaining(rebroadcast.expiresAt!));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [rebroadcast.available, rebroadcast.expiresAt]);

  // Re-show banner whenever a new live broadcast begins
  useEffect(() => {
    if (!prevIsLive && status.isLive) setDismissed(false);
    setPrevIsLive(status.isLive);
  }, [status.isLive, prevIsLive]);

  // Re-show banner when rebroadcast activates (after live ends)
  useEffect(() => {
    if (rebroadcast.available) setDismissed(false);
  }, [rebroadcast.available]);

  // Nothing to show (and banner isn't holding an active state)
  if (!status.isLive && !rebroadcast.available) return null;
  if (dismissed) return null;

  return (
    <AnimatePresence mode="wait">
      {/* ── 🔴 LIVE SERVICE Banner ─────────────────────────────────────── */}
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
          {/* Banner just signals status — the floating indicator pill handles the player */}
          <span className="ml-auto sm:ml-2 bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 sm:px-3 rounded-full shrink-0 select-none">
            See indicator →
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors touch-manipulation shrink-0"
            aria-label="Dismiss banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}

      {/* ── 📺 REBROADCAST SERVICE Banner ──────────────────────────────── */}
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
          <span className="ml-auto sm:ml-2 bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 sm:px-3 rounded-full shrink-0 select-none">
            See indicator →
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors touch-manipulation shrink-0"
            aria-label="Dismiss banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

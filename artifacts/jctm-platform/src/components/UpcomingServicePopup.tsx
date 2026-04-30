import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Clock, Radio, X, Play } from "lucide-react";
import { useLivestreamStatus } from "@/hooks/useLivestreamStatus";

const STORAGE_KEY = "jctm-upcoming-service-popup-2026-04-19";

export function UpcomingServicePopup() {
  const [open, setOpen] = useState(false);

  // Live-aware: when the crusade is broadcasting, the popup hot-swaps from
  // "Begins Soon" into a "Live Now — Watch Live" call-to-action so audiences
  // can jump straight into the live stream.
  const liveStatus = useLivestreamStatus();
  const isLive = liveStatus.isLive;
  const liveTitle = liveStatus.title?.trim() || "Warri Crusade Day 1";

  useEffect(() => {
    let dismissedAt = 0;
    try {
      dismissedAt = Number(window.localStorage.getItem(STORAGE_KEY) ?? "0");
    } catch {
      dismissedAt = 0;
    }
    const hoursSinceDismissed = dismissedAt ? (Date.now() - dismissedAt) / (1000 * 60 * 60) : Infinity;
    const timer = window.setTimeout(() => {
      if (hoursSinceDismissed >= 18) setOpen(true);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, []);

  const close = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      undefined;
    }
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className={`fixed bottom-5 left-4 right-4 z-[220] mx-auto max-w-md rounded-[1.75rem] border ${isLive ? "border-red-400/50 bg-[#1a0303]/95 shadow-red-950/40" : "border-amber-300/30 bg-[#180900]/95 shadow-amber-950/35"} p-4 text-white shadow-2xl backdrop-blur-xl sm:left-auto sm:right-5 sm:mx-0`}
          role="dialog"
          aria-label={isLive ? "Live broadcast notification" : "Upcoming Sunday service notification"}
        >
          <button
            onClick={close}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close service notification"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex gap-3 pr-8">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg ${isLive ? "bg-gradient-to-br from-red-500 to-red-700 shadow-red-500/30 animate-pulse" : "bg-gradient-to-br from-amber-400 to-red-500 shadow-amber-500/25"}`}>
              {isLive ? <Radio className="h-5 w-5 text-white" /> : <Bell className="h-5 w-5 text-white" />}
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {isLive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/30 border border-red-400/40 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-red-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-300 animate-pulse" /> Live Now
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-red-200">
                    <Radio className="h-3 w-3" /> Service Alert
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/75">
                  <Clock className="h-3 w-3" /> {isLive ? "Streaming Now" : "8:00 AM WAT"}
                </span>
              </div>
              <h3 className="font-serif text-lg font-black leading-tight text-white">
                {isLive ? `${liveTitle} — Live Now` : "Warri Crusade Day 1 Begins Soon"}
              </h3>
              <p className={`mt-1 text-sm font-semibold ${isLive ? "text-red-100" : "text-amber-100"}`}>
                {isLive ? "The crusade is broadcasting live right now" : "Join us live at 8:00 AM (WAT)"}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-white/65">
                {isLive
                  ? "Tap below to join the live stream and experience the move of God in real time."
                  : "Prepare your heart and connect to the presence of God."}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Link href={isLive ? "/sermons" : "/"} className="flex-1" onClick={close}>
              <button className={`h-11 w-full rounded-2xl text-sm font-black uppercase tracking-widest text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 ${isLive ? "bg-gradient-to-r from-red-500 to-red-700 shadow-red-950/35" : "bg-gradient-to-r from-amber-400 to-red-500 shadow-red-950/25"}`}>
                {isLive && <Play className="h-4 w-4 fill-current" />}
                {isLive ? "Watch Live" : "View Website"}
              </button>
            </Link>
            <button
              onClick={close}
              className="h-11 rounded-2xl border border-white/15 px-4 text-sm font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              Later
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Clock, Radio, X } from "lucide-react";

const STORAGE_KEY = "jctm-upcoming-service-popup-2026-04-19";

export function UpcomingServicePopup() {
  const [open, setOpen] = useState(false);

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
          className="fixed bottom-5 left-4 right-4 z-[220] mx-auto max-w-md rounded-[1.75rem] border border-amber-300/30 bg-[#180900]/95 p-4 text-white shadow-2xl shadow-amber-950/35 backdrop-blur-xl sm:left-auto sm:right-5 sm:mx-0"
          role="dialog"
          aria-label="Upcoming Sunday service notification"
        >
          <button
            onClick={close}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close service notification"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex gap-3 pr-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-red-500 shadow-lg shadow-amber-500/25">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-red-200">
                  <Radio className="h-3 w-3" /> Service Alert
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/75">
                  <Clock className="h-3 w-3" /> 8:00 AM WAT
                </span>
              </div>
              <h3 className="font-serif text-lg font-black leading-tight text-white">
                Holy Spirit Sunday Service Begins Soon
              </h3>
              <p className="mt-1 text-sm font-semibold text-amber-100">
                Join us live at 8:00 AM (WAT)
              </p>
              <p className="mt-1 text-sm leading-relaxed text-white/65">
                Prepare your heart and connect to the presence of God.
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Link href="/" className="flex-1" onClick={close}>
              <button className="h-11 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-red-500 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-red-950/25 transition-transform hover:scale-[1.02] active:scale-[0.98]">
                View Website
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
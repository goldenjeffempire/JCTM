import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.templetv.jctm";
const DISMISS_KEY = "jctm_app_banner_dismissed_v1";

function PlayStoreLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M3.18 23.76c.3.17.64.24.99.2l12.24-11.24L12.9 9.2 3.18 23.76zm17.27-10.98-3.35-1.93-3.41 3.13 3.41 3.13 3.38-1.95c.96-.56.96-1.83-.03-2.38zM3 1.07C2.58 1.34 2.3 1.8 2.3 2.4v19.2c0 .6.28 1.06.7 1.33l.1.06 10.76-10.76v-.25L3 1.07zm9.9 9.85L3.18.36c-.35-.04-.69.03-.99.2L12.9 14.8l.41-.38L12.9 10.92z" />
    </svg>
  );
}

export function TempleAppBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem(DISMISS_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* noop */ }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
          role="banner"
          aria-label="Temple TV App announcement"
        >
          <div
            className="relative flex items-center justify-between gap-3 px-4 py-2.5 text-white"
            style={{
              background: "linear-gradient(90deg, #003366 0%, #01875f 55%, #0284C7 100%)",
            }}
          >
            {/* Shimmer */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              <motion.div
                className="absolute inset-0 opacity-20"
                style={{ background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)" }}
                animate={{ x: ["-100%", "220%"] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear", repeatDelay: 6 }}
              />
            </div>

            {/* Content */}
            <div className="relative flex items-center gap-3 min-w-0 flex-1">
              {/* Icon */}
              <div className="shrink-0 h-7 w-7 rounded-lg bg-white/15 flex items-center justify-center border border-white/25">
                <PlayStoreLogo className="h-4 w-4 text-white" />
              </div>

              {/* Text */}
              <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-bold text-sm whitespace-nowrap">
                  📱 Temple TV App — Anywhere & Everywhere You Go!
                </span>
                <span className="text-white/70 text-xs hidden sm:inline truncate">
                  Watch sermons, live broadcasts &amp; more — anytime, anywhere.
                </span>
              </div>
            </div>

            {/* CTA + dismiss */}
            <div className="relative flex items-center gap-2 shrink-0">
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-[#003366] text-xs font-bold shadow hover:bg-white/90 transition-colors whitespace-nowrap"
                aria-label="Download Temple TV App on Google Play"
              >
                <PlayStoreLogo className="h-3 w-3 text-[#01875f]" />
                Download Free
              </a>
              <button
                onClick={dismiss}
                aria-label="Dismiss app announcement"
                className="h-6 w-6 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

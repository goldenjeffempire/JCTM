import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import googlePlayIcon from "@assets/vecteezy_google-play-store-icon-logo-symbol_22484501_1783000016861.png";
import templeTVAppIcon from "@assets/TempleTV_logo_transparent.png";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.templetv.jctm";
const DISMISS_KEY = "jctm_app_banner_dismissed_v1";

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
              <div className="shrink-0 h-7 w-7 rounded-lg bg-white/15 flex items-center justify-center border border-white/25 overflow-hidden">
                <img src={templeTVAppIcon} className="h-6 w-6 object-contain" alt="Temple TV App" aria-hidden="true" />
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
                <img src={googlePlayIcon} className="h-3 w-3" alt="" aria-hidden="true" />
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

/**
 * FloatingJoinCrusadeCTA — fixed bottom-right "Join Warri Crusade" pill.
 *
 *  • Globally mounted (every route).
 *  • Only shows during campaign window — auto-hides once the event ends.
 *  • Defers when the page is /crusade (don't promote the page from itself).
 *  • Independently dismissible from the top sticky banner; uses its own
 *    sessionStorage key so collapsing the floating CTA doesn't kill the bar.
 *  • Compact "FAB" on mobile, expanded pill on desktop.
 *  • Slide-in animation on mount, never blocks navigation (bottom-right corner,
 *    above safe-area inset).
 */

import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, ChevronRight, X } from "lucide-react";

const CAMPAIGN_END = new Date("2026-05-01T21:00:00+01:00").getTime();
const CAMPAIGN_START = new Date("2026-04-30T18:00:00+01:00").getTime();
const SESSION_HIDE_KEY = "jctm:warri-crusade-2026:floating-cta-hidden";
const SHOW_DELAY_MS = 1500; // let initial paint settle to avoid CLS jank

export function FloatingJoinCrusadeCTA() {
  const [location] = useLocation();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Cheap re-render once a minute so the live/upcoming state can flip
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setMounted(true);
    try {
      setHidden(sessionStorage.getItem(SESSION_HIDE_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const t = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [mounted]);

  if (!mounted) return null;
  if (now >= CAMPAIGN_END) return null;
  if (hidden) return null;
  // Don't show on the crusade page itself — would be redundant
  if (location.startsWith("/crusade")) return null;

  const isLive = now >= CAMPAIGN_START;

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setHidden(true);
    try {
      sessionStorage.setItem(SESSION_HIDE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.92 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="fixed z-[80] right-3 sm:right-5 pointer-events-none"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)",
          }}
          role="region"
          aria-label="Warri Crusade quick join"
          data-testid="floating-join-crusade-cta"
        >
          <Link href="/crusade">
            <div
              className="relative pointer-events-auto group inline-flex items-center gap-2 rounded-full pl-3 pr-4 py-2.5 shadow-2xl shadow-red-900/40 cursor-pointer transition-transform hover:scale-105"
              style={{
                background: isLive
                  ? "linear-gradient(135deg,#dc2626 0%,#7f1d1d 50%,#dc2626 100%)"
                  : "linear-gradient(135deg,#3b0000 0%,#7f1d1d 50%,#3b0000 100%)",
                border: "1.5px solid rgba(255,215,0,0.55)",
              }}
            >
              {/* pulsing flame indicator */}
              <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400/90 text-[#1a0000] shrink-0">
                <Flame className="h-4 w-4" />
                {isLive && (
                  <span className="absolute inset-0 rounded-full bg-yellow-400 animate-ping opacity-50" />
                )}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-yellow-300/90">
                  {isLive ? "Live Now" : "Apr 30 – May 1"}
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-white whitespace-nowrap">
                  Join Warri Crusade
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-yellow-300 shrink-0 group-hover:translate-x-0.5 transition-transform" />

              {/* dismiss button */}
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Hide Join Warri Crusade button"
                data-testid="floating-join-crusade-dismiss"
                className="absolute -top-1.5 -right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-yellow-200 hover:bg-black hover:text-white border border-yellow-400/40 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

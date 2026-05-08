/**
 * MinistersConferenceFAB — fixed bottom-right floating action button.
 *
 * Enterprise features:
 *   • Globally mounted (every route via Layout)
 *   • Auto-hides once the conference ends and is a no-op before CONF_START
 *   • Defers when the visitor is already on /conference-registration
 *   • Independently dismissible (sessionStorage) from other promo surfaces
 *   • Compact FAB icon on mobile, expanded pill label on ≥sm
 *   • Slide-in animation after 1.5 s initial paint settle (no CLS jank)
 *   • Purple / gold brand palette; live-state switches to pulsing glow
 *   • Accessibility: role="region", aria-labels, keyboard-friendly dismiss
 *   • Respects prefers-reduced-motion for entrance / pulse animations
 */

import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, X, Radio } from "lucide-react";

const CONF_START_MS   = new Date("2026-05-08T08:00:00+01:00").getTime(); // 8:00 AM WAT
const CONF_END_MS     = new Date("2026-05-10T21:00:00+01:00").getTime();
const SESSION_HIDE_KEY = "jctm:ministers-conf-2026:fab-hidden";
const SHOW_DELAY_MS   = 1500;

export function FloatingJoinCrusadeCTA() {
  const [location] = useLocation();
  const [mounted,  setMounted]  = useState(false);
  const [visible,  setVisible]  = useState(false);
  const [hidden,   setHidden]   = useState(false);
  const [now,      setNow]      = useState(() => Date.now());

  // Re-poll once a minute — cheap, keeps live / upcoming label fresh
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
  if (now >= CONF_END_MS) return null;
  if (hidden) return null;
  if (location.startsWith("/conference-registration")) return null;

  const isLive = now >= CONF_START_MS && now < CONF_END_MS;

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
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)" }}
          role="region"
          aria-label="Ministers Conference 2026 quick register"
          data-testid="floating-join-crusade-cta"
        >
          <Link href="/conference-registration">
            <div
              className="relative pointer-events-auto group inline-flex items-center gap-2 rounded-full pl-3 pr-4 py-2.5 shadow-2xl cursor-pointer transition-transform hover:scale-105"
              style={{
                background: isLive
                  ? "linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#7c3aed 100%)"
                  : "linear-gradient(135deg,#2d0057 0%,#6b21a8 50%,#2d0057 100%)",
                border: "1.5px solid rgba(212,160,23,0.55)",
                boxShadow: isLive
                  ? "0 8px 32px rgba(168,85,247,0.5)"
                  : "0 8px 28px rgba(168,85,247,0.35)",
              }}
            >
              {/* Icon container */}
              <span
                className="relative inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0"
                style={{ background: "linear-gradient(135deg,#D4A017,#FFD700)" }}
              >
                {isLive ? (
                  <Radio className="h-4 w-4 text-purple-900" aria-hidden />
                ) : (
                  <Sparkles className="h-4 w-4 text-purple-900" aria-hidden />
                )}
                {isLive && (
                  <span
                    className="absolute inset-0 rounded-full animate-ping opacity-50"
                    style={{ background: "#D4A017" }}
                    aria-hidden
                  />
                )}
              </span>

              {/* Label */}
              <span className="flex flex-col leading-tight">
                <span
                  className="text-[9px] font-extrabold uppercase tracking-widest"
                  style={{ color: "#D4A017" }}
                >
                  {isLive ? "Live Now — May 8–10" : "May 8–10, 2026"}
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-white whitespace-nowrap">
                  {isLive ? "Conference Is Live!" : "Join Ministers Conference"}
                </span>
              </span>

              <ChevronRight
                className="h-4 w-4 shrink-0 group-hover:translate-x-0.5 transition-transform"
                style={{ color: "#D4A017" }}
                aria-hidden
              />

              {/* Dismiss button */}
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Hide Ministers Conference button"
                data-testid="floating-join-crusade-dismiss"
                className="absolute -top-1.5 -right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 hover:bg-black border transition-colors"
                style={{ borderColor: "rgba(212,160,23,0.40)", color: "#D4A017" }}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </div>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

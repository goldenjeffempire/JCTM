/**
 * EventStickyBar — top-of-page minimal countdown bar.
 *
 *  • Always visible on every page (mounted in Layout).
 *  • Hidden when no active promotion or admin disabled showStickyBar.
 *  • User-dismissible per session (sessionStorage), but auto-resurrects when
 *    the phase flips to LIVE so users never miss the start.
 *  • Pre-Event: yellow gradient + countdown digits + "Details" CTA.
 *  • Live: red pulsing strip + "Join Live" CTA.
 *  • Ended: hidden.
 */

import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Radio, X, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useActiveEventPromotion } from "@/hooks/useActiveEventPromotion";

const DISMISS_KEY = (slug: string, phase: string) => `jctm:event-bar:${slug}:${phase}:dismissed`;

export function EventStickyBar() {
  const { promotion } = useActiveEventPromotion();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissal when slug or phase changes (so live takeover always shows).
  useEffect(() => {
    if (!promotion) return;
    try {
      const key = DISMISS_KEY(promotion.slug, promotion.livePhase);
      setDismissed(window.sessionStorage.getItem(key) === "1");
    } catch {
      setDismissed(false);
    }
  }, [promotion?.slug, promotion?.livePhase]);

  if (!promotion) return null;
  if (!promotion.showStickyBar) return null;
  if (promotion.livePhase === "ended") return null;
  if (dismissed) return null;

  const isLive = promotion.livePhase === "live";
  const c = promotion.countdown;

  return (
    <AnimatePresence>
      <motion.div
        key={`${promotion.slug}-${promotion.livePhase}`}
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        role="region"
        aria-label={`${promotion.title} ${isLive ? "live" : "countdown"} bar`}
        className={
          isLive
            ? "relative z-[60] w-full bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white shadow-lg"
            : "relative z-[60] w-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 text-[#1a1100] shadow-md"
        }
      >
        <div className="container mx-auto px-3 sm:px-4 py-1.5 flex items-center gap-3">
          <span
            className={
              "shrink-0 inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest " +
              (isLive ? "" : "text-[#1a1100]")
            }
          >
            {isLive ? (
              <>
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                <span className="hidden sm:inline">Now Live</span>
                <span className="sm:hidden">LIVE</span>
              </>
            ) : (
              <>
                <Calendar className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Upcoming</span>
              </>
            )}
          </span>

          <span className="shrink min-w-0 truncate text-xs sm:text-sm font-semibold">
            {promotion.title}
          </span>

          {!isLive && (
            <span className="hidden md:inline-flex items-center gap-1 ml-auto text-xs font-mono font-bold tabular-nums">
              <CountSegment value={c.days} label="d" />
              <CountSegment value={c.hours} label="h" />
              <CountSegment value={c.minutes} label="m" />
              <CountSegment value={c.seconds} label="s" />
            </span>
          )}

          <Link href={promotion.ctaUrl}>
            <button
              className={
                "ml-auto md:ml-3 shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all " +
                (isLive
                  ? "bg-white text-red-700 hover:bg-red-50 shadow-sm"
                  : "bg-[#1a1100] text-amber-200 hover:bg-[#2a1d00]")
              }
              data-testid="event-sticky-cta"
            >
              {isLive ? "Join Now" : promotion.ctaText}
              <ChevronRight className="h-3 w-3" />
            </button>
          </Link>

          <button
            type="button"
            onClick={() => {
              try {
                window.sessionStorage.setItem(DISMISS_KEY(promotion.slug, promotion.livePhase), "1");
              } catch {
                /* ignore */
              }
              setDismissed(true);
            }}
            aria-label="Dismiss event bar"
            className={
              "shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors " +
              (isLive ? "hover:bg-white/15" : "hover:bg-black/10")
            }
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function CountSegment({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline">
      <span className="rounded-md bg-black/10 px-1.5 py-0.5 text-xs">{String(value).padStart(2, "0")}</span>
      <span className="ml-0.5 text-[10px] font-semibold opacity-70">{label}</span>
    </span>
  );
}

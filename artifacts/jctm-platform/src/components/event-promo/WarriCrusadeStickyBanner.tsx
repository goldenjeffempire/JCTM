/**
 * WarriCrusadeStickyBanner — global, persistent campaign banner for the
 * Warri City Crusade 2026 ("Apr 30 – May 1, 2026 · Ighogbadu Primary School").
 *
 *  • Mounted in `Layout`, rendered on every route.
 *  • Sticky top, high z-index (above Navbar but below modals).
 *  • Mobile: compact one-line strip; tap to expand to full card.
 *  • Desktop: full info bar with countdown + CTA.
 *  • Dismissible (localStorage TTL — max 6 hours), then auto-resurrects.
 *  • Reactivation triggers: page refresh, 40% scroll past dismissal, 90s idle.
 *  • Hides automatically once the event ends.
 *  • Defers to the admin-controlled <EventStickyBar/> when a DB promotion
 *    with `showStickyBar = true` is active, so we never stack two top bars.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, MapPin, Calendar, ChevronRight, X, ChevronUp, Radio } from "lucide-react";
import { useActiveEventPromotion } from "@/hooks/useActiveEventPromotion";

const CAMPAIGN_SLUG = "warri-crusade-2026";
const CAMPAIGN_START = new Date("2026-04-30T18:00:00+01:00");
const CAMPAIGN_END = new Date("2026-05-01T21:00:00+01:00");
const CAMPAIGN_LOCATION = "Ighogbadu Primary School, Warri";
const CAMPAIGN_TITLE = "🔥 WARRI CRUSADE 2026 — POWERFUL MOVE OF GOD";
const CAMPAIGN_TITLE_SHORT = "🔥 Warri Crusade 2026";
const CTA_HREF = "/crusade";
const CTA_LABEL = "Register / Join";

const STORAGE_KEY = `jctm:${CAMPAIGN_SLUG}:dismissedAt`;
const DISMISS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours hard-cap
const IDLE_REACTIVATE_MS = 90 * 1000; // 90 s of no interaction
const SCROLL_REACTIVATE_RATIO = 0.4; // 40 % of page scrolled

function readDismissedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const ts = Number.parseInt(raw, 10);
    if (!Number.isFinite(ts)) return null;
    if (Date.now() - ts > DISMISS_TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return ts;
  } catch {
    return null;
  }
}

function writeDismissedAt(ts: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(ts));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

function clearDismissed(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  phase: "upcoming" | "live" | "ended";
}

function useCountdown(): CountdownState {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return useMemo<CountdownState>(() => {
    const start = CAMPAIGN_START.getTime();
    const end = CAMPAIGN_END.getTime();
    if (now >= end) return { days: 0, hours: 0, minutes: 0, seconds: 0, phase: "ended" };
    if (now >= start) {
      const diff = Math.max(end - now, 0);
      return {
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        phase: "live",
      };
    }
    const diff = Math.max(start - now, 0);
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
      phase: "upcoming",
    };
  }, [now]);
}

export function WarriCrusadeStickyBanner() {
  const countdown = useCountdown();
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lastInteractionRef = useRef<number>(Date.now());

  // Defer to admin-controlled sticky bar if a DB promotion is also active
  // to prevent two top bars stacking on top of each other.
  const { promotion } = useActiveEventPromotion();
  const adminBarActive = Boolean(
    promotion && promotion.showStickyBar && promotion.livePhase !== "ended",
  );

  useEffect(() => {
    setMounted(true);
    setDismissedAt(readDismissedAt());
  }, []);

  // ── Idle re-show: if user was inactive past IDLE_REACTIVATE_MS while
  //    dismissed, clear the dismissal so the banner returns.
  useEffect(() => {
    if (!mounted) return;
    const onActivity = () => {
      lastInteractionRef.current = Date.now();
    };
    const events = ["mousemove", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const id = window.setInterval(() => {
      if (dismissedAt === null) return;
      const idleFor = Date.now() - lastInteractionRef.current;
      if (idleFor >= IDLE_REACTIVATE_MS) {
        clearDismissed();
        setDismissedAt(null);
      }
    }, 5000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(id);
    };
  }, [mounted, dismissedAt]);

  // ── Scroll-trigger reactivation: scrolling past 40 % of the page after
  //    a dismissal brings the banner back.
  useEffect(() => {
    if (!mounted) return;
    if (dismissedAt === null) return;
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const ratio = window.scrollY / scrollable;
      if (ratio >= SCROLL_REACTIVATE_RATIO) {
        clearDismissed();
        setDismissedAt(null);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mounted, dismissedAt]);

  const handleDismiss = useCallback(() => {
    const ts = Date.now();
    writeDismissedAt(ts);
    setDismissedAt(ts);
    setExpanded(false);
  }, []);

  // ── Render gating ─────────────────────────────────────────────────────────
  if (!mounted) return null;
  if (countdown.phase === "ended") return null;
  if (adminBarActive) return null; // defer to existing DB-driven sticky bar
  if (dismissedAt !== null) return null;

  const isLive = countdown.phase === "live";

  return (
    <AnimatePresence>
      <motion.div
        key={`wc-sticky-${isLive ? "live" : "soon"}`}
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -48, opacity: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 24 }}
        role="region"
        aria-label="Warri Crusade 2026 campaign banner"
        data-testid="warri-crusade-sticky-banner"
        className="relative z-[70] w-full text-white shadow-lg"
        style={{
          background: isLive
            ? "linear-gradient(90deg,#1a0000 0%,#7f1d1d 35%,#dc2626 50%,#7f1d1d 65%,#1a0000 100%)"
            : "linear-gradient(90deg,#0a0a0a 0%,#3b0000 28%,#7f1d1d 50%,#3b0000 72%,#0a0a0a 100%)",
        }}
      >
        {/* Gold top accent line */}
        <div
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{ background: "linear-gradient(90deg, transparent, #FFD700, #D4A017, #FFD700, transparent)" }}
        />

        <div className="container mx-auto px-2 sm:px-4">
          {/* ── Compact strip (always rendered; on mobile tap to expand) ─── */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls="wc-sticky-expanded"
            className="flex w-full items-center gap-2 sm:gap-3 py-1.5 text-left"
            data-testid="warri-crusade-sticky-toggle"
          >
            <span
              className={
                "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest " +
                (isLive
                  ? "bg-white text-red-700 animate-pulse"
                  : "bg-yellow-400 text-[#1a0000]")
              }
            >
              {isLive ? (
                <>
                  <Radio className="h-3 w-3" /> Live
                </>
              ) : (
                <>
                  <Flame className="h-3 w-3" /> Live Soon
                </>
              )}
            </span>

            <span className="min-w-0 flex-1 truncate text-xs sm:text-sm font-bold tracking-wide">
              <span className="hidden sm:inline">{CAMPAIGN_TITLE}</span>
              <span className="sm:hidden">{CAMPAIGN_TITLE_SHORT} — Powerful Move of God</span>
            </span>

            {/* Desktop countdown chips */}
            {!isLive && (
              <span className="hidden md:inline-flex items-center gap-1 font-mono text-xs font-bold tabular-nums">
                <CountChip value={countdown.days} label="d" />
                <CountChip value={countdown.hours} label="h" />
                <CountChip value={countdown.minutes} label="m" />
                <CountChip value={countdown.seconds} label="s" />
              </span>
            )}

            {/* Desktop CTA */}
            <Link href={CTA_HREF}>
              <span
                role="button"
                onClick={(e) => e.stopPropagation()}
                className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full bg-yellow-400 px-3 py-1 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-[#1a0000] shadow-md transition-transform hover:scale-105"
                data-testid="warri-crusade-sticky-cta"
              >
                {CTA_LABEL} <ChevronRight className="h-3 w-3" />
              </span>
            </Link>

            {/* Mobile expand/collapse glyph */}
            <span className="sm:hidden inline-flex items-center text-yellow-300">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>

            <span
              role="button"
              tabIndex={0}
              aria-label="Hide Warri Crusade banner"
              data-testid="warri-crusade-sticky-dismiss"
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  handleDismiss();
                }
              }}
              className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-yellow-200/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          </button>

          {/* ── Mobile expanded panel ─────────────────────────────────────── */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                id="wc-sticky-expanded"
                key="wc-expanded"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="overflow-hidden sm:hidden"
              >
                <div className="pb-3 pt-1 space-y-2 text-xs text-white/90">
                  <p className="text-[11px] font-semibold text-yellow-200">
                    Be Ready For Rapture: Tribulation Is Coming!
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-yellow-300" /> Apr 30 – May 1, 2026 · 6 PM (WAT)
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-yellow-300" /> {CAMPAIGN_LOCATION}
                    </span>
                  </div>
                  {!isLive && (
                    <div className="flex items-center gap-1 font-mono font-bold tabular-nums">
                      <CountChip value={countdown.days} label="d" />
                      <CountChip value={countdown.hours} label="h" />
                      <CountChip value={countdown.minutes} label="m" />
                      <CountChip value={countdown.seconds} label="s" />
                    </div>
                  )}
                  <Link href={CTA_HREF}>
                    <button
                      type="button"
                      onClick={() => setExpanded(false)}
                      className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#1a0000] shadow-md"
                      data-testid="warri-crusade-sticky-cta-mobile"
                    >
                      {CTA_LABEL} <ChevronRight className="h-3 w-3" />
                    </button>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function CountChip({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline rounded-md bg-black/30 px-1.5 py-0.5">
      <span className="text-xs">{String(value).padStart(2, "0")}</span>
      <span className="ml-0.5 text-[10px] opacity-70">{label}</span>
    </span>
  );
}

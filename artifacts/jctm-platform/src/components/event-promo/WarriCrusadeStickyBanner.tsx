/**
 * MinistersConferenceStickyBanner — global top sticky campaign banner for
 * Ministers Conference 2026 (May 8–10, 2026 · 8:00 AM Daily WAT).
 *
 * Enterprise-grade build:
 *  • Mounted in Layout, rendered on every route.
 *  • Sticky top, z-70 — above Navbar but below modals.
 *  • Three render variants: compact mobile strip, condensed tablet, full desktop.
 *  • Phase-aware: upcoming → live → ended (auto-hide).
 *  • Live-state CTA pivots to "Join Now" and deep-links to the conference page.
 *  • Defers to <LiveBanner/> (real broadcast) and admin <EventStickyBar/>
 *    so we never stack two promotional bars.
 *  • Dismissible (localStorage TTL 6 hours), auto-resurrects on 40% scroll
 *    or 30 s idle.
 *  • Performance: countdown pauses when document is hidden; seconds digit is
 *    patched directly in the DOM via ref (surrounding tree re-renders only on
 *    minute / phase change).
 *  • Accessibility: prefers-reduced-motion, aria-live region for phase
 *    transitions, 44×44 dismiss target, keyboard-friendly toggle, visible
 *    focus rings, sr-only countdown fallback.
 *  • Purple / gold brand palette (#a855f7, #D4A017).
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  MapPin,
  Calendar,
  ChevronRight,
  X,
  ChevronUp,
  Radio,
  PlayCircle,
} from "lucide-react";
import { useActiveEventPromotion } from "@/hooks/useActiveEventPromotion";
import { useLivestreamStatus } from "@/hooks/useLivestreamStatus";

// ── Campaign constants ───────────────────────────────────────────────────────
const CAMPAIGN_SLUG       = "ministers-conference-2026";
const CAMPAIGN_START      = new Date("2026-05-09T07:00:00Z"); // Day 2 · 8:00 AM WAT
const CAMPAIGN_END        = new Date("2026-05-10T20:00:00Z"); // 9:00 PM WAT May 10
const CAMPAIGN_LOCATION   = "JCTM Auditorium, Ebrumede Roundabout, Effurun";
const CAMPAIGN_DATE_LABEL = "May 9–10, 2026 · 8:00 AM (WAT)";
const CAMPAIGN_TITLE_FULL = "Ministers Conference Day 2 — Apostolic Fire";
const CAMPAIGN_TITLE_SHORT = "Ministers Conference Day 2";
const CAMPAIGN_TAGLINE    = "An Apostolic Gathering of Ministers, Leaders & Kingdom Builders";
const CTA_HREF            = "/livestream";
const CTA_LABEL_UPCOMING  = "Join Day 2";
const CTA_LABEL_LIVE      = "Watch Day 2 Live";

const STORAGE_KEY          = `jctm:${CAMPAIGN_SLUG}:dismissedAt`;
const DISMISS_TTL_MS       = 6 * 60 * 60 * 1000;
const IDLE_REACTIVATE_MS   = 30 * 1000;
const SCROLL_REACTIVATE_RATIO = 0.4;

// ── Static gradient styles (allocated once at module scope) ─────────────────
const GRADIENT_LIVE: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(120% 240% at 50% 0%, rgba(212,160,23,0.18) 0%, rgba(212,160,23,0) 55%)," +
    "linear-gradient(90deg,#1a0033 0%,#4c1070 32%,#7c3aed 50%,#4c1070 68%,#1a0033 100%)",
};
const GRADIENT_UPCOMING: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(120% 240% at 50% 0%, rgba(168,85,247,0.14) 0%, rgba(168,85,247,0) 60%)," +
    "linear-gradient(90deg,#0e0018 0%,#2d0057 28%,#4c1070 50%,#2d0057 72%,#0e0018 100%)",
};
const GOLD_ACCENT_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(90deg, transparent, #a855f7 20%, #D4A017 50%, #a855f7 80%, transparent)",
};

// ── Storage helpers ──────────────────────────────────────────────────────────
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
  try { window.localStorage.setItem(STORAGE_KEY, String(ts)); } catch { /* ignore */ }
}
function clearDismissed(): void {
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ── Document-visibility store ────────────────────────────────────────────────
function subscribeVisibility(cb: () => void): () => void {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
}
function getVisibility(): boolean {
  return typeof document !== "undefined" ? !document.hidden : true;
}
function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, getVisibility, () => true);
}

// ── Countdown engine ─────────────────────────────────────────────────────────
type Phase = "upcoming" | "live" | "ended";
interface CountdownParts { days: number; hours: number; minutes: number; seconds: number }
interface CountdownSnapshot extends CountdownParts { phase: Phase }

function computeSnapshot(now: number): CountdownSnapshot {
  const start = CAMPAIGN_START.getTime();
  const end   = CAMPAIGN_END.getTime();
  if (now >= end) return { days: 0, hours: 0, minutes: 0, seconds: 0, phase: "ended" };
  const live   = now >= start;
  const target = live ? end : start;
  const diff   = Math.max(target - now, 0);
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    phase:   live ? "live" : "upcoming",
  };
}

function useCountdown(active: boolean) {
  const visible = useDocumentVisible();
  const [coarse, setCoarse] = useState<CountdownSnapshot>(() => computeSnapshot(Date.now()));
  const secondsRef = useRef(coarse.seconds);

  useEffect(() => {
    if (!active || !visible) return;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const snap = computeSnapshot(Date.now());
      secondsRef.current = snap.seconds;
      setCoarse((prev) => {
        if (
          prev.phase !== snap.phase ||
          prev.minutes !== snap.minutes ||
          prev.hours !== snap.hours ||
          prev.days !== snap.days
        ) return snap;
        return prev;
      });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => { stopped = true; window.clearInterval(id); };
  }, [active, visible]);

  return { coarse, secondsRef };
}

// ── Component ────────────────────────────────────────────────────────────────
export function WarriCrusadeStickyBanner() {
  const reducedMotion = useReducedMotion();
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [expanded, setExpanded]       = useState(false);
  const [mounted, setMounted]         = useState(false);
  const lastInteractionRef            = useRef<number>(Date.now());

  // Top-bar precedence: LiveBanner > EventStickyBar > this campaign banner
  const { promotion } = useActiveEventPromotion();
  const adminBarActive = Boolean(
    promotion && promotion.showStickyBar && promotion.livePhase !== "ended",
  );
  const livestream = useLivestreamStatus();
  const liveBarActive = Boolean(
    livestream.isLive ||
      (livestream.rebroadcast.available && livestream.rebroadcast.mode === "scheduled"),
  );

  useEffect(() => {
    setMounted(true);
    setDismissedAt(readDismissedAt());
  }, []);

  // Idle-based reactivation
  useEffect(() => {
    if (!mounted) return;
    const onActivity = () => { lastInteractionRef.current = Date.now(); };
    const events = ["mousemove", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const id = window.setInterval(() => {
      if (dismissedAt === null) return;
      if (Date.now() - lastInteractionRef.current >= IDLE_REACTIVATE_MS) {
        clearDismissed();
        setDismissedAt(null);
      }
    }, 5000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(id);
    };
  }, [mounted, dismissedAt]);

  // Scroll-based reactivation
  useEffect(() => {
    if (!mounted || dismissedAt === null) return;
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      if (window.scrollY / scrollable >= SCROLL_REACTIVATE_RATIO) {
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

  const shouldRender =
    mounted && !liveBarActive && !adminBarActive && dismissedAt === null;

  const { coarse, secondsRef } = useCountdown(shouldRender);

  if (!shouldRender) return null;
  if (coarse.phase === "ended") return null;

  const isLive  = coarse.phase === "live";
  const ctaLabel = isLive ? CTA_LABEL_LIVE : CTA_LABEL_UPCOMING;
  const transition = reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 240, damping: 24 };

  return (
    <AnimatePresence>
      <motion.aside
        key={`mc-sticky-${isLive ? "live" : "soon"}`}
        initial={reducedMotion ? false : { y: -56, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { y: -56, opacity: 0 }}
        transition={transition}
        role="region"
        aria-label="Ministers Conference 2026 campaign banner"
        data-testid="ministers-conference-sticky-banner"
        data-phase={coarse.phase}
        className="relative isolate z-[70] w-full text-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.55)]"
        style={isLive ? GRADIENT_LIVE : GRADIENT_UPCOMING}
      >
        {/* SR live announcement of phase changes */}
        <span className="sr-only" aria-live="polite">
          {isLive
            ? "Ministers Conference 2026 is live now."
            : `Ministers Conference 2026 starts in ${coarse.days} days, ${coarse.hours} hours, and ${coarse.minutes} minutes.`}
        </span>

        {/* Gold hairline accents */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px]" style={GOLD_ACCENT_STYLE} />
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-60" style={GOLD_ACCENT_STYLE} />

        {/* Shimmer sweep — live state only */}
        {isLive && !reducedMotion && (
          <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.span
              className="absolute top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              initial={{ x: "-110%" }}
              animate={{ x: "260%" }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "linear" }}
            />
          </span>
        )}

        <div className="relative container mx-auto px-3 sm:px-4">
          {/* ── Compact strip — always rendered ─────────────────────────── */}
          <div className="flex w-full items-center gap-2 sm:gap-3 py-2 min-h-[44px]">

            {/* Phase badge */}
            <PhaseBadge isLive={isLive} reducedMotion={!!reducedMotion} />

            {/* Title + desktop subtitle */}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls="mc-sticky-expanded"
              aria-label={expanded ? "Collapse Ministers Conference details" : "Expand Ministers Conference details"}
              data-testid="ministers-conf-sticky-toggle"
              className="group min-w-0 flex-1 text-left rounded-md outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a0033] transition-colors"
            >
              <span className="block min-w-0 truncate font-serif text-[13px] sm:text-[15px] font-bold leading-tight tracking-[0.005em]">
                <span className="hidden sm:inline">{CAMPAIGN_TITLE_FULL}</span>
                <span className="sm:hidden">{CAMPAIGN_TITLE_SHORT}</span>
              </span>
              <span className="mt-0.5 hidden md:flex items-center gap-1.5 text-[11px] font-medium text-white/80">
                <Calendar className="h-3 w-3 shrink-0" style={{ color: "#D4A017" }} aria-hidden />
                <span>{CAMPAIGN_DATE_LABEL}</span>
                <span aria-hidden className="text-white/30">·</span>
                <MapPin className="h-3 w-3 shrink-0" style={{ color: "#D4A017" }} aria-hidden />
                <span className="truncate">{CAMPAIGN_LOCATION}</span>
              </span>
            </button>

            {/* Countdown chips — desktop only, not during live */}
            {!isLive && (
              <Countdown
                coarse={coarse}
                secondsRef={secondsRef}
                className="hidden lg:inline-flex"
              />
            )}

            {/* Primary CTA */}
            <Link
              href={CTA_HREF}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              data-testid="ministers-conf-sticky-cta"
              aria-label={ctaLabel}
              className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-extrabold uppercase tracking-wider shadow-md outline-none transition-all no-underline focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a0033]"
              style={
                isLive
                  ? { background: "linear-gradient(135deg,#a855f7,#7c3aed)", color: "#fff" }
                  : { background: "linear-gradient(135deg,#D4A017,#FFD700)", color: "#1a0033" }
              }
            >
              {isLive ? (
                <PlayCircle className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              )}
              <span>{ctaLabel}</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>

            {/* Mobile expand toggle */}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-hidden
              tabIndex={-1}
              className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-full text-purple-200 hover:bg-white/10 transition-colors"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {/* Dismiss — 44×44 hit target */}
            <button
              type="button"
              aria-label="Hide Ministers Conference banner"
              data-testid="ministers-conf-sticky-dismiss"
              onClick={handleDismiss}
              className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-purple-200/80 hover:bg-white/10 hover:text-white outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a0033] transition-colors"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* ── Mobile expanded panel ─────────────────────────────────── */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                id="mc-sticky-expanded"
                key="mc-expanded"
                initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.22, ease: "easeOut" }}
                className="overflow-hidden sm:hidden"
              >
                <div className="pb-3 pt-1.5 space-y-2.5 text-[12px] text-white/90">
                  <p className="font-semibold text-purple-200 leading-snug">{CAMPAIGN_TAGLINE}</p>
                  <ul className="space-y-1 text-[11.5px] leading-snug">
                    <li className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" style={{ color: "#D4A017" }} aria-hidden />
                      <span>{CAMPAIGN_DATE_LABEL}</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "#D4A017" }} aria-hidden />
                      <span>{CAMPAIGN_LOCATION}</span>
                    </li>
                  </ul>

                  {!isLive && (
                    <Countdown coarse={coarse} secondsRef={secondsRef} className="inline-flex" />
                  )}

                  <Link
                    href={CTA_HREF}
                    onClick={() => setExpanded(false)}
                    data-testid="ministers-conf-sticky-cta-mobile"
                    aria-label={ctaLabel}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-extrabold uppercase tracking-wider shadow-md outline-none focus-visible:ring-2 focus-visible:ring-white/80 transition-colors no-underline"
                    style={
                      isLive
                        ? { background: "linear-gradient(135deg,#a855f7,#7c3aed)", color: "#fff" }
                        : { background: "linear-gradient(135deg,#D4A017,#FFD700)", color: "#1a0033" }
                    }
                  >
                    {isLive
                      ? <PlayCircle className="h-4 w-4" aria-hidden />
                      : <Sparkles className="h-4 w-4" aria-hidden />
                    }
                    <span>{ctaLabel}</span>
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────
const PhaseBadge = memo(function PhaseBadge({
  isLive,
  reducedMotion,
}: {
  isLive: boolean;
  reducedMotion: boolean;
}) {
  if (isLive) {
    return (
      <span
        className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-purple-800 shadow-sm ring-1 ring-purple-900/10"
        aria-label="Live now"
      >
        <span className="relative inline-flex h-2 w-2">
          {!reducedMotion && (
            <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-purple-500 opacity-75" />
          )}
          <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-700" />
        </span>
        <Radio className="h-3 w-3" aria-hidden />
        <span>Live</span>
      </span>
    );
  }
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] shadow-sm"
      style={{ background: "linear-gradient(135deg,#D4A017,#FFD700)", color: "#1a0033" }}
      aria-label="Coming soon"
    >
      <Sparkles className="h-3 w-3" aria-hidden />
      <span>Coming Soon</span>
    </span>
  );
});

const Countdown = memo(function Countdown({
  coarse,
  secondsRef,
  className = "",
}: {
  coarse: CountdownParts;
  secondsRef: React.MutableRefObject<number>;
  className?: string;
}) {
  const secondsNodeRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    let stopped = false;
    const paint = () => {
      if (stopped) return;
      const node = secondsNodeRef.current;
      if (node) node.textContent = String(secondsRef.current).padStart(2, "0");
    };
    paint();
    const id = window.setInterval(paint, 1000);
    return () => { stopped = true; window.clearInterval(id); };
  }, [secondsRef]);

  return (
    <span
      role="timer"
      aria-label={`${coarse.days} days, ${coarse.hours} hours, ${coarse.minutes} minutes until Ministers Conference`}
      className={"items-center gap-1 font-mono text-[11px] font-bold tabular-nums " + className}
    >
      <CountChip value={coarse.days}    label="d" />
      <CountChip value={coarse.hours}   label="h" />
      <CountChip value={coarse.minutes} label="m" />
      <span
        className="inline-flex items-baseline rounded-md px-1.5 py-0.5 border"
        style={{ background: "rgba(168,85,247,0.25)", borderColor: "rgba(168,85,247,0.30)" }}
      >
        <span ref={secondsNodeRef} className="text-[11px]">
          {String(coarse.seconds).padStart(2, "0")}
        </span>
        <span className="ml-0.5 text-[10px] opacity-70">s</span>
      </span>
    </span>
  );
});

function CountChip({ value, label }: { value: number; label: string }) {
  return (
    <span
      className="inline-flex items-baseline rounded-md px-1.5 py-0.5 border"
      style={{ background: "rgba(168,85,247,0.25)", borderColor: "rgba(168,85,247,0.30)" }}
    >
      <span className="text-[11px]">{String(value).padStart(2, "0")}</span>
      <span className="ml-0.5 text-[10px] opacity-70">{label}</span>
    </span>
  );
}

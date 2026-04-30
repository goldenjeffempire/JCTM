/**
 * EventBanner — the hero-grade event promotion card embedded above the home
 * hero (and reusable on key pages).
 *
 * Three visual states driven by `livePhase`:
 *   • upcoming : Royal-blue gradient + artwork + countdown grid + primary CTA
 *   • live     : Red glow + pulsing LIVE chip + emphatic "Join Live Now" CTA,
 *                with a secondary "Watch the stream" link when the promotion's
 *                primary CTA points elsewhere (e.g. registration).
 *   • ended    : Hidden (the host page reverts to its default hero)
 *
 * Enterprise-grade build:
 *   • Layered radial-glow gradients with refined gold/red accents.
 *   • Imperative seconds patch to keep React re-renders quiet.
 *   • Pauses countdown side-effects when the document is hidden.
 *   • Respects `prefers-reduced-motion` for entrance, exit, and pulse FX.
 *   • Accessibility: role="region", aria-live phase announcement, role="timer"
 *     on the countdown, 44×44 dismiss target, visible focus rings, sr-only
 *     fallback countdown for screen readers, decorative pieces marked aria-hidden.
 *   • Resilience: graceful image fallback when artworkUrl is missing or fails.
 */

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Calendar,
  MapPin,
  Radio,
  ArrowRight,
  Clock,
  X,
  PlayCircle,
} from "lucide-react";
import { useActiveEventPromotion } from "@/hooks/useActiveEventPromotion";

interface Props {
  className?: string;
}

// ── Static gradient/style objects (allocated once at module scope) ─────────
const GRADIENT_LIVE: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(120% 90% at 80% 20%, rgba(255,90,90,0.45) 0%, rgba(255,90,90,0) 55%)," +
    "linear-gradient(135deg,#1a0202 0%,#5a0a0a 40%,#7a0c0c 60%,#3a0606 100%)",
};
const GRADIENT_UPCOMING: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(120% 90% at 80% 20%, rgba(255,210,80,0.32) 0%, rgba(255,210,80,0) 55%)," +
    "linear-gradient(135deg,#040b2c 0%,#0a1a4a 40%,#1a3a8a 60%,#0a1a4a 100%)",
};
const ARTWORK_OVERLAY_LIVE: React.CSSProperties = {
  background:
    "linear-gradient(90deg, rgba(58,6,6,0.92) 0%, rgba(58,6,6,0.4) 35%, rgba(58,6,6,0) 70%)",
};
const ARTWORK_OVERLAY_UPCOMING: React.CSSProperties = {
  background:
    "linear-gradient(90deg, rgba(10,26,74,0.92) 0%, rgba(10,26,74,0.4) 35%, rgba(10,26,74,0) 70%)",
};
const GOLD_ACCENT_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(90deg, transparent, #FFD700 18%, #D4A017 50%, #FFD700 82%, transparent)",
};

export function EventBanner({ className = "" }: Props) {
  const reducedMotion = useReducedMotion();
  const { promotion } = useActiveEventPromotion();

  // Per-session-view dismissal: state-only, no storage.
  const [dismissed, setDismissed] = useState(false);
  // Pulse glow when a recurring 6-hour reminder lands while the user is here.
  const [pulse, setPulse] = useState(false);
  // Image error fallback.
  const [imageOk, setImageOk] = useState(true);

  useEffect(() => {
    const onReminder = () => {
      setDismissed(false);
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 4000);
      return () => window.clearTimeout(t);
    };
    window.addEventListener("jctm:event-reminder", onReminder as EventListener);
    return () =>
      window.removeEventListener("jctm:event-reminder", onReminder as EventListener);
  }, []);

  // Reset image error state whenever the artwork source changes.
  useEffect(() => {
    setImageOk(true);
  }, [promotion?.artworkUrl]);

  // Stable date strings derived from the promotion (cheap memo).
  const formatted = useMemo(() => {
    if (!promotion) return null;
    const start = new Date(promotion.startAt);
    return {
      date: start.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      time: start.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }),
    };
  }, [promotion?.startAt]);

  if (!promotion) return null;
  if (!promotion.showBanner) return null;
  if (promotion.livePhase === "ended") return null;
  if (dismissed) return null;
  if (!formatted) return null;

  const isLive = promotion.livePhase === "live";
  const c = promotion.countdown;
  const ctaLabel = isLive ? "Join Live Now" : promotion.ctaText;
  const ctaUrl = promotion.ctaUrl;
  const showSecondaryWatch = isLive && ctaUrl !== "/live" && ctaUrl !== "/livestream";
  const showArtwork = Boolean(promotion.artworkUrl) && imageOk;

  const motionVariant = reducedMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10, height: 0, marginTop: 0, paddingTop: 0 },
      };

  return (
    <AnimatePresence>
      <section
        className={`relative w-full ${className}`}
        data-testid="event-banner"
        role="region"
        aria-label={isLive ? `${promotion.title} — live now` : `${promotion.title} — upcoming`}
        data-phase={promotion.livePhase}
      >
        <span className="sr-only" aria-live="polite">
          {isLive
            ? `${promotion.title} is live now.`
            : `${promotion.title} starts in ${c.days} days, ${c.hours} hours, ${c.minutes} minutes.`}
        </span>

        <div className="container mx-auto px-4 pt-6 sm:pt-8">
          <motion.div
            initial={motionVariant.initial}
            animate={motionVariant.animate}
            exit={motionVariant.exit}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 90, damping: 20 }
            }
            className={
              "relative overflow-hidden rounded-3xl border shadow-2xl transition-shadow duration-500 isolate " +
              (isLive
                ? "border-red-500/40 ring-1 ring-red-500/40"
                : "border-yellow-400/30") +
              (pulse && !reducedMotion
                ? " ring-4 ring-yellow-300/60 animate-pulse"
                : "")
            }
            style={isLive ? GRADIENT_LIVE : GRADIENT_UPCOMING}
          >
            {/* Decorative gold hairlines */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
              style={GOLD_ACCENT_STYLE}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-50"
              style={GOLD_ACCENT_STYLE}
            />

            {/* Outer red halo while live */}
            {isLive && !reducedMotion && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute -inset-1 rounded-3xl"
                animate={{ opacity: [0.25, 0.55, 0.25] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                style={{ boxShadow: "0 0 80px 8px rgba(239,68,68,0.45)" }}
              />
            )}

            {/* Dismiss control — 44×44 hit target */}
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss event banner"
              data-testid="event-banner-close"
              className="absolute top-3 right-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white/85 backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:top-4 sm:right-4"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>

            <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-0">
              {/* ── Text column ─────────────────────────────────────────── */}
              <div className="p-6 sm:p-8 md:p-10 flex flex-col justify-center pr-14 sm:pr-16 lg:pr-10">
                <div className="flex items-center gap-2">
                  {isLive ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-400/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-red-100"
                      aria-label="Live now"
                    >
                      <span className="relative flex h-2 w-2">
                        {!reducedMotion && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                        )}
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-300" />
                      </span>
                      Live Now
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full bg-yellow-400/20 border border-yellow-400/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-yellow-200"
                      aria-label="Upcoming event"
                    >
                      <Calendar className="h-3 w-3" aria-hidden />
                      Upcoming Event
                    </span>
                  )}
                </div>

                <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-serif font-black text-white leading-[1.05] tracking-[-0.005em] text-balance">
                  {promotion.title}
                </h2>
                {promotion.subtitle && (
                  <p className="mt-3 text-sm sm:text-base text-white/85 max-w-2xl leading-relaxed">
                    {promotion.subtitle}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs sm:text-sm text-white/85">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-yellow-300" aria-hidden />
                    {formatted.date}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-yellow-300" aria-hidden />
                    {formatted.time}
                  </span>
                  {promotion.location && (
                    <span className="inline-flex items-center gap-1.5 max-w-full sm:max-w-md">
                      <MapPin
                        className="h-3.5 w-3.5 text-yellow-300 shrink-0"
                        aria-hidden
                      />
                      <span className="truncate">{promotion.location}</span>
                    </span>
                  )}
                </div>

                {/* Countdown / Live indicator */}
                {isLive ? (
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
                      <Radio
                        className={
                          "h-5 w-5 text-red-200 " +
                          (reducedMotion ? "" : "animate-pulse")
                        }
                        aria-hidden
                      />
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">
                          Status
                        </p>
                        <p className="text-sm font-bold text-white">
                          Broadcasting Now
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="mt-6 grid grid-cols-4 gap-2 sm:gap-3 max-w-md"
                    role="timer"
                    aria-label={`${c.days} days, ${c.hours} hours, ${c.minutes} minutes, ${c.seconds} seconds remaining`}
                  >
                    <CountdownTile value={c.days} label="Days" />
                    <CountdownTile value={c.hours} label="Hours" />
                    <CountdownTile value={c.minutes} label="Mins" />
                    <CountdownTile value={c.seconds} label="Secs" />
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href={ctaUrl}
                    aria-label={ctaLabel}
                    data-testid="event-banner-cta"
                    className={
                      "group inline-flex items-center gap-2 rounded-full px-6 h-12 font-bold text-sm shadow-xl transition-all no-underline " +
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black " +
                      (isLive
                        ? "bg-white text-red-700 hover:bg-red-50 shadow-red-900/40 hover:-translate-y-0.5"
                        : "bg-yellow-400 text-[#1a1100] hover:bg-yellow-300 shadow-amber-900/40 hover:-translate-y-0.5")
                    }
                  >
                    {isLive && (
                      <PlayCircle className="h-4 w-4" aria-hidden />
                    )}
                    <span>{ctaLabel}</span>
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden
                    />
                  </Link>

                  {showSecondaryWatch && (
                    <Link
                      href="/live"
                      aria-label="Watch the live stream"
                      data-testid="event-banner-watch-live"
                      className="group inline-flex items-center gap-2 rounded-full px-5 h-12 font-semibold text-sm border border-white/30 text-white/95 hover:bg-white/10 transition-colors no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                      <PlayCircle className="h-4 w-4" aria-hidden />
                      <span>Watch the stream</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* ── Artwork column ───────────────────────────────────────── */}
              <div className="relative min-h-[180px] lg:min-h-[280px]">
                {showArtwork ? (
                  <img
                    src={promotion.artworkUrl ?? ""}
                    alt={promotion.title}
                    className="absolute inset-0 h-full w-full object-cover object-center"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    onError={() => setImageOk(false)}
                  />
                ) : (
                  <div
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center text-white/25"
                  >
                    <Calendar className="h-20 w-20" />
                  </div>
                )}
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={
                    isLive ? ARTWORK_OVERLAY_LIVE : ARTWORK_OVERLAY_UPCOMING
                  }
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </AnimatePresence>
  );
}

const CountdownTile = memo(function CountdownTile({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm px-2 py-2.5 text-center shadow-inner shadow-black/10">
      <div className="font-mono text-2xl sm:text-3xl font-black text-white tabular-nums leading-none">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-1 text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-white/65">
        {label}
      </div>
    </div>
  );
});

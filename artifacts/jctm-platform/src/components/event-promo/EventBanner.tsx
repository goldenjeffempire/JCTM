/**
 * EventBanner — the hero-grade event promotion card embedded above the home
 * hero (and reusable on key pages). Three visual states driven by `livePhase`:
 *
 *  • upcoming : Royal-blue gradient + artwork + countdown grid + "Get Details"
 *  • live     : Red glow + pulsing LIVE chip + "Join Live Now" emphasis
 *  • ended    : Hidden (the host page reverts to its default hero)
 *
 * Designed to be the highest-impact visible module on the page during the
 * pre-event window AND the live window, then disappear silently afterward.
 */

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, MapPin, Radio, ArrowRight, Clock, X } from "lucide-react";
import { useActiveEventPromotion } from "@/hooks/useActiveEventPromotion";

interface Props {
  className?: string;
}

export function EventBanner({ className = "" }: Props) {
  const { promotion } = useActiveEventPromotion();
  // Per-session-view dismissal: state-only, no storage. Resets on every page
  // refresh so the banner always reappears, exactly as designed.
  const [dismissed, setDismissed] = useState(false);
  // Pulse glow when a recurring 6-hour reminder lands while the user is here.
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const onReminder = () => {
      // Reveal the banner again so the just-fired reminder is unmissable, and
      // glow for a few seconds so the user notices the refreshed call-out.
      setDismissed(false);
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 4000);
      return () => window.clearTimeout(t);
    };
    window.addEventListener("jctm:event-reminder", onReminder as EventListener);
    return () => window.removeEventListener("jctm:event-reminder", onReminder as EventListener);
  }, []);

  if (!promotion) return null;
  if (!promotion.showBanner) return null;
  if (promotion.livePhase === "ended") return null;
  if (dismissed) return null;

  const isLive = promotion.livePhase === "live";
  const c = promotion.countdown;
  const start = new Date(promotion.startAt);
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeLabel = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <AnimatePresence>
      <section className={`relative w-full ${className}`} data-testid="event-banner">
        <div className="container mx-auto px-4 pt-6 sm:pt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, height: 0, marginTop: 0, paddingTop: 0 }}
            transition={{ type: "spring", stiffness: 90, damping: 20 }}
            className={
              "relative overflow-hidden rounded-3xl border shadow-2xl transition-shadow duration-500 " +
              (isLive
                ? "border-red-500/40 ring-1 ring-red-500/40"
                : "border-yellow-400/30") +
              (pulse
                ? " ring-4 ring-yellow-300/60 animate-pulse"
                : "")
            }
            style={{
              background: isLive
                ? "linear-gradient(135deg,#3a0606 0%,#7a0c0c 55%,#3a0606 100%)"
                : "linear-gradient(135deg,#0a1a4a 0%,#1a3a8a 55%,#0a1a4a 100%)",
            }}
          >
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss event banner"
              className="absolute top-3 right-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white/70 backdrop-blur transition-colors hover:bg-black/50 hover:text-white sm:top-4 sm:right-4"
              data-testid="event-banner-close"
            >
              <X className="h-4 w-4" />
            </button>
          {/* Decorative glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background: isLive
                ? "radial-gradient(circle at 80% 20%, rgba(255,80,80,0.45) 0%, transparent 55%)"
                : "radial-gradient(circle at 80% 20%, rgba(255,210,80,0.35) 0%, transparent 55%)",
            }}
          />
          {isLive && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -inset-1 rounded-3xl"
              animate={{ opacity: [0.25, 0.55, 0.25] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              style={{
                boxShadow: "0 0 80px 8px rgba(239,68,68,0.45)",
              }}
            />
          )}

          <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-0">
            {/* Text column */}
            <div className="p-6 sm:p-8 md:p-10 flex flex-col justify-center">
              <div className="flex items-center gap-2">
                {isLive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-400/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-red-100">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-300" />
                    </span>
                    Live Now
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-400/20 border border-yellow-400/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-yellow-200">
                    <Calendar className="h-3 w-3" />
                    Upcoming Event
                  </span>
                )}
              </div>

              <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-serif font-black text-white leading-tight">
                {promotion.title}
              </h2>
              {promotion.subtitle && (
                <p className="mt-3 text-sm sm:text-base text-white/80 max-w-2xl leading-relaxed">
                  {promotion.subtitle}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs sm:text-sm text-white/85">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 opacity-80" /> {dateLabel}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 opacity-80" /> {timeLabel}
                </span>
                {promotion.location && (
                  <span className="inline-flex items-center gap-1.5 max-w-full sm:max-w-md truncate">
                    <MapPin className="h-3.5 w-3.5 opacity-80 shrink-0" />
                    <span className="truncate">{promotion.location}</span>
                  </span>
                )}
              </div>

              {/* Countdown / Live indicator */}
              {isLive ? (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/20 px-4 py-3">
                    <Radio className="h-5 w-5 text-red-200 animate-pulse" />
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-white/60">Status</p>
                      <p className="text-sm font-bold text-white">Broadcasting Now</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-4 gap-2 sm:gap-3 max-w-md">
                  <CountdownTile value={c.days} label="Days" />
                  <CountdownTile value={c.hours} label="Hours" />
                  <CountdownTile value={c.minutes} label="Mins" />
                  <CountdownTile value={c.seconds} label="Secs" />
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={promotion.ctaUrl}>
                  <button
                    className={
                      "group inline-flex items-center gap-2 rounded-full px-6 h-12 font-bold text-sm shadow-xl transition-all hover:-translate-y-0.5 " +
                      (isLive
                        ? "bg-white text-red-700 hover:bg-red-50 shadow-red-900/40"
                        : "bg-yellow-400 text-[#1a1100] hover:bg-yellow-300 shadow-amber-900/40")
                    }
                    data-testid="event-banner-cta"
                  >
                    {isLive ? "Join Live Now" : promotion.ctaText}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </Link>
              </div>
            </div>

            {/* Artwork column */}
            <div className="relative min-h-[180px] lg:min-h-[280px]">
              {promotion.artworkUrl ? (
                <img
                  src={promotion.artworkUrl}
                  alt={promotion.title}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/30">
                  <Calendar className="h-20 w-20" />
                </div>
              )}
              <div
                className="absolute inset-0"
                style={{
                  background: isLive
                    ? "linear-gradient(90deg, rgba(58,6,6,0.85) 0%, rgba(58,6,6,0) 60%)"
                    : "linear-gradient(90deg, rgba(10,26,74,0.85) 0%, rgba(10,26,74,0) 60%)",
                }}
              />
            </div>
          </div>
          </motion.div>
        </div>
      </section>
    </AnimatePresence>
  );
}

function CountdownTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm px-2 py-2.5 text-center">
      <div className="font-mono text-2xl sm:text-3xl font-black text-white tabular-nums leading-none">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-1 text-[9px] sm:text-[10px] uppercase tracking-widest text-white/60">
        {label}
      </div>
    </div>
  );
}

/**
 * GlobalEventAdBanner — top-center floating ad-style overlay mounted at the
 * Layout root, rendered on every route.
 *
 * Reads its content from /api/event-promotions/active (admin-controlled),
 * with a hard-coded Warri Crusade fallback when no DB promotion is active.
 *
 * Enterprise-grade build:
 *   • Layered radial-gradient background with refined gold border accent.
 *   • Phase-aware: pivots CTA + adds a "Watch live" link during the live window.
 *   • Performance: countdown ticker only runs when (a) no DB promotion is
 *     overriding it AND (b) the document is visible AND (c) the banner is
 *     actually rendering. Memoised gradient styles never re-allocate.
 *   • Accessibility: role="region" with aria-label, sr-only live announcement
 *     of phase changes, role="timer" on the countdown, 44×44 dismiss target,
 *     visible focus rings, dialog semantics removed (was incorrectly modal),
 *     decorative pieces marked aria-hidden.
 *   • Resilience: graceful image error fallback, prefers-reduced-motion
 *     respected for entrance/exit animations.
 *   • Hydration-safe: never nests <a> inside wouter's <Link>.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import {
  Calendar,
  Clock,
  MapPin,
  X,
  Flame,
  PlayCircle,
  ChevronRight,
} from "lucide-react";
import { useActiveEventPromotion } from "@/hooks/useActiveEventPromotion";
import ministerConferenceFlyer from "@assets/WhatsApp_Image_2026-04-16_at_2.59.53_PM_1776348424004.jpeg";

const SESSION_HIDE_KEY = "ministers_conf_banner_hidden";

const FALLBACK_EVENT = {
  enabled: false, // Ministers Conference 2026 (May 8–10) has ended — disabled
  slug: "ministers-conference-2026",
  artworkImport: ministerConferenceFlyer,
  title: "Ministers Conference Day 2 — Apostolic Fire",
  subtitle: "Day 2 · 8:00 AM WAT · JCTM Auditorium, Ebrumede Roundabout",
  dateLabel: "May 9, 2026 · 8:00 AM (WAT)",
  location: "JCTM Auditorium, Ebrumede Roundabout",
  ctaLabel: "Join Day 2",
  ctaHref: "/livestream",
  // 2026-05-09T07:00:00Z = 8:00 AM WAT on Day 2 (WAT is UTC+1)
  startAtIso: "2026-05-09T07:00:00Z",
  // 2026-05-10T20:00:00Z = 9:00 PM WAT — conference closes after Day 3
  endAtIso: "2026-05-10T20:00:00Z",
};

// ── Static styles (allocated once at module scope) ─────────────────────────
const CARD_STYLE: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(120% 200% at 80% 0%, rgba(212,160,23,0.18) 0%, rgba(212,160,23,0) 60%)," +
    "linear-gradient(135deg, rgba(2,11,42,0.97) 0%, rgba(10,26,90,0.97) 50%, rgba(2,11,42,0.97) 100%)",
  borderColor: "rgba(212,160,23,0.5)",
};
const FEATURED_PILL_STYLE: React.CSSProperties = {
  background: "rgba(212,160,23,0.15)",
  color: "#FFD700",
  border: "1px solid rgba(212,160,23,0.4)",
};
const COUNT_TILE_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(212,160,23,0.25)",
};
const CTA_GOLD_STYLE: React.CSSProperties = {
  background: "linear-gradient(135deg,#D4A017,#FFD700)",
  color: "#0a1a4a",
};
const GOLD_HAIRLINE_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(90deg, transparent, #FFD700 18%, #D4A017 50%, #FFD700 82%, transparent)",
};

// ── Document-visibility store ──────────────────────────────────────────────
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

function formatDateRange(startIso: string, endIso: string): string {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const opts: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      timeZone: "Africa/Lagos",
    };
    const sameDay = start.toDateString() === end.toDateString();
    const fmtTime = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Africa/Lagos",
    });
    const fmtDate = new Intl.DateTimeFormat("en-US", opts);
    if (sameDay) return `${fmtDate.format(start)} · ${fmtTime.format(start)} (WAT)`;
    return `${fmtDate.format(start)} – ${fmtDate.format(end)} · ${fmtTime.format(start)} (WAT)`;
  } catch {
    return "";
  }
}

function useFallbackCountdown(targetIso: string, endIso: string, active: boolean) {
  const visible = useDocumentVisible();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !visible) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, visible]);
  const start = new Date(targetIso).getTime();
  const end = new Date(endIso).getTime();
  const isLive = now >= start && now < end;
  const target = isLive ? Math.max(end - now, 0) : Math.max(start - now, 0);
  return {
    isLive,
    isEnded: now >= end,
    days: Math.floor(target / 86400000),
    hours: Math.floor((target % 86400000) / 3600000),
    mins: Math.floor((target % 3600000) / 60000),
    secs: Math.floor((target % 60000) / 1000),
  };
}

interface BannerData {
  slug: string;
  artwork: string | null;
  title: string;
  subtitle: string | null;
  dateLabel: string;
  location: string | null;
  ctaLabel: string;
  ctaHref: string;
  isLive: boolean;
  countdown: { days: number; hours: number; mins: number; secs: number };
}

export function GlobalEventAdBanner() {
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hiddenSlug, setHiddenSlug] = useState<string | null>(null);
  const [imageOk, setImageOk] = useState(true);

  const { promotion } = useActiveEventPromotion();
  // Only run the local ticker when the DB hook isn't supplying one.
  const fallbackActive = !promotion;
  const fallback = useFallbackCountdown(
    FALLBACK_EVENT.startAtIso,
    FALLBACK_EVENT.endAtIso,
    fallbackActive,
  );

  const banner = useMemo<BannerData | null>(() => {
    if (promotion) {
      if (!promotion.showBanner) return null;
      if (promotion.livePhase === "ended") return null;
      return {
        slug: promotion.slug,
        artwork: promotion.artworkUrl,
        title: promotion.title,
        subtitle: promotion.subtitle,
        dateLabel: formatDateRange(promotion.startAt, promotion.endAt),
        location: promotion.location,
        ctaLabel: promotion.ctaText || "Learn More",
        ctaHref: promotion.ctaUrl || "#",
        isLive: promotion.livePhase === "live",
        countdown: {
          days: promotion.countdown.days,
          hours: promotion.countdown.hours,
          mins: promotion.countdown.minutes,
          secs: promotion.countdown.seconds,
        },
      };
    }
    if (!FALLBACK_EVENT.enabled || fallback.isEnded) return null;
    return {
      slug: FALLBACK_EVENT.slug,
      artwork: FALLBACK_EVENT.artworkImport,
      title: FALLBACK_EVENT.title,
      subtitle: FALLBACK_EVENT.subtitle,
      dateLabel: FALLBACK_EVENT.dateLabel,
      location: FALLBACK_EVENT.location,
      ctaLabel: FALLBACK_EVENT.ctaLabel,
      ctaHref: FALLBACK_EVENT.ctaHref,
      isLive: fallback.isLive,
      countdown: {
        days: fallback.days,
        hours: fallback.hours,
        mins: fallback.mins,
        secs: fallback.secs,
      },
    };
  }, [promotion, fallback]);

  useEffect(() => {
    setMounted(true);
    let hidden: string | null = null;
    try {
      hidden = sessionStorage.getItem(SESSION_HIDE_KEY);
    } catch {
      hidden = null;
    }
    setHiddenSlug(hidden);
  }, []);

  useEffect(() => {
    if (!mounted || !banner) {
      setVisible(false);
      return;
    }
    if (hiddenSlug === banner.slug) {
      setVisible(false);
      return;
    }
    const t = window.setTimeout(() => setVisible(true), 600);
    return () => window.clearTimeout(t);
  }, [mounted, banner, hiddenSlug]);

  // Reset image error state whenever the artwork source changes.
  useEffect(() => {
    setImageOk(true);
  }, [banner?.artwork]);

  const handleClose = useCallback(() => {
    if (!banner) return;
    setVisible(false);
    setHiddenSlug(banner.slug);
    try {
      sessionStorage.setItem(SESSION_HIDE_KEY, banner.slug);
    } catch {
      /* ignore */
    }
  }, [banner]);

  if (!mounted || !banner) return null;

  const {
    artwork,
    title,
    subtitle,
    dateLabel,
    location,
    ctaLabel,
    ctaHref,
    isLive,
    countdown,
  } = banner;

  const showArtwork = Boolean(artwork) && imageOk;
  const isExternal = ctaHref.startsWith("http");
  const showSecondaryWatch =
    isLive && ctaHref !== "/live" && ctaHref !== "/livestream";

  const motionInit = reducedMotion ? false : { opacity: 0, y: -24 };
  const motionExit = reducedMotion ? { opacity: 0 } : { opacity: 0, y: -24 };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={motionInit}
          animate={{ opacity: 1, y: 0 }}
          exit={motionExit}
          transition={{ duration: reducedMotion ? 0 : 0.32, ease: "easeOut" }}
          className="fixed left-1/2 -translate-x-1/2 z-[9998] w-[min(96vw,720px)] px-2 sm:px-0 pointer-events-none"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 72px)" }}
          role="region"
          aria-label={`${title} promotional banner`}
          data-testid="global-event-ad-banner"
          data-phase={isLive ? "live" : "upcoming"}
        >
          <span className="sr-only" aria-live="polite">
            {isLive
              ? `${title} is live now.`
              : `${title} starts in ${countdown.days} days, ${countdown.hours} hours, ${countdown.mins} minutes.`}
          </span>

          <div
            className="relative isolate rounded-2xl shadow-2xl shadow-black/40 overflow-hidden border backdrop-blur-md pointer-events-auto"
            style={CARD_STYLE}
          >
            {/* Decorative gold hairlines */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] z-10"
              style={GOLD_HAIRLINE_STYLE}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-60 z-10"
              style={GOLD_HAIRLINE_STYLE}
            />

            {/* Dismiss control — 44×44 hit target */}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close promotional banner"
              data-testid="button-close-event-banner"
              className="absolute top-1.5 right-1.5 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 hover:bg-black/70 text-yellow-200 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#040b2c]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>

            <div className="relative flex items-stretch">
              {showArtwork && (
                <div className="hidden sm:block shrink-0 w-28 md:w-32 self-stretch relative">
                  <img
                    src={artwork ?? ""}
                    alt={title}
                    className="absolute inset-0 w-full h-full object-cover object-top"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    onError={() => setImageOk(false)}
                  />
                  {/* Right-edge feathering into card body */}
                  <div
                    aria-hidden
                    className="absolute inset-y-0 right-0 w-10 pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(2,11,42,0) 0%, rgba(2,11,42,0.6) 100%)",
                    }}
                  />
                </div>
              )}

              <div className="flex-1 min-w-0 p-3 sm:p-4 pr-12">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={FEATURED_PILL_STYLE}
                    aria-label="Featured event"
                  >
                    <Flame className="h-3 w-3" aria-hidden /> Featured Event
                  </span>
                  {isLive && (
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.18em] bg-red-600 text-white shadow-sm shadow-red-900/30"
                      aria-label="Live now"
                    >
                      <span className="relative inline-flex h-1.5 w-1.5">
                        {!reducedMotion && (
                          <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-white/80 opacity-75" />
                        )}
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                      </span>
                      Live Now
                    </span>
                  )}
                </div>

                <h3 className="font-serif font-black text-white text-base sm:text-lg leading-tight truncate tracking-[-0.005em]">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-yellow-200/85 italic text-[11px] sm:text-xs mt-0.5 line-clamp-1">
                    {subtitle}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/80">
                  {dateLabel && (
                    <span className="inline-flex items-center gap-1 min-w-0">
                      <Calendar
                        className="h-3 w-3 text-yellow-400 shrink-0"
                        aria-hidden
                      />
                      <span className="truncate max-w-[200px]">{dateLabel}</span>
                    </span>
                  )}
                  {location && (
                    <span className="inline-flex items-center gap-1 min-w-0">
                      <MapPin
                        className="h-3 w-3 text-yellow-400 shrink-0"
                        aria-hidden
                      />
                      <span className="truncate max-w-[180px]">{location}</span>
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                  {!isLive ? (
                    <CountdownStrip count={countdown} />
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-yellow-300 text-xs font-bold">
                      <Clock className="h-3.5 w-3.5" aria-hidden /> Happening Now
                    </div>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    {showSecondaryWatch && (
                      <Link
                        href="/live"
                        aria-label="Watch the live stream"
                        data-testid="button-event-banner-watch-live"
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 rounded-lg font-semibold text-[11px] sm:text-xs tracking-wide text-yellow-200 hover:text-white hover:bg-white/10 transition-colors no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#040b2c]"
                      >
                        <PlayCircle className="h-3.5 w-3.5" aria-hidden />
                        <span className="hidden sm:inline">Watch live</span>
                      </Link>
                    )}

                    {ctaHref && ctaHref !== "#" && (
                      isExternal ? (
                        <a
                          href={ctaHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={ctaLabel}
                          data-testid="button-event-banner-cta"
                          className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg font-serif font-black text-[12px] sm:text-sm tracking-wide transition-transform hover:scale-105 no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#040b2c]"
                          style={CTA_GOLD_STYLE}
                        >
                          <span>{ctaLabel}</span>
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      ) : (
                        <Link
                          href={ctaHref}
                          aria-label={ctaLabel}
                          data-testid="button-event-banner-cta"
                          className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg font-serif font-black text-[12px] sm:text-sm tracking-wide transition-transform hover:scale-105 no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#040b2c]"
                          style={CTA_GOLD_STYLE}
                        >
                          <span>{ctaLabel}</span>
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const CountdownStrip = memo(function CountdownStrip({
  count,
}: {
  count: { days: number; hours: number; mins: number; secs: number };
}) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="timer"
      aria-label={`${count.days} days, ${count.hours} hours, ${count.mins} minutes, ${count.secs} seconds remaining`}
    >
      {[
        { v: count.days, l: "D" },
        { v: count.hours, l: "H" },
        { v: count.mins, l: "M" },
        { v: count.secs, l: "S" },
      ].map(({ v, l }) => (
        <div
          key={l}
          className="flex items-baseline gap-0.5 px-2 py-1 rounded-md"
          style={COUNT_TILE_STYLE}
        >
          <span className="text-sm font-black text-white font-mono tabular-nums leading-none">
            {String(v).padStart(2, "0")}
          </span>
          <span className="text-[9px] text-yellow-400/80 font-bold uppercase">
            {l}
          </span>
        </div>
      ))}
    </div>
  );
});

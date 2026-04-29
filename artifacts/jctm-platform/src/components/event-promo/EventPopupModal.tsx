/**
 * EventPopupModal — session-aware, frequency-capped promotional modal.
 *
 *  • Appears once per browser session per (slug + phase) pair.
 *  • 24-hour soft-cooldown stored in localStorage so dismissed popups don't
 *    reappear on every new tab.
 *  • Auto-reopens once when the phase flips upcoming → live (the LIVE popup
 *    is independent of the upcoming popup).
 *  • 3-second delay before opening so it doesn't fight first-paint.
 *  • Disabled entirely when admin sets showPopup=false.
 */

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Calendar, MapPin, Radio, Clock } from "lucide-react";
import { useActiveEventPromotion } from "@/hooks/useActiveEventPromotion";

const SESSION_KEY = (slug: string, phase: string) => `jctm:event-popup:${slug}:${phase}:shown`;
const COOLDOWN_KEY = (slug: string, phase: string) => `jctm:event-popup:${slug}:${phase}:dismissedAt`;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function EventPopupModal() {
  const { promotion } = useActiveEventPromotion();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!promotion) return;
    if (!promotion.showPopup) return;
    if (promotion.livePhase === "ended") return;

    const sKey = SESSION_KEY(promotion.slug, promotion.livePhase);
    const cKey = COOLDOWN_KEY(promotion.slug, promotion.livePhase);

    let alreadyShownThisSession = false;
    let cooldownActive = false;
    try {
      alreadyShownThisSession = window.sessionStorage.getItem(sKey) === "1";
      const dismissedAt = Number(window.localStorage.getItem(cKey) ?? "0");
      cooldownActive = dismissedAt > 0 && Date.now() - dismissedAt < COOLDOWN_MS;
    } catch {
      // storage may be unavailable — fail open, show popup
    }

    if (alreadyShownThisSession || cooldownActive) return;

    const t = window.setTimeout(() => {
      setOpen(true);
      try {
        window.sessionStorage.setItem(sKey, "1");
      } catch {
        /* ignore */
      }
    }, 3_000);

    return () => window.clearTimeout(t);
  }, [promotion?.slug, promotion?.livePhase, promotion?.showPopup]);

  if (!promotion) return null;
  const isLive = promotion.livePhase === "live";

  const close = () => {
    try {
      window.localStorage.setItem(
        COOLDOWN_KEY(promotion.slug, promotion.livePhase),
        String(Date.now()),
      );
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const c = promotion.countdown;
  const start = new Date(promotion.startAt);
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeLabel = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] bg-black/55 backdrop-blur-sm"
            onClick={close}
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 230, damping: 24 }}
            role="dialog"
            aria-modal="true"
            aria-label={`${promotion.title} promotion`}
            className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-4"
          >
            <div
              className="relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl border border-white/10"
              style={{
                background: isLive
                  ? "linear-gradient(155deg,#3a0606 0%,#7a0c0c 60%,#3a0606 100%)"
                  : "linear-gradient(155deg,#0a1a4a 0%,#1a3a8a 60%,#0a1a4a 100%)",
              }}
              onClick={(e) => e.stopPropagation()}
              data-testid="event-popup"
            >
              <button
                type="button"
                onClick={close}
                aria-label="Close event popup"
                className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors z-10"
              >
                <X className="h-4 w-4" />
              </button>

              {promotion.artworkUrl && (
                <div className="relative h-44 w-full">
                  <img
                    src={promotion.artworkUrl}
                    alt={promotion.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: isLive
                        ? "linear-gradient(180deg, rgba(58,6,6,0) 40%, rgba(58,6,6,0.95) 100%)"
                        : "linear-gradient(180deg, rgba(10,26,74,0) 40%, rgba(10,26,74,0.95) 100%)",
                    }}
                  />
                </div>
              )}

              <div className="p-6">
                <div className="flex items-center gap-2">
                  {isLive ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/30 border border-red-400/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-100">
                      <Radio className="h-3 w-3 animate-pulse" />
                      Live Now
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-400/20 border border-yellow-400/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-yellow-200">
                      <Calendar className="h-3 w-3" />
                      Coming Soon
                    </span>
                  )}
                </div>

                <h3 className="mt-3 text-2xl font-serif font-black text-white leading-tight">
                  {promotion.title}
                </h3>
                {promotion.subtitle && (
                  <p className="mt-2 text-sm text-white/75 leading-relaxed line-clamp-3">
                    {promotion.subtitle}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/70">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {dateLabel}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {timeLabel}
                  </span>
                  {promotion.location && (
                    <span className="inline-flex items-center gap-1 max-w-full truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{promotion.location}</span>
                    </span>
                  )}
                </div>

                {!isLive && (
                  <div className="mt-4 grid grid-cols-4 gap-1.5">
                    <PopupTile value={c.days} label="D" />
                    <PopupTile value={c.hours} label="H" />
                    <PopupTile value={c.minutes} label="M" />
                    <PopupTile value={c.seconds} label="S" />
                  </div>
                )}

                <Link href={promotion.ctaUrl}>
                  <button
                    onClick={close}
                    className={
                      "mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full h-11 font-bold text-sm shadow-lg transition-all hover:-translate-y-0.5 " +
                      (isLive
                        ? "bg-white text-red-700 hover:bg-red-50"
                        : "bg-yellow-400 text-[#1a1100] hover:bg-yellow-300")
                    }
                    data-testid="event-popup-cta"
                  >
                    {isLive ? "Join Live Now" : promotion.ctaText}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function PopupTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-white/10 border border-white/15 px-1.5 py-2 text-center">
      <div className="font-mono text-lg font-black text-white tabular-nums leading-none">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-widest text-white/60">{label}</div>
    </div>
  );
}

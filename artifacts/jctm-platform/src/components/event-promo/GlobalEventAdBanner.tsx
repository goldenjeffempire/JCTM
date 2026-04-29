import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "wouter";
import { Calendar, Clock, MapPin, X, Flame } from "lucide-react";

const SESSION_HIDE_KEY = "warri_banner_hidden";

const EVENT_CONFIG = {
  enabled: true,
  artwork: "/warri-crusade-flyer2.jpeg",
  title: "Warri City Crusade 2026",
  subtitle: "Be Ready For Rapture: Tribulation Is Coming!",
  dateLabel: "Apr 30 – May 1, 2026 · 6:00 PM (WAT)",
  location: "Ighogbadu Primary School, Warri",
  ctaLabel: "Register to Attend",
  ctaHref: "/crusade",
  startAtIso: "2026-04-30T18:00:00+01:00",
};

function useCountdown(targetIso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, new Date(targetIso).getTime() - now);
  return {
    diff,
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  };
}

export function GlobalEventAdBanner() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const { diff, days, hours, mins, secs } = useCountdown(EVENT_CONFIG.startAtIso);

  useEffect(() => {
    setMounted(true);
    if (!EVENT_CONFIG.enabled) return;
    let hidden = false;
    try {
      hidden = sessionStorage.getItem(SESSION_HIDE_KEY) === "true";
    } catch {
      hidden = false;
    }
    if (!hidden) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const handleClose = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(SESSION_HIDE_KEY, "true");
    } catch {
      /* ignore */
    }
  };

  if (!mounted || !EVENT_CONFIG.enabled) return null;

  const isLive = diff <= 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed left-1/2 -translate-x-1/2 z-[9998] w-[min(96vw,720px)] px-2 sm:px-0"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
          role="dialog"
          aria-label="Warri City Crusade 2026 promotional banner"
          data-testid="global-event-ad-banner"
        >
          <div
            className="relative rounded-2xl shadow-2xl shadow-black/40 overflow-hidden border backdrop-blur-md"
            style={{
              background:
                "linear-gradient(135deg, rgba(2,11,42,0.96) 0%, rgba(10,26,90,0.96) 50%, rgba(2,11,42,0.96) 100%)",
              borderColor: "rgba(212,160,23,0.5)",
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close promotional banner"
              data-testid="button-close-event-banner"
              className="absolute top-2 right-2 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-yellow-300 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-stretch">
              <div className="hidden sm:block shrink-0 w-28 md:w-32 self-stretch">
                <img
                  src={EVENT_CONFIG.artwork}
                  alt={EVENT_CONFIG.title}
                  className="w-full h-full object-cover object-top"
                  loading="eager"
                  decoding="async"
                />
              </div>

              <div className="flex-1 min-w-0 p-3 sm:p-4 pr-10">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
                    style={{
                      background: "rgba(212,160,23,0.15)",
                      color: "#FFD700",
                      border: "1px solid rgba(212,160,23,0.4)",
                    }}
                  >
                    <Flame className="h-3 w-3" /> Featured Event
                  </span>
                  {isLive && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-red-600 text-white animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" /> Live Now
                    </span>
                  )}
                </div>

                <h3 className="font-serif font-black text-white text-base sm:text-lg leading-tight truncate">
                  {EVENT_CONFIG.title}
                </h3>
                <p className="text-yellow-200/80 italic text-[11px] sm:text-xs mt-0.5 line-clamp-1">
                  {EVENT_CONFIG.subtitle}
                </p>

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/75">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-yellow-400" />
                    <span className="truncate max-w-[200px]">{EVENT_CONFIG.dateLabel}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-yellow-400" />
                    <span className="truncate max-w-[180px]">{EVENT_CONFIG.location}</span>
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  {!isLive ? (
                    <div className="flex items-center gap-1.5">
                      {[
                        { v: days, l: "D" },
                        { v: hours, l: "H" },
                        { v: mins, l: "M" },
                        { v: secs, l: "S" },
                      ].map(({ v, l }) => (
                        <div
                          key={l}
                          className="flex items-baseline gap-0.5 px-2 py-1 rounded-md"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(212,160,23,0.25)",
                          }}
                        >
                          <span className="text-sm font-black text-white font-mono tabular-nums leading-none">
                            {String(v).padStart(2, "0")}
                          </span>
                          <span className="text-[9px] text-yellow-400/70 font-bold uppercase">{l}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 text-yellow-300 text-xs font-bold">
                      <Clock className="h-3.5 w-3.5" /> Happening Now
                    </div>
                  )}

                  <Link href={EVENT_CONFIG.ctaHref}>
                    <button
                      type="button"
                      data-testid="button-event-banner-cta"
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg font-serif font-black text-[12px] sm:text-sm tracking-wide transition-transform hover:scale-105"
                      style={{
                        background: "linear-gradient(135deg,#D4A017,#FFD700)",
                        color: "#0a1a4a",
                      }}
                    >
                      {EVENT_CONFIG.ctaLabel}
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

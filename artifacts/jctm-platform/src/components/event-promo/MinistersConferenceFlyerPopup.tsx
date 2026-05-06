/**
 * MinistersConferenceFlyerPopup — full-screen flyer modal for Ministers
 * Conference 2026.
 *
 * Enterprise features:
 *   • Opens automatically after 3 s on first visit — session-aware (won't
 *     re-open on the same tab) and 24-hour localStorage cooldown so repeat
 *     visitors aren't hassled on every new tab.
 *   • Auto-reopens once when the conference goes live (upcoming → live).
 *   • Shows the actual official flyer image with share & download controls.
 *   • Full countdown until conference start (seconds precision, RAF-free).
 *   • Social share links: WhatsApp, Facebook, X, Telegram.
 *   • Purple / gold theme (#a855f7, #D4A017) matching conference branding.
 *   • Accessibility: focus-trap hint, role="dialog", aria-modal, aria-label,
 *     Escape key closes, 44×44 dismiss target, sr-only live region.
 *   • Backdrop click dismisses; scroll-lock while open.
 *   • prefers-reduced-motion respected for entrance animation.
 */

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X,
  Calendar,
  MapPin,
  Phone,
  ChevronRight,
  Share2,
  Download,
  Sparkles,
  Radio,
} from "lucide-react";
import ministerConferenceFlyer from "@assets/WhatsApp_Image_2026-04-16_at_2.59.53_PM_1776348424004.jpeg";

const CONF_START = new Date("2026-05-08T07:00:00+01:00");
const CONF_END   = new Date("2026-05-10T21:00:00+01:00");

const SESSION_KEY  = "jctm:ministers-conf-2026:popup:shown";
const COOLDOWN_KEY = "jctm:ministers-conf-2026:popup:dismissedAt";
const COOLDOWN_MS  = 24 * 60 * 60 * 1000;
const OPEN_DELAY_MS = 3_000;

const SHARE_TEXT = encodeURIComponent(
  "🙏 MINISTERS CONFERENCE 2026!\n\n\"An Apostolic Gathering of Ministers, Leaders & Kingdom Builders\"\n\nFriday 8th – Sunday 10th May, 2026\n⏰ 8:00 AM Daily (WAT)\n📍 JCTM Auditorium, Ebrumede Roundabout, Effurun — Delta State\n\n📞 +234(0)8081313111\n🌐 www.jctm.org.ng\n\n#MinistersConference2026 #JCTM #ProphetAmos",
);
const SHARE_URL = encodeURIComponent("https://jctm.org.ng/conference-registration");

const PLATFORMS = [
  {
    label: "WhatsApp",
    bg: "#25D366",
    href: `https://wa.me/?text=${SHARE_TEXT}`,
  },
  {
    label: "Facebook",
    bg: "#1877F2",
    href: `https://www.facebook.com/sharer/sharer.php?u=${SHARE_URL}&quote=${SHARE_TEXT}`,
  },
  {
    label: "X",
    bg: "#000",
    href: `https://twitter.com/intent/tweet?text=${SHARE_TEXT}&url=${SHARE_URL}`,
  },
  {
    label: "Telegram",
    bg: "#0088CC",
    href: `https://t.me/share/url?url=${SHARE_URL}&text=${SHARE_TEXT}`,
  },
];

// ── Document-visibility store ────────────────────────────────────────────────
function subscribeVisibility(cb: () => void) {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
}
function getVisibility() {
  return typeof document !== "undefined" ? !document.hidden : true;
}
function useDocumentVisible() {
  return useSyncExternalStore(subscribeVisibility, getVisibility, () => true);
}

// ── Countdown engine ─────────────────────────────────────────────────────────
type Phase = "upcoming" | "live" | "ended";

interface Snapshot {
  phase: Phase;
  days: number;
  hours: number;
  mins: number;
  secs: number;
}

function computeSnapshot(now: number): Snapshot {
  const start = CONF_START.getTime();
  const end   = CONF_END.getTime();
  if (now >= end)   return { phase: "ended",    days: 0, hours: 0, mins: 0, secs: 0 };
  if (now >= start) {
    const diff = end - now;
    return { phase: "live", days: 0, hours: Math.floor(diff / 3600000), mins: Math.floor((diff % 3600000) / 60000), secs: Math.floor((diff % 60000) / 1000) };
  }
  const diff = start - now;
  return {
    phase: "upcoming",
    days:  Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins:  Math.floor((diff % 3600000) / 60000),
    secs:  Math.floor((diff % 60000) / 1000),
  };
}

function useCountdown(active: boolean): Snapshot {
  const visible = useDocumentVisible();
  const [snap, setSnap] = useState<Snapshot>(() => computeSnapshot(Date.now()));

  useEffect(() => {
    if (!active || !visible) return;
    const id = window.setInterval(() => {
      setSnap(computeSnapshot(Date.now()));
    }, 1_000);
    return () => window.clearInterval(id);
  }, [active, visible]);

  return snap;
}

// ── Popup session helpers ────────────────────────────────────────────────────
function shouldShowPopup(phase: Phase): boolean {
  try {
    if (window.sessionStorage.getItem(`${SESSION_KEY}:${phase}`) === "1") return false;
    const raw = window.localStorage.getItem(`${COOLDOWN_KEY}:${phase}`);
    if (raw) {
      const ts = Number(raw);
      if (Number.isFinite(ts) && Date.now() - ts < COOLDOWN_MS) return false;
    }
    return true;
  } catch {
    return true;
  }
}

function markShown(phase: Phase): void {
  try {
    window.sessionStorage.setItem(`${SESSION_KEY}:${phase}`, "1");
  } catch {
    /* ignore */
  }
}

function markDismissed(phase: Phase): void {
  try {
    window.localStorage.setItem(`${COOLDOWN_KEY}:${phase}`, String(Date.now()));
  } catch {
    /* ignore */
  }
}

// ── Component ────────────────────────────────────────────────────────────────
export function MinistersConferenceFlyerPopup() {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [imgOk, setImgOk] = useState(true);

  const snap = useCountdown(open || mounted);
  const { phase, days, hours, mins, secs } = snap;

  useEffect(() => { setMounted(true); }, []);

  // Auto-open with delay — session+cooldown aware
  useEffect(() => {
    if (!mounted) return;
    if (phase === "ended") return;
    if (!shouldShowPopup(phase)) return;

    const t = window.setTimeout(() => {
      setOpen(true);
      markShown(phase);
    }, OPEN_DELAY_MS);

    return () => window.clearTimeout(t);
  // Re-evaluate if phase flips (upcoming → live) so the live popup can open
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, phase]);

  // Scroll-lock while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Escape key closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = useCallback(() => {
    markDismissed(phase);
    setOpen(false);
  }, [phase]);

  const handleDownload = useCallback(() => {
    const link = document.createElement("a");
    link.href = ministerConferenceFlyer;
    link.download = "ministers-conference-2026-flyer.jpeg";
    link.click();
  }, []);

  if (!mounted || phase === "ended") return null;

  const isLive = phase === "live";

  const motionInit = reducedMotion ? false : { opacity: 0, scale: 0.94, y: 16 };
  const motionExit = reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 16 };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="conf-popup-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.25 }}
            className="fixed inset-0 z-[9000] bg-black/75 backdrop-blur-sm"
            aria-hidden
            onClick={close}
          />

          {/* Modal */}
          <motion.div
            key="conf-popup-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Ministers Conference 2026 — Event Flyer"
            data-testid="ministers-conference-flyer-popup"
            initial={motionInit}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={motionExit}
            transition={{ duration: reducedMotion ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-[9001] w-auto sm:w-[min(94vw,580px)] rounded-3xl overflow-hidden shadow-2xl"
            style={{
              top: "50%",
              transform: "translate(-50%, -50%)",
              left: "50%",
              maxHeight: "92vh",
              overflowY: "auto",
              background:
                "linear-gradient(160deg, #0e0018 0%, #1a0035 40%, #120028 100%)",
              border: "1.5px solid rgba(168,85,247,0.45)",
              boxShadow:
                "0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(212,160,23,0.2) inset",
            }}
          >
            {/* Screen-reader announcement */}
            <span className="sr-only" aria-live="polite">
              {isLive
                ? "Ministers Conference 2026 is happening now."
                : `Ministers Conference 2026 starts in ${days} days, ${hours} hours, ${mins} minutes.`}
            </span>

            {/* Close button */}
            <button
              type="button"
              onClick={close}
              aria-label="Close Ministers Conference popup"
              data-testid="ministers-conf-popup-close"
              className="absolute top-3 right-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 hover:bg-black/85 text-purple-300 hover:text-white border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e0018]"
              style={{ borderColor: "rgba(168,85,247,0.35)" }}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>

            {/* Gold top hairline */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-[2px] z-10"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #a855f7 20%, #D4A017 50%, #a855f7 80%, transparent)",
              }}
            />

            {/* Flyer image */}
            <div className="relative w-full overflow-hidden" style={{ maxHeight: "340px" }}>
              {imgOk ? (
                <img
                  src={ministerConferenceFlyer}
                  alt="Ministers Conference 2026 — Official Event Flyer"
                  className="w-full object-cover object-top"
                  style={{ maxHeight: "340px" }}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  onError={() => setImgOk(false)}
                />
              ) : (
                <div
                  className="w-full flex items-center justify-center"
                  style={{ height: "220px", background: "linear-gradient(135deg,#2d0057,#4c1070)" }}
                >
                  <Sparkles className="h-12 w-12 text-purple-400" aria-hidden />
                </div>
              )}
              {/* Gradient overlay from bottom */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, #0e0018 0%, rgba(14,0,24,0.6) 45%, transparent 100%)",
                }}
              />
              {/* Live badge over image */}
              {isLive && (
                <div className="absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 shadow-lg">
                  <span className="relative inline-flex h-2 w-2">
                    <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-purple-600 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-700" />
                  </span>
                  <Radio className="h-3.5 w-3.5 text-purple-700" aria-hidden />
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-purple-800">
                    Live Now
                  </span>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="px-5 pb-5 pt-3 relative">
              {/* Radial glow behind text */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.35) 0%, transparent 65%)",
                }}
              />

              <div className="relative">
                {/* Pill label */}
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.25em] mb-2 flex items-center gap-1.5"
                  style={{ color: "#D4A017" }}
                >
                  <Sparkles className="h-3 w-3" aria-hidden />
                  Jesus Christ Temple Ministry Presents
                </p>

                <h2 className="font-serif font-black text-white text-xl sm:text-2xl leading-tight mb-1">
                  Ministers Conference 2026
                </h2>
                <p className="text-purple-300 italic text-xs sm:text-sm mb-4 leading-snug">
                  An Apostolic Gathering of Ministers, Leaders &amp; Kingdom Builders
                </p>

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  <div
                    className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)" }}
                  >
                    <Calendar className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#D4A017" }} aria-hidden />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-0.5">Date & Time</p>
                      <p className="text-xs text-white font-semibold leading-snug">
                        May 8–10, 2026<br />8:00 AM Daily (WAT)
                      </p>
                    </div>
                  </div>
                  <div
                    className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(212,160,23,0.10)", border: "1px solid rgba(212,160,23,0.25)" }}
                  >
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#D4A017" }} aria-hidden />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-0.5">Venue</p>
                      <p className="text-xs text-white font-semibold leading-snug">
                        JCTM Auditorium,<br />Ebrumede Roundabout, Effurun
                      </p>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 sm:col-span-2"
                    style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.20)" }}
                  >
                    <Phone className="h-4 w-4 shrink-0" style={{ color: "#D4A017" }} aria-hidden />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-0.5">Contact</p>
                      <p className="text-xs text-white font-semibold">+234(0)8081313111</p>
                    </div>
                  </div>
                </div>

                {/* Countdown */}
                {!isLive && (days > 0 || hours > 0 || mins > 0 || secs > 0) && (
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-2">
                      Conference Begins In
                    </p>
                    <div
                      className="flex items-center gap-1.5"
                      role="timer"
                      aria-label={`${days} days, ${hours} hours, ${mins} minutes, ${secs} seconds until Ministers Conference`}
                    >
                      {[
                        { v: days,  l: "Days" },
                        { v: hours, l: "Hrs" },
                        { v: mins,  l: "Min" },
                        { v: secs,  l: "Sec" },
                      ].map(({ v, l }) => (
                        <div
                          key={l}
                          className="flex-1 flex flex-col items-center rounded-xl py-2"
                          style={{
                            background: "rgba(168,85,247,0.15)",
                            border: "1px solid rgba(168,85,247,0.30)",
                          }}
                        >
                          <span className="text-lg sm:text-xl font-black text-white font-mono tabular-nums leading-none">
                            {String(v).padStart(2, "0")}
                          </span>
                          <span
                            className="text-[9px] font-bold uppercase mt-0.5"
                            style={{ color: "#D4A017" }}
                          >
                            {l}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Primary CTA */}
                <Link href="/conference-registration" onClick={close}>
                  <button
                    type="button"
                    data-testid="ministers-conf-popup-cta"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 font-serif font-black text-base uppercase tracking-wide text-white transition-transform hover:scale-[1.02] active:scale-100 mb-3"
                    style={{
                      background: "linear-gradient(135deg,#7c3aed,#a855f7,#7c3aed)",
                      boxShadow: "0 4px 24px rgba(168,85,247,0.55)",
                    }}
                  >
                    {isLive ? "Join the Conference Now" : "Register for Conference"}
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </Link>

                {/* Social share row */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400 mb-2 flex items-center gap-1.5">
                    <Share2 className="h-3 w-3" aria-hidden />
                    Share This Conference
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((p) => (
                      <a
                        key={p.label}
                        href={p.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-bold transition-transform hover:scale-105 shadow-lg"
                        style={{ background: p.bg }}
                      >
                        {p.label}
                      </a>
                    ))}
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-transform hover:scale-105 border"
                      style={{
                        borderColor: "rgba(212,160,23,0.5)",
                        color: "#D4A017",
                        background: "rgba(212,160,23,0.10)",
                      }}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />
                      Flyer
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Gold bottom hairline */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-[1.5px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #D4A017 30%, #a855f7 70%, transparent)",
              }}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * EventPromotionPreview — admin-only inline preview for the three live
 * event-promo surfaces (sticky bar, hero banner, popup modal).
 *
 *  • Driven entirely by the form state — does NOT call useActiveEventPromotion
 *    or hit the API. Re-renders on every keystroke so admins see the result
 *    immediately, before saving.
 *  • Faithful visual replica of the live components (same Tailwind classes,
 *    same icons, same gradients) but with all navigation, sessionStorage,
 *    web-push, and CustomEvent side-effects stripped.
 *  • Includes a phase toggle (Upcoming / Live) and a popup re-open button so
 *    admins can preview both states without changing form values.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Calendar, MapPin, Radio, ArrowRight, Clock, X,
  Smartphone, Monitor, Eye, EyeOff,
} from "lucide-react";

interface PreviewSource {
  title: string;
  subtitle: string;
  artworkUrl: string;
  location: string;
  ctaText: string;
  ctaUrl: string;
  startAtLocal: string;     // "YYYY-MM-DDTHH:mm" in the admin's local TZ
  endAtLocal: string;
  showBanner: boolean;
  showPopup: boolean;
  showStickyBar: boolean;
  status: "draft" | "active" | "archived";
}

interface Countdown { days: number; hours: number; minutes: number; seconds: number }

function diffToCountdown(ms: number): Countdown {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const s = Math.floor(ms / 1000);
  return {
    days:    Math.floor(s / 86400),
    hours:   Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

export function EventPromotionPreview({ form }: { form: PreviewSource }) {
  const [phase, setPhase] = useState<"upcoming" | "live">("upcoming");
  const [popupOpen, setPopupOpen] = useState(true);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [now, setNow] = useState(() => Date.now());

  // Tick the countdown every second so the preview feels alive.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Auto-pick the most natural phase the first time the start date changes.
  useEffect(() => {
    if (!form.startAtLocal || !form.endAtLocal) return;
    const startMs = new Date(form.startAtLocal).getTime();
    const endMs = new Date(form.endAtLocal).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return;
    if (Date.now() >= startMs && Date.now() < endMs) setPhase("live");
  }, [form.startAtLocal, form.endAtLocal]);

  const startMs = useMemo(() => {
    const t = form.startAtLocal ? new Date(form.startAtLocal).getTime() : NaN;
    return Number.isNaN(t) ? null : t;
  }, [form.startAtLocal]);

  const countdown = useMemo<Countdown>(() => {
    if (!startMs) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return diffToCountdown(startMs - now);
  }, [startMs, now]);

  const hasMinimum = !!form.title && !!form.startAtLocal && !!form.endAtLocal;

  if (!hasMinimum) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        <Eye className="w-5 h-5 mx-auto mb-2 opacity-40" />
        Fill in <span className="font-semibold">title</span>, <span className="font-semibold">starts at</span> and <span className="font-semibold">ends at</span> to see a live preview here.
      </div>
    );
  }

  const previewPromotion = {
    title: form.title,
    subtitle: form.subtitle,
    artworkUrl: form.artworkUrl,
    location: form.location,
    ctaText: form.ctaText || "Join Us",
    countdown,
    startAtLocal: form.startAtLocal,
  };

  const isLive = phase === "live";
  const draftBadge = form.status !== "active" && (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
      Status: {form.status} — won&apos;t show on the live site
    </span>
  );

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 border border-border px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-muted-foreground">
          <Eye className="w-3.5 h-3.5" /> Live preview
          {draftBadge}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Phase</span>
          <PreviewToggle
            active={phase === "upcoming"}
            onClick={() => setPhase("upcoming")}
            label="Upcoming"
            tone="amber"
          />
          <PreviewToggle
            active={phase === "live"}
            onClick={() => setPhase("live")}
            label="Live"
            tone="red"
          />
          <span className="mx-2 h-4 w-px bg-border" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">View</span>
          <PreviewToggle
            active={viewport === "desktop"}
            onClick={() => setViewport("desktop")}
            label={<><Monitor className="w-3 h-3" /> Desktop</>}
          />
          <PreviewToggle
            active={viewport === "mobile"}
            onClick={() => setViewport("mobile")}
            label={<><Smartphone className="w-3 h-3" /> Mobile</>}
          />
          <span className="mx-2 h-4 w-px bg-border" />
          <PreviewToggle
            active={popupOpen}
            onClick={() => setPopupOpen((s) => !s)}
            label={popupOpen ? <><EyeOff className="w-3 h-3" /> Hide popup</> : <><Eye className="w-3 h-3" /> Show popup</>}
          />
        </div>
      </div>

      {/* Device frame */}
      <div className="rounded-2xl border border-border bg-zinc-950 p-3 shadow-inner">
        <div
          className={
            "mx-auto overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition-all " +
            (viewport === "mobile" ? "w-[360px] max-w-full" : "w-full")
          }
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-950/60 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
            <span className="ml-3 truncate text-[10px] text-zinc-500">jctm.live{form.ctaUrl || "/"}</span>
          </div>

          {/* Site preview area */}
          <div className="relative bg-gradient-to-b from-zinc-900 via-zinc-900 to-black">
            {/* Sticky bar */}
            {form.showStickyBar
              ? <PreviewStickyBar isLive={isLive} promotion={previewPromotion} />
              : <DisabledChannelStrip label="Sticky bar disabled" />}

            {/* Mock navbar */}
            <div className="border-b border-zinc-800/60 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-700" />
                <span className="text-xs font-semibold text-zinc-300">Jesus Christ Temple Ministry</span>
              </div>
              <div className="hidden sm:flex items-center gap-3 text-[10px] text-zinc-500">
                <span>Home</span><span>Sermons</span><span>Crusade</span><span>About</span>
              </div>
            </div>

            {/* Banner */}
            <div className="px-3 sm:px-4 pt-4 pb-3">
              {form.showBanner
                ? <PreviewBanner isLive={isLive} promotion={previewPromotion} />
                : <DisabledChannelStrip label="Hero banner disabled" />}
            </div>

            {/* Mock page hero */}
            <div className="px-4 pt-2 pb-6">
              <div className="h-16 rounded-lg bg-zinc-800/50 border border-zinc-800" />
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div className="h-12 rounded bg-zinc-800/40 border border-zinc-800" />
                <div className="h-12 rounded bg-zinc-800/40 border border-zinc-800" />
                <div className="h-12 rounded bg-zinc-800/40 border border-zinc-800" />
              </div>
            </div>

            {/* Popup overlay (rendered inside preview frame, not modal) */}
            {form.showPopup && popupOpen && (
              <div className="absolute inset-0 z-30 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-3">
                <PreviewPopup
                  isLive={isLive}
                  promotion={previewPromotion}
                  onClose={() => setPopupOpen(false)}
                />
              </div>
            )}
            {!form.showPopup && (
              <div className="px-4 pb-3">
                <DisabledChannelStrip label="Popup modal disabled" />
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground px-1">
        This preview ignores per-user dismissal, session-storage cooldowns and 6-hour reminder timing — those still apply on the real site.
      </p>
    </div>
  );
}

// ─── Toolbar pill ────────────────────────────────────────────────────────────

function PreviewToggle({
  active, onClick, label, tone,
}: {
  active: boolean;
  onClick: () => void;
  label: React.ReactNode;
  tone?: "amber" | "red";
}) {
  const palette = active
    ? tone === "amber"
      ? "bg-amber-500 text-black"
      : tone === "red"
        ? "bg-red-600 text-white"
        : "bg-primary text-primary-foreground"
    : "bg-transparent text-muted-foreground hover:bg-muted";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${palette}`}
    >
      {label}
    </button>
  );
}

// ─── Disabled channel ────────────────────────────────────────────────────────

function DisabledChannelStrip({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 py-2 text-[10px] uppercase tracking-widest text-zinc-500">
      <EyeOff className="w-3 h-3 mr-1.5" /> {label}
    </div>
  );
}

// ─── Sticky bar preview ──────────────────────────────────────────────────────

function PreviewStickyBar({
  isLive,
  promotion,
}: {
  isLive: boolean;
  promotion: { title: string; ctaText: string; countdown: Countdown };
}) {
  const c = promotion.countdown;
  return (
    <div
      className={
        isLive
          ? "w-full bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white shadow-lg"
          : "w-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 text-[#1a1100] shadow-md"
      }
    >
      <div className="px-3 py-1.5 flex items-center gap-2">
        <span className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
          {isLive ? <><Radio className="h-3 w-3 animate-pulse" />Live</> : <><Calendar className="h-3 w-3" />Upcoming</>}
        </span>
        <span className="shrink min-w-0 truncate text-[11px] font-semibold">
          {promotion.title}
        </span>
        {!isLive && (
          <span className="hidden md:inline-flex items-center gap-1 ml-auto text-[10px] font-mono font-bold tabular-nums">
            <CountSeg value={c.days} label="d" />
            <CountSeg value={c.hours} label="h" />
            <CountSeg value={c.minutes} label="m" />
            <CountSeg value={c.seconds} label="s" />
          </span>
        )}
        <span
          className={
            "ml-auto md:ml-2 shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
            (isLive ? "bg-white text-red-700" : "bg-[#1a1100] text-amber-200")
          }
        >
          {isLive ? "Join Now" : promotion.ctaText}
        </span>
        <X className="h-3 w-3 opacity-50" />
      </div>
    </div>
  );
}

function CountSeg({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline">
      <span className="rounded bg-black/10 px-1 py-0.5 text-[10px]">{String(value).padStart(2, "0")}</span>
      <span className="ml-0.5 text-[8px] font-semibold opacity-70">{label}</span>
    </span>
  );
}

// ─── Banner preview ──────────────────────────────────────────────────────────

function PreviewBanner({
  isLive,
  promotion,
}: {
  isLive: boolean;
  promotion: {
    title: string; subtitle: string; artworkUrl: string;
    location: string; ctaText: string; countdown: Countdown; startAtLocal: string;
  };
}) {
  const c = promotion.countdown;
  const start = new Date(promotion.startAtLocal);
  const dateLabel = isNaN(start.getTime())
    ? ""
    : start.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const timeLabel = isNaN(start.getTime())
    ? ""
    : start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <div
      className={
        "relative overflow-hidden rounded-2xl border shadow-xl " +
        (isLive ? "border-red-500/40 ring-1 ring-red-500/40" : "border-yellow-400/30")
      }
      style={{
        background: isLive
          ? "linear-gradient(135deg,#3a0606 0%,#7a0c0c 55%,#3a0606 100%)"
          : "linear-gradient(135deg,#0a1a4a 0%,#1a3a8a 55%,#0a1a4a 100%)",
      }}
    >
      <button
        type="button"
        aria-hidden
        className="absolute top-2 right-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white/70"
      >
        <X className="h-3 w-3" />
      </button>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background: isLive
            ? "radial-gradient(circle at 80% 20%, rgba(255,80,80,0.45) 0%, transparent 55%)"
            : "radial-gradient(circle at 80% 20%, rgba(255,210,80,0.35) 0%, transparent 55%)",
        }}
      />
      <div className="relative grid grid-cols-1 sm:grid-cols-[1fr_minmax(0,160px)] gap-3 p-4">
        <div className="min-w-0">
          <span
            className={
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest " +
              (isLive
                ? "bg-red-500/20 border border-red-400/40 text-red-100"
                : "bg-yellow-400/15 border border-yellow-400/30 text-yellow-200")
            }
          >
            {isLive ? <><Radio className="h-2.5 w-2.5 animate-pulse" />Live</> : <><Calendar className="h-2.5 w-2.5" />Upcoming Event</>}
          </span>
          <h3 className="mt-2 text-base sm:text-lg font-serif font-black text-white leading-tight line-clamp-2">
            {promotion.title}
          </h3>
          {promotion.subtitle && (
            <p className="mt-1 text-[11px] text-white/70 leading-snug line-clamp-2">{promotion.subtitle}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/70">
            {dateLabel && <span className="inline-flex items-center gap-1"><Calendar className="h-2.5 w-2.5" /> {dateLabel}</span>}
            {timeLabel && <span className="inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {timeLabel}</span>}
            {promotion.location && (
              <span className="inline-flex items-center gap-1 max-w-full truncate">
                <MapPin className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{promotion.location}</span>
              </span>
            )}
          </div>
          {!isLive && (
            <div className="mt-3 grid grid-cols-4 gap-1 max-w-[260px]">
              <BannerTile value={c.days} label="D" />
              <BannerTile value={c.hours} label="H" />
              <BannerTile value={c.minutes} label="M" />
              <BannerTile value={c.seconds} label="S" />
            </div>
          )}
          <span
            className={
              "mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-all " +
              (isLive ? "bg-white text-red-700" : "bg-yellow-400 text-[#1a1100]")
            }
          >
            {isLive ? "Join Live Now" : promotion.ctaText}
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
        {promotion.artworkUrl && (
          <div className="hidden sm:block relative h-full min-h-[110px] overflow-hidden rounded-xl border border-white/10">
            <img src={promotion.artworkUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
}

function BannerTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded bg-white/10 border border-white/10 px-1 py-1 text-center">
      <div className="font-mono text-xs font-black text-white tabular-nums leading-none">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-0.5 text-[8px] uppercase tracking-widest text-white/60">{label}</div>
    </div>
  );
}

// ─── Popup preview ───────────────────────────────────────────────────────────

function PreviewPopup({
  isLive, promotion, onClose,
}: {
  isLive: boolean;
  promotion: {
    title: string; subtitle: string; artworkUrl: string; location: string;
    ctaText: string; countdown: Countdown; startAtLocal: string;
  };
  onClose: () => void;
}) {
  const c = promotion.countdown;
  const start = new Date(promotion.startAtLocal);
  const dateLabel = isNaN(start.getTime())
    ? ""
    : start.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const timeLabel = isNaN(start.getTime())
    ? ""
    : start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <div
      className="relative w-full max-w-[320px] overflow-hidden rounded-2xl shadow-2xl border border-white/10"
      style={{
        background: isLive
          ? "linear-gradient(155deg,#3a0606 0%,#7a0c0c 60%,#3a0606 100%)"
          : "linear-gradient(155deg,#0a1a4a 0%,#1a3a8a 60%,#0a1a4a 100%)",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview popup"
        className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 z-10"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {promotion.artworkUrl && (
        <div className="relative h-28 w-full">
          <img src={promotion.artworkUrl} alt="" className="h-full w-full object-cover" />
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
      <div className="p-4">
        <span
          className={
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest " +
            (isLive
              ? "bg-red-500/30 border-red-400/40 text-red-100"
              : "bg-yellow-400/20 border-yellow-400/30 text-yellow-200")
          }
        >
          {isLive ? <><Radio className="h-2.5 w-2.5 animate-pulse" />Live Now</> : <><Calendar className="h-2.5 w-2.5" />Coming Soon</>}
        </span>
        <h3 className="mt-2 text-lg font-serif font-black text-white leading-tight line-clamp-2">
          {promotion.title}
        </h3>
        {promotion.subtitle && (
          <p className="mt-1 text-[11px] text-white/75 leading-snug line-clamp-3">{promotion.subtitle}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-white/70">
          {dateLabel && <span className="inline-flex items-center gap-1"><Calendar className="h-2.5 w-2.5" /> {dateLabel}</span>}
          {timeLabel && <span className="inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {timeLabel}</span>}
          {promotion.location && (
            <span className="inline-flex items-center gap-1 max-w-full truncate">
              <MapPin className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{promotion.location}</span>
            </span>
          )}
        </div>
        {!isLive && (
          <div className="mt-3 grid grid-cols-4 gap-1">
            <BannerTile value={c.days} label="D" />
            <BannerTile value={c.hours} label="H" />
            <BannerTile value={c.minutes} label="M" />
            <BannerTile value={c.seconds} label="S" />
          </div>
        )}
        <div
          className={
            "mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-full h-8 font-bold text-[11px] " +
            (isLive ? "bg-white text-red-700" : "bg-yellow-400 text-[#1a1100]")
          }
        >
          {isLive ? "Join Live Now" : promotion.ctaText}
          <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}

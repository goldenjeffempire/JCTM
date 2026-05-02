/**
 * BroadcastEngagementSystem
 *
 * The central broadcast notification system for JCTM Temple TV.
 * Handles all channels of in-app notification without AI.
 *
 * Responsibilities:
 *  1. Visitor ID — generate/persist a UUID in localStorage for every visitor
 *  2. Live SSE monitoring — show an in-app toast the moment isLive flips true
 *  3. SW push relay — listen for BROADCAST_PUSH messages from the service worker
 *     so users who are on the site still get the in-app toast even if the browser
 *     delivers the OS push notification
 *  4. Missed-broadcast re-engagement — on every page load, check the latest
 *     broadcast event from the API; if the visitor hasn't acknowledged it,
 *     show a slim re-engagement banner at the top of the screen
 *  5. Notification opt-out — respects a localStorage flag so users can silence
 *     in-app banners
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Radio, X, Tv, ChevronRight, Clock } from "lucide-react";
import { useLivestreamStatus } from "@/hooks/useLivestreamStatus";
import { getOrCreateVisitorId } from "@/lib/visitorId";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const LAST_SEEN_KEY = "jctm_last_seen_broadcast_id";
const OPT_OUT_KEY = "jctm_inapp_notif_optout";
const REENGAGEMENT_DELAY_MS = 2500;

// Session-scoped dedup: prevents re-firing on every page load while stream is live.
// Key is based on videoId so a new stream always re-triggers.
const LIVE_TOAST_SESSION_KEY = (videoId: string) => `jctm:live-toast:${videoId}`;
function hasShownLiveToast(videoId: string): boolean {
  try { return sessionStorage.getItem(LIVE_TOAST_SESSION_KEY(videoId)) === "1"; } catch { return false; }
}
function markLiveToastShown(videoId: string) {
  try { sessionStorage.setItem(LIVE_TOAST_SESSION_KEY(videoId), "1"); } catch {}
}

interface BroadcastEvent {
  id: number;
  type: "live_start" | "rebroadcast_start" | string;
  title: string | null;
  videoId: string | null;
  message: string;
  url: string;
  firedAt: string;
}

function isOptedOut(): boolean {
  try { return localStorage.getItem(OPT_OUT_KEY) === "1"; } catch { return false; }
}
function setOptOut(value: boolean) {
  try { localStorage.setItem(OPT_OUT_KEY, value ? "1" : "0"); } catch {}
}
function getLastSeenId(): number | null {
  try { const v = localStorage.getItem(LAST_SEEN_KEY); return v ? parseInt(v, 10) : null; } catch { return null; }
}
function markSeen(id: number) {
  try { localStorage.setItem(LAST_SEEN_KEY, String(id)); } catch {}
}

// ─── Re-engagement banner ─────────────────────────────────────────────────────

interface ReengagementBannerProps {
  event: BroadcastEvent;
  onDismiss: () => void;
}

function ReengagementBanner({ event, onDismiss }: ReengagementBannerProps) {
  const isLiveBanner = event.type === "live_start";
  const bgColor = isLiveBanner ? "from-red-600/95 to-red-700/95" : "from-indigo-600/95 to-indigo-700/95";
  const icon = isLiveBanner
    ? <Radio className="h-4 w-4 shrink-0 animate-pulse" />
    : <Tv className="h-4 w-4 shrink-0" />;

  const label = isLiveBanner ? "Live Now" : "Rebroadcast";
  const title = event.title ?? (isLiveBanner ? "Temple TV" : "Temple TV");
  const actionLabel = isLiveBanner ? "Watch Live" : "Watch Now";

  const navigate = () => {
    onDismiss();
    window.location.href = `${BASE}${event.url}`;
  };

  return (
    <motion.div
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -64, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={`fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r ${bgColor} backdrop-blur-md shadow-lg`}
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
        <span className="text-white/90">{icon}</span>

        <span className="text-xs font-bold uppercase tracking-widest text-white/70 shrink-0">{label}</span>

        <p className="flex-1 truncate text-sm font-semibold text-white">{title}</p>

        <button
          onClick={navigate}
          className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white hover:bg-white/25 transition-colors"
        >
          {actionLabel}
          <ChevronRight className="h-3 w-3" />
        </button>

        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 text-white/50 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Opt-out settings chip ────────────────────────────────────────────────────

function NotificationSettingsChip({ onClose }: { onClose: () => void }) {
  const [optedOut, setOptedOut] = useState(isOptedOut);

  const toggle = () => {
    const next = !optedOut;
    setOptOut(next);
    setOptedOut(next);
    if (!next) toast.success("In-app notifications re-enabled");
    else toast.info("In-app notifications muted");
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed bottom-20 right-4 z-50 rounded-2xl border border-white/10 bg-black/80 p-4 shadow-2xl backdrop-blur-xl"
      style={{ minWidth: 220 }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white">Notification Preferences</span>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X className="h-3.5 w-3.5" /></button>
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={toggle}
          className={`relative h-5 w-9 rounded-full transition-colors ${optedOut ? "bg-white/20" : "bg-red-500"}`}
        >
          <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${optedOut ? "left-0.5" : "left-4"}`} />
        </div>
        <span className="text-xs text-white/70">{optedOut ? "Muted" : "In-app alerts on"}</span>
      </label>
      <p className="mt-2 text-[10px] text-white/40 leading-snug">
        Muting hides in-app banners. Push notifications are managed by your browser.
      </p>
    </motion.div>
  );
}

// ─── Main system component ────────────────────────────────────────────────────

export function BroadcastEngagementSystem() {
  const liveStatus = useLivestreamStatus();
  const prevIsLive = useRef(false);
  const [reengagementEvent, setReengagementEvent] = useState<BroadcastEvent | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // 1. Persist visitor ID on every mount
  useEffect(() => {
    getOrCreateVisitorId();
  }, []);

  // 2. SSE live-start → in-app toast (fires the moment isLive flips true)
  useEffect(() => {
    if (!liveStatus.isLive) {
      prevIsLive.current = false;
      return;
    }

    const videoId = liveStatus.videoId ?? "live";
    const justWentLive = !prevIsLive.current;
    prevIsLive.current = true;

    if (isOptedOut()) return;

    // Only fire once per stream session — prevents re-firing on every page load
    // while the stream is live. A new videoId always gets a fresh toast.
    if (!justWentLive && hasShownLiveToast(videoId)) return;
    if (hasShownLiveToast(videoId)) return;
    markLiveToastShown(videoId);

    const title = liveStatus.title ?? "Temple TV";
    const streamUrl = liveStatus.streamUrl
      ? liveStatus.streamUrl
      : `${BASE}/sermons`;

    toast.custom(
      (id) => (
        <div
          className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-black/90 px-4 py-3 shadow-2xl backdrop-blur-xl cursor-pointer"
          onClick={() => {
            toast.dismiss(id);
            window.location.href = streamUrl;
          }}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/20">
            <Radio className="h-4 w-4 animate-pulse text-red-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-red-400">🔴 Live Now</p>
            <p className="text-sm font-semibold text-white leading-snug line-clamp-2 mt-0.5">{title}</p>
          </div>
          <div className="flex items-center gap-2 ml-2 shrink-0">
            <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white whitespace-nowrap">Watch Live</span>
            <button
              onClick={(e) => { e.stopPropagation(); toast.dismiss(id); }}
              className="text-white/30 hover:text-white/70 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ),
      { duration: 15000, position: "top-center" }
    );
  }, [liveStatus.isLive, liveStatus.videoId, liveStatus.title, liveStatus.streamUrl]);

  // 3. SW push relay → in-app toast when push fires to an open page client
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "BROADCAST_PUSH") return;
      if (isOptedOut()) return;

      const { title, body, url, broadcastType } = event.data.payload as {
        title: string; body: string; url: string; broadcastType: string | null; tag: string | null;
      };

      const isLiveMsg = broadcastType === "live" || broadcastType === "live_service";
      const isReminder = broadcastType === "event_reminder";

      // Notify the rest of the app (banners, sticky bar, hero) so they can
      // pulse / refresh when a recurring reminder lands. Banner & sticky-bar
      // listen for this custom event and apply a 3-second pulse animation.
      if (isReminder) {
        try {
          window.dispatchEvent(new CustomEvent("jctm:event-reminder", {
            detail: { title, body, url },
          }));
        } catch { /* CustomEvent unavailable — ignore */ }
      }

      const palette = isLiveMsg
        ? { border: "rgba(239,68,68,0.3)", bgIcon: "bg-red-500/20", iconText: "text-red-400", label: "Live Now", labelText: "text-red-400", pill: "bg-red-500", icon: <Radio className="h-4 w-4 animate-pulse text-red-400" />, cta: "Watch" }
        : isReminder
          ? { border: "rgba(250,204,21,0.35)", bgIcon: "bg-yellow-400/20", iconText: "text-yellow-300", label: "Coming Soon", labelText: "text-yellow-300", pill: "bg-yellow-500", icon: <Clock className="h-4 w-4 text-yellow-300" />, cta: "Details" }
          : { border: "rgba(99,102,241,0.3)", bgIcon: "bg-indigo-500/20", iconText: "text-indigo-400", label: "Rebroadcast", labelText: "text-indigo-400", pill: "bg-indigo-500", icon: <Tv className="h-4 w-4 text-indigo-400" />, cta: "Watch" };

      toast.custom(
        (id) => (
          <div
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/90 px-4 py-3 shadow-2xl backdrop-blur-xl cursor-pointer"
            style={{ borderColor: palette.border }}
            onClick={() => {
              toast.dismiss(id);
              window.location.href = `${BASE}${url}`;
            }}
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${palette.bgIcon}`}>
              {palette.icon}
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-bold uppercase tracking-wider ${palette.labelText}`}>{palette.label}</p>
              <p className="truncate text-sm font-semibold text-white">{title}</p>
              {body && <p className="truncate text-xs text-white/50">{body}</p>}
            </div>
            <span className={`ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-bold text-white ${palette.pill}`}>{palette.cta}</span>
          </div>
        ),
        { duration: 15000, position: "top-center" }
      );
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, []);

  // 4. Missed-broadcast re-engagement — check on mount after a short delay
  const checkMissedBroadcast = useCallback(async () => {
    if (isOptedOut()) return;
    try {
      const res = await fetch(`${BASE}/api/broadcast/history/latest`, { cache: "no-store" });
      if (!res.ok) return;
      const event: BroadcastEvent | null = await res.json();
      if (!event) return;

      const lastSeen = getLastSeenId();
      if (lastSeen !== null && lastSeen >= event.id) return;

      // Only re-engage for events within the last 4 hours
      const ageMs = Date.now() - new Date(event.firedAt).getTime();
      if (ageMs > 4 * 60 * 60 * 1000) {
        markSeen(event.id);
        return;
      }

      setReengagementEvent(event);
    } catch {}
  }, []);

  useEffect(() => {
    const t = setTimeout(checkMissedBroadcast, REENGAGEMENT_DELAY_MS);
    return () => clearTimeout(t);
  }, [checkMissedBroadcast]);

  const dismissReengagement = useCallback(() => {
    if (reengagementEvent) markSeen(reengagementEvent.id);
    setReengagementEvent(null);
  }, [reengagementEvent]);

  // Don't show re-engagement banner if stream is currently live (the live banner handles that)
  const showReengagement = !!reengagementEvent && !liveStatus.isLive;

  return (
    <>
      <AnimatePresence>
        {showReengagement && reengagementEvent && (
          <ReengagementBanner event={reengagementEvent} onDismiss={dismissReengagement} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && <NotificationSettingsChip onClose={() => setShowSettings(false)} />}
      </AnimatePresence>
    </>
  );
}

/**
 * useActiveEventPromotion — single source of truth for the time-driven
 * Event Promotion lifecycle on the frontend.
 *
 *  • Polls /api/event-promotions/active every 30 s (TanStack Query).
 *  • Re-derives the "phase" (upcoming | live | ended) from server-supplied
 *    timestamps every second on the client so the LIVE flip is precise to the
 *    second without waiting for the next poll.
 *  • Provides a derived `countdown` block (days/hours/minutes/seconds).
 *  • Refetches immediately on tab-focus so a tab that was idle through the
 *    LIVE transition catches up the moment the user returns.
 */

import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

/**
 * Admin-only client-side phase override. Lets a logged-in operator preview
 * the entire live-mode UI on demand without changing the database or waiting
 * for the real start_at timestamp. Controlled by `EventPromoPreviewToggle`.
 *
 * Values: "upcoming" | "live" | "ended" | null (no override).
 * Persisted in localStorage and broadcast via the `jctm:event-preview-changed`
 * window event so this hook can re-derive instantly across all open tabs.
 */
export const PHASE_OVERRIDE_STORAGE_KEY = "jctm:event-phase-override";
export const PHASE_OVERRIDE_EVENT = "jctm:event-preview-changed";

function readOverride(): "upcoming" | "live" | "ended" | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(PHASE_OVERRIDE_STORAGE_KEY);
  return v === "upcoming" || v === "live" || v === "ended" ? v : null;
}

export interface EventPromotion {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  artworkUrl: string | null;
  location: string | null;
  ctaText: string;
  ctaUrl: string;
  startAt: string;
  endAt: string;
  status: string;
  showBanner: boolean;
  showPopup: boolean;
  showStickyBar: boolean;
  phase: "upcoming" | "live" | "ended";
  msUntilStart: number;
  msUntilEnd: number;
  serverTime: string;
}

export interface ActiveEventPromotionResponse {
  promotion: EventPromotion | null;
  serverTime: string;
}

const QUERY_KEY = ["event-promotions", "active"] as const;

async function fetchActive(): Promise<ActiveEventPromotionResponse> {
  const res = await fetch("/api/event-promotions/active", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Failed to load active event promotion (${res.status})`);
  return res.json();
}

export interface DerivedPromotion extends EventPromotion {
  /** Re-derived on the client every second */
  livePhase: "upcoming" | "live" | "ended";
  countdown: { days: number; hours: number; minutes: number; seconds: number };
  /** True the moment the client clock crossed start_at — for one-shot side effects */
  msToStart: number;
  msToEnd: number;
}

function derive(p: EventPromotion): DerivedPromotion {
  const now = Date.now();
  const start = new Date(p.startAt).getTime();
  const end = new Date(p.endAt).getTime();
  let msToStart = Math.max(start - now, -1);
  let msToEnd = Math.max(end - now, -1);
  let livePhase: "upcoming" | "live" | "ended";
  if (now < start) livePhase = "upcoming";
  else if (now < end) livePhase = "live";
  else livePhase = "ended";

  // Honor admin client-side override (used only by the Live Mode preview
  // toggle). The override flips livePhase and synthesizes plausible
  // ms-to-boundary values so every downstream surface (banner, sticky bar,
  // popup, crusade section) shows its true live-state UI.
  const override = readOverride();
  if (override === "live") {
    livePhase = "live";
    msToStart = -1;
    msToEnd = Math.max(msToEnd, 60 * 60_000); // pretend at least 1h remaining
  } else if (override === "upcoming") {
    livePhase = "upcoming";
    msToStart = Math.max(msToStart, 24 * 60 * 60_000); // at least 1 day out
    msToEnd = Math.max(msToEnd, 25 * 60 * 60_000);
  } else if (override === "ended") {
    livePhase = "ended";
    msToStart = -1;
    msToEnd = -1;
  }

  // Countdown counts down to whichever boundary is most relevant
  const target = livePhase === "upcoming" ? msToStart : Math.max(msToEnd, 0);
  const days = Math.floor(target / 86_400_000);
  const hours = Math.floor((target % 86_400_000) / 3_600_000);
  const minutes = Math.floor((target % 3_600_000) / 60_000);
  const seconds = Math.floor((target % 60_000) / 1_000);

  return {
    ...p,
    livePhase,
    countdown: {
      days: Math.max(days, 0),
      hours: Math.max(hours, 0),
      minutes: Math.max(minutes, 0),
      seconds: Math.max(seconds, 0),
    },
    msToStart,
    msToEnd,
  };
}

export function useActiveEventPromotion(): {
  promotion: DerivedPromotion | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchActive,
    refetchInterval: 30_000,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!data?.promotion) return;
    const id = window.setInterval(() => setTick(t => (t + 1) % 1_000_000), 1_000);
    return () => window.clearInterval(id);
  }, [data?.promotion]);

  // React instantly when the admin flips the preview-mode override (same tab
  // via custom event, other tabs via storage event).
  useEffect(() => {
    const bump = () => setTick(t => (t + 1) % 1_000_000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === PHASE_OVERRIDE_STORAGE_KEY) bump();
    };
    window.addEventListener(PHASE_OVERRIDE_EVENT, bump);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PHASE_OVERRIDE_EVENT, bump);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const derived = useMemo(() => {
    if (!data?.promotion) return null;
    // tick is intentionally a dependency so the countdown re-derives every second
    void tick;
    return derive(data.promotion);
  }, [data?.promotion, tick]);

  return { promotion: derived, isLoading };
}

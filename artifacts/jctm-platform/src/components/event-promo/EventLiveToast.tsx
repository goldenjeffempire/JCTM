/**
 * EventLiveToast — the in-app side of the lifecycle engine.
 *
 *  • Watches the active promotion. The exact moment its phase flips from
 *    "upcoming" to "live" on the client clock, fires a single sonner toast
 *    with the title, location and a Join CTA.
 *  • Idempotent per (slug + start_at) — uses sessionStorage so a refresh
 *    inside the same tab never replays the toast.
 *  • Independent from the push-notification path: push reaches users with
 *    the tab closed; this toast covers users who happen to be on the site
 *    when the LIVE moment hits.
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useActiveEventPromotion } from "@/hooks/useActiveEventPromotion";

const FIRED_KEY = (slug: string, startAt: string) =>
  `jctm:event-live-toast:${slug}:${startAt}`;

export function EventLiveToast() {
  const { promotion } = useActiveEventPromotion();
  const lastPhaseRef = useRef<string | null>(null);

  useEffect(() => {
    if (!promotion) return;
    const prev = lastPhaseRef.current;
    lastPhaseRef.current = promotion.livePhase;

    if (promotion.livePhase !== "live") return;
    // Only fire on the upcoming→live transition (or first mount when already live)
    if (prev && prev !== "upcoming") return;

    let alreadyFired = false;
    try {
      alreadyFired = window.sessionStorage.getItem(FIRED_KEY(promotion.slug, promotion.startAt)) === "1";
    } catch {
      alreadyFired = false;
    }
    if (alreadyFired) return;

    try {
      window.sessionStorage.setItem(FIRED_KEY(promotion.slug, promotion.startAt), "1");
    } catch {
      /* ignore */
    }

    toast(`🔴 ${promotion.title} — Now Live`, {
      description: promotion.location
        ? `It's happening now at ${promotion.location}.`
        : "It's happening now — join us live.",
      duration: 12_000,
      action: {
        label: "Join",
        onClick: () => {
          window.location.href = promotion.ctaUrl;
        },
      },
    });
  }, [promotion?.livePhase, promotion?.slug, promotion?.startAt]);

  return null;
}

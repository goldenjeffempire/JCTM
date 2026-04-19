import { useEffect, useRef, useState } from "react";
import { useCookieConsent } from "./CookieConsent";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const rawClientId = (
  import.meta.env.VITE_ADSENSE_CLIENT_ID ??
  import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT ??
  ""
).trim();

const clientId = rawClientId.startsWith("ca-pub-") ? rawClientId : rawClientId ? `ca-pub-${rawClientId}` : "";
const hasValidClient = /^ca-pub-\d+$/.test(clientId);
const enabledInCurrentEnvironment = import.meta.env.PROD || import.meta.env.VITE_ADSENSE_ENABLE === "true";

export const ADSENSE_ENABLED = hasValidClient && enabledInCurrentEnvironment;
export const ADSENSE_CLIENT_ID = clientId;

// ─── Ad Slot Registry ─────────────────────────────────────────────────────────
// Each key maps to a VITE env var. Pages without their own dedicated slot
// gracefully share a suitable existing unit — Google allows the same unit on
// multiple pages. Keeping one unit per logical "position" (banner, in-content,
// sidebar) is the recommended approach when you have a limited set of approved
// units.

export const ADSENSE_SLOTS = {
  // ── Home page ─────────────────────────────────────────────────────────────
  homeHero:        import.meta.env.VITE_ADSENSE_SLOT_HOME_HERO         ?? "",
  homeMid:         import.meta.env.VITE_ADSENSE_SLOT_HOME_MID          ?? "",

  // ── Sermon library ─────────────────────────────────────────────────────────
  sermonFeed:      import.meta.env.VITE_ADSENSE_SLOT_SERMON_FEED       ?? "",
  sermonSidebar:   import.meta.env.VITE_ADSENSE_SLOT_SERMON_SIDEBAR    ?? "",
  liveBelowPlayer: import.meta.env.VITE_ADSENSE_SLOT_LIVE_BELOW_PLAYER ?? "",

  // ── Intro videos ───────────────────────────────────────────────────────────
  // No dedicated unit yet → reuse sermonFeed (same in-feed position type)
  introFeed:       import.meta.env.VITE_ADSENSE_SLOT_INTRO_FEED
                   ?? import.meta.env.VITE_ADSENSE_SLOT_SERMON_FEED    ?? "",

  // ── Blog ───────────────────────────────────────────────────────────────────
  blogFeed:        import.meta.env.VITE_ADSENSE_SLOT_BLOG_FEED
                   ?? import.meta.env.VITE_ADSENSE_SLOT_SERMON_FEED    ?? "",
  blogPost:        import.meta.env.VITE_ADSENSE_SLOT_BLOG_POST
                   ?? import.meta.env.VITE_ADSENSE_SLOT_HOME_MID       ?? "",

  // ── Additional pages (reuse best-fit existing units) ─────────────────────
  prayerPage:      import.meta.env.VITE_ADSENSE_SLOT_PRAYER
                   ?? import.meta.env.VITE_ADSENSE_SLOT_HOME_MID       ?? "",
  eventsPage:      import.meta.env.VITE_ADSENSE_SLOT_EVENTS
                   ?? import.meta.env.VITE_ADSENSE_SLOT_SERMON_FEED    ?? "",
  aboutPage:       import.meta.env.VITE_ADSENSE_SLOT_ABOUT
                   ?? import.meta.env.VITE_ADSENSE_SLOT_HOME_MID       ?? "",
  testimoniesPage: import.meta.env.VITE_ADSENSE_SLOT_TESTIMONIES
                   ?? import.meta.env.VITE_ADSENSE_SLOT_SERMON_FEED    ?? "",
  devotionPage:    import.meta.env.VITE_ADSENSE_SLOT_DEVOTION
                   ?? import.meta.env.VITE_ADSENSE_SLOT_HOME_MID       ?? "",
  topicsPage:      import.meta.env.VITE_ADSENSE_SLOT_TOPICS
                   ?? import.meta.env.VITE_ADSENSE_SLOT_SERMON_FEED    ?? "",
  leadershipPage:  import.meta.env.VITE_ADSENSE_SLOT_LEADERSHIP
                   ?? import.meta.env.VITE_ADSENSE_SLOT_HOME_MID       ?? "",
};

function isValidSlot(slot: string | undefined): slot is string {
  return Boolean(slot && /^\d+$/.test(slot));
}

interface AdSlotProps {
  slot: string;
  className?: string;
  minHeight?: number;
  format?: "auto" | "fluid" | "rectangle" | "horizontal" | "vertical";
  layout?: string;
  fullWidthResponsive?: boolean;
  lazy?: boolean;
}

export function AdSlot({
  slot,
  className = "",
  minHeight = 250,
  format = "auto",
  layout,
  fullWidthResponsive = true,
  lazy = true,
}: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pushedRef = useRef(false);
  const [shouldLoad, setShouldLoad] = useState(!lazy);
  const consent = useCookieConsent();

  const consentResolved = consent !== null;
  const advertisingAllowed = consent?.advertising !== false;
  const canRender = ADSENSE_ENABLED && isValidSlot(slot) && consentResolved && advertisingAllowed;

  // Lazy-load via IntersectionObserver — fires when ad enters viewport + 600px margin
  useEffect(() => {
    if (!canRender || shouldLoad || !lazy) return;

    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px", threshold: 0.01 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [canRender, lazy, shouldLoad]);

  // Trigger AdSense push — only once per mounted instance
  useEffect(() => {
    if (!canRender || !shouldLoad || pushedRef.current) return;

    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
      pushedRef.current = true;
    } catch {
      pushedRef.current = true;
    }
  }, [canRender, shouldLoad]);

  if (!ADSENSE_ENABLED || !isValidSlot(slot)) return null;
  if (!consentResolved || !advertisingAllowed) return null;

  // Build `ins` element attributes — only include optional attrs when defined
  const insProps: Record<string, string | boolean> = {
    className: "adsbygoogle",
    "data-ad-client": ADSENSE_CLIENT_ID,
    "data-ad-slot": slot,
    "data-ad-format": format,
    "data-full-width-responsive": fullWidthResponsive ? "true" : "false",
  };
  if (layout) {
    insProps["data-ad-layout"] = layout;
  }

  return (
    <aside
      ref={containerRef}
      aria-label="Advertisement"
      className={`relative overflow-hidden rounded-2xl border border-border/40 bg-muted/20 ${className}`}
      style={{ minHeight }}
    >
      <p className="absolute left-3 top-2 z-[1] text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/50 select-none pointer-events-none">
        Advertisement
      </p>
      {shouldLoad ? (
        <ins
          {...insProps}
          style={{ display: "block", minHeight }}
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-gradient-to-r from-muted/20 via-muted/40 to-muted/20" />
      )}
    </aside>
  );
}

// ─── Auto Ads initializer ─────────────────────────────────────────────────────
// Auto Ads run automatically once the AdSense script is loaded with ?client=...
// No additional JavaScript is needed — Google's crawler and runtime handle
// placement. This export is kept for documentation purposes.
export { ADSENSE_ENABLED as AUTO_ADS_ACTIVE };

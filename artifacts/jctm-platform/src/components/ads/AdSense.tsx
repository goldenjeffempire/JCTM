import { useEffect, useRef, useState } from "react";
import { useCookieConsent } from "./CookieConsent";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

// ─── Publisher Configuration ──────────────────────────────────────────────────
// Resolution order: env var → hardcoded fallback (already public in index.html)
const PUBLISHER_ID = "ca-pub-6817509745706083";

const rawClientId = (
  import.meta.env.VITE_ADSENSE_CLIENT_ID ??
  import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT ??
  PUBLISHER_ID
).trim();

const clientId = rawClientId.startsWith("ca-pub-")
  ? rawClientId
  : rawClientId
    ? `ca-pub-${rawClientId}`
    : PUBLISHER_ID;

const hasValidClient = /^ca-pub-\d+$/.test(clientId);
const enabledInCurrentEnvironment =
  import.meta.env.PROD || import.meta.env.VITE_ADSENSE_ENABLE === "true";

export const ADSENSE_ENABLED = hasValidClient && enabledInCurrentEnvironment;
export const ADSENSE_CLIENT_ID = clientId;

// ─── Ad Slot Registry ─────────────────────────────────────────────────────────
export const ADSENSE_SLOTS = {
  homeHero:        import.meta.env.VITE_ADSENSE_SLOT_HOME_HERO         ?? "",
  homeMid:         import.meta.env.VITE_ADSENSE_SLOT_HOME_MID          ?? "",
  sermonFeed:      import.meta.env.VITE_ADSENSE_SLOT_SERMON_FEED       ?? "",
  sermonSidebar:   import.meta.env.VITE_ADSENSE_SLOT_SERMON_SIDEBAR    ?? "",
  liveBelowPlayer: import.meta.env.VITE_ADSENSE_SLOT_LIVE_BELOW_PLAYER ?? "",
  introFeed:       import.meta.env.VITE_ADSENSE_SLOT_INTRO_FEED
                   ?? import.meta.env.VITE_ADSENSE_SLOT_SERMON_FEED    ?? "",
  blogFeed:        import.meta.env.VITE_ADSENSE_SLOT_BLOG_FEED
                   ?? import.meta.env.VITE_ADSENSE_SLOT_SERMON_FEED    ?? "",
  blogPost:        import.meta.env.VITE_ADSENSE_SLOT_BLOG_POST
                   ?? import.meta.env.VITE_ADSENSE_SLOT_HOME_MID       ?? "",
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
  return Boolean(slot && /^\d+$/.test(slot.trim()));
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

// ─── AdSense Script Loader ────────────────────────────────────────────────────
// Ensures the AdSense script is injected exactly once, regardless of how many
// <AdSlot /> instances are rendered. If the script tag is already present in
// the HTML <head> (index.html) this is a no-op — the duplicate URL check
// prevents double-loading.
let scriptInjected = false;
function ensureAdSenseScript() {
  if (scriptInjected) return;
  if (typeof document === "undefined") return;
  const existing = document.querySelector(
    `script[src*="pagead2.googlesyndication.com"][src*="${PUBLISHER_ID}"]`
  );
  if (existing) { scriptInjected = true; return; }
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUBLISHER_ID}`;
  document.head.appendChild(script);
  scriptInjected = true;
}

// ─── AdSlot Component ─────────────────────────────────────────────────────────
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
  const insRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);
  const [shouldLoad, setShouldLoad] = useState(!lazy);
  const [adKey, setAdKey] = useState(0);
  const consent = useCookieConsent();

  const consentResolved = consent !== null;
  const advertisingAllowed = consent?.advertising !== false;
  const slotValid = isValidSlot(slot);
  const canRender = ADSENSE_ENABLED && slotValid && consentResolved && advertisingAllowed;

  // Re-render on consent change (e.g. user accepts ads after page load)
  useEffect(() => {
    if (advertisingAllowed && consentResolved) {
      pushedRef.current = false;
      setAdKey(k => k + 1);
    }
  }, [advertisingAllowed, consentResolved]);

  // Lazy-load via IntersectionObserver
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

  // Push adsbygoogle — exactly once per mounted ins element
  useEffect(() => {
    if (!canRender || !shouldLoad || pushedRef.current) return;
    const ins = insRef.current;
    if (!ins) return;

    // Don't push if already filled (e.g. after hot-reload)
    if (ins.getAttribute("data-adsbygoogle-status") === "done") return;

    ensureAdSenseScript();

    const timeoutId = setTimeout(() => {
      if (pushedRef.current) return;
      try {
        (window.adsbygoogle = window.adsbygoogle ?? []).push({});
        pushedRef.current = true;
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[AdSense] push failed:", err);
        }
        pushedRef.current = true;
      }
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [canRender, shouldLoad, adKey]);

  // Don't render anything if ads are disabled or slot is invalid
  if (!ADSENSE_ENABLED || !slotValid) return null;
  // Render placeholder while waiting for consent
  if (!consentResolved || !advertisingAllowed) return null;

  const insProps: Record<string, string | boolean> = {
    "data-ad-client": ADSENSE_CLIENT_ID,
    "data-ad-slot": slot.trim(),
    "data-ad-format": format,
    "data-full-width-responsive": fullWidthResponsive ? "true" : "false",
  };
  if (layout) insProps["data-ad-layout"] = layout;

  return (
    <aside
      ref={containerRef}
      aria-label="Advertisement"
      className={`relative overflow-hidden rounded-2xl border border-border/40 bg-muted/20 ${className}`}
      style={{ minHeight, contain: "layout" }}
    >
      <p className="absolute left-3 top-2 z-[1] text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/50 select-none pointer-events-none">
        Advertisement
      </p>
      {shouldLoad ? (
        <ins
          key={adKey}
          ref={insRef as React.Ref<HTMLModElement>}
          className="adsbygoogle"
          style={{ display: "block", minHeight, width: "100%" }}
          {...insProps}
        />
      ) : (
        <div
          className="h-full w-full animate-pulse bg-gradient-to-r from-muted/20 via-muted/40 to-muted/20"
          style={{ minHeight }}
        />
      )}
    </aside>
  );
}

export { ADSENSE_ENABLED as AUTO_ADS_ACTIVE };

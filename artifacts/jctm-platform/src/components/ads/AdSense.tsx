import { useEffect, useRef, useState, useCallback } from "react";
import { useCookieConsent } from "./CookieConsent";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

// ─── Publisher Configuration ──────────────────────────────────────────────────
const PUBLISHER_ID = "ca-pub-9869546801865196";

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
const _homeHero        = import.meta.env.VITE_ADSENSE_SLOT_HOME_HERO         || "7433409715";
const _homeMid         = import.meta.env.VITE_ADSENSE_SLOT_HOME_MID          || "6447631104";
const _sermonFeed      = import.meta.env.VITE_ADSENSE_SLOT_SERMON_FEED       || "2094061938";
const _sermonSidebar   = import.meta.env.VITE_ADSENSE_SLOT_SERMON_SIDEBAR    || "2609067251";
const _liveBelowPlayer = import.meta.env.VITE_ADSENSE_SLOT_LIVE_BELOW_PLAYER || "2069402391";

export const ADSENSE_SLOTS = {
  homeHero:        _homeHero,
  homeMid:         _homeMid,
  sermonFeed:      _sermonFeed,
  sermonSidebar:   _sermonSidebar,
  liveBelowPlayer: _liveBelowPlayer,
  introFeed:       import.meta.env.VITE_ADSENSE_SLOT_INTRO_FEED        || _sermonFeed,
  blogFeed:        import.meta.env.VITE_ADSENSE_SLOT_BLOG_FEED         || _sermonFeed,
  blogPost:        import.meta.env.VITE_ADSENSE_SLOT_BLOG_POST         || _homeMid,
  prayerPage:      import.meta.env.VITE_ADSENSE_SLOT_PRAYER            || _homeMid,
  eventsPage:      import.meta.env.VITE_ADSENSE_SLOT_EVENTS            || _sermonFeed,
  aboutPage:       import.meta.env.VITE_ADSENSE_SLOT_ABOUT             || _homeMid,
  testimoniesPage: import.meta.env.VITE_ADSENSE_SLOT_TESTIMONIES       || _sermonFeed,
  devotionPage:    import.meta.env.VITE_ADSENSE_SLOT_DEVOTION          || _homeMid,
  topicsPage:        import.meta.env.VITE_ADSENSE_SLOT_TOPICS            || _sermonFeed,
  leadershipPage:    import.meta.env.VITE_ADSENSE_SLOT_LEADERSHIP        || _homeMid,
  topicDetailPage:   import.meta.env.VITE_ADSENSE_SLOT_TOPIC_DETAIL      || _sermonFeed,
  scriptureStudy:    import.meta.env.VITE_ADSENSE_SLOT_SCRIPTURE         || _homeMid,
  spiritualInsight:  import.meta.env.VITE_ADSENSE_SLOT_SPIRITUAL         || _homeMid,
  galleryPage:       import.meta.env.VITE_ADSENSE_SLOT_GALLERY           || _sermonFeed,
  crusadePage:       import.meta.env.VITE_ADSENSE_SLOT_CRUSADE           || _sermonFeed,
  momentsPage:       import.meta.env.VITE_ADSENSE_SLOT_MOMENTS           || _sermonFeed,
};

function isValidSlot(slot: string | undefined): slot is string {
  return Boolean(slot && /^\d+$/.test(slot.trim()));
}

// ─── Explicit height presets (CLS prevention) ────────────────────────────────
// Google's CLS policy requires ad containers to have explicit dimensions so
// the layout does not shift when the ad fills in. Heights map to standard IAB sizes.
const FORMAT_MIN_HEIGHTS: Record<string, number> = {
  auto:       90,
  horizontal: 90,
  rectangle:  250,
  vertical:   600,
  fluid:      120,
};

interface AdSlotProps {
  slot: string;
  className?: string;
  minHeight?: number;
  format?: "auto" | "fluid" | "rectangle" | "horizontal" | "vertical";
  layout?: string;
  fullWidthResponsive?: boolean;
  lazy?: boolean;
  label?: string;
  trackPage?: string;
}

// ─── Page-view tracker — fires once per page mount ────────────────────────────
const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export function useAdPageTracker(page: string, adSlotsInView: number) {
  const fired = useRef(false);
  const consent = useCookieConsent();

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const consentLevel =
      consent === null
        ? "pending"
        : consent.advertising
          ? "full"
          : consent.analytics
            ? "analytics"
            : "essential";

    const visitorId = (() => {
      try {
        let id = localStorage.getItem("jctm_vid");
        if (!id) {
          id = crypto.randomUUID();
          localStorage.setItem("jctm_vid", id);
        }
        return id;
      } catch { return "anon"; }
    })();

    const sessionId = (() => {
      try {
        let id = sessionStorage.getItem("jctm_sid");
        if (!id) {
          id = crypto.randomUUID();
          sessionStorage.setItem("jctm_sid", id);
        }
        return id;
      } catch { return "anon"; }
    })();

    fetch(`${BASE_URL}/api/monetization/pageview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page,
        referrer: document.referrer,
        visitorId,
        sessionId,
        adSlotsInView,
        consentLevel,
      }),
    }).catch(() => {});
  }, [page, adSlotsInView, consent]);
}

// ─── AdSense Script Loader ────────────────────────────────────────────────────
// The AdSense script is already injected in index.html <head> so we never need
// to add it again. This guard simply marks the module as ready and prevents
// any accidental duplicate injection — two copies of pagead2.js with the same
// client ID will cause "TagError" errors and break auto-ads entirely.
let scriptInjected = false;
function ensureAdSenseScript() {
  if (scriptInjected) return;
  if (typeof document === "undefined") return;
  // Detect any pagead2 script — publisher ID may differ between env vars and index.html
  const existing = document.querySelector("script[src*='pagead2.googlesyndication.com']");
  if (existing) { scriptInjected = true; return; }
  // Fallback injection (only fires if index.html script tag is somehow missing)
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
  document.head.appendChild(script);
  scriptInjected = true;
}

// ─── AdSlot Component ─────────────────────────────────────────────────────────
export function AdSlot({
  slot,
  className = "",
  minHeight,
  format = "auto",
  layout,
  fullWidthResponsive = true,
  lazy = true,
  label = "Advertisement",
}: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const insRef       = useRef<HTMLModElement | null>(null);
  const pushedRef    = useRef(false);
  const [shouldLoad, setShouldLoad] = useState(!lazy);
  const [adKey, setAdKey]           = useState(0);
  const consent = useCookieConsent();

  // Explicit container height — prevents CLS (Core Web Vitals / AdSense policy)
  const reservedHeight = minHeight ?? FORMAT_MIN_HEIGHTS[format] ?? 90;

  const advertisingExplicitlyDenied = consent !== null && consent.advertising === false;
  const slotValid  = isValidSlot(slot);
  const canRender  = ADSENSE_ENABLED && slotValid && !advertisingExplicitlyDenied;

  useEffect(() => {
    if (!advertisingExplicitlyDenied) {
      pushedRef.current = false;
      setAdKey(k => k + 1);
    }
  }, [advertisingExplicitlyDenied]);

  // Lazy-load with generous rootMargin so ads load before visible
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

  // Push adsbygoogle exactly once per mounted ins element
  const push = useCallback(() => {
    if (pushedRef.current) return;
    const ins = insRef.current;
    if (!ins) return;
    if (ins.getAttribute("data-adsbygoogle-status") === "done") {
      pushedRef.current = true;
      return;
    }
    ensureAdSenseScript();
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
      pushedRef.current = true;
    } catch (err) {
      if (import.meta.env.DEV) console.warn("[AdSense] push failed:", err);
    }
  }, []);

  useEffect(() => {
    if (!canRender || !shouldLoad) return;
    const t = setTimeout(push, 200);
    return () => clearTimeout(t);
  }, [canRender, shouldLoad, adKey, push]);

  if (!ADSENSE_ENABLED || !slotValid) return null;
  if (advertisingExplicitlyDenied) return null;

  const insProps: Record<string, string | boolean> = {
    "data-ad-client":             ADSENSE_CLIENT_ID,
    "data-ad-slot":               slot.trim(),
    "data-ad-format":             format,
    "data-full-width-responsive": fullWidthResponsive ? "true" : "false",
  };
  if (layout) insProps["data-ad-layout"] = layout;

  return (
    <aside
      ref={containerRef}
      aria-label={label}
      // IMPORTANT: Do NOT use overflow-hidden here — it clips ad creatives that
      // render outside the initial container bounds (e.g. expanding ads, sticky
      // anchors). Do NOT use CSS containment (contain: layout/style/paint) as
      // it creates an independent formatting context that breaks auto-ads
      // viewport measurement and prevents Google's ad scripts from calculating
      // correct ad sizes and positions.
      className={`relative rounded-lg border border-border/40 bg-muted/20 ${className}`}
      style={{ minHeight: reservedHeight }}
    >
      <p className="absolute left-3 top-2 z-[1] text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/50 select-none pointer-events-none">
        Advertisement
      </p>

      {shouldLoad ? (
        <ins
          key={adKey}
          ref={insRef as React.Ref<HTMLModElement>}
          className="adsbygoogle"
          style={{
            display: "block",
            minHeight: reservedHeight,
            width: "100%",
          }}
          {...insProps}
        />
      ) : (
        <div
          aria-hidden
          className="h-full w-full animate-pulse bg-gradient-to-r from-muted/20 via-muted/40 to-muted/20"
          style={{ minHeight: reservedHeight }}
        />
      )}
    </aside>
  );
}

export { ADSENSE_ENABLED as AUTO_ADS_ACTIVE };

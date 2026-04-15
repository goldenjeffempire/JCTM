import { useEffect, useRef, useState } from "react";

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

export const ADSENSE_SLOTS = {
  homeHero: import.meta.env.VITE_ADSENSE_SLOT_HOME_HERO ?? "",
  homeMid: import.meta.env.VITE_ADSENSE_SLOT_HOME_MID ?? "",
  sermonFeed: import.meta.env.VITE_ADSENSE_SLOT_SERMON_FEED ?? "",
  sermonSidebar: import.meta.env.VITE_ADSENSE_SLOT_SERMON_SIDEBAR ?? "",
  introFeed: import.meta.env.VITE_ADSENSE_SLOT_INTRO_FEED ?? "",
  liveBelowPlayer: import.meta.env.VITE_ADSENSE_SLOT_LIVE_BELOW_PLAYER ?? "",
};

function isValidSlot(slot: string | undefined): slot is string {
  return Boolean(slot && /^\d+$/.test(slot));
}

export function AdSenseHead() {
  return null;
}

interface AdSlotProps {
  slot: string;
  className?: string;
  minHeight?: number;
  format?: "auto" | "fluid" | "rectangle" | "horizontal" | "vertical";
  layout?: string;
  lazy?: boolean;
}

export function AdSlot({
  slot,
  className = "",
  minHeight = 250,
  format = "auto",
  layout,
  lazy = true,
}: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pushedRef = useRef(false);
  const [shouldLoad, setShouldLoad] = useState(!lazy);
  const canRender = ADSENSE_ENABLED && isValidSlot(slot);

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

  if (!canRender) return null;

  return (
    <aside
      ref={containerRef}
      aria-label="Advertisement"
      className={`relative overflow-hidden rounded-2xl border border-border/40 bg-muted/20 ${className}`}
      style={{ minHeight }}
    >
      <div className="absolute left-3 top-2 z-[1] text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
        Advertisement
      </div>
      {shouldLoad ? (
        <ins
          className="adsbygoogle"
          style={{ display: "block", minHeight }}
          data-ad-client={ADSENSE_CLIENT_ID}
          data-ad-slot={slot}
          data-ad-format={format}
          data-ad-layout={layout}
          data-full-width-responsive="true"
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-gradient-to-r from-muted/20 via-muted/40 to-muted/20" />
      )}
    </aside>
  );
}
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const GA4_ID = (import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined)?.trim();

let ga4Loaded = false;

export function initGA4(): void {
  if (!GA4_ID || typeof document === "undefined" || ga4Loaded) return;
  ga4Loaded = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(script);

  script.onload = () => {
    window.gtag?.("js", new Date());
    window.gtag?.("config", GA4_ID, {
      send_page_view: false,
      cookie_flags: "SameSite=None;Secure",
    });
  };
}

export function trackPageView(path: string, title?: string): void {
  if (!GA4_ID || typeof window.gtag !== "function") return;
  window.gtag("config", GA4_ID, {
    page_path: path,
    page_title: title ?? document.title,
    send_page_view: true,
  });
}

export function trackEvent(
  action: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (!GA4_ID || typeof window.gtag !== "function") return;
  window.gtag("event", action, params ?? {});
}

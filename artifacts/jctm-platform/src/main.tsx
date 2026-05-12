import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { Component, type ReactNode } from "react";
import App from "./App";
import "./index.css";
import { reportClientError } from "./lib/clientErrorReporting";
import { isChunkLoadError, recoverFromChunkLoadError } from "./lib/chunkRecovery";
import { initGA4 } from "./lib/analytics";

initGA4();

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("Root-level error:", error, info);
    reportClientError(error, { source: "root-error-boundary", componentStack: info.componentStack });
    recoverFromChunkLoadError(error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", fontFamily: "sans-serif", background: "#0a0a0a", color: "#fff" }}>
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>Something went wrong</h1>
            <p style={{ color: "#aaa", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              We encountered an unexpected error loading the page. Please try refreshing.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: "9999px", padding: "0.625rem 1.5rem", cursor: "pointer", fontSize: "0.875rem" }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </RootErrorBoundary>
);

// ─── Hide instant app shell once React has mounted ────────────────────────────
// The shell is rendered synchronously by index.html so users never see a blank
// white page during JS download/parse. Once React commits its first paint we
// fade it out immediately (150ms CSS transition) and remove it from the DOM.
function hideAppShell() {
  const el = document.getElementById("app-shell");
  if (!el) return;
  el.classList.add("app-shell--hide");
  setTimeout(() => el.parentNode?.removeChild(el), 160);
}
if (typeof requestAnimationFrame === "function") {
  requestAnimationFrame(hideAppShell);
} else {
  hideAppShell();
}

// ─── Idle-time route prefetching ──────────────────────────────────────────────
// After first paint, warm up the chunks for the most-trafficked pages so when
// the user navigates the click feels instant (no Suspense fallback flash).
// Runs only on `requestIdleCallback` so it never competes with user interaction
// or first contentful paint. Skipped on slow connections (Save-Data / 2g).
type NavigatorWithSaveData = Navigator & {
  connection?: { saveData?: boolean; effectiveType?: string };
};
function prefetchCriticalRoutes() {
  const conn = (navigator as NavigatorWithSaveData).connection;
  if (conn?.saveData) return;
  if (conn?.effectiveType && /^(slow-)?2g$/.test(conn.effectiveType)) return;
  // Each import() returns a promise we don't await — Vite/rollup will fetch
  // the chunk and the browser cache will hold it for instant route navigation.
  void import("@/pages/Home");
  void import("@/pages/Sermons");
  void import("@/pages/Crusade");
  void import("@/pages/Events");
  void import("@/pages/Devotion");
}
type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
};
const idleWin = window as WindowWithIdleCallback;
if (typeof idleWin.requestIdleCallback === "function") {
  idleWin.requestIdleCallback(prefetchCriticalRoutes, { timeout: 4000 });
} else {
  setTimeout(prefetchCriticalRoutes, 2500);
}

window.addEventListener("error", (event) => {
  if (isChunkLoadError(event.error ?? event.message)) {
    recoverFromChunkLoadError(event.error ?? event.message);
  }
  reportClientError(event.error ?? event.message, { source: "window-error" });
});

window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadError(event.reason)) {
    recoverFromChunkLoadError(event.reason);
  }
  reportClientError(event.reason, { source: "unhandled-rejection" });
});

// ─── Service Worker Registration ──────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .then((reg) => {
        reg.update();
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
        // Re-poll the SW for updates whenever the tab regains focus so
        // installability metadata stays fresh on long-lived sessions.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            reg.update().catch(() => {});
            navigator.serviceWorker.controller?.postMessage({ type: "CHECK_INSTALLABILITY" });
          }
        });
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });
  });
}

// ─── PWA Install Prompt Capture ───────────────────────────────────────────────
// Browsers fire `beforeinstallprompt` once per page-load when install criteria
// are satisfied. We capture the deferred event and stash it on `window` so the
// browser's native install affordance (address-bar icon, menu entry) stays
// available across SPA navigations, and any future "Install App" UI can call
// `window.__jctmInstallPrompt.prompt()` on demand. We also re-broadcast a
// custom event each time so listeners across the app can react.
declare global {
  interface Window {
    __jctmInstallPrompt: BeforeInstallPromptEvent | null;
    __jctmIsAppInstalled: boolean;
  }
  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: ReadonlyArray<string>;
    readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
    prompt(): Promise<void>;
  }
}

window.__jctmInstallPrompt = null;
window.__jctmIsAppInstalled =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

window.addEventListener("beforeinstallprompt", (event) => {
  // Do NOT call preventDefault — letting the browser handle its own native
  // install UI is exactly what "advertise installability every refresh" means.
  // We just stash the event so any in-app trigger can also fire it later.
  window.__jctmInstallPrompt = event as BeforeInstallPromptEvent;
  window.dispatchEvent(
    new CustomEvent("jctm:installability-changed", {
      detail: { installable: true, installed: window.__jctmIsAppInstalled },
    }),
  );
});

window.addEventListener("appinstalled", () => {
  window.__jctmInstallPrompt = null;
  window.__jctmIsAppInstalled = true;
  window.dispatchEvent(
    new CustomEvent("jctm:installability-changed", {
      detail: { installable: false, installed: true },
    }),
  );
});

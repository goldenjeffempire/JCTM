import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { Component, type ReactNode } from "react";
import App from "./App";
import "./index.css";
import { reportClientError } from "./lib/clientErrorReporting";

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

window.addEventListener("error", (event) => {
  reportClientError(event.error ?? event.message, { source: "window-error" });
});

window.addEventListener("unhandledrejection", (event) => {
  reportClientError(event.reason, { source: "unhandled-rejection" });
});

// ─── Service Worker Registration ──────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.info("[SW] New version available — will activate on next reload");
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });
  });
}

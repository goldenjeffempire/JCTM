import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { Component, type ReactNode } from "react";
import App from "./App";
import "./index.css";

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

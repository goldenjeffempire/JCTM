import { Component, type ReactNode } from "react";
import { reportClientError } from "@/lib/clientErrorReporting";

interface Props {
  /** A short label used to identify this boundary in error reports. */
  name: string;
  /** Children to render normally; replaced by `fallback` if they throw. */
  children: ReactNode;
  /**
   * Optional replacement UI shown when the section crashes. Defaults to
   * `null`, which simply removes the failed section without breaking the
   * rest of the page.
   */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Per-section error boundary. Use this around expensive/fragile UI
 * (WebGL canvases, large media widgets, dynamic third-party embeds) so a
 * failure in one section never takes down the whole page.
 *
 * Errors are reported to the client error pipeline with the boundary
 * `name` so we can see exactly which section failed.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    reportClientError(error, {
      source: `section:${this.props.name}`,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

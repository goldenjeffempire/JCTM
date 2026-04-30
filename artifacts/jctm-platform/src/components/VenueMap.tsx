import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ExternalLink, MapPin, Navigation, Loader2, AlertTriangle } from "lucide-react";
import { Venue, isValidVenue, venueDeepLinks } from "@/constants/venues";

// ─────────────────────────────────────────────────────────────────────────────
// VenueMap — production-grade interactive map for any event venue.
// ─────────────────────────────────────────────────────────────────────────────
// • Engine: Leaflet 1.9 + react-leaflet 5 + OpenStreetMap tiles. No API key
//   required; works in production immediately. Used by Wikipedia / GitHub /
//   Facebook / Foursquare among many others — fully industry-standard.
// • Lazy-loaded: the entire Leaflet payload (~150kB) is split into its own
//   chunk via React.lazy + dynamic import, AND the chunk is only fetched once
//   the map scrolls into the viewport (IntersectionObserver gate). This keeps
//   first-paint of the host page completely uncoupled from map cost.
// • Skeleton loader before tiles are ready, animated shimmer.
// • Robust fallback: if the dynamic import or tile load fails, we surface the
//   address + a one-tap "Open in Google Maps" CTA — never an empty box.
// • Accessibility: outer container is `role="region"` with an aria-label.
//   The "Get Directions" buttons are real <a> tags so screen readers / keyboard
//   nav handle them naturally.
// • Mobile-first: scroll-wheel zoom is disabled on mobile so the map never
//   hijacks page scroll; users tap the map once to enable interaction. Pinch-
//   zoom + drag-pan always work.
// • Multi-venue: pass `venues` instead of `venue` to render multiple markers
//   and auto-fit the viewport to all of them.
// ─────────────────────────────────────────────────────────────────────────────

export interface VenueMapProps {
  /** Single venue (most common usage). Mutually exclusive with `venues`. */
  venue?: Venue;
  /** Multiple venues — auto-fits bounds to include all valid ones. */
  venues?: Venue[];
  /** Visual height of the map area. Default 400px. */
  height?: number | string;
  /** Optional title shown in the colour-banded header bar. */
  headerTitle?: string;
  /** Optional className applied to the outer wrapper. */
  className?: string;
  /** Header colour theme (matches the host page). */
  theme?: {
    headerBg?: string;
    headerBorder?: string;
    accentText?: string;
    footerBg?: string;
  };
  /**
   * Disable lazy-loading. Useful for above-the-fold maps where the map IS
   * the page (e.g. a dedicated "Find us" page).
   */
  eager?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lazy-loaded inner renderer — pulls leaflet only when actually needed.
// ─────────────────────────────────────────────────────────────────────────────
const LeafletInner = lazy(() => import("./VenueMapLeaflet"));

const DEFAULT_THEME = {
  headerBg: "rgba(15,23,42,0.85)",
  headerBorder: "rgba(148,163,184,0.2)",
  accentText: "text-sky-400",
  footerBg: "rgba(15,23,42,0.85)",
} as const;

export function VenueMap({
  venue,
  venues,
  height = 400,
  headerTitle = "Live Location Map",
  className = "",
  theme,
  eager = false,
}: VenueMapProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(eager);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const t = { ...DEFAULT_THEME, ...(theme ?? {}) };

  // Resolve the venue list once and validate.
  const allVenues = useMemo<Venue[]>(() => {
    const raw = venues ?? (venue ? [venue] : []);
    return raw.filter(isValidVenue);
  }, [venue, venues]);

  const primary = allVenues[0];

  // Lazy-load: hold off on fetching the leaflet chunk until the map enters
  // the viewport (or close to it). 200px rootMargin = pre-warm just before.
  useEffect(() => {
    if (eager || inView || typeof window === "undefined") return;
    const node = wrapperRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px 0px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [eager, inView]);

  // ── Empty/invalid state ───────────────────────────────────────────────────
  if (allVenues.length === 0 || !primary) {
    return (
      <div
        ref={wrapperRef}
        role="region"
        aria-label="Venue location"
        className={`rounded-3xl overflow-hidden border border-amber-500/30 bg-amber-500/5 ${className}`}
        style={{ minHeight: typeof height === "number" ? `${height}px` : height }}
      >
        <div className="flex items-start gap-3 p-6">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-200 text-sm font-semibold">Venue coordinates unavailable</p>
            <p className="text-amber-200/70 text-xs mt-1">
              The map can't render without valid coordinates. Please add latitude/longitude in
              the admin panel.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const links = venueDeepLinks(primary);

  return (
    <div
      ref={wrapperRef}
      role="region"
      aria-label={`Map showing the location of ${primary.name}`}
      className={`rounded-3xl overflow-hidden ${className}`}
      style={{
        border: `1px solid ${t.headerBorder}`,
      }}
    >
      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <div
        className="p-4 flex items-center gap-2"
        style={{ background: t.headerBg, borderBottom: `1px solid ${t.headerBorder}` }}
      >
        <MapPin className={`h-4 w-4 ${t.accentText}`} aria-hidden />
        <span className="text-white text-sm font-semibold truncate">{headerTitle}</span>
        <a
          href={links.google}
          target="_blank"
          rel="noopener noreferrer"
          className={`ml-auto text-xs ${t.accentText} opacity-80 hover:opacity-100 flex items-center gap-1 whitespace-nowrap`}
          aria-label={`Open ${primary.name} in Google Maps (opens in a new tab)`}
        >
          Open in Maps <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </div>

      {/* ── Map canvas (lazy + Suspense + error fallback) ────────────────── */}
      <div
        className="relative bg-slate-950"
        style={{ height: typeof height === "number" ? `${height}px` : height }}
      >
        {loadError ? (
          <FallbackPanel venue={primary} reason="The interactive map couldn't load." />
        ) : inView ? (
          <Suspense fallback={<MapSkeleton />}>
            <LeafletInnerWithErrorBoundary
              venues={allVenues}
              onError={setLoadError}
            />
          </Suspense>
        ) : (
          <MapSkeleton />
        )}
      </div>

      {/* ── Footer: address + actions ────────────────────────────────────── */}
      <div className="p-4 space-y-3" style={{ background: t.footerBg }}>
        <div>
          {primary.whenLabel && (
            <p className="text-white/90 text-sm font-semibold">{primary.whenLabel}</p>
          )}
          <p className="text-white/70 text-xs flex items-start gap-1.5 mt-1">
            <MapPin className={`h-3.5 w-3.5 ${t.accentText} shrink-0 mt-0.5`} aria-hidden />
            <span>{primary.address}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Get directions">
          <DirAction href={links.googleDirections} label="Google Maps" primary />
          <DirAction href={links.apple} label="Apple Maps" />
          <DirAction href={links.waze} label="Waze" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────────────────────

function DirAction({
  href,
  label,
  primary,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
        primary
          ? "bg-sky-500 text-white hover:bg-sky-400"
          : "bg-white/10 text-white hover:bg-white/20",
      ].join(" ")}
      aria-label={`Get directions with ${label} (opens in a new tab)`}
    >
      <Navigation className="h-3.5 w-3.5" aria-hidden /> {label}
    </a>
  );
}

function MapSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading map"
      className="absolute inset-0 flex items-center justify-center bg-slate-900"
    >
      <div
        aria-hidden
        className="absolute inset-0 animate-pulse"
        style={{
          background:
            "linear-gradient(135deg, rgba(30,41,59,0.6) 0%, rgba(15,23,42,0.9) 50%, rgba(30,41,59,0.6) 100%)",
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-2 text-white/70">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-xs font-medium">Loading map…</span>
      </div>
    </div>
  );
}

function FallbackPanel({ venue, reason }: { venue: Venue; reason: string }) {
  const links = venueDeepLinks(venue);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-slate-900">
      <AlertTriangle className="h-7 w-7 text-amber-400" aria-hidden />
      <p className="text-white text-sm font-semibold">{reason}</p>
      <p className="text-white/70 text-xs max-w-md">{venue.address}</p>
      <a
        href={links.google}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-400"
      >
        <Navigation className="h-3.5 w-3.5" aria-hidden /> Open in Google Maps
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny error boundary so a chunk-load / runtime failure inside Leaflet bubbles
// up as a `loadError` instead of crashing the whole page.
// ─────────────────────────────────────────────────────────────────────────────

interface BoundaryProps {
  venues: Venue[];
  onError: (err: Error) => void;
  children?: ReactNode;
}
interface BoundaryState {
  hasError: boolean;
}
class LeafletInnerWithErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };
  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    // Surface to host so it can render the fallback UI.
    this.props.onError(error);
    // Best-effort logging for monitoring; consumer can wire to Sentry/etc.
    if (typeof console !== "undefined") {
      console.error("[VenueMap] Leaflet failed to mount:", error);
    }
  }
  render() {
    if (this.state.hasError) return null;
    return <LeafletInner venues={this.props.venues} />;
  }
}

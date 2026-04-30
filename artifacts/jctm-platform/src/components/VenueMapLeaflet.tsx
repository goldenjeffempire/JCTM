import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L, { type LatLngBoundsExpression } from "leaflet";
import { Venue, venueDeepLinks } from "@/constants/venues";
import "leaflet/dist/leaflet.css";

// ─────────────────────────────────────────────────────────────────────────────
// Inner Leaflet renderer — split into its own file so the heavyweight leaflet
// + react-leaflet payload only ships in the chunk loaded by VenueMap's
// React.lazy() call.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  venues: Venue[];
}

/**
 * Build a branded SVG pin as a Leaflet `divIcon`. Avoids the broken default
 * marker images (which require a webpack/vite asset pipeline workaround) and
 * lets each venue use its own accent colour.
 */
function buildIcon(accent: string) {
  const fill = accent || "#facc15";
  const html = `
    <div class="venue-pin" aria-hidden="true">
      <svg viewBox="0 0 32 44" width="32" height="44" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="venue-pin-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.45"/>
          </filter>
        </defs>
        <path filter="url(#venue-pin-shadow)" d="M16 0C7.163 0 0 7.05 0 15.75 0 27.563 16 44 16 44s16-16.438 16-28.25C32 7.05 24.837 0 16 0z" fill="${fill}"/>
        <circle cx="16" cy="15.75" r="6" fill="#0f172a"/>
        <circle cx="16" cy="15.75" r="2.6" fill="${fill}"/>
      </svg>
    </div>
  `;
  return L.divIcon({
    className: "venue-pin-wrapper",
    html,
    iconSize: [32, 44],
    iconAnchor: [16, 42],
    popupAnchor: [0, -36],
  });
}

/**
 * Auto-fit the map viewport to include every marker. For a single venue we
 * just centre + zoom; for multiple we compute a fitBounds with padding so
 * every pin is visible.
 */
function FitToVenues({ venues }: { venues: Venue[] }) {
  const map = useMap();
  useEffect(() => {
    if (venues.length === 0) return;
    if (venues.length === 1) {
      const v = venues[0]!;
      map.setView([v.lat, v.lng], v.zoom ?? 16, { animate: false });
      return;
    }
    const bounds: LatLngBoundsExpression = venues.map(v => [v.lat, v.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [map, venues]);
  return null;
}

/**
 * On touch devices, disable scroll-wheel + drag zoom on initial mount so the
 * page can scroll past the map without the map grabbing focus. After the user
 * explicitly taps the map, all interactions are re-enabled.
 */
function TouchFriendlyInteractions() {
  const map = useMap();
  const armed = useRef(false);
  useEffect(() => {
    const isTouch =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)").matches ?? false);
    if (!isTouch) return;
    map.scrollWheelZoom.disable();
    map.dragging.disable();
    const enable = () => {
      if (armed.current) return;
      armed.current = true;
      map.scrollWheelZoom.enable();
      map.dragging.enable();
    };
    map.on("click", enable);
    return () => {
      map.off("click", enable);
    };
  }, [map]);
  return null;
}

export default function VenueMapLeaflet({ venues }: Props) {
  const primary = venues[0]!;

  // Memoise icons by accent so React doesn't rebuild on every render.
  const iconCache = useMemo(() => {
    const cache = new Map<string, L.DivIcon>();
    for (const v of venues) {
      const key = v.accent ?? "#facc15";
      if (!cache.has(key)) cache.set(key, buildIcon(key));
    }
    return cache;
  }, [venues]);

  return (
    <MapContainer
      center={[primary.lat, primary.lng]}
      zoom={primary.zoom ?? 16}
      scrollWheelZoom
      keyboard
      style={{ height: "100%", width: "100%" }}
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <FitToVenues venues={venues} />
      <TouchFriendlyInteractions />
      {venues.map(v => {
        const icon = iconCache.get(v.accent ?? "#facc15")!;
        const links = venueDeepLinks(v);
        return (
          <Marker
            key={v.id}
            position={[v.lat, v.lng]}
            icon={icon}
            keyboard
            title={v.name}
            alt={`${v.name} — ${v.address}`}
          >
            <Popup>
              <div className="venue-popup">
                <strong style={{ color: "#0f172a" }}>{v.name}</strong>
                {v.whenLabel && (
                  <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>{v.whenLabel}</div>
                )}
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>
                  {v.address}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <a
                    href={links.googleDirections}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={popupBtn(v.accent ?? "#facc15", true)}
                  >
                    Directions
                  </a>
                  <a
                    href={links.apple}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={popupBtn(v.accent ?? "#facc15", false)}
                  >
                    Apple Maps
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

function popupBtn(accent: string, primary: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    textDecoration: "none",
    background: primary ? accent : "#f1f5f9",
    color: primary ? "#0f172a" : "#0f172a",
  };
}

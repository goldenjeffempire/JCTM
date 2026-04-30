// ─────────────────────────────────────────────────────────────────────────────
// Venue registry — single source of truth for every physical event location
// rendered by <VenueMap />. Each entry holds the lat/lng, addresses, and
// pre-built navigation deep links (Google Maps, Apple Maps, Waze).
// ─────────────────────────────────────────────────────────────────────────────

export interface Venue {
  /** stable id, used as React key + for analytics */
  id: string;
  /** display name shown in the marker popup */
  name: string;
  /** WGS84 latitude (decimal degrees) */
  lat: number;
  /** WGS84 longitude (decimal degrees) */
  lng: number;
  /** Single-line postal/street address shown under the name */
  address: string;
  /** Optional "starts at" line shown in the popup (e.g. "Fri 1 May, 4 PM") */
  whenLabel?: string;
  /** Brand accent colour for the marker glyph (hex). Defaults to gold. */
  accent?: string;
  /** Optional zoom level override (default 16) */
  zoom?: number;
}

/**
 * Validate that a Venue has usable coordinates. Used as a runtime guard
 * before rendering the map — prevents broken/empty map states.
 */
export function isValidVenue(v: Pick<Venue, "lat" | "lng">): boolean {
  return (
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lng) &&
    v.lat >= -90 &&
    v.lat <= 90 &&
    v.lng >= -180 &&
    v.lng <= 180
  );
}

/** URL-encode an address for use in a `?q=` style maps query. */
const enc = (s: string) => encodeURIComponent(s);

/** Build platform-specific deep links for a venue. */
export function venueDeepLinks(v: Pick<Venue, "lat" | "lng" | "address" | "name">) {
  const q = enc(v.address);
  const coordPair = `${v.lat},${v.lng}`;
  return {
    /** Open in the Google Maps web/app — most reliable on Android & desktop. */
    google: `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=&query_coords=${coordPair}`,
    /** Get driving directions in Google Maps. */
    googleDirections: `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`,
    /** Apple Maps — works on iOS/macOS, falls back to a web view elsewhere. */
    apple: `https://maps.apple.com/?daddr=${q}&q=${enc(v.name)}`,
    /** Waze — community-driven driving navigation. */
    waze: `https://waze.com/ul?ll=${coordPair}&navigate=yes&q=${q}`,
    /** Neutral geo: URI that the OS will hand off to the user's default map app. */
    geoUri: `geo:${coordPair}?q=${coordPair}(${enc(v.name)})`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Known venues — lat/lng confirmed against Google Maps embeds already in use.
// ─────────────────────────────────────────────────────────────────────────────

export const WARRI_CRUSADE_VENUE: Venue = {
  id: "warri-crusade-2026",
  name: "Warri City Crusade 2026",
  lat: 5.5167,
  lng: 5.7500,
  address:
    "Ighogbadu Primary School, Obodo, Okumagba Avenue, Warri South L.G.A., Delta State, Nigeria",
  whenLabel: "Thursday 30th April & Friday 1st May, 2026 · 6:00 PM Daily (WAT)",
  accent: "#facc15", // tailwind yellow-400 — matches Crusade page palette
  zoom: 16,
};

export const CHURCH_HQ_VENUE: Venue = {
  id: "jctm-headquarters",
  name: "Jesus Christ Temple Ministry — Headquarters",
  lat: 5.5552,
  lng: 5.7833,
  address:
    "Km 1 East West Road, Patani Expressway, Ebrumede Roundabout, Effurun, Delta State, Nigeria",
  whenLabel: "Sundays · 8 AM (1st service) · 10 AM (2nd service)",
  accent: "#0ea5e9", // sky-500 — matches site primary
  zoom: 16,
};

export const CONFERENCE_VENUE: Venue = {
  id: "ministers-conference-2026",
  name: "Ministers Conference 2026",
  lat: 5.548,
  lng: 5.773,
  address:
    "Church Auditorium, Ebrumede Roundabout, Effurun, Uvwie L.G.A., Delta State, Nigeria",
  whenLabel: "Conference Week · See schedule",
  accent: "#a855f7", // purple-500 — matches Conference page palette
  zoom: 16,
};

/** Lookup by id — used by the admin panel & dynamic map embeds. */
export const VENUES: Record<string, Venue> = {
  [WARRI_CRUSADE_VENUE.id]: WARRI_CRUSADE_VENUE,
  [CHURCH_HQ_VENUE.id]: CHURCH_HQ_VENUE,
  [CONFERENCE_VENUE.id]: CONFERENCE_VENUE,
};

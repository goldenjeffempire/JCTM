import { pool } from "@workspace/db";
import { logger } from "./logger.js";

interface ActiveEvent {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  artwork_url: string | null;
  location: string | null;
  cta_url: string;
  start_at: Date;
  end_at: Date;
}

// ── In-memory TTL cache ───────────────────────────────────────────────────────
// Avoids a DB hit on every SPA page request. Refreshes at most every 60 s,
// so new events created in the admin panel go live within 1 minute.
// The cache is invalidated immediately on any event create / update / delete.
let cachedSchemas: string | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000;

// ── Schema builder ────────────────────────────────────────────────────────────
function buildEventSchema(ev: ActiveEvent): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: ev.title,
    description:
      ev.subtitle ??
      `${ev.title} — hosted by Jesus Christ Temple Ministry (JCTM), Warri, Nigeria.`,
    startDate: new Date(ev.start_at).toISOString(),
    endDate: new Date(ev.end_at).toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: String(ev.cta_url).startsWith("http")
      ? ev.cta_url
      : `https://jctm.org.ng${ev.cta_url}`,
    image: ev.artwork_url ?? "https://jctm.org.ng/opengraph.jpg",
    isAccessibleForFree: true,
    inLanguage: "en-NG",
    organizer: { "@id": "https://jctm.org.ng/#organization" },
    performer: { "@id": "https://jctm.org.ng/#prophet" },
    superEvent: {
      "@type": "EventSeries",
      name: "JCTM Conferences & Crusades",
    },
  };

  if (ev.location) {
    schema.location = {
      "@type": "Place",
      name: ev.location,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Warri",
        addressRegion: "Delta State",
        addressCountry: "NG",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: "5.5167",
        longitude: "5.7500",
      },
    };
  }

  return schema;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns zero or more <script type="application/ld+json"> tags for all
 * events that are currently active (status='active' AND end_at > NOW()).
 * The result is an empty string when there are no live events, so callers
 * can inject it unconditionally without adding whitespace noise.
 */
export async function getActiveEventSchemaScripts(): Promise<string> {
  const now = Date.now();
  if (cachedSchemas !== null && now < cacheExpiresAt) {
    return cachedSchemas;
  }

  try {
    const { rows } = await pool.query<ActiveEvent>(`
      SELECT id, slug, title, subtitle, artwork_url, location, cta_url, start_at, end_at
      FROM   event_promotions
      WHERE  status = 'active'
        AND  end_at > NOW()
      ORDER  BY start_at ASC
      LIMIT  5
    `);

    if (rows.length === 0) {
      cachedSchemas = "";
      cacheExpiresAt = now + CACHE_TTL_MS;
      return "";
    }

    const scripts = rows
      .map(
        (ev) =>
          `    <!-- Event schema: ${ev.slug} (auto-removed after ${new Date(ev.end_at).toISOString()}) -->\n` +
          `    <script type="application/ld+json">\n${JSON.stringify(buildEventSchema(ev), null, 4)}\n    </script>`,
      )
      .join("\n");

    cachedSchemas = scripts;
    cacheExpiresAt = now + CACHE_TTL_MS;
    return scripts;
  } catch (err) {
    logger.warn({ err }, "event-schema: DB query failed — skipping injection");
    // Don't cache the failure — try again on next request.
    return "";
  }
}

/**
 * Immediately invalidates the cached schema so the next page request
 * triggers a fresh DB query. Call this from any route that mutates
 * the event_promotions table (create, update, delete).
 */
export function invalidateEventSchemaCache(): void {
  cachedSchemas = null;
  cacheExpiresAt = 0;
  logger.debug("event-schema: cache invalidated");
}

// ── Plain-text event context (for TempleBots system prompt) ───────────────────
let cachedEventContext: string | null = null;
let contextExpiresAt = 0;

/**
 * Returns a plain-text description of the currently active event (if any)
 * for injection into the TempleBots system prompt. Shares the same 60-second
 * TTL cache as the JSON-LD schema. Returns an empty string when no event is live.
 */
export async function getActiveEventContext(): Promise<string> {
  const now = Date.now();
  if (cachedEventContext !== null && now < contextExpiresAt) {
    return cachedEventContext;
  }

  try {
    const { rows } = await pool.query<ActiveEvent>(`
      SELECT id, slug, title, subtitle, artwork_url, location, cta_url, start_at, end_at
      FROM   event_promotions
      WHERE  status = 'active'
        AND  end_at > NOW()
      ORDER  BY start_at ASC
      LIMIT  1
    `);

    if (rows.length === 0) {
      cachedEventContext = "";
      contextExpiresAt = now + CACHE_TTL_MS;
      return "";
    }

    const ev = rows[0]!;
    const startStr = new Date(ev.start_at).toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos",
    });
    const endStr = new Date(ev.end_at).toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos",
    });
    const url = String(ev.cta_url).startsWith("http")
      ? ev.cta_url
      : `https://jctm.org.ng${ev.cta_url}`;

    const ctx = `CURRENT ACTIVE EVENT — ${ev.title}:
- Title: ${ev.title}${ev.subtitle ? ` — ${ev.subtitle}` : ""}
- Dates: ${startStr} through ${endStr}
- Venue: ${ev.location ?? "JCTM Ebrumede Temple, Warri"}
- Info / Register: ${url}
- Organiser: Jesus Christ Temple Ministry (JCTM), Warri, Nigeria
- Enquiries: +234(0)8081313111 | info@jctm.org.ng
When users ask about this event, provide these exact details. Do NOT fabricate additional details not listed here.`;

    cachedEventContext = ctx;
    contextExpiresAt = now + CACHE_TTL_MS;
    return ctx;
  } catch (err) {
    logger.warn({ err }, "event-schema: getActiveEventContext DB query failed");
    return "";
  }
}

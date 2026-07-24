/**
 * devotion-prerender.ts — Server-side pre-rendering helper for the daily devotion.
 *
 * Returns a <script> block that sets window.__DEVOTION__ so the React component
 * can hydrate immediately without waiting for a client-side API round-trip.
 * This ensures Google's crawler always sees the full devotional content.
 *
 * The result is cached in-process for 7 minutes so successive page requests
 * don't each hit the DB / AI generation path.  The cache resets automatically
 * at midnight (Nigeria time) when the date changes, ensuring users always see
 * today's devotion rather than yesterday's cached copy.
 */

import { ensureDevotionForDate } from "./devotion-engine.js";
import { logger } from "./logger.js";

// ── In-memory TTL cache ───────────────────────────────────────────────────────
let cachedScript: string | null = null;
let cachedForDate: string = "";          // YYYY-MM-DD
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 7 * 60_000;        // 7 minutes

/** Subset of the devotion object kept for Open Graph tag injection. */
interface DevotionOgData {
  title: string;
  scripture: string;
  reference: string;
}
let cachedOgData: DevotionOgData | null = null;

function todayNigeriaDate(): string {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }); // YYYY-MM-DD
}

/**
 * Returns an inline <script> tag that sets window.__DEVOTION__ to today's
 * devotion object.  Returns an empty string on any error so callers can always
 * inject the return value unconditionally — the page still works via client
 * fetch if this fails.
 */
export async function getDevotionPrerenderScript(): Promise<string> {
  const todayStr = todayNigeriaDate();
  const now = Date.now();

  // Serve from cache if it's still fresh AND for the same calendar date.
  if (
    cachedScript !== null &&
    cachedForDate === todayStr &&
    now < cacheExpiresAt
  ) {
    return cachedScript;
  }

  try {
    const { devotion } = await ensureDevotionForDate(todayStr);

    // JSON.stringify is safe here; the values are plain strings from the DB
    // (no user-supplied HTML that could break out of the <script> block).
    // We replace </script with <\/script just to be belt-and-suspenders safe.
    const safeJson = JSON.stringify(devotion).replace(/<\/script/gi, "<\\/script");

    const script =
      `  <script>window.__DEVOTION__=${safeJson};</script>`;

    cachedScript = script;
    cachedForDate = todayStr;
    cacheExpiresAt = now + CACHE_TTL_MS;
    cachedOgData = {
      title: devotion.title,
      scripture: devotion.scripture,
      reference: devotion.reference,
    };
    return script;
  } catch (err) {
    logger.warn({ err }, "devotion-prerender: failed to fetch today's devotion — skipping injection");
    // Don't cache the failure; retry on the next request.
    return "";
  }
}

/**
 * Returns the Open Graph data (title, scripture, reference) for today's
 * devotion, reusing the same in-process cache as getDevotionPrerenderScript().
 * Returns null if the devotion is unavailable or if the cache is stale /
 * for a different calendar date, so callers fall back gracefully to the
 * static index.html meta tags rather than serving yesterday's content.
 *
 * This function must be called AFTER getDevotionPrerenderScript() in the
 * same request (both are awaited together via Promise.all in app.ts), which
 * ensures the cache is always warm when this is read.
 */
export function getDevotionOgData(): DevotionOgData | null {
  // Guard: only serve OG data when the cache is fresh AND for today's date.
  // If the re-fetch failed after expiry or date rollover, cachedOgData may
  // hold yesterday's values — return null so the static fallback is used.
  if (
    cachedOgData === null ||
    cachedForDate !== todayNigeriaDate() ||
    Date.now() >= cacheExpiresAt
  ) {
    return null;
  }
  return cachedOgData;
}

/**
 * Immediately clears the pre-render cache.  Call this if the devotion for
 * today is manually regenerated via an admin action.
 */
export function invalidateDevotionPrerenderCache(): void {
  cachedScript = null;
  cachedForDate = "";
  cacheExpiresAt = 0;
  cachedOgData = null;
  logger.debug("devotion-prerender: cache invalidated");
}

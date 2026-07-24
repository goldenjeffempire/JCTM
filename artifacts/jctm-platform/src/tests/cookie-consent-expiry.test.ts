/**
 * Unit tests for getConsentState() expiry logic in CookieConsent.tsx.
 *
 * Verifies three scenarios:
 *  (a) Fresh consent  → banner stays hidden (returns ConsentState)
 *  (b) Consent older than 12 months → returns null (banner re-appears)
 *  (c) Legacy entry with no timestamp → back-dated with a 30-day grace period;
 *      returns consent while within the grace window, null once past it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getConsentState } from "@/components/ads/CookieConsent";

// ── Constants mirrored from CookieConsent.tsx ──────────────────────────────
const STORAGE_KEY       = "jctm_cookie_consent_v2";
const LEGACY_KEY        = "jctm_cookie_notice_dismissed";
const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;          // 12 months
const LEGACY_GRACE_MS   = 30  * 24 * 60 * 60 * 1000;           // 30 days
const ONE_DAY_MS        = 24  * 60 * 60 * 1000;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Write a timestamped consent record. `consentedAt` defaults to Date.now(). */
function setConsent(
  overrides: { analytics?: boolean; advertising?: boolean; consentedAt?: number } = {}
) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      essential:   true,
      analytics:   overrides.analytics   ?? true,
      advertising: overrides.advertising ?? true,
      consentedAt: overrides.consentedAt ?? Date.now(),
    })
  );
}

/** Write a legacy consent record that has NO timestamp (pre-feature format). */
function setLegacyConsent(
  overrides: { analytics?: boolean; advertising?: boolean } = {}
) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      essential:   true,
      analytics:   overrides.analytics   ?? true,
      advertising: overrides.advertising ?? true,
      // deliberately omit consentedAt
    })
  );
}

// ── (a) Fresh consent — banner stays hidden ────────────────────────────────

describe("getConsentState() — fresh consent (within 12 months)", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

  it("returns a ConsentState when consent was just saved", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    setConsent({ analytics: true, advertising: true });

    const result = getConsentState();
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ essential: true, analytics: true, advertising: true });
  });

  it("returns a ConsentState when consent was saved 6 months ago", () => {
    const sixMonthsAgo = Date.now() - Math.floor(CONSENT_MAX_AGE_MS / 2);
    setConsent({ consentedAt: sixMonthsAgo });
    vi.setSystemTime(Date.now());

    expect(getConsentState()).not.toBeNull();
  });

  it("returns a ConsentState one day before the 12-month boundary", () => {
    const almostExpired = Date.now() - (CONSENT_MAX_AGE_MS - ONE_DAY_MS);
    setConsent({ consentedAt: almostExpired });

    expect(getConsentState()).not.toBeNull();
  });

  it("does not include consentedAt in the returned object (internal field hidden)", () => {
    setConsent();
    const result = getConsentState();
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("consentedAt");
  });

  it("returns null (not an error) when localStorage is completely empty", () => {
    expect(getConsentState()).toBeNull();
  });
});

// ── (b) Expired consent — banner re-appears ────────────────────────────────

describe("getConsentState() — expired consent (older than 12 months)", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

  it("returns null when consent is exactly 12 months old", () => {
    // Exactly at the boundary — use consentedAt = now − CONSENT_MAX_AGE_MS.
    // The check is `>`, so equal-to is NOT expired yet; one ms past is expired.
    const exactExpiry = Date.now() - CONSENT_MAX_AGE_MS - 1;
    setConsent({ consentedAt: exactExpiry });

    expect(getConsentState()).toBeNull();
  });

  it("returns null when consent is 13 months old", () => {
    const thirteenMonths = Date.now() - Math.floor(CONSENT_MAX_AGE_MS * (13 / 12));
    setConsent({ consentedAt: thirteenMonths });

    expect(getConsentState()).toBeNull();
  });

  it("returns null when consent is 2 years old", () => {
    setConsent({ consentedAt: Date.now() - 2 * CONSENT_MAX_AGE_MS });
    expect(getConsentState()).toBeNull();
  });

  it("transitions from non-null to null as time advances past 12 months", () => {
    const base = Date.now();
    setConsent({ consentedAt: base });

    // 11 months after saving → still valid
    vi.setSystemTime(base + CONSENT_MAX_AGE_MS - ONE_DAY_MS);
    expect(getConsentState()).not.toBeNull();

    // 12 months + 1 ms after saving → expired
    vi.setSystemTime(base + CONSENT_MAX_AGE_MS + 1);
    expect(getConsentState()).toBeNull();
  });
});

// ── (c) Legacy entries (no timestamp) — 30-day grace period ───────────────

describe("getConsentState() — legacy entries without timestamp (30-day grace)", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

  it("returns a ConsentState immediately for a legacy entry (grace period starts)", () => {
    vi.setSystemTime(Date.now());
    setLegacyConsent({ analytics: true, advertising: false });

    const result = getConsentState();
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ essential: true, analytics: true, advertising: false });
  });

  it("persists a back-dated consentedAt so the entry is not re-migrated on every read", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    setLegacyConsent();

    // First read triggers migration — writes back a consentedAt value.
    getConsentState();

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!);
    expect(stored).toHaveProperty("consentedAt");

    // The back-dated timestamp should be (now − (MAX_AGE − GRACE)) ≈ 335 days ago.
    const expectedMigratedAt = now - (CONSENT_MAX_AGE_MS - LEGACY_GRACE_MS);
    expect(stored.consentedAt).toBeCloseTo(expectedMigratedAt, -3); // within ~1 second
  });

  it("still returns consent 29 days after migration (within grace window)", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    setLegacyConsent();

    // Trigger migration
    getConsentState();

    // Advance 29 days — still within the 30-day grace window
    vi.setSystemTime(now + 29 * ONE_DAY_MS);
    expect(getConsentState()).not.toBeNull();
  });

  it("returns null 31 days after migration (grace period elapsed)", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    setLegacyConsent();

    // Trigger migration — stores consentedAt = now − 335d
    getConsentState();

    // Advance 31 days past the original read → total age = 335 + 31 = 366d > 365d
    vi.setSystemTime(now + 31 * ONE_DAY_MS);
    expect(getConsentState()).toBeNull();
  });

  it("very old legacy entry (jctm_cookie_notice_dismissed only) always returns null", () => {
    // Pre-v2 format: only the dismissed flag exists, no v2 key at all.
    localStorage.setItem(LEGACY_KEY, "1");
    expect(getConsentState()).toBeNull();
  });
});

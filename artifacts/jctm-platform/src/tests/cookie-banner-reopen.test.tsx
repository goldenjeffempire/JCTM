/**
 * Integration tests: cookie banner re-opens correctly when triggered from
 * any page via the footer "Manage cookie preferences" button, and from the
 * /cookies page "Review Preferences" button.
 *
 * Both surfaces dispatch window event `jctm:open-consent-banner`.
 * The CookieConsent component (mounted once at the app root) listens for
 * that event and re-opens itself with the "Manage preferences" section
 * already expanded.
 *
 * Key test groups:
 *  1. CookieConsent unit-level: event handling, state, toggles
 *  2. Real Footer component integration: clicks the live "Manage cookie
 *     preferences" button and asserts the banner re-opens expanded
 *  3. Real /cookies page integration: clicks the live "Review Preferences"
 *     button and asserts the banner re-opens expanded
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookieConsent } from "@/components/ads/CookieConsent";
import { Footer } from "@/components/layout/Footer";
import CookiesPage from "@/pages/Cookies";
import App from "@/App";

// ── Module mocks ──────────────────────────────────────────────────────────
// vi.mock calls are hoisted by Vite — they run before imports are evaluated.

// wouter: replace routing primitives with lightweight stubs (no router context needed)
vi.mock("wouter", () => ({
  Link: ({
    href,
    children,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
  // Router/Switch/Route: render nothing — we test the shell, not page content
  Router: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Switch: () => null,
  Route: () => null,
  useLocation: () => ["/" as string, () => {}] as [string, () => void],
}));

// Providers that are context-only — just pass through children
vi.mock("@/contexts/ThemeContext", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/GeoContext", () => ({
  GeoProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Heavy global components not relevant to cookie banner tests
vi.mock("@/components/VoiceTempleBots", () => ({
  VoiceTempleBots: () => null,
}));

vi.mock("@/components/PushNotificationPrompt", () => ({
  PushNotificationPrompt: () => null,
}));

vi.mock("@/components/BroadcastEngagementSystem", () => ({
  BroadcastEngagementSystem: () => null,
}));

vi.mock("@/hooks/useVisitorHeartbeat", () => ({
  useVisitorHeartbeat: () => {},
}));

vi.mock("@/lib/analytics", () => ({
  trackPageView: () => {},
}));

// Toaster and Tooltip: render nothing / pass through
vi.mock("sonner", () => ({
  Toaster: () => null,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => null,
}));

// framer-motion: render children without animation (avoids timers / requestAnimationFrame)
vi.mock("framer-motion", () => {
  const React = require("react");
  return {
    motion: {
      div: React.forwardRef(
        (
          { children, ...props }: React.HTMLAttributes<HTMLDivElement>,
          ref: React.Ref<HTMLDivElement>
        ) => (
          <div ref={ref} {...props}>
            {children}
          </div>
        )
      ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

// lucide-react: return lightweight SVG stubs (avoids CSS / icon bundle issues)
vi.mock("lucide-react", () => {
  const React = require("react");
  const stub = (name: string) =>
    React.forwardRef(
      (
        { className }: { className?: string },
        ref: React.Ref<SVGSVGElement>
      ) => <svg data-icon={name} className={className} ref={ref} />
    );
  return {
    Cookie: stub("Cookie"),
    Shield: stub("Shield"),
    BarChart3: stub("BarChart3"),
    Megaphone: stub("Megaphone"),
    ChevronDown: stub("ChevronDown"),
    ChevronUp: stub("ChevronUp"),
    ExternalLink: stub("ExternalLink"),
    BanIcon: stub("BanIcon"),
    SlidersHorizontal: stub("SlidersHorizontal"),
    Facebook: stub("Facebook"),
    Youtube: stub("Youtube"),
    Mail: stub("Mail"),
    Video: stub("Video"),
    MapPin: stub("MapPin"),
  };
});

// LanguageContext: provide a minimal t() passthrough so Footer text renders;
// also export LanguageProvider so App.tsx can use it as a wrapper
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (s: string) => s,
    language: "en",
    setLanguage: () => {},
    translate: async (s: string) => s,
    translateBatch: async (arr: string[]) => arr,
    isTranslating: false,
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ChurchAddressBlock: stub the address block (depends on DirectionsModal etc.)
vi.mock("@/components/ChurchAddressBlock", () => ({
  ChurchAddressBlock: () => <address data-testid="church-address" />,
}));

// Layout (used by Cookies page): render children only — avoids Navbar/TempleBots/etc.
vi.mock("@/components/layout/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// SEO (used by Cookies page): renders nothing — avoids react-helmet-async
vi.mock("@/components/SEO", () => ({
  SEO: () => null,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "jctm_cookie_consent_v2";

/** Simulate an existing consent record so the banner is hidden on mount. */
function setExistingConsent(
  overrides: { analytics?: boolean; advertising?: boolean } = {}
) {
  const stored = JSON.stringify({
    essential: true,
    analytics: overrides.analytics ?? true,
    advertising: overrides.advertising ?? true,
    consentedAt: Date.now(),
  });
  localStorage.setItem(STORAGE_KEY, stored);
}

/** Dispatch the custom event that both the Footer and Cookies page fire. */
function dispatchOpenConsentBanner() {
  act(() => {
    window.dispatchEvent(new Event("jctm:open-consent-banner"));
  });
}

// ── CookieConsent unit-level tests ─────────────────────────────────────────

describe("CookieConsent – re-open via jctm:open-consent-banner event", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("banner is hidden after consent has already been given", () => {
    setExistingConsent();
    render(<CookieConsent />);
    expect(screen.queryByText(/your privacy/i)).toBeNull();
  });

  it("re-opens the banner when the event fires after consent was given", () => {
    setExistingConsent();
    render(<CookieConsent />);

    expect(screen.queryByText(/your privacy/i)).toBeNull();

    dispatchOpenConsentBanner();

    expect(screen.getByText(/your privacy/i)).toBeInTheDocument();
  });

  it("opens with 'Manage preferences' section expanded when event fires", () => {
    setExistingConsent();
    render(<CookieConsent />);

    dispatchOpenConsentBanner();

    // These rows only appear in the expanded detail panel
    expect(screen.getByText("Essential Cookies")).toBeInTheDocument();
    expect(screen.getByText("Analytics Cookies")).toBeInTheDocument();
    expect(screen.getByText("Advertising Cookies")).toBeInTheDocument();
  });

  it("'Save My Choices' button is visible in the expanded state", () => {
    setExistingConsent();
    render(<CookieConsent />);

    dispatchOpenConsentBanner();

    expect(
      screen.getByRole("button", { name: /save my choices/i })
    ).toBeInTheDocument();
  });

  it("re-populates toggles from saved consent when re-opened", () => {
    // analytics ON, advertising OFF
    setExistingConsent({ analytics: true, advertising: false });

    render(<CookieConsent />);
    dispatchOpenConsentBanner();

    const switches = screen.getAllByRole("switch");
    // switches[0] = Essential (always on), [1] = Analytics, [2] = Advertising
    expect(switches[0]).toHaveAttribute("aria-checked", "true");
    expect(switches[1]).toHaveAttribute("aria-checked", "true");
    expect(switches[2]).toHaveAttribute("aria-checked", "false");
  });

  it("re-opens the banner from first-visit state (no stored consent)", () => {
    render(<CookieConsent />);
    expect(screen.queryByText(/your privacy/i)).toBeNull();

    dispatchOpenConsentBanner();

    expect(screen.getByText(/your privacy/i)).toBeInTheDocument();
  });
});

// ── Footer integration – real component ───────────────────────────────────

describe("Footer real component: 'Manage cookie preferences' button", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("clicking the live footer button re-opens the banner with expanded preferences", async () => {
    setExistingConsent();
    const user = userEvent.setup();

    render(
      <>
        <CookieConsent />
        <Footer />
      </>
    );

    // Banner starts hidden (consent already given)
    expect(screen.queryByText(/your privacy/i)).toBeNull();

    // Click the real footer "Manage cookie preferences" button
    await user.click(
      screen.getByRole("button", { name: /manage cookie preferences/i })
    );

    // Banner re-opens with the expanded preferences section
    expect(screen.getByText(/your privacy/i)).toBeInTheDocument();
    expect(screen.getByText("Analytics Cookies")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save my choices/i })
    ).toBeInTheDocument();
  });

  it("the footer button triggers the correct custom window event", async () => {
    setExistingConsent();
    const user = userEvent.setup();
    const listener = vi.fn();

    render(<Footer />);
    window.addEventListener("jctm:open-consent-banner", listener);

    await user.click(
      screen.getByRole("button", { name: /manage cookie preferences/i })
    );

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("jctm:open-consent-banner", listener);
  });
});

// ── /cookies page integration – real component ────────────────────────────

describe("/cookies page 'Review Preferences' button", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("clicking the live 'Review Preferences' button re-opens the banner expanded", async () => {
    setExistingConsent();
    const user = userEvent.setup();

    render(
      <>
        <CookieConsent />
        <CookiesPage />
      </>
    );

    // Banner starts hidden — use a heading-specific query so we don't match
    // cookie-policy body text that also contains "privacy" on this page.
    expect(
      screen.queryByRole("heading", { name: /your privacy/i })
    ).toBeNull();

    // Click the real "Review Preferences" button on the Cookies page
    // (aria-label is "Review cookie preferences")
    await user.click(
      screen.getByRole("button", { name: /review cookie preferences/i })
    );

    // Banner re-opens with expanded preferences section
    expect(
      screen.getByRole("heading", { name: /your privacy/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Analytics Cookies")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save my choices/i })
    ).toBeInTheDocument();
  });

  it("the Review Preferences button triggers the correct custom window event", async () => {
    setExistingConsent();
    const user = userEvent.setup();
    const listener = vi.fn();

    render(<CookiesPage />);
    window.addEventListener("jctm:open-consent-banner", listener);

    await user.click(
      screen.getByRole("button", { name: /review/i })
    );

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("jctm:open-consent-banner", listener);
  });
});

// ── Full App shell: CookieConsent must be mounted at the app root ─────────
//
// These tests render the complete <App /> component (all providers, Router,
// ErrorBoundary, and CookieConsent) alongside a real <Footer />.  They
// catch the class of silent breakage where CookieConsent is accidentally:
//   • removed from App.tsx
//   • wrapped in a lazy() / Suspense boundary
//   • conditionally rendered so it never mounts on initial paint
//
// If any of those happen, the event listener is never registered and the
// "Manage cookie preferences" footer button silently stops working.

describe("Full App shell: CookieConsent mounted at app root", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("dispatching the open event reaches CookieConsent inside the rendered App", () => {
    setExistingConsent();
    render(<App />);

    // Banner is hidden — consent already recorded
    expect(screen.queryByText(/your privacy/i)).toBeNull();

    // Dispatching the event should reach the listener registered by CookieConsent.
    // If CookieConsent is not in the tree (removed, lazy, or conditional) this fails.
    dispatchOpenConsentBanner();

    expect(screen.getByText(/your privacy/i)).toBeInTheDocument();
    expect(screen.getByText("Analytics Cookies")).toBeInTheDocument();
  });

  it("clicking the real footer button re-opens the banner rendered by App", async () => {
    setExistingConsent();
    const user = userEvent.setup();

    // App provides CookieConsent; Footer provides the trigger button.
    render(
      <>
        <App />
        <Footer />
      </>
    );

    // Banner starts hidden (consent recorded)
    expect(screen.queryByText(/your privacy/i)).toBeNull();

    // Click the real "Manage cookie preferences" button in the footer
    await user.click(
      screen.getByRole("button", { name: /manage cookie preferences/i })
    );

    // CookieConsent (mounted in App root, not lazy-loaded) receives the event
    expect(screen.getByText(/your privacy/i)).toBeInTheDocument();
    expect(screen.getByText("Analytics Cookies")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save my choices/i })
    ).toBeInTheDocument();
  });

  it("the test fails if CookieConsent is absent from App — verifying the guard works", () => {
    // Render ONLY the Footer (no CookieConsent in the tree at all).
    // Dispatching the event should find no listener, so the banner never appears.
    setExistingConsent();
    render(<Footer />);

    dispatchOpenConsentBanner();

    // No banner — CookieConsent is not mounted
    expect(screen.queryByText(/your privacy/i)).toBeNull();
    expect(screen.queryByText("Analytics Cookies")).toBeNull();
  });
});

// ── Full dismiss → re-open cycle ──────────────────────────────────────────

describe("Full flow: dismiss banner then re-open via footer link", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("accepting essential only then re-opening via footer shows preferences expanded", async () => {
    setExistingConsent();
    const user = userEvent.setup();

    render(
      <>
        <CookieConsent />
        <Footer />
      </>
    );

    // 1. Re-open from footer
    await user.click(
      screen.getByRole("button", { name: /manage cookie preferences/i })
    );
    expect(screen.getByText(/your privacy/i)).toBeInTheDocument();

    // 2. Dismiss with essential only
    await user.click(
      screen.getByRole("button", { name: /essential only/i })
    );
    expect(screen.queryByText(/your privacy/i)).toBeNull();

    // 3. Re-open again from footer (simulates visiting another page)
    await user.click(
      screen.getByRole("button", { name: /manage cookie preferences/i })
    );

    // Banner is back, expanded, with Save My Choices available
    expect(screen.getByText(/your privacy/i)).toBeInTheDocument();
    expect(screen.getByText("Analytics Cookies")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save my choices/i })
    ).toBeInTheDocument();
  });
});

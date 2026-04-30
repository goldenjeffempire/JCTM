import { useLocation } from "wouter";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { BackToTop } from "./BackToTop";
import { TempleBots } from "../TempleBots";
import { BroadcastStatusIndicator } from "../BroadcastStatusIndicator";
import { LiveBanner } from "../LiveBanner";
import { LanguageSuggestionBanner } from "../LanguageSuggestionBanner";
import { EventStickyBar } from "../event-promo/EventStickyBar";
import { EventBanner } from "../event-promo/EventBanner";
import { EventLiveToast } from "../event-promo/EventLiveToast";
import { GlobalEventAdBanner } from "../event-promo/GlobalEventAdBanner";
import { EventPromoPreviewToggle } from "../event-promo/EventPromoPreviewToggle";
import { WarriCrusadeStickyBanner } from "../event-promo/WarriCrusadeStickyBanner";
import { CrusadeInlineAd } from "../event-promo/CrusadeInlineAd";
import { FloatingJoinCrusadeCTA } from "../event-promo/FloatingJoinCrusadeCTA";

interface LayoutProps {
  children: React.ReactNode;
}

const CRUSADE_LIVE_ROUTE_PREFIXES = ["/", "/crusade", "/warri-crusade", "/sermons", "/events"];

function isCrusadeLiveRoute(path: string): boolean {
  if (path === "/") return true;
  return CRUSADE_LIVE_ROUTE_PREFIXES
    .filter((p) => p !== "/")
    .some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const showLiveSignals = isCrusadeLiveRoute(location);
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background font-sans text-foreground overflow-x-hidden">
      {/* Skip-to-content link — keyboard/screen-reader users can jump past nav */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-white focus:font-bold focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Screen-reader live region — receives dynamic broadcast announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        id="sr-announcer"
        className="sr-only"
      />

      <WarriCrusadeStickyBanner />
      <EventStickyBar />
      {showLiveSignals && <LiveBanner />}
      <Navbar />
      <EventBanner />
      <main id="main-content" className="flex-1 w-full" tabIndex={-1}>
        {children}
      </main>
      <CrusadeInlineAd />
      <Footer />
      <TempleBots />
      <LanguageSuggestionBanner />
      <BackToTop />
      {showLiveSignals && <BroadcastStatusIndicator />}
      <EventLiveToast />
      <GlobalEventAdBanner />
      <FloatingJoinCrusadeCTA />
      <EventPromoPreviewToggle />
    </div>
  );
}

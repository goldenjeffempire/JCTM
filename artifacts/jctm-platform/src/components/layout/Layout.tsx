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
import { MinistersConferenceFlyerPopup } from "../event-promo/MinistersConferenceFlyerPopup";
import { MediaJobsPanel } from "../MediaJobsPanel";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
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

      {/* Ministers Conference sticky campaign banner (dismissible, phase-aware) */}
      <WarriCrusadeStickyBanner />
      <EventStickyBar />
      <LiveBanner />
      <Navbar />
      <EventBanner />
      <main id="main-content" className="flex-1 w-full" tabIndex={-1}>
        {children}
      </main>

      {/* Ministers Conference inline ad — full-width block above footer */}
      <CrusadeInlineAd />

      <Footer />
      <TempleBots />
      <LanguageSuggestionBanner />
      <BackToTop />
      <BroadcastStatusIndicator />
      <EventLiveToast />

      {/* Admin-driven floating event banner */}
      <GlobalEventAdBanner />
      <EventPromoPreviewToggle />

      {/* Ministers Conference floating register FAB */}
      <FloatingJoinCrusadeCTA />

      {/* Full-screen flyer popup — auto-opens once per session */}
      <MinistersConferenceFlyerPopup />

      {/* Global floating download queue */}
      <MediaJobsPanel />
    </div>
  );
}

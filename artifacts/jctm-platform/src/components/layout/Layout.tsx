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

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background font-sans text-foreground overflow-x-hidden">
      <WarriCrusadeStickyBanner />
      <EventStickyBar />
      <LiveBanner />
      <Navbar />
      <EventBanner />
      <main className="flex-1 w-full">
        {children}
      </main>
      <CrusadeInlineAd />
      <Footer />
      <TempleBots />
      <LanguageSuggestionBanner />
      <BackToTop />
      <BroadcastStatusIndicator />
      <EventLiveToast />
      <GlobalEventAdBanner />
      <FloatingJoinCrusadeCTA />
      <EventPromoPreviewToggle />
    </div>
  );
}

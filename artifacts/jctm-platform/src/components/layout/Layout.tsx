import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { BackToTop } from "./BackToTop";
import { TempleBots } from "../TempleBots";
import { BroadcastStatusIndicator } from "../BroadcastStatusIndicator";
import { LiveBanner } from "../LiveBanner";
import { LanguageSuggestionBanner } from "../LanguageSuggestionBanner";
import { EventStickyBar } from "../event-promo/EventStickyBar";
import { EventLiveToast } from "../event-promo/EventLiveToast";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background font-sans text-foreground overflow-x-hidden">
      <EventStickyBar />
      <LiveBanner />
      <Navbar />
      <main className="flex-1 w-full">
        {children}
      </main>
      <Footer />
      <TempleBots />
      <LanguageSuggestionBanner />
      <BackToTop />
      <BroadcastStatusIndicator />
      <EventLiveToast />
    </div>
  );
}

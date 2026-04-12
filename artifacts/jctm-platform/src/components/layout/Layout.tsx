import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { BackToTop } from "./BackToTop";
import { TempleBots } from "../TempleBots";
import { BroadcastStatusIndicator } from "../BroadcastStatusIndicator";
import { LanguageSuggestionBanner } from "../LanguageSuggestionBanner";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background font-sans text-foreground overflow-x-hidden">
      <Navbar />
      <main className="flex-1 w-full">
        {children}
      </main>
      <Footer />
      <TempleBots />
      <LanguageSuggestionBanner />
      <BackToTop />
      <BroadcastStatusIndicator />
    </div>
  );
}

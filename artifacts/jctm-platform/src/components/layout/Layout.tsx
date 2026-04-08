import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { TempleBots } from "../TempleBots";
import { LiveBanner } from "../LiveBanner";
import { LanguageSuggestionBanner } from "../LanguageSuggestionBanner";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background font-sans text-foreground overflow-x-hidden">
      <LiveBanner />
      <Navbar />
      <main className="flex-1 w-full">
        {children}
      </main>
      <Footer />
      <TempleBots />
      <LanguageSuggestionBanner />
    </div>
  );
}

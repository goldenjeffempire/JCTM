import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

const Home = lazy(() => import("@/pages/Home"));
const Sermons = lazy(() => import("@/pages/Sermons"));
const SermonDetail = lazy(() => import("@/pages/SermonDetail"));
const Testimonies = lazy(() => import("@/pages/Testimonies"));
const Give = lazy(() => import("@/pages/Give"));
const Events = lazy(() => import("@/pages/Events"));
const Members = lazy(() => import("@/pages/Members"));
const Timeline = lazy(() => import("@/pages/Timeline"));
const About = lazy(() => import("@/pages/About"));
const Join = lazy(() => import("@/pages/Join"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));
const Crusade = lazy(() => import("@/pages/Crusade"));
const ViewingCentres = lazy(() => import("@/pages/ViewingCentres"));
const Prayer = lazy(() => import("@/pages/Prayer"));
const Moments = lazy(() => import("@/pages/Moments"));
const SermonAssistant = lazy(() => import("@/pages/SermonAssistant"));
const Leadership = lazy(() => import("@/pages/Leadership"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

function PageFallback() {
  return (
    <div className="container mx-auto px-4 py-16 space-y-6 max-w-4xl">
      <Skeleton className="h-12 w-1/2 rounded-xl" />
      <Skeleton className="h-4 w-3/4 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/sermons" component={Sermons} />
        <Route path="/sermons/:id" component={SermonDetail} />
        <Route path="/testimonies" component={Testimonies} />
        <Route path="/give" component={Give} />
        <Route path="/events" component={Events} />
        <Route path="/members" component={Members} />
        <Route path="/correction-timeline" component={Timeline} />
        <Route path="/about" component={About} />
        <Route path="/join" component={Join} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/crusade" component={Crusade} />
        <Route path="/viewing-centres" component={ViewingCentres} />
        <Route path="/prayer" component={Prayer} />
        <Route path="/moments" component={Moments} />
        <Route path="/sermon-assistant" component={SermonAssistant} />
        <Route path="/leadership" component={Leadership} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ErrorBoundary>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </ErrorBoundary>
          <Toaster
            position="top-center"
            toastOptions={{
              classNames: {
                toast: "glass-panel border border-border font-sans text-primary",
                title: "font-semibold text-primary",
                description: "text-muted-foreground",
                success: "border-accent/40",
                error: "border-destructive/40",
              },
            }}
            richColors
          />
        </TooltipProvider>
      </QueryClientProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;

import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Sermons from "@/pages/Sermons";
import SermonDetail from "@/pages/SermonDetail";
import Testimonies from "@/pages/Testimonies";
import Give from "@/pages/Give";
import Events from "@/pages/Events";
import Members from "@/pages/Members";
import Timeline from "@/pages/Timeline";
import About from "@/pages/About";
import Join from "@/pages/Join";

const queryClient = new QueryClient();

function Router() {
  return (
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

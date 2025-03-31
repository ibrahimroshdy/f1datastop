
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SessionProvider } from "@/context/SessionContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LiveRace from "./pages/LiveRace";
import Standings from "./pages/Standings";
import RaceCalendar from "./pages/RaceCalendar";
import Drivers from "./pages/Drivers";
import Analytics from "./pages/Analytics";
import News from "./pages/News";
import Timing from "./pages/Timing";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SessionProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/live" element={<LiveRace />} />
            <Route path="/standings" element={<Standings />} />
            <Route path="/calendar" element={<RaceCalendar />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/news" element={<News />} />
            <Route path="/timing" element={<Timing />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SessionProvider>
  </QueryClientProvider>
);

export default App;

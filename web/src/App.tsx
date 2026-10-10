import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import Seo from "@/components/common/Seo";
import { organizationSchema, websiteSchema } from "@/lib/structuredData";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { DeveloperProvider } from "@/context/DeveloperContext";
import AnalyticsProvider from "./integrations/google-analytics/AnalyticsProvider";
import { ClarityProvider } from './integrations/clarity/ClarityProvider';
import ClarityStatus from "./components/dev/ClarityStatus";
import initConsoleFilters from "./utils/errorFilter";
import Index from "./pages/Index";
import RaceCalendar from "./pages/RaceCalendar";
import RaceAnalysis from "./pages/RaceAnalysis";
import Drivers from "./pages/Drivers";
import Constructors from "./pages/Constructors";
import DriverProfile from "./pages/DriverProfile";
import TeamProfile from "./pages/TeamProfile";
import Standings from "./pages/Standings";
import CircuitDetail from "./pages/CircuitDetail";
import PitWall from "./features/pitwall/routes/PitWall";
import Developers from "./pages/Developers";
import NotFound from "./pages/NotFound";
import MainLayout from "@/components/layout/MainLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Privacy from "./pages/Privacy";
import React, { Suspense } from "react";

if (typeof window !== 'undefined') {
  initConsoleFilters();
}

import { clarityProjectId, isClarityEnabled } from '@/config/integrations';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 1000 * 60 * 5,
    },
  },
});

const RaceInfoRedirect = () => {
  const { year, round } = useParams();
  const target =
    year && round ? `/race-analysis/${year}/${round}` : "/race-analysis";
  return <Navigate to={target} replace />;
};

const ConstructorSlugRedirect = () => {
  const { slug } = useParams();
  return <Navigate to={slug ? `/teams/${slug}` : "/constructors"} replace />;
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      {/* Sitewide identity + sitelinks search box. Individual routes add their own. */}
      <Seo jsonLd={[websiteSchema(), organizationSchema()]} />
      <BrowserRouter>
        <ThemeProvider>
          <DeveloperProvider>
            <TooltipProvider>
              <ErrorBoundary>
                <ClarityProvider projectId={clarityProjectId}>
                  <AnalyticsProvider>
                    <Toaster />
                    <Sonner />
                    {process.env.NODE_ENV === 'development' && isClarityEnabled && (
                      <ClarityStatus projectId={clarityProjectId} />
                    )}
                    <Routes>
                      {/* Shell routes — all public, no login */}
                      <Route element={<MainLayout />}>
                        <Route path="/" element={<Index />} />
                        <Route path="/calendar" element={<RaceCalendar />} />
                        <Route path="/standings" element={<Standings />} />
                        <Route path="/circuits" element={<Navigate to="/calendar" replace />} />
                        <Route path="/circuits/:circuitId" element={<CircuitDetail />} />
                        <Route path="/race-analysis" element={<RaceAnalysis />} />
                        <Route path="/race-analysis/:year/:round" element={<RaceAnalysis />} />
                        <Route path="/pit-wall" element={<PitWall />} />
                        <Route path="/drivers" element={<Drivers />} />
                        <Route path="/drivers/:slug" element={<DriverProfile />} />
                        <Route path="/teams/:slug" element={<TeamProfile />} />
                        <Route path="/constructors/:slug" element={<ConstructorSlugRedirect />} />
                        <Route path="/constructors" element={<Constructors />} />
                        <Route path="/privacy" element={<Privacy />} />
                        <Route path="/developers" element={<Developers />} />
                        <Route path="*" element={<NotFound />} />
                      </Route>

                      {/* Outside shell */}
                      <Route path="/analytics" element={<Navigate to="/race-analysis" replace />} />
                      <Route path="/race-info/:year/:round" element={<RaceInfoRedirect />} />
                      <Route path="/race-info" element={<Navigate to="/race-analysis" replace />} />
                      <Route
                        path="/embed"
                        element={
                          <Suspense fallback={<div>Loading...</div>}>
                            {React.createElement(React.lazy(() => import('./pages/embed')))}
                          </Suspense>
                        }
                      />
                      <Route
                        path="/embed/driver-standings"
                        element={
                          <Suspense fallback={<div>Loading...</div>}>
                            {React.createElement(React.lazy(() => import('./pages/embed/driver-standings')))}
                          </Suspense>
                        }
                      />
                      <Route
                        path="/embed/constructor-standings"
                        element={
                          <Suspense fallback={<div>Loading...</div>}>
                            {React.createElement(React.lazy(() => import('./pages/embed/constructor-standings')))}
                          </Suspense>
                        }
                      />
                    </Routes>
                  </AnalyticsProvider>
                </ClarityProvider>
              </ErrorBoundary>
            </TooltipProvider>
          </DeveloperProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;

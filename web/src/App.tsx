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
import MainLayout from "@/components/layout/MainLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { F1Loader } from "@/components/f1/F1Loader";
import React, { Suspense, lazy } from "react";

// Lazy-loaded heavy pages — keeps main chunk small
const Index = lazy(() => import("./pages/Index"));
const RaceCalendar = lazy(() => import("./pages/RaceCalendar"));
const RaceAnalysis = lazy(() => import("./pages/RaceAnalysis"));
const Drivers = lazy(() => import("./pages/Drivers"));
const Constructors = lazy(() => import("./pages/Constructors"));
const DriverProfile = lazy(() => import("./pages/DriverProfile"));
const TeamProfile = lazy(() => import("./pages/TeamProfile"));
const Standings = lazy(() => import("./pages/Standings"));
const CircuitDetail = lazy(() => import("./pages/CircuitDetail"));
const PitWall = lazy(() => import("./features/pitwall/routes/PitWall"));
const Developers = lazy(() => import("./pages/Developers"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Privacy = lazy(() => import("./pages/Privacy"));

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
                        <Route
                          path="/"
                          element={
                            <Suspense fallback={<F1Loader label="Loading…" />}>
                              <Index />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/calendar"
                          element={
                            <Suspense fallback={<F1Loader label="Loading calendar…" />}>
                              <RaceCalendar />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/standings"
                          element={
                            <Suspense fallback={<F1Loader label="Loading standings…" />}>
                              <Standings />
                            </Suspense>
                          }
                        />
                        <Route path="/circuits" element={<Navigate to="/calendar" replace />} />
                        <Route
                          path="/circuits/:circuitId"
                          element={
                            <Suspense fallback={<F1Loader label="Loading circuit…" />}>
                              <CircuitDetail />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/race-analysis"
                          element={
                            <Suspense fallback={<F1Loader label="Loading race analysis…" />}>
                              <RaceAnalysis />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/race-analysis/:year/:round"
                          element={
                            <Suspense fallback={<F1Loader label="Loading race analysis…" />}>
                              <RaceAnalysis />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/pit-wall"
                          element={
                            <Suspense fallback={<F1Loader label="Loading Pit Wall…" />}>
                              <PitWall />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/drivers"
                          element={
                            <Suspense fallback={<F1Loader label="Loading drivers…" />}>
                              <Drivers />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/drivers/:slug"
                          element={
                            <Suspense fallback={<F1Loader label="Loading driver…" />}>
                              <DriverProfile />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/teams/:slug"
                          element={
                            <Suspense fallback={<F1Loader label="Loading team…" />}>
                              <TeamProfile />
                            </Suspense>
                          }
                        />
                        <Route path="/constructors/:slug" element={<ConstructorSlugRedirect />} />
                        <Route
                          path="/constructors"
                          element={
                            <Suspense fallback={<F1Loader label="Loading constructors…" />}>
                              <Constructors />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/privacy"
                          element={
                            <Suspense fallback={<F1Loader label="Loading…" />}>
                              <Privacy />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/developers"
                          element={
                            <Suspense fallback={<F1Loader label="Loading…" />}>
                              <Developers />
                            </Suspense>
                          }
                        />
                        <Route
                          path="*"
                          element={
                            <Suspense fallback={<F1Loader label="Loading…" />}>
                              <NotFound />
                            </Suspense>
                          }
                        />
                      </Route>

                      {/* Outside shell */}
                      <Route path="/analytics" element={<Navigate to="/race-analysis" replace />} />
                      <Route path="/race-info/:year/:round" element={<RaceInfoRedirect />} />
                      <Route path="/race-info" element={<Navigate to="/race-analysis" replace />} />
                      <Route
                        path="/embed"
                        element={
                          <Suspense fallback={<F1Loader label="Loading embed…" className="min-h-[200px]" />}>
                            {React.createElement(React.lazy(() => import('./pages/embed')))}
                          </Suspense>
                        }
                      />
                      <Route
                        path="/embed/driver-standings"
                        element={
                          <Suspense fallback={<F1Loader label="Loading standings…" className="min-h-[200px]" />}>
                            {React.createElement(React.lazy(() => import('./pages/embed/driver-standings')))}
                          </Suspense>
                        }
                      />
                      <Route
                        path="/embed/constructor-standings"
                        element={
                          <Suspense fallback={<F1Loader label="Loading standings…" className="min-h-[200px]" />}>
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

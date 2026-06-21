import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { DeveloperProvider } from "@/context/DeveloperContext";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/auth/ProtectedRoute";
import { useState, useEffect } from "react";
import { supabase } from "./integrations/supabase/client";
import { notifySlackAboutTwitterSignin } from "./context/auth/authActions";
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
import Circuits from "./pages/Circuits";
import Developers from "./pages/Developers";
import NotFound from "./pages/NotFound";
import MainLayout from "@/components/layout/MainLayout";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Profile from "./pages/auth/Profile";
import ResetPassword from "./pages/auth/ResetPassword";
import Privacy from "./pages/Privacy";
import React, { Suspense } from "react";
import { F1Skeleton } from "@/components/f1";

if (typeof window !== 'undefined') {
  initConsoleFilters();
}

import { clarityProjectId, isClarityEnabled } from '@/config/integrations';

const AuthCallback = () => {
  const [message, setMessage] = useState("Processing authentication...");
  
  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setMessage("Authenticating with Twitter...");
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          setMessage("Authentication failed. Please try again.");
          setTimeout(() => window.location.href = '/auth/login', 2000);
        } else if (data.session) {
          setMessage("Authentication successful! Redirecting...");
          const { data: userData } = await supabase.auth.getUser();
          
          if (userData?.user?.app_metadata?.provider === 'twitter') {
            try {
              await notifySlackAboutTwitterSignin(userData.user);
            } catch {
              /* non-blocking */
            }
          }
          
          setTimeout(() => window.location.href = '/', 1000);
        } else {
          setMessage("Authentication in progress...");
          setTimeout(() => {
            supabase.auth.getSession().then(({ data }) => {
              window.location.href = data.session ? '/' : '/auth/login';
            });
          }, 3000);
        }
      } catch {
        setMessage("An unexpected error occurred. Please try again.");
        setTimeout(() => window.location.href = '/auth/login', 2000);
      }
    };
    
    handleAuthCallback();
  }, []);
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <F1Skeleton className="mx-auto h-12 w-12 rounded-full" />
        <F1Skeleton className="mx-auto h-6 w-48" />
        <F1Skeleton className="mx-auto h-4 w-64" />
        <p className="sr-only">{message}</p>
        <h2 className="text-xl font-semibold">{message}</h2>
        <p className="text-muted-foreground">You will be redirected shortly.</p>
      </div>
    </div>
  );
};

const ErrorBoundaryWrapper = ({ children }: { children: React.ReactNode }) => {
  try {
    return <>{children}</>;
  } catch (error) {
    console.error('Error in analytics providers:', error);
    return <>{children}</>;
  }
};

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
  <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <DeveloperProvider>
              <TooltipProvider>
                <ErrorBoundaryWrapper>
                  <ClarityProvider projectId={clarityProjectId}>
                    <AnalyticsProvider>
                      <Toaster />
                      <Sonner />
                      {process.env.NODE_ENV === 'development' && isClarityEnabled && (
                        <ClarityStatus projectId={clarityProjectId} />
                      )}
                      <Routes>
                        {/* Shell routes */}
                        <Route element={<MainLayout />}>
                          <Route path="/" element={<Index />} />
                          <Route path="/calendar" element={<RaceCalendar />} />
                          <Route path="/standings" element={<Standings />} />
                          <Route path="/circuits" element={<Circuits />} />
                          <Route path="/race-analysis" element={<RaceAnalysis />} />
                          <Route path="/race-analysis/:year/:round" element={<RaceAnalysis />} />
                          <Route path="/drivers" element={<Drivers />} />
                          <Route path="/drivers/:slug" element={<DriverProfile />} />
                          <Route path="/teams/:slug" element={<TeamProfile />} />
                          <Route path="/constructors/:slug" element={<ConstructorSlugRedirect />} />
                          <Route path="/constructors" element={<Constructors />} />
                          <Route path="/privacy" element={<Privacy />} />
                          <Route
                            path="/infographic/:year/:round"
                            element={
                              <Suspense fallback={<div className="flex items-center justify-center min-h-[40vh]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary" /></div>}>
                                {React.createElement(React.lazy(() => import('./pages/RaceInfographicPage')))}
                              </Suspense>
                            }
                          />
                          <Route element={<ProtectedRoute />}>
                            <Route path="/profile" element={<Profile />} />
                            <Route path="/developers" element={<Developers />} />
                          </Route>
                          <Route path="*" element={<NotFound />} />
                        </Route>

                        {/* Outside shell */}
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        <Route path="/auth/reset-password" element={<ResetPassword />} />
                        <Route path="/analytics" element={<Navigate to="/race-analysis" replace />} />
                        <Route path="/race-info/:year/:round" element={<RaceInfoRedirect />} />
                        <Route path="/race-info" element={<Navigate to="/race-analysis" replace />} />
                        <Route element={<PublicOnlyRoute />}>
                          <Route path="/auth/login" element={<Login />} />
                          <Route path="/auth/signup" element={<Signup />} />
                        </Route>
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
                </ErrorBoundaryWrapper>
              </TooltipProvider>
            </DeveloperProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
  </QueryClientProvider>
);

export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router-dom";
import { SessionProvider } from "@/context/SessionContext";
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
import Analytics from "./pages/Analytics";
import RaceAnalysis from "./pages/RaceAnalysis";
import Drivers from "./pages/Drivers";
import Constructors from "./pages/Constructors";
import Developers from "./pages/Developers";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Profile from "./pages/auth/Profile";
import ResetPassword from "./pages/auth/ResetPassword";
import RaceInfoPage from "./pages/RaceInfoPage";
import Privacy from "./pages/Privacy";
import React, { Suspense } from "react";

// Initialize console filters to reduce noise
if (typeof window !== 'undefined') {
  initConsoleFilters();
}

// Clarity project ID - make it a constant to ensure consistency
const CLARITY_PROJECT_ID = 'r25ms3yolv';

// Create a simple Auth callback handler component
const AuthCallback = () => {
  const [message, setMessage] = useState("Processing authentication...");
  
  useEffect(() => {
    // Handle the OAuth callback
    const handleAuthCallback = async () => {
      try {
        // Just process the authentication without expecting specific parameters
        setMessage("Authenticating with Twitter...");
        
        // Supabase handles the token exchange internally when getting the session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          setMessage("Authentication failed. Please try again.");
          setTimeout(() => window.location.href = '/auth/login', 2000);
        } else if (data.session) {
          setMessage("Authentication successful! Redirecting...");
          
          // Get the user data to check if this is a Twitter authentication
          const { data: userData } = await supabase.auth.getUser();
          
          if (userData && userData.user) {
            const user = userData.user;
            const provider = user.app_metadata?.provider;
            
            // If this is a Twitter login, notify Slack
            if (provider === 'twitter') {
              try {
                await notifySlackAboutTwitterSignin(user);
              } catch (notifyError) {
                // Don't fail the auth flow if notification fails
              }
            }
          }
          
          setTimeout(() => window.location.href = '/', 1000);
        } else {
          setMessage("Authentication in progress...");
          // If no session yet, try checking again in a moment
          setTimeout(() => {
            supabase.auth.getSession().then(({ data }) => {
              if (data.session) {
                window.location.href = '/';
              } else {
                window.location.href = '/auth/login';
              }
            });
          }, 3000);
        }
      } catch (err) {
        setMessage("An unexpected error occurred. Please try again.");
        setTimeout(() => window.location.href = '/auth/login', 2000);
      }
    };
    
    handleAuthCallback();
  }, []);
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary border-opacity-50 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold mb-2">{message}</h2>
        <p className="text-muted-foreground">You will be redirected shortly.</p>
      </div>
    </div>
  );
};

// Error boundary for analytics providers
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
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SessionProvider>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <DeveloperProvider>
              <TooltipProvider>
                <ErrorBoundaryWrapper>
                  <ClarityProvider projectId={CLARITY_PROJECT_ID}>
                    <AnalyticsProvider>
                      <Toaster />
                      <Sonner />
                      {/* Only show ClarityStatus in development */}
                      {process.env.NODE_ENV === 'development' && (
                        <ClarityStatus projectId={CLARITY_PROJECT_ID} />
                      )}
                      <Routes>
                        {/* Public Routes */}
                        <Route path="/" element={<Index />} />
                        <Route path="/calendar" element={<RaceCalendar />} />
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        <Route path="/privacy" element={<Privacy />} />
                        {/* Race Infographic Page */}
                        <Route 
                          path="/infographic/:year/:round" 
                          element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div></div>}>
                            {React.createElement(React.lazy(() => import('./pages/RaceInfographicPage')))}
                          </Suspense>} 
                        />
                        {/* Race Analysis - Unified page */}
                        <Route path="/race-analysis" element={<RaceAnalysis />} />
                        <Route path="/race-analysis/:year/:round" element={<RaceAnalysis />} />
                        
                        {/* Legacy Analytics route - redirect to race-analysis */}
                        <Route path="/analytics" element={<Navigate to="/race-analysis" replace />} />
                        
                        {/* Make Drivers and Constructors public */}
                        <Route path="/drivers" element={<Drivers />} />
                        <Route path="/constructors" element={<Constructors />} />
                        <Route path="*" element={<NotFound />} />
                        
                        {/* Embed Routes */}
                        <Route 
                          path="/embed" 
                          element={<Suspense fallback={<div>Loading...</div>}>
                            {React.createElement(React.lazy(() => import('./pages/embed')))}
                          </Suspense>} 
                        />
                        <Route 
                          path="/embed/driver-standings" 
                          element={<Suspense fallback={<div>Loading...</div>}>
                            {React.createElement(React.lazy(() => import('./pages/embed/driver-standings')))}
                          </Suspense>} 
                        />
                        <Route 
                          path="/embed/constructor-standings" 
                          element={<Suspense fallback={<div>Loading...</div>}>
                            {React.createElement(React.lazy(() => import('./pages/embed/constructor-standings')))}
                          </Suspense>} 
                        />
                        
                        {/* Auth routes (only accessible if not logged in) */}
                        <Route element={<PublicOnlyRoute />}>
                          <Route path="/auth/login" element={<Login />} />
                          <Route path="/auth/signup" element={<Signup />} />
                          <Route path="/auth/reset-password" element={<ResetPassword />} />
                        </Route>
                        
                        {/* Protected routes with blur effect for non-authenticated users */}
                        <Route element={<ProtectedRoute />}>
                          {/* Legacy Race Info routes - redirect to race-analysis */}
                          <Route path="/race-info/:year/:round" element={<Navigate to="/race-analysis" replace />} />
                          <Route path="/race-info" element={<Navigate to="/race-analysis" replace />} />
                          <Route path="/profile" element={<Profile />} />
                          <Route path="/developers" element={<Developers />} />
                        </Route>
                      </Routes>
                    </AnalyticsProvider>
                  </ClarityProvider>
                </ErrorBoundaryWrapper>
              </TooltipProvider>
            </DeveloperProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </SessionProvider>
  </QueryClientProvider>
);

export default App;

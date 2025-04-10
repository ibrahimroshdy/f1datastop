import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SessionProvider } from "@/context/SessionContext";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/auth/ProtectedRoute";
import { useState, useEffect } from "react";
import { supabase } from "./integrations/supabase/client";
import Index from "./pages/Index";
import RaceCalendar from "./pages/RaceCalendar";
import Analytics from "./pages/Analytics";
import Drivers from "./pages/Drivers";
import Constructors from "./pages/Constructors";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Profile from "./pages/auth/Profile";
import ResetPassword from "./pages/auth/ResetPassword";
import RaceAnalysisPage from "./pages/RaceAnalysisPage";

// Create a simple Auth callback handler component
const AuthCallback = () => {
  const [message, setMessage] = useState("Processing authentication...");
  
  useEffect(() => {
    // Handle the OAuth callback
    const handleAuthCallback = async () => {
      try {
        // For OAuth 1.0a, the callback will include oauth_token and oauth_verifier
        const urlParams = new URLSearchParams(window.location.search);
        const oauthToken = urlParams.get('oauth_token');
        const oauthVerifier = urlParams.get('oauth_verifier');
        
        if (!oauthToken || !oauthVerifier) {
          console.log("Missing OAuth parameters:", { oauthToken, oauthVerifier });
          setMessage("Authentication parameters missing or invalid");
          setTimeout(() => window.location.href = '/auth/login', 2000);
          return;
        }
        
        setMessage("Verifying authentication...");
        
        // Supabase handles the token exchange internally when getting the session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Authentication error:", error);
          setMessage("Authentication failed. Please try again.");
          setTimeout(() => window.location.href = '/auth/login', 2000);
        } else if (data.session) {
          setMessage("Authentication successful! Redirecting...");
          setTimeout(() => window.location.href = '/', 1000);
        } else {
          setMessage("Authentication in progress...");
          // If no session yet, try refreshing
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } catch (err) {
        console.error("Error in auth callback:", err);
        setMessage("An unexpected error occurred. Please try again.");
        setTimeout(() => window.location.href = '/auth/login', 2000);
      }
    };
    
    handleAuthCallback();
  }, []);
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-f1-black p-4">
      <div className="text-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-f1-red border-opacity-50 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold mb-2">{message}</h2>
        <p className="text-gray-400">You will be redirected shortly.</p>
      </div>
    </div>
  );
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
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              <Route path="/calendar" element={<RaceCalendar />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="*" element={<NotFound />} />
              
              {/* Auth routes (only accessible if not logged in) */}
              <Route element={<PublicOnlyRoute />}>
                <Route path="/auth/login" element={<Login />} />
                <Route path="/auth/signup" element={<Signup />} />
                <Route path="/auth/reset-password" element={<ResetPassword />} />
              </Route>
              
              {/* Protected routes with blur effect for non-authenticated users */}
              <Route element={<ProtectedRoute />}>
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/race-analysis/:year/:round" element={<RaceAnalysisPage />} />
                <Route path="/drivers" element={<Drivers />} />
                <Route path="/constructors" element={<Constructors />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
            </Routes>
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </SessionProvider>
  </QueryClientProvider>
);

export default App;

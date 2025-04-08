
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SessionProvider } from "@/context/SessionContext";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/auth/ProtectedRoute";
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
import AuthCallback from "./pages/auth/AuthCallback";

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
              <Route path="*" element={<NotFound />} />
              
              {/* Auth routes (only accessible if not logged in) */}
              <Route element={<PublicOnlyRoute />}>
                <Route path="/auth/login" element={<Login />} />
                <Route path="/auth/signup" element={<Signup />} />
                <Route path="/auth/reset-password" element={<ResetPassword />} />
              </Route>
              
              {/* OAuth callback route */}
              <Route path="/auth/callback" element={<AuthCallback />} />
              
              {/* Protected routes with blur effect for non-authenticated users */}
              <Route element={<ProtectedRoute />}>
                <Route path="/analytics" element={<Analytics />} />
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

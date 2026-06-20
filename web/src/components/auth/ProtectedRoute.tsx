
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AuthBlurOverlay from "./AuthBlurOverlay";

export const ProtectedRoute = () => {
  const { user, isLoading } = useAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-f1-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-f1-red"></div>
      </div>
    );
  }

  // If not authenticated, show the blurred background with login prompt
  if (!user) {
    return (
      <div className="relative">
        <div className="filter blur-sm pointer-events-none">
          <Outlet />
        </div>
        <AuthBlurOverlay />
      </div>
    );
  }

  // Render the protected content
  return <Outlet />;
};

export const PublicOnlyRoute = () => {
  const { user, isLoading } = useAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-f1-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-f1-red"></div>
      </div>
    );
  }

  // Redirect to home if already authenticated
  if (user) {
    return <Navigate to="/" replace />;
  }

  // Render the public content
  return <Outlet />;
};

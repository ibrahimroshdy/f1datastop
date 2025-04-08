
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AuthCallback = () => {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Extract error from URL if present
    const queryParams = new URLSearchParams(location.search);
    const errorDescription = queryParams.get('error_description');
    
    if (errorDescription) {
      setError(errorDescription);
      toast.error(`Authentication error: ${errorDescription}`);
      return;
    }

    // Handle the OAuth callback
    const handleAuthCallback = async () => {
      try {
        console.log("Processing auth callback...");
        
        // Get the session to check if authentication was successful
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth session error:", error);
          throw error;
        }

        if (data?.session) {
          // Authentication successful
          console.log("Authentication successful, session found");
          toast.success("Successfully signed in with Twitter!");
          navigate("/");
        } else {
          // If no session found but no error, just redirect
          console.log("No session found, redirecting to login");
          navigate("/auth/login");
        }
      } catch (err: any) {
        console.error("Auth callback error:", err);
        setError(err.message || "An error occurred during authentication");
        toast.error("Twitter authentication error");
      }
    };

    handleAuthCallback();
  }, [navigate, location]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-f1-black p-4">
        <div className="bg-red-900/30 border border-red-800 p-4 rounded-md text-center max-w-md">
          <h2 className="text-xl font-bold text-white mb-2">Authentication Error</h2>
          <p className="text-red-200">{error}</p>
          <button 
            onClick={() => navigate("/auth/login")}
            className="mt-4 px-4 py-2 bg-f1-red text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-f1-black p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-f1-red mx-auto"></div>
        <p className="mt-4 text-white">Completing Twitter authentication...</p>
      </div>
    </div>
  );
};

export default AuthCallback;

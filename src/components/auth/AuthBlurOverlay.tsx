
import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const AuthBlurOverlay: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="absolute inset-0 backdrop-blur-md bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-2">Login Required</h2>
        <p className="text-gray-300 mb-4">
          You need to be logged in to access this content. Sign up or log in to see the full data.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            className="bg-f1-red hover:bg-red-700" 
            onClick={() => navigate("/auth/login")}
          >
            Log in
          </Button>
          <Button 
            variant="outline" 
            className="border-gray-600 text-white" 
            onClick={() => navigate("/auth/signup")}
          >
            Sign up
          </Button>
          <Button 
            variant="ghost" 
            className="text-gray-400 hover:text-white" 
            onClick={() => navigate("/")}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuthBlurOverlay;

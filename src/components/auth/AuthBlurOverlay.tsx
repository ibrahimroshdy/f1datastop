import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";

const AuthBlurOverlay: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();

  return (
    <div className="absolute inset-0 backdrop-blur-md bg-black/50 z-50 flex items-center justify-center">
      <div className={`${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl`}>
        <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Login Required</h2>
        <p className={`mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
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
            className={`${theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-gray-800'}`}
            onClick={() => navigate("/auth/signup")}
          >
            Sign up
          </Button>
          <Button 
            variant="ghost" 
            className={`${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
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

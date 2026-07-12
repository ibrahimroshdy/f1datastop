import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const AuthBlurOverlay: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="absolute inset-0 backdrop-blur-md bg-background/50 z-50 flex items-center justify-center">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-2xl font-bold mb-2 text-foreground">Login Required</h2>
        <p className="mb-4 text-muted-foreground">
          You need to be logged in to access this content. Sign up or log in to see the full data.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => navigate("/auth/login")}
          >
            Log in
          </Button>
          <Button
            variant="outline"
            className="border-border text-foreground"
            onClick={() => navigate("/auth/signup")}
          >
            Sign up
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
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

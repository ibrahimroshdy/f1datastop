
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = "http://localhost:8000";

export function BackendStatusIndicator() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const checkBackendConnection = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/`);
        if (response.ok) {
          setIsConnected(true);
          toast.success("Connected to Python backend");
        } else {
          setIsConnected(false);
          toast.error("Backend API responded with an error");
        }
      } catch (error) {
        console.error("Failed to connect to backend:", error);
        setIsConnected(false);
        toast.error("Could not connect to Python backend", {
          description: "Make sure the backend server is running on port 8000"
        });
      }
    };

    checkBackendConnection();
    
    // Check connection every 30 seconds
    const intervalId = setInterval(checkBackendConnection, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  if (isConnected === null) {
    return (
      <Badge variant="outline" className="bg-gray-700 text-white border-0 animate-pulse">
        Checking backend...
      </Badge>
    );
  }

  return isConnected ? (
    <Badge variant="outline" className="bg-green-600 text-white border-0">
      <CheckCircle2 className="w-3 h-3 mr-1" />
      Python Backend Connected
    </Badge>
  ) : (
    <Badge variant="outline" className="bg-red-600 text-white border-0">
      <XCircle className="w-3 h-3 mr-1" />
      Backend Disconnected
    </Badge>
  );
}

export default BackendStatusIndicator;

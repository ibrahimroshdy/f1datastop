
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { toast } from "sonner";

const BACKEND_URL = "http://localhost:8000";

interface ApiContextProps {
  isBackendConnected: boolean;
  setIsBackendConnected: (connected: boolean) => void;
  backendUrl: string;
}

const ApiContext = createContext<ApiContextProps | undefined>(undefined);

interface ApiProviderProps {
  children: ReactNode;
}

export const ApiProvider: React.FC<ApiProviderProps> = ({ children }) => {
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  
  // Check backend connection on initial load
  useEffect(() => {
    const checkBackendConnection = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/`);
        if (response.ok) {
          setIsBackendConnected(true);
          toast.success("Connected to Python F1 Backend");
        } else {
          setIsBackendConnected(false);
          toast.error("Backend API responded with an error");
        }
      } catch (error) {
        console.error("Failed to connect to backend:", error);
        setIsBackendConnected(false);
        toast.error("Could not connect to F1 Python Backend", {
          description: "Make sure the backend server is running on port 8000"
        });
      }
    };

    checkBackendConnection();
    
    // Check connection every 30 seconds
    const intervalId = setInterval(checkBackendConnection, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  return (
    <ApiContext.Provider value={{ 
      isBackendConnected, 
      setIsBackendConnected,
      backendUrl: BACKEND_URL
    }}>
      {children}
    </ApiContext.Provider>
  );
};

export const useApi = (): ApiContextProps => {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};

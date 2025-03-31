
import React, { createContext, useContext, useState, ReactNode } from "react";

interface SessionContextProps {
  activeSessionId: string | undefined;
  setActiveSessionId: (id: string | undefined) => void;
  updateActiveSession: (id: string) => void; // Add this method to the interface
}

const SessionContext = createContext<SessionContextProps | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  
  // Add the updateActiveSession implementation
  const updateActiveSession = (id: string) => {
    setActiveSessionId(id);
  };

  return (
    <SessionContext.Provider value={{ 
      activeSessionId, 
      setActiveSessionId,
      updateActiveSession 
    }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = (): SessionContextProps => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};

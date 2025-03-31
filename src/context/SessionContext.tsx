
import { createContext, useContext, ReactNode } from "react";
import { useSessionContext } from "@/hooks/useF1Data";

interface SessionContextType {
  activeSessionId: number | null;
  setActiveSessionId: (id: number | null) => void;
  isLoading: boolean;
  error: Error | null;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const { activeSessionId, setActiveSessionId, nextRaceQuery } = useSessionContext();
  
  const value = {
    activeSessionId,
    setActiveSessionId,
    isLoading: nextRaceQuery.isLoading,
    error: nextRaceQuery.error as Error | null,
  };
  
  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  
  return context;
};

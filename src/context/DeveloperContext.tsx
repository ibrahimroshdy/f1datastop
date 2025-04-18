import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';

interface DeveloperContextProps {
  isDeveloperMode: boolean;
  profileClickCount: number;
  incrementProfileClickCount: () => void;
  resetProfileClickCount: () => void;
}

const DeveloperContext = createContext<DeveloperContextProps | undefined>(undefined);

export const DeveloperProvider = ({ children }: { children: ReactNode }) => {
  const [profileClickCount, setProfileClickCount] = useState<number>(0);
  const [isDeveloperMode, setIsDeveloperMode] = useState<boolean>(false);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('f1_developer_mode');
      if (savedMode) {
        setIsDeveloperMode(JSON.parse(savedMode));
      }
    } catch (error) {
      console.error('Error loading developer mode state:', error);
    }
  }, []);

  // Save developer mode state to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('f1_developer_mode', JSON.stringify(isDeveloperMode));
    } catch (error) {
      console.error('Error saving developer mode state:', error);
    }
  }, [isDeveloperMode]);

  // Handle profile click counter
  const incrementProfileClickCount = () => {
    const newCount = profileClickCount + 1;
    setProfileClickCount(newCount);
    
    if (newCount === 8) {
      toast('2 more clicks to open developer tools', {
        duration: 3000,
      });
    }
    
    if (newCount >= 10) {
      if (!isDeveloperMode) {
        toast('Developer mode activated! 🛠️', {
          duration: 3000,
        });
        setIsDeveloperMode(true);
      }
    }
  };

  const resetProfileClickCount = () => {
    setProfileClickCount(0);
  };

  const contextValue: DeveloperContextProps = {
    isDeveloperMode,
    profileClickCount,
    incrementProfileClickCount,
    resetProfileClickCount,
  };

  return (
    <DeveloperContext.Provider value={contextValue}>
      {children}
    </DeveloperContext.Provider>
  );
};

export const useDeveloper = () => {
  const context = useContext(DeveloperContext);
  if (context === undefined) {
    throw new Error('useDeveloper must be used within a DeveloperProvider');
  }
  return context;
}; 
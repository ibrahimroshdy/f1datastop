
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { toast } from "sonner";

type ApiSource = 'direct' | 'backend';

interface ApiContextProps {
  apiSource: ApiSource;
  setApiSource: (source: ApiSource) => void;
  toggleApiSource: () => void;
}

const ApiContext = createContext<ApiContextProps | undefined>(undefined);

interface ApiProviderProps {
  children: ReactNode;
}

export const ApiProvider: React.FC<ApiProviderProps> = ({ children }) => {
  const [apiSource, setApiSource] = useState<ApiSource>('direct');

  const toggleApiSource = () => {
    const newSource = apiSource === 'direct' ? 'backend' : 'direct';
    setApiSource(newSource);
    toast.info(`Switched to ${newSource === 'direct' ? 'Direct API' : 'Python Backend'}`, {
      description: newSource === 'backend' ? 'Using Fast-F1 Python library for data' : 'Using direct Ergast API for data'
    });
  };

  return (
    <ApiContext.Provider value={{ apiSource, setApiSource, toggleApiSource }}>
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

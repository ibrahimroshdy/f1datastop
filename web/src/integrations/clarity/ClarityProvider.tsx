import React, { useEffect } from 'react';
import clarity from '@microsoft/clarity';
import { isClarityEnabled } from '@/config/integrations';

interface ClarityProviderProps {
  children: React.ReactNode;
  projectId: string;
}

// Module-level guard to prevent double initialization
let clarityInitialized = false;

export const ClarityProvider: React.FC<ClarityProviderProps> = ({ children, projectId }) => {
  useEffect(() => {
    if (!isClarityEnabled || !projectId || clarityInitialized) return;
    clarity.init(projectId);
    clarityInitialized = true;
  }, [projectId]);

  return <>{children}</>;
};

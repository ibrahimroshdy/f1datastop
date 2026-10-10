import React, { useEffect } from 'react';
import clarity from '@microsoft/clarity';
import { isClarityEnabled } from '@/config/integrations';

interface ClarityProviderProps {
  children: React.ReactNode;
  projectId: string;
}

export const ClarityProvider: React.FC<ClarityProviderProps> = ({ children, projectId }) => {
  useEffect(() => {
    if (!isClarityEnabled || !projectId) return;
    clarity.init(projectId);
  }, [projectId]);

  return <>{children}</>;
};

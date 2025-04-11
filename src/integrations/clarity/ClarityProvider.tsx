import React, { useEffect } from 'react';
import clarity from '@microsoft/clarity';

interface ClarityProviderProps {
  children: React.ReactNode;
  projectId: string;
}

export const ClarityProvider: React.FC<ClarityProviderProps> = ({ children, projectId }) => {
  useEffect(() => {
    // Initialize Clarity with the provided project ID
    clarity.init(projectId);

    // No cleanup needed as clarity doesn't have a stop method
    return () => {};
  }, [projectId]);

  return <>{children}</>;
}; 
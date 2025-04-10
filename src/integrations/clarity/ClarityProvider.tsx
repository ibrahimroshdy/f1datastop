import { ReactNode, useEffect } from 'react';

interface ClarityProviderProps {
  children: ReactNode;
  projectId: string;
}

declare global {
  interface Window {
    clarity: any;
  }
}

const ClarityProvider = ({ children, projectId }: ClarityProviderProps) => {
  useEffect(() => {
    // Only load Clarity in browser environment
    if (typeof window === 'undefined') return;
    
    // Skip if already loaded
    if (window.clarity) return;
    
    // Load Clarity script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://www.clarity.ms/tag/' + projectId;
    
    // Add to document head
    document.head.appendChild(script);

    // Log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('[Clarity] Tracking initialized with project ID:', projectId);
    }
    
    return () => {
      // Cleanup if component unmounts
      try {
        document.head.removeChild(script);
      } catch (e) {
        // Script might already be removed
      }
    };
  }, [projectId]);

  // This component doesn't render anything itself, just wraps children
  return <>{children}</>;
};

export default ClarityProvider; 
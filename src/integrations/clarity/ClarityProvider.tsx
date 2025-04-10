import { ReactNode, useEffect, useState } from 'react';

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
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Only load Clarity in browser environment
    if (typeof window === 'undefined') return;
    
    // Skip if already loaded or had an error
    if (window.clarity || isInitialized || hasError) return;
    
    try {
      // Handle errors from previous load attempts
      window.onerror = (event, source, lineno, colno, error) => {
        if (source && source.includes(projectId)) {
          setHasError(true);
          console.error('[Clarity] Error in script execution:', error);
          return true; // Prevent default handling
        }
        return false;
      };
      
      // Create wrapper function to prevent errors
      window.clarity = function(action: string, ...args: any[]) {
        // This is a stub that will be replaced when Clarity loads
        // If called before loaded, it will safely do nothing
      };
      
      // Load Clarity script
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = 'https://www.clarity.ms/tag/' + projectId;
      
      // Handle script load success
      script.onload = () => {
        setIsInitialized(true);
        if (process.env.NODE_ENV === 'development') {
          console.log('[Clarity] Tracking initialized with project ID:', projectId);
        }
      };
      
      // Handle script load error
      script.onerror = (error) => {
        setHasError(true);
        console.error('[Clarity] Failed to load tracking script:', error);
      };
      
      // Add to document head
      document.head.appendChild(script);
      
      return () => {
        // Cleanup if component unmounts
        try {
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
        } catch (e) {
          // Script might already be removed
        }
      };
    } catch (error) {
      setHasError(true);
      console.error('[Clarity] Error during initialization:', error);
    }
  }, [projectId, isInitialized, hasError]);

  // This component doesn't render anything itself, just wraps children
  return <>{children}</>;
};

export default ClarityProvider; 
import { ReactNode, useEffect, useState, useRef } from 'react';
import { initClarity } from './clarityHelpers';

interface ClarityProviderProps {
  children: ReactNode;
  projectId: string;
}

declare global {
  interface Window {
    clarity?: any;
    clarityQueue?: any[];
  }
}

const ClarityProvider = ({ children, projectId }: ClarityProviderProps) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasError, setHasError] = useState(false);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  
  useEffect(() => {
    // Only load Clarity in browser environment
    if (typeof window === 'undefined') return;
    
    // Skip if already initialized
    if (isInitialized || hasError) return;

    // Prevent excessive logging in development
    const isDev = process.env.NODE_ENV === 'development';
    const logInfo = isDev ? (msg: string) => {} : () => {};
    
    try {
      // First, add a safety script to ensure window.clarity exists
      const safetyScript = document.createElement('script');
      safetyScript.type = 'text/javascript';
      safetyScript.innerHTML = `
        // Create a stub clarity function if it doesn't exist
        window.clarityQueue = [];
        if (typeof window.clarity !== 'function') {
          window.clarity = function() {
            // Store calls to be processed once real clarity loads
            window.clarityQueue.push(arguments);
          };
        }
      `;
      document.head.appendChild(safetyScript);
      
      // Load the Clarity script directly
      const script = document.createElement('script');
      scriptRef.current = script;
      script.type = 'text/javascript';
      script.async = true;
      script.defer = true;
      script.src = `https://www.clarity.ms/tag/${projectId}`;
      
      script.onload = () => {
        // Successfully loaded
        setIsInitialized(true);
        logInfo('Clarity initialized successfully');
        
        // Initialize Clarity using our helper (as a backup)
        initClarity(projectId);
      };
      
      script.onerror = () => {
        setHasError(true);
        console.error('[Clarity] Failed to load script');
      };
      
      document.head.appendChild(script);
      
      return () => {
        // Clean up on unmount
        if (safetyScript.parentNode) {
          safetyScript.parentNode.removeChild(safetyScript);
        }
        if (scriptRef.current && scriptRef.current.parentNode) {
          scriptRef.current.parentNode.removeChild(scriptRef.current);
        }
      };
    } catch (error) {
      setHasError(true);
      console.error('[Clarity] Error during initialization');
    }
  }, [projectId, isInitialized, hasError]);

  // This component doesn't render anything itself, just wraps children
  return <>{children}</>;
};

export default ClarityProvider; 
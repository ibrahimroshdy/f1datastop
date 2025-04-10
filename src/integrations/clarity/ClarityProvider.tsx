import { ReactNode, useEffect, useState, useRef } from 'react';

interface ClarityProviderProps {
  children: ReactNode;
  projectId: string;
}

declare global {
  interface Window {
    clarity?: any;
    // Add a more specific structure to prevent unshift errors
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
    
    // Skip if already loaded or had an error
    if ((window.clarity && typeof window.clarity === 'function') || isInitialized || hasError) return;

    try {
      // Initialize the clarity queue to prevent unshift errors
      window.clarityQueue = window.clarityQueue || [];
      
      // Create a safe stub for clarity
      window.clarity = function(name: string, ...args: any[]) {
        // Only execute methods that are known to be available before initialization
        if (name === 'consent' || name === 'set' || name === 'identify' || name === 'event') {
          // Queue these calls until the real clarity is loaded
          window.clarityQueue = window.clarityQueue || [];
          window.clarityQueue.push({name, args});
        }
      };
      
      // Custom error handler for Clarity script
      const handleClarityError = (event: ErrorEvent) => {
        // Only handle Clarity script errors
        if (event.filename && event.filename.includes(projectId)) {
          console.error('[Clarity] Error in script:', event.message);
          setHasError(true);
          
          // Remove the script to prevent further errors
          if (scriptRef.current && scriptRef.current.parentNode) {
            scriptRef.current.parentNode.removeChild(scriptRef.current);
          }
          
          event.preventDefault();
          return true; // Indicates we've handled the error
        }
        return false;
      };
      
      // Add error listener
      window.addEventListener('error', handleClarityError);
      
      // Load Clarity script with a different approach
      const script = document.createElement('script');
      scriptRef.current = script;
      
      script.type = 'text/javascript';
      script.async = true;
      script.defer = true; // Add defer to ensure it loads after page
      script.crossOrigin = 'anonymous';
      
      // Use a different approach to loading the script
      // Add a version parameter to avoid caching issues
      script.src = `https://www.clarity.ms/tag/${projectId}?v=${Date.now()}`;
      
      // Handle script load success
      script.onload = () => {
        console.log('[Clarity] Script loaded successfully');
        setIsInitialized(true);
        
        // Process any queued events
        if (window.clarityQueue && window.clarity && typeof window.clarity === 'function') {
          try {
            window.clarityQueue.forEach(item => {
              window.clarity(item.name, ...item.args);
            });
            // Clear the queue
            window.clarityQueue = [];
          } catch (e) {
            console.error('[Clarity] Error processing queued events:', e);
          }
        }
      };
      
      // Handle script load error
      script.onerror = (error) => {
        console.error('[Clarity] Failed to load tracking script:', error);
        setHasError(true);
        
        // Remove the error listener to prevent memory leaks
        window.removeEventListener('error', handleClarityError);
      };
      
      // Add to document head
      document.head.appendChild(script);
      
      return () => {
        // Cleanup if component unmounts
        window.removeEventListener('error', handleClarityError);
        if (scriptRef.current && scriptRef.current.parentNode) {
          scriptRef.current.parentNode.removeChild(scriptRef.current);
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
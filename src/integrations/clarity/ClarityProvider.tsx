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
    clarity_c?: any[];
    __CLARITY_SAFETY_INTERVAL__?: number;
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
      // IMPORTANT: Ensure all Clarity globals are defined BEFORE loading the script
      // First, add a safety script to ensure necessary objects exist
      const safetyScript = document.createElement('script');
      safetyScript.type = 'text/javascript';
      safetyScript.innerHTML = `
        // Define all possible arrays that Clarity might need
        window.clarityQueue = window.clarityQueue || [];
        window.clarity_c = window.clarity_c || [];
        
        // Add safety polyfills for arrays (in case they get re-assigned)
        const safetyHandler = {
          get: function(target, prop) {
            // If accessing array methods on undefined, return a safe array
            if (target === undefined || target === null) {
              console.warn('[Clarity] Prevented null error for ' + String(prop));
              return [];
            }
            
            // For the unshift method specifically, ensure it's safe
            if (prop === 'unshift') {
              return function(...args) {
                if (!Array.isArray(target)) {
                  console.warn('[Clarity] Prevented unshift on non-array');
                  // Create a new array and return the result of unshift
                  const newArray = [];
                  return Array.prototype.unshift.apply(newArray, args);
                }
                return Array.prototype.unshift.apply(target, args);
              };
            }
            
            return target[prop];
          }
        };
        
        // Apply these safety proxies
        window.clarityQueue = new Proxy(window.clarityQueue || [], safetyHandler);
        window.clarity_c = new Proxy(window.clarity_c || [], safetyHandler);
        
        // Force array methods to always be available on Clarity objects
        // This ensures that even if something changes these objects, they'll still have array methods
        const ensureArrayMethods = () => {
          const objects = ['clarityQueue', 'clarity_c'];
          objects.forEach(name => {
            // Create fresh array if it doesn't exist
            if (!window[name]) window[name] = [];
            
            // If it exists but isn't an array, replace it with an array
            if (window[name] && !Array.isArray(window[name])) {
              window[name] = [];
            }
            
            // Add unshift method directly to prevent the TypeError
            if (window[name] && !window[name].unshift) {
              window[name].unshift = function(...args) {
                // Create a new array with the args at the beginning
                const newArray = [...args, ...(Array.isArray(this) ? this : [])];
                // Replace the current array with the new one
                window[name] = newArray;
                return newArray.length;
              };
            }
          });
        };
        
        // Run immediately and set up interval to keep checking
        ensureArrayMethods();
        const intervalId = setInterval(ensureArrayMethods, 1000);
        
        // Expose the interval ID so we can clear it later
        window.__CLARITY_SAFETY_INTERVAL__ = intervalId;
        
        // Define a safe clarity function that won't fail
        window.clarity = window.clarity || function() {
          try {
            // Ensure array before pushing
            ensureArrayMethods();
            // Store calls to be processed once real clarity loads
            (window.clarityQueue = window.clarityQueue || []).push(arguments);
          } catch (e) {
            console.warn('[Clarity] Queue error prevented');
          }
        };
        
        // Message port error silencer
        window.addEventListener('message', function(event) {
          if (event.data && typeof event.data === 'string' && event.data.indexOf('clarity') !== -1) {
            try {
              // Handle the message normally
            } catch (e) {
              // Silently catch any message port errors
              event.stopPropagation();
            }
          }
        }, true);
      `;
      
      // Add this script BEFORE any other scripts
      if (document.head.firstChild) {
        document.head.insertBefore(safetyScript, document.head.firstChild);
      } else {
        document.head.appendChild(safetyScript);
      }
      
      // Load the Clarity script with a version parameter to avoid caching
      const script = document.createElement('script');
      scriptRef.current = script;
      script.type = 'text/javascript';
      script.async = true;
      script.defer = true;
      script.src = `https://www.clarity.ms/tag/${projectId}?v=${Date.now()}`;
      script.crossOrigin = 'anonymous';
      
      // Add global error handler for script errors
      const handleScriptError = (event: ErrorEvent) => {
        if (event.filename && event.filename.includes('clarity')) {
          // Prevent the error from propagating
          event.preventDefault();
          setHasError(true); // Mark as errored to avoid retrying
          return true;
        }
        
        // Specific error for unshift issues
        if (event.message && (
          event.message.includes('unshift') || 
          event.message.includes('message port closed')
        )) {
          event.preventDefault();
          return true;
        }
        
        return false;
      };
      
      window.addEventListener('error', handleScriptError, true);
      
      script.onload = () => {
        // Successfully loaded
        setIsInitialized(true);
        logInfo('Clarity initialized successfully');
        
        // Initialize Clarity using our helper (as a backup)
        try {
          initClarity(projectId);
        } catch (err) {
          // Silently fail
        }
      };
      
      script.onerror = () => {
        setHasError(true);
        console.error('[Clarity] Failed to load script');
        window.removeEventListener('error', handleScriptError, true);
      };
      
      document.head.appendChild(script);
      
      // Return cleanup function to remove script and clear interval
      return () => {
        // Remove script tag if it exists
        if (scriptRef.current && scriptRef.current.parentNode) {
          scriptRef.current.parentNode.removeChild(scriptRef.current);
        }
        
        // Clean up safety script if it exists
        if (safetyScript && safetyScript.parentNode) {
          safetyScript.parentNode.removeChild(safetyScript);
        }
        
        // Clear the safety interval
        if (window.__CLARITY_SAFETY_INTERVAL__) {
          clearInterval(window.__CLARITY_SAFETY_INTERVAL__);
          delete window.__CLARITY_SAFETY_INTERVAL__;
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
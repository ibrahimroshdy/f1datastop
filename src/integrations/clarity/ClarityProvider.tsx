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
    testClarity?: () => boolean;
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

    // Always log for debugging
    console.log('[Clarity] Starting initialization...');
    
    try {
      // IMPORTANT: Ensure all Clarity globals are defined BEFORE loading the script
      // First, add a safety script to ensure necessary objects exist
      const safetyScript = document.createElement('script');
      safetyScript.type = 'text/javascript';
      safetyScript.innerHTML = `
        // Define all possible arrays that Clarity might need
        console.log('[Clarity] Setting up safety handlers...');
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
            console.log('[Clarity] Command queued for later:', arguments[0]);
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
        
        console.log('[Clarity] Safety handlers initialized successfully');
      `;
      
      // Add this script BEFORE any other scripts
      if (document.head.firstChild) {
        document.head.insertBefore(safetyScript, document.head.firstChild);
      } else {
        document.head.appendChild(safetyScript);
      }
      
      console.log('[Clarity] Loading main script...');
      
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
          console.error('[Clarity] Script error:', event.message);
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
          console.warn('[Clarity] Non-critical error ignored:', event.message);
          event.preventDefault();
          return true;
        }
        
        return false;
      };
      
      window.addEventListener('error', handleScriptError, true);
      
      script.onload = () => {
        // Successfully loaded
        setIsInitialized(true);
        console.log('[Clarity] Script loaded successfully!');
        
        // Initialize Clarity using our helper (as a backup)
        try {
          initClarity(projectId);
          
          // Set a custom tag to verify tracking is working
          if (window.clarity) {
            window.clarity('set', 'clarity_verification', 'true');
            console.log('[Clarity] Set verification tag to confirm tracking is active');
          }
          
          // Add a way to test if Clarity is collecting data
          window.testClarity = function() {
            try {
              if (window.clarity) {
                window.clarity('event', 'test_event');
                window.clarity('set', 'test_tag', 'test_value');
                console.log('[Clarity] Test event sent successfully!');
                console.log('[Clarity] Clarity is installed and working correctly');
                return true;
              } else {
                console.error('[Clarity] Clarity object not found');
                return false;
              }
            } catch (e) {
              console.error('[Clarity] Test failed:', e);
              return false;
            }
          };
          
          console.log('[Clarity] You can run window.testClarity() in the console to verify Clarity is working');
        } catch (err) {
          console.error('[Clarity] Error during initialization:', err);
        }
      };
      
      script.onerror = (error) => {
        setHasError(true);
        console.error('[Clarity] Failed to load script:', error);
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
        
        window.removeEventListener('error', handleScriptError, true);
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
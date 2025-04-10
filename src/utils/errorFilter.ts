/**
 * Utility to silence common errors and warnings in the console
 * This helps keep the console clean for debugging
 */

// Messages to filter in console errors/warnings
const ERROR_FILTERS = [
  '[Clarity]',
  'Firebase Analytics not initialized',
  'Cannot read properties of undefined (reading',
  'message port closed',
  '[GA4 Error]'
];

/**
 * Initialize console filters to silence common errors/warnings
 * Call this function once early in the application lifecycle
 */
export const initConsoleFilters = (): void => {
  if (typeof window === 'undefined') return;
  
  // Only apply in non-development environments
  if (process.env.NODE_ENV === 'development') {
    console.log('[ErrorFilter] Not filtering console in development mode');
    return;
  }
  
  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Override console.error
  console.error = function(msg: any, ...args: any[]) {
    // Filter out common errors
    if (typeof msg === 'string') {
      for (const filter of ERROR_FILTERS) {
        if (msg.includes(filter)) {
          return; // Silently drop the error
        }
      }
    }
    
    // Log everything else
    originalError.apply(console, [msg, ...args]);
  };
  
  // Override console.warn
  console.warn = function(msg: any, ...args: any[]) {
    // Filter out common warnings
    if (typeof msg === 'string') {
      for (const filter of ERROR_FILTERS) {
        if (msg.includes(filter)) {
          return; // Silently drop the warning
        }
      }
    }
    
    // Log everything else
    originalWarn.apply(console, [msg, ...args]);
  };
  
  // Log that filters have been applied
  console.log('[ErrorFilter] Console filters applied');
};

export default initConsoleFilters; 
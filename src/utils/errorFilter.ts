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
  '[GA4 Error]',
  'Uncaught TypeError: Cannot read properties of undefined (reading \'unshift\')',
  'The message port closed before a response was received',
  'r25ms3yolv', // Hide project ID from logs
  'clarity.ms', // Filter out any clarity domain references
  'www.clarity.ms', // Filter out any clarity domain references
  'clarity_', // Filter anything related to clarity variables
  'unshift', // Specifically filter unshift errors
  'Error sending message to extension', // Common extension errors
  'message port', // Filter message port errors
  'Failed to execute \'postMessage\' on \'MessagePort\'', // Filter specific message port errors
  'Prevented unshift on non-array', // Filter our custom warnings
  'Prevented null error for', // Filter our custom warnings
  'AAAA-BBBB-CCCC' // Filter any generic project ID pattern
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
  const originalLog = console.log;
  
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
  
  // Override console.log to filter out certain messages
  console.log = function(msg: any, ...args: any[]) {
    // Filter out logs containing sensitive info
    if (typeof msg === 'string') {
      for (const filter of ERROR_FILTERS) {
        if (msg.includes(filter)) {
          return; // Silently drop the log
        }
      }
    }
    
    // Log everything else
    originalLog.apply(console, [msg, ...args]);
  };
  
  // Log that filters have been applied (without project IDs)
  originalLog.apply(console, ['[ErrorFilter] Console filters applied']);
};

export default initConsoleFilters; 
/**
 * Utility to silence common errors and warnings in the console
 * This helps keep the console clean for debugging
 */

// Messages to filter in console errors/warnings
const ERROR_FILTERS = [
  // Only filter errors, not successful messages
  'Cannot read properties of undefined (reading',
  'message port closed',
  'Uncaught TypeError: Cannot read properties of undefined (reading \'unshift\')',
  'The message port closed before a response was received',
  'Error sending message to extension',
  'Failed to execute \'postMessage\' on \'MessagePort\'',
  'Prevented unshift on non-array',
  'Prevented null error for'
];

// Project ID to redact from logs (don't filter the entire message)
const PROJECT_ID = 'r25ms3yolv';

/**
 * Initialize console filters to silence common errors/warnings
 * Call this function once early in the application lifecycle
 */
export const initConsoleFilters = (): void => {
  if (typeof window === 'undefined') return;
  
  // Allow both development and production logging to see if it's working
  // Only redact sensitive information
  
  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  
  // Override console.error
  console.error = function(msg: any, ...args: any[]) {
    // Filter out common errors
    if (typeof msg === 'string') {
      // Check for specific error patterns that we want to suppress
      for (const filter of ERROR_FILTERS) {
        if (msg.includes(filter)) {
          return; // Silently drop these specific errors
        }
      }
      
      // Redact project ID but still show the message
      if (msg.includes(PROJECT_ID)) {
        msg = msg.replace(new RegExp(PROJECT_ID, 'g'), '[CLARITY-ID]');
      }
    }
    
    // Log everything else
    originalError.apply(console, [msg, ...args]);
  };
  
  // Override console.warn
  console.warn = function(msg: any, ...args: any[]) {
    // Don't completely filter warnings, just redact sensitive info
    if (typeof msg === 'string' && msg.includes(PROJECT_ID)) {
      msg = msg.replace(new RegExp(PROJECT_ID, 'g'), '[CLARITY-ID]');
    }
    
    // Log all warnings
    originalWarn.apply(console, [msg, ...args]);
  };
  
  // Override console.log to redact sensitive info but show success messages
  console.log = function(msg: any, ...args: any[]) {
    // Only redact project ID
    if (typeof msg === 'string' && msg.includes(PROJECT_ID)) {
      msg = msg.replace(new RegExp(PROJECT_ID, 'g'), '[CLARITY-ID]');
    }
    
    // Log all messages (important for seeing success)
    originalLog.apply(console, [msg, ...args]);
  };
  
  // Log that filters have been applied
  originalLog.apply(console, ['[ErrorFilter] Console filters applied - monitoring Clarity status']);
};

export default initConsoleFilters; 
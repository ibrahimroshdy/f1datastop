/**
 * Utility functions for Microsoft Clarity heatmap tracking
 * These functions are designed to work with the queuing system in ClarityProvider
 */

// Flag to enable/disable Clarity tracking
let clarityEnabled = true;
// Flag to track if we're in verbose logging mode
const verboseLogging = false;

/**
 * Check if Clarity is fully initialized
 */
const isFullyClarityAvailable = (): boolean => {
  return typeof window !== 'undefined' && 
         typeof window.clarity === 'function' && 
         clarityEnabled;
};

/**
 * Check if at least the Clarity stub is available (for queueing)
 */
const isClarityStubAvailable = (): boolean => {
  return typeof window !== 'undefined' && 
         typeof window.clarity === 'function';
};

/**
 * Safely execute a Clarity function, handling errors gracefully
 * Works with the queueing system in ClarityProvider
 */
const safeExecute = (fn: string, ...args: any[]): void => {
  // Skip if Clarity is explicitly disabled
  if (!clarityEnabled) return;
  
  try {
    // Even if just the stub is available, it will queue the command
    if (isClarityStubAvailable()) {
      window.clarity(fn, ...args);
      
      if (verboseLogging && process.env.NODE_ENV === 'development') {
        console.log(`[Clarity] ${isFullyClarityAvailable() ? 'Executed' : 'Queued'} event: ${fn}`);
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[Clarity] Error with ${fn}:`, error);
    }
  }
};

/**
 * Set a custom tag in Clarity to help filter recordings
 * @param key Tag key
 * @param value Tag value
 */
export const setTag = (key: string, value: string): void => {
  if (!key || value === undefined) return;
  safeExecute('set', key, value);
};

/**
 * Identify the current user in Clarity recordings
 * @param userId Unique user ID
 * @param userInfo Optional additional user information
 */
export const identifyUser = (
  userId: string, 
  userInfo?: {
    name?: string;
    email?: string;
    role?: string;
  }
): void => {
  if (!userId) return;
  
  safeExecute('identify', userId);
  
  // Set additional user information as tags if provided
  if (userInfo?.name) {
    setTag('user_name', userInfo.name);
  }
  
  if (userInfo?.email) {
    setTag('user_email', userInfo.email);
  }
  
  if (userInfo?.role) {
    setTag('user_role', userInfo.role);
  }
};

/**
 * Track a custom event in Clarity
 * @param eventName Name of the event
 */
export const trackEvent = (eventName: string): void => {
  if (!eventName) return;
  safeExecute('event', eventName);
};

/**
 * Set the current page name in a single-page application
 * Helps organize recordings by logical pages rather than URL changes
 * @param pageName Name of the current page/view
 */
export const setCurrentPage = (pageName: string): void => {
  if (!pageName) return;
  setTag('page_name', pageName);
};

/**
 * Track F1-specific events in Clarity
 * @param category Event category
 * @param action Specific action
 * @param label Optional label for the event
 */
export const trackF1Event = (
  category: 'race' | 'driver' | 'team' | 'analytics' | 'user', 
  action: string,
  label?: string
): void => {
  if (!category || !action) return;
  
  setTag('f1_event_category', category);
  setTag('f1_event_action', action);
  
  if (label) {
    setTag('f1_event_label', label);
  }
  
  trackEvent(`f1_${category}_${action}`);
}; 
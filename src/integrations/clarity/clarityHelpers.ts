/**
 * Utility functions for Microsoft Clarity heatmap tracking
 */

// Queue to store events while Clarity is loading
const eventQueue: Array<{ fn: string, args: any[] }> = [];
// Flag to enable/disable Clarity tracking
let clarityEnabled = true;
// Flag to track if we're in verbose logging mode
const verboseLogging = false;

/**
 * Check if Clarity is available and initialized properly
 */
const isClarityAvailable = (): boolean => {
  return typeof window !== 'undefined' && 
         typeof window.clarity === 'function' && 
         clarityEnabled;
};

/**
 * Process any queued events once Clarity becomes available
 */
const processQueue = () => {
  if (!isClarityAvailable() || eventQueue.length === 0) return;
  
  try {
    // Process all queued events
    while (eventQueue.length > 0) {
      const event = eventQueue.shift();
      if (event) {
        window.clarity(event.fn, ...event.args);
      }
    }
  } catch (error) {
    // If processing fails, disable Clarity to prevent further errors
    clarityEnabled = false;
    console.error('[Clarity] Error processing queue, disabling Clarity:', error);
  }
};

// Check queue periodically
if (typeof window !== 'undefined') {
  // Process queue when Clarity loads
  const intervalId = setInterval(() => {
    if (isClarityAvailable()) {
      processQueue();
      // Keep checking but less frequently once Clarity is available
      clearInterval(intervalId);
      setInterval(processQueue, 5000);
    }
  }, 1000);
}

/**
 * Safely execute a Clarity function, handling errors gracefully
 * Queues the event if Clarity is not yet available
 */
const safeExecute = (fn: string, ...args: any[]): void => {
  // Skip if Clarity is explicitly disabled
  if (!clarityEnabled) return;
  
  // If Clarity is not available, queue the event
  if (!isClarityAvailable()) {
    eventQueue.push({ fn, args });
    if (verboseLogging && process.env.NODE_ENV === 'development') {
      console.log(`[Clarity] Queued event: ${fn}`);
    }
    return;
  }
  
  try {
    window.clarity(fn, ...args);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[Clarity] Error executing ${fn}:`, error);
    }
    
    // Queue the event to try again later
    eventQueue.push({ fn, args });
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
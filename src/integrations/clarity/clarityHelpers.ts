/**
 * Utility functions for Microsoft Clarity
 */
import clarityPackage from '@microsoft/clarity';

// Extend Window interface to include clarity
declare global {
  interface Window {
    clarity?: any;
    clarityQueue?: any[];
  }
}

// Flag to prevent excessive logging
const PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Check if Clarity is properly available in the window
 */
const isClarityAvailable = (): boolean => {
  return typeof window !== 'undefined' && typeof window.clarity === 'function';
};

/**
 * Process any queued commands that might have been stored
 * before Clarity was fully initialized
 */
const processQueuedCommands = () => {
  if (typeof window === 'undefined' || !window.clarityQueue) return;
  
  try {
    const queue = window.clarityQueue;
    
    // Process each command in the queue
    while (queue.length > 0) {
      const args = queue.shift();
      if (args && window.clarity) {
        window.clarity.apply(window, args);
      }
    }
  } catch (error) {
    // Silently fail in production
    if (!PRODUCTION) {
      console.error('[Clarity] Error processing queued commands');
    }
  }
};

/**
 * Initialize Clarity safely if not already initialized
 */
export const initClarity = (projectId: string): void => {
  try {
    if (!isClarityAvailable()) {
      clarityPackage.init(projectId);
      
      // Process any queued commands
      setTimeout(processQueuedCommands, 500);
    }
  } catch (error) {
    // Silently fail in production
    if (!PRODUCTION) {
      console.error('[Clarity] Error during initialization');
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
  
  try {
    // Try to use the global window.clarity if available
    if (isClarityAvailable()) {
      window.clarity('set', key, value);
    } else if (window.clarity) {
      // If window.clarity exists but might not be fully initialized
      window.clarity('set', key, value);
    } else {
      // Fallback to the npm package method
      clarityPackage.setTag(key, value);
    }
  } catch (error) {
    // Silently fail in production
    if (!PRODUCTION) {
      console.error(`[Clarity] Error setting tag`);
    }
  }
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
  
  try {
    if (isClarityAvailable()) {
      window.clarity('identify', userId);
    } else if (window.clarity) {
      window.clarity('identify', userId);
    } else {
      clarityPackage.identify(userId);
    }
    
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
  } catch (error) {
    // Silently fail in production
    if (!PRODUCTION) {
      console.error('[Clarity] Error identifying user');
    }
  }
};

/**
 * Track a custom event in Clarity
 * @param eventName Name of the event
 */
export const trackEvent = (eventName: string): void => {
  if (!eventName) return;
  
  try {
    if (isClarityAvailable()) {
      window.clarity('event', eventName);
    } else if (window.clarity) {
      window.clarity('event', eventName);
    } else {
      clarityPackage.event(eventName);
    }
  } catch (error) {
    // Silently fail in production
    if (!PRODUCTION) {
      console.error(`[Clarity] Error tracking event`);
    }
  }
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
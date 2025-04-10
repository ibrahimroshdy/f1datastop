/**
 * Utility functions for Microsoft Clarity heatmap tracking
 */

/**
 * Set a custom tag in Clarity to help filter recordings
 * @param key Tag key
 * @param value Tag value
 */
export const setTag = (key: string, value: string): void => {
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity('set', key, value);
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
  if (typeof window !== 'undefined' && window.clarity) {
    // Set the user ID
    window.clarity('identify', userId);
    
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
  }
};

/**
 * Track a custom event in Clarity
 * @param eventName Name of the event
 */
export const trackEvent = (eventName: string): void => {
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity('event', eventName);
  }
};

/**
 * Set the current page name in a single-page application
 * Helps organize recordings by logical pages rather than URL changes
 * @param pageName Name of the current page/view
 */
export const setCurrentPage = (pageName: string): void => {
  if (typeof window !== 'undefined' && window.clarity) {
    setTag('page_name', pageName);
  }
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
  if (typeof window !== 'undefined' && window.clarity) {
    // Set the event as a tag
    setTag('f1_event_category', category);
    setTag('f1_event_action', action);
    
    if (label) {
      setTag('f1_event_label', label);
    }
    
    // Track the event
    window.clarity('event', `f1_${category}_${action}`);
  }
}; 
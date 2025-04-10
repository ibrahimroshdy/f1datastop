import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import * as clarityHelpers from '@/integrations/clarity/clarityHelpers';

/**
 * Custom hook for Clarity tracking
 * Provides easy access to Clarity tracking functions
 * and automatically tracks page views
 */
const useClarity = () => {
  const location = useLocation();
  
  // Set page name on route change
  useEffect(() => {
    clarityHelpers.setCurrentPage(getPageNameFromPath(location.pathname));
  }, [location]);
  
  // Get a human-readable page name from the path
  const getPageNameFromPath = (path: string): string => {
    // Remove leading slash and split by remaining slashes
    const parts = path.replace(/^\//, '').split('/');
    
    // If empty (homepage), return 'home'
    if (parts[0] === '') return 'home';
    
    // Replace hyphens with spaces and capitalize each word
    return parts[0]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };
  
  /**
   * Track a user interaction with a specific element
   */
  const trackInteraction = useCallback((
    elementName: string,
    interactionType: 'click' | 'hover' | 'view' = 'click'
  ) => {
    clarityHelpers.trackEvent(`interaction_${interactionType}_${elementName}`);
  }, []);
  
  /**
   * Track an F1-specific event
   */
  const trackF1Event = useCallback((
    category: 'race' | 'driver' | 'team' | 'analytics' | 'user',
    action: string,
    label?: string
  ) => {
    clarityHelpers.trackF1Event(category, action, label);
  }, []);
  
  /**
   * Set a custom tag for the current user session
   */
  const setUserProperty = useCallback((key: string, value: string) => {
    clarityHelpers.setTag(`user_${key}`, value);
  }, []);
  
  /**
   * Set a feature flag for the current session
   */
  const setFeatureFlag = useCallback((featureName: string, enabled: boolean) => {
    clarityHelpers.setTag(`feature_${featureName}`, enabled ? 'enabled' : 'disabled');
  }, []);
  
  return {
    // Methods from clarityHelpers
    setTag: clarityHelpers.setTag,
    trackEvent: clarityHelpers.trackEvent,
    identifyUser: clarityHelpers.identifyUser,
    setCurrentPage: clarityHelpers.setCurrentPage,
    
    // Enhanced methods
    trackInteraction,
    trackF1Event,
    setUserProperty,
    setFeatureFlag
  };
};

export default useClarity; 
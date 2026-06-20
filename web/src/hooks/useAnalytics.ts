import { trackEvent, trackPageView } from '@/integrations/google-analytics/GA4.tsx';

// Custom hook for analytics
const useAnalytics = () => {
  // Track user interaction events
  const trackInteraction = (
    elementName: string,
    interactionType: 'click' | 'hover' | 'scroll' | 'input' = 'click',
    additionalParams?: Record<string, any>
  ) => {
    trackEvent('user_interaction', {
      element_name: elementName,
      interaction_type: interactionType,
      ...additionalParams
    });
  };

  // Track content views (articles, videos, etc.)
  const trackContentView = (
    contentId: string,
    contentType: string,
    contentName: string,
    additionalParams?: Record<string, any>
  ) => {
    trackEvent('content_view', {
      content_id: contentId,
      content_type: contentType,
      content_name: contentName,
      ...additionalParams
    });
  };

  // Track user engagement metrics
  const trackEngagement = (
    engagementType: 'time_spent' | 'scroll_depth' | 'session_length',
    value: number,
    additionalParams?: Record<string, any>
  ) => {
    trackEvent('user_engagement', {
      engagement_type: engagementType,
      engagement_value: value,
      ...additionalParams
    });
  };

  // Track search events
  const trackSearch = (
    searchTerm: string,
    searchCategory?: string,
    additionalParams?: Record<string, any>
  ) => {
    trackEvent('search', {
      search_term: searchTerm,
      search_category: searchCategory,
      ...additionalParams
    });
  };

  // Track F1-specific events
  const trackF1Event = (
    eventType: 'race_selection' | 'driver_view' | 'team_view' | 'season_change',
    eventDetail: string,
    additionalParams?: Record<string, any>
  ) => {
    trackEvent('f1_interaction', {
      event_type: eventType,
      event_detail: eventDetail,
      ...additionalParams
    });
  };

  // Manual page view tracking (if needed)
  const trackCustomPageView = (path: string) => {
    trackPageView(path);
  };

  return {
    trackInteraction,
    trackContentView,
    trackEngagement,
    trackSearch,
    trackF1Event,
    trackCustomPageView
  };
};

export default useAnalytics; 
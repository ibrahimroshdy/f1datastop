import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isGaEnabled } from '@/config/integrations';

// Interface for the gtag function
interface GTagFunction {
  (command: 'js', date: Date): void;
  (command: 'config', targetId: string, config?: object): void;
  (command: 'event', eventName: string, eventParams?: object): void;
  (command: 'set', params: object): void;
}

// Extend Window interface to include gtag
declare global {
  interface Window {
    dataLayer: any[];
    gtag: GTagFunction;
  }
}

// The gtag loader, consent defaults and the first page_view live in index.html (the only
// loader). Everything below just sends events through window.gtag when it exists.

// Helper function to track page views
export const trackPageView = (url: string) => {
  if (!isGaEnabled) return;
  if (!window.gtag) return;
  
  try {
    window.gtag('event', 'page_view', {
      page_path: url,
      page_location: window.location.href,
      page_title: document.title,
    });
  } catch (error) {
    console.error('[GA4] Error tracking page view:', error);
  }
};

// Helper function to track events
export const trackEvent = (
  eventName: string, 
  eventParams?: Record<string, any>
) => {
  if (!isGaEnabled) return;
  if (!window.gtag) return;
  
  try {
    // Log event in development environment
    if (process.env.NODE_ENV === 'development') {
      console.log('[GA4 Direct Event]', eventName, eventParams);
    }
    
    // Include timestamp if not provided
    const params = {
      ...eventParams,
      timestamp: eventParams?.timestamp || new Date().toISOString(),
    };
    
    window.gtag('event', eventName, params);
  } catch (error) {
    console.error('[GA4] Error tracking event:', error);
  }
};

// Track form submissions
export const trackFormSubmission = (formName: string, success: boolean): void => {
  trackEvent('form_submit', {
    form_name: formName,
    success: success
  });
};

// Track search events
export const trackSearch = (searchTerm: string): void => {
  trackEvent('search', {
    search_term: searchTerm
  });
};

// Track outbound link clicks
export const trackOutboundLink = (url: string): void => {
  trackEvent('click', {
    outbound: true,
    link_url: url
  });
};

// Track file downloads
export const trackDownload = (fileName: string, fileType: string): void => {
  trackEvent('file_download', {
    file_name: fileName,
    file_type: fileType
  });
};

// Track performance metrics
export const trackPerformance = (): void => {
  if (!isGaEnabled) return;
  if (typeof window !== 'undefined' && 'performance' in window) {
    const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (perfData) {
      trackEvent('page_performance', {
        page_load_time: Math.round(perfData.loadEventEnd - perfData.loadEventStart),
        dom_content_loaded: Math.round(perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart),
        first_paint: Math.round(performance.getEntriesByType('paint')[0]?.startTime || 0),
        connection_type: (navigator as any)?.connection?.effectiveType || 'unknown',
        page_path: window.location.pathname
      });
    }
  }
};

// Track JavaScript errors
export const trackError = (error: Error, errorInfo?: any): void => {
  if (!isGaEnabled) return;
  trackEvent('javascript_error', {
    error_message: error.message,
    error_stack: error.stack?.substring(0, 500), // Limit stack trace length
    error_name: error.name,
    page_path: window.location.pathname,
    user_agent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    additional_info: JSON.stringify(errorInfo)?.substring(0, 200)
  });
};

// Track viewport and device info
export const trackDeviceInfo = (): void => {
  if (!isGaEnabled) return;
  if (typeof window !== 'undefined') {
    trackEvent('device_info', {
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      screen_width: screen.width,
      screen_height: screen.height,
      pixel_ratio: window.devicePixelRatio || 1,
      color_depth: screen.colorDepth,
      touch_support: 'ontouchstart' in window,
      online_status: navigator.onLine,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      connection_type: (navigator as any)?.connection?.effectiveType || 'unknown'
    });
  }
};

// Track custom dimensions for F1 data
export const trackF1Event = (eventType: string, eventValue: string, additionalData?: Record<string, any>): void => {
  trackEvent('f1_interaction', {
    f1_event_type: eventType,
    f1_event_value: eventValue,
    season: additionalData?.season || 'current',
    category: additionalData?.category || 'general',
    ...additionalData
  });
};

// Track conversion goals
export const trackGoal = (goalName: string, value?: number, currency?: string): void => {
  trackEvent('conversion', {
    goal_name: goalName,
    value: value,
    currency: currency || 'USD',
    timestamp: new Date().toISOString()
  });
};

// Comprehensive F1 Calendar Tracking Functions

// Track calendar page visit
export const trackCalendarPageView = (year: number, viewType: 'list' | 'map' = 'list'): void => {
  trackEvent('calendar_page_view', {
    selected_year: year,
    view_type: viewType,
    current_year: new Date().getFullYear(),
    page_path: window.location.pathname,
    timestamp: new Date().toISOString()
  });
};

// Track year selection in calendar
export const trackCalendarYearChange = (fromYear: number, toYear: number): void => {
  trackEvent('calendar_year_change', {
    from_year: fromYear,
    to_year: toYear,
    year_difference: toYear - fromYear,
    direction: toYear > fromYear ? 'forward' : 'backward',
    timestamp: new Date().toISOString()
  });
};

// Track race card interactions
export const trackRaceCardClick = (race: any): void => {
  const raceDate = new Date(race.date);
  const now = new Date();
  const daysUntilRace = Math.ceil((raceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  trackEvent('race_card_click', {
    race_name: race.raceName,
    race_round: parseInt(race.round),
    race_season: parseInt(race.season),
    circuit_name: race.Circuit?.circuitName,
    country: race.Circuit?.Location?.country,
    locality: race.Circuit?.Location?.locality,
    has_sprint: !!race.Sprint,
    race_status: daysUntilRace < 0 ? 'completed' : daysUntilRace === 0 ? 'today' : 'upcoming',
    days_until_race: daysUntilRace,
    timestamp: new Date().toISOString()
  });
};

// Track map interactions
export const trackMapInteraction = (action: string, data?: any): void => {
  trackEvent('calendar_map_interaction', {
    action: action, // 'race_marker_click', 'race_hover', 'zoom', 'rotate', 'search', 'filter_toggle'
    year: data?.year,
    race_data: data?.race ? {
      race_name: data.race.raceName,
      round: parseInt(data.race.round),
      country: data.race.Circuit?.Location?.country
    } : null,
    search_term: data?.searchTerm,
    filter_type: data?.filterType,
    filter_enabled: data?.filterEnabled,
    zoom_level: data?.zoomLevel,
    detail_level: data?.detailLevel,
    timestamp: new Date().toISOString()
  });
};

// Track race detail dialog interactions
export const trackRaceDetailDialog = (action: string, race: any, data?: any): void => {
  trackEvent('race_detail_dialog', {
    action: action, // 'open', 'close', 'tab_change', 'view_analysis'
    race_name: race.raceName,
    race_round: parseInt(race.round),
    race_season: parseInt(race.season),
    country: race.Circuit?.Location?.country,
    has_sprint: !!race.Sprint,
    selected_tab: data?.selectedTab,
    previous_tab: data?.previousTab,
    time_spent_seconds: data?.timeSpent,
    timestamp: new Date().toISOString()
  });
};

// Track session schedule interactions
export const trackSessionScheduleView = (race: any, sessions: string[]): void => {
  trackEvent('session_schedule_view', {
    race_name: race.raceName,
    race_round: parseInt(race.round),
    race_season: parseInt(race.season),
    sessions_available: sessions,
    session_count: sessions.length,
    has_sprint_qualifying: sessions.includes('SprintQualifying'),
    has_sprint: sessions.includes('Sprint'),
    has_practice_3: sessions.includes('ThirdPractice'),
    timestamp: new Date().toISOString()
  });
};

// Track race results viewing
export const trackRaceResultsView = (race: any, resultType: 'race' | 'qualifying' | 'sprint', resultCount: number): void => {
  trackEvent('race_results_view', {
    result_type: resultType,
    race_name: race.raceName,
    race_round: parseInt(race.round),
    race_season: parseInt(race.season),
    country: race.Circuit?.Location?.country,
    driver_count: resultCount,
    view_mode: window.innerWidth < 640 ? 'mobile' : 'desktop',
    timestamp: new Date().toISOString()
  });
};

// Track driver/team interactions in results
export const trackDriverTeamInteraction = (driver: any, constructor: any, context: string): void => {
  trackEvent('driver_team_interaction', {
    context: context, // 'results_view', 'qualifying_view', 'sprint_view'
    driver_code: driver.code,
    driver_name: `${driver.givenName} ${driver.familyName}`,
    constructor_name: constructor.name,
    constructor_id: constructor.constructorId,
    timestamp: new Date().toISOString()
  });
};

// Track calendar filtering and search
export const trackCalendarFilter = (filterType: string, filterValue: any, resultsCount: number): void => {
  trackEvent('calendar_filter', {
    filter_type: filterType, // 'search', 'race_status', 'race_type'
    filter_value: filterValue,
    results_count: resultsCount,
    filter_effectiveness: resultsCount > 0 ? 'effective' : 'no_results',
    timestamp: new Date().toISOString()
  });
};

// Track "View Analysis" button clicks
export const trackViewAnalysisClick = (race: any): void => {
  trackEvent('view_analysis_click', {
    race_name: race.raceName,
    race_round: parseInt(race.round),
    race_season: parseInt(race.season),
    country: race.Circuit?.Location?.country,
    source: 'race_detail_dialog',
    timestamp: new Date().toISOString()
  });
  
  // Also track as a conversion goal
  trackGoal('race_analysis_viewed', 1);
};

// Track calendar engagement summary
export const trackCalendarSession = (sessionData: {
  timeSpent: number;
  racesViewed: number;
  detailDialogsOpened: number;
  yearChanges: number;
  mapInteractions: number;
  searchQueries: number;
  filtersUsed: number;
}): void => {
  trackEvent('calendar_session_summary', {
    time_spent_seconds: sessionData.timeSpent,
    races_viewed: sessionData.racesViewed,
    detail_dialogs_opened: sessionData.detailDialogsOpened,
    year_changes: sessionData.yearChanges,
    map_interactions: sessionData.mapInteractions,
    search_queries: sessionData.searchQueries,
    filters_used: sessionData.filtersUsed,
    engagement_level: sessionData.timeSpent > 300 ? 'high' : sessionData.timeSpent > 120 ? 'medium' : 'low',
    timestamp: new Date().toISOString()
  });
};

// Google Analytics Component
const GoogleAnalytics = () => {
  const location = useLocation();
  
  useEffect(() => {
    if (!isGaEnabled) return;
    if (typeof window !== 'undefined') {
      trackPageView(location.pathname + location.search);
    }
  }, [location]);
  
  return null; // This component doesn't render anything
};

export default GoogleAnalytics; 
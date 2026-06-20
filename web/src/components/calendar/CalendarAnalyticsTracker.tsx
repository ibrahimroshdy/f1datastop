import React, { useEffect, useState, useRef } from 'react';
import { 
  trackCalendarPageView, 
  trackCalendarSession, 
  trackCalendarYearChange, 
  trackRaceCardClick,
  trackMapInteraction,
  trackRaceDetailDialog,
  trackSessionScheduleView,
  trackRaceResultsView,
  trackDriverTeamInteraction,
  trackCalendarFilter,
  trackViewAnalysisClick
} from '@/integrations/google-analytics/GA4.tsx';

interface CalendarAnalyticsTrackerProps {
  selectedYear: number;
  viewType?: 'list' | 'map';
  children: React.ReactNode;
}

// Global session tracking variables
let calendarSessionData = {
  timeSpent: 0,
  racesViewed: 0,
  detailDialogsOpened: 0,
  yearChanges: 0,
  mapInteractions: 0,
  searchQueries: 0,
  filtersUsed: 0,
  startTime: Date.now(),
  lastYear: new Date().getFullYear()
};

const CalendarAnalyticsTracker: React.FC<CalendarAnalyticsTrackerProps> = ({ 
  selectedYear, 
  viewType = 'list', 
  children 
}) => {
  const [hasTrackedPageView, setHasTrackedPageView] = useState(false);
  const previousYear = useRef(selectedYear);
  
  // Track page view on mount
  useEffect(() => {
    if (!hasTrackedPageView) {
      trackCalendarPageView(selectedYear, viewType);
      setHasTrackedPageView(true);
      calendarSessionData.startTime = Date.now();
      calendarSessionData.lastYear = selectedYear;
    }
  }, [selectedYear, viewType, hasTrackedPageView]);

  // Track year changes
  useEffect(() => {
    if (previousYear.current !== selectedYear && hasTrackedPageView) {
      trackCalendarYearChange(previousYear.current, selectedYear);
      calendarSessionData.yearChanges++;
      calendarSessionData.lastYear = selectedYear;
    }
    previousYear.current = selectedYear;
  }, [selectedYear, hasTrackedPageView]);

  // Track session summary on unmount or page change
  useEffect(() => {
    const handleBeforeUnload = () => {
      calendarSessionData.timeSpent = Math.floor((Date.now() - calendarSessionData.startTime) / 1000);
      trackCalendarSession(calendarSessionData);
    };

    const handlePageChange = () => {
      calendarSessionData.timeSpent = Math.floor((Date.now() - calendarSessionData.startTime) / 1000);
      trackCalendarSession(calendarSessionData);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Track session when leaving the calendar page
    return () => {
      handlePageChange();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Provide tracking functions to child components via context or global window
  useEffect(() => {
    // Attach tracking functions to window for easy access by child components
    (window as any).calendarAnalytics = {
      trackRaceCardClick: (race: any) => {
        trackRaceCardClick(race);
        calendarSessionData.racesViewed++;
      },
      
      trackMapInteraction: (action: string, data?: any) => {
        trackMapInteraction(action, { ...data, year: selectedYear });
        calendarSessionData.mapInteractions++;
      },
      
      trackRaceDetailDialog: (action: string, race: any, data?: any) => {
        trackRaceDetailDialog(action, race, data);
        if (action === 'open') {
          calendarSessionData.detailDialogsOpened++;
        }
      },
      
      trackSessionScheduleView: (race: any, sessions: string[]) => {
        trackSessionScheduleView(race, sessions);
      },
      
      trackRaceResultsView: (race: any, resultType: 'race' | 'qualifying' | 'sprint', resultCount: number) => {
        trackRaceResultsView(race, resultType, resultCount);
      },
      
      trackDriverTeamInteraction: (driver: any, constructor: any, context: string) => {
        trackDriverTeamInteraction(driver, constructor, context);
      },
      
      trackCalendarFilter: (filterType: string, filterValue: any, resultsCount: number) => {
        trackCalendarFilter(filterType, filterValue, resultsCount);
        calendarSessionData.filtersUsed++;
        if (filterType === 'search') {
          calendarSessionData.searchQueries++;
        }
      },
      
      trackViewAnalysisClick: (race: any) => {
        trackViewAnalysisClick(race);
      }
    };

    // Cleanup
    return () => {
      delete (window as any).calendarAnalytics;
    };
  }, [selectedYear]);

  return <>{children}</>;
};

export default CalendarAnalyticsTracker; 
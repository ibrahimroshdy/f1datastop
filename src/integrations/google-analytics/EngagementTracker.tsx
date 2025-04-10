import React, { useEffect, useState, useRef } from 'react';
import { trackEvent } from './GA4';

// Maximum scroll depth reached
let maxScrollDepth = 0;
// Session start time
let sessionStartTime = Date.now();
// Is this the first page in the session
let isFirstPage = true;

interface EngagementTrackerProps {
  trackScrollDepth?: boolean;
  trackTimeOnPage?: boolean;
  trackInactivity?: boolean;
  scrollThresholds?: number[]; // Scroll depth percentage thresholds
  timeThresholds?: number[]; // Time thresholds in seconds
  inactivityThreshold?: number; // Time in seconds before considered inactive
}

const EngagementTracker: React.FC<EngagementTrackerProps> = ({
  trackScrollDepth = true,
  trackTimeOnPage = true,
  trackInactivity = true,
  scrollThresholds = [25, 50, 75, 90],
  timeThresholds = [10, 30, 60, 120, 300],
  inactivityThreshold = 120 // 2 minutes
}) => {
  const [visitStartTime] = useState(Date.now());
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const [isInactive, setIsInactive] = useState(false);
  const thresholdsReached = useRef<{
    scroll: number[];
    time: number[];
  }>({
    scroll: [],
    time: []
  });

  // Initialize session
  useEffect(() => {
    if (isFirstPage) {
      sessionStartTime = Date.now();
      isFirstPage = false;
      // Track session start
      trackEvent('session_start', {
        referrer: document.referrer || 'direct',
        landing_page: window.location.pathname
      });
    }

    // Track page view start time
    trackEvent('page_engagement', {
      event_type: 'page_view_start',
      url: window.location.pathname,
      timestamp: new Date().toISOString()
    });

    // Set up session tracking
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Track time spent on page when component unmounts
      trackTimeSpent(false);
      
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, []);

  // Track scroll depth
  useEffect(() => {
    if (!trackScrollDepth) return;

    const handleScroll = () => {
      // Calculate scroll depth as percentage
      const docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.body.clientHeight,
        document.documentElement.clientHeight
      );

      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const trackLength = docHeight - windowHeight;
      const scrollPercent = Math.floor((scrollTop / trackLength) * 100);

      // Update max scroll depth
      if (scrollPercent > maxScrollDepth) {
        maxScrollDepth = scrollPercent;

        // Check if we've passed any thresholds
        scrollThresholds.forEach(threshold => {
          if (
            scrollPercent >= threshold &&
            !thresholdsReached.current.scroll.includes(threshold)
          ) {
            thresholdsReached.current.scroll.push(threshold);
            trackEvent('scroll_depth', {
              scroll_percent: threshold,
              page_path: window.location.pathname,
              page_title: document.title
            });
          }
        });
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [trackScrollDepth, scrollThresholds]);

  // Track time spent on page
  useEffect(() => {
    if (!trackTimeOnPage) return;
    
    const timeInterval = setInterval(() => {
      trackTimeSpent(true);
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(timeInterval);
  }, [trackTimeOnPage, timeThresholds]);

  // Track user inactivity
  useEffect(() => {
    if (!trackInactivity) return;
    
    // Reset inactivity timer on user interactions
    const resetInactivityTimer = () => {
      if (isInactive) {
        // User became active again
        setIsInactive(false);
        trackEvent('user_activity', {
          event_type: 'active',
          inactive_duration: 'calculated_on_server',
          url: window.location.pathname
        });
      }
      
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      
      inactivityTimer.current = setTimeout(() => {
        setIsInactive(true);
        trackEvent('user_activity', {
          event_type: 'inactive',
          threshold_seconds: inactivityThreshold,
          url: window.location.pathname
        });
      }, inactivityThreshold * 1000);
    };
    
    // Add event listeners for user activity
    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
    events.forEach(event => {
      window.addEventListener(event, resetInactivityTimer);
    });
    
    // Initial setup
    resetInactivityTimer();
    
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
      
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, [trackInactivity, inactivityThreshold, isInactive]);

  // Track time spent on page
  const trackTimeSpent = (isInterval: boolean) => {
    const timeSpent = Math.floor((Date.now() - visitStartTime) / 1000);
    
    // Check for time thresholds
    timeThresholds.forEach(threshold => {
      if (
        timeSpent >= threshold &&
        !thresholdsReached.current.time.includes(threshold)
      ) {
        thresholdsReached.current.time.push(threshold);
        trackEvent('time_on_page', {
          time_seconds: threshold,
          page_path: window.location.pathname,
          page_title: document.title
        });
      }
    });
    
    // For the final tracking when component unmounts or page changes
    if (!isInterval) {
      trackEvent('page_engagement', {
        event_type: 'page_view_end',
        url: window.location.pathname,
        time_spent_seconds: timeSpent,
        max_scroll_depth: maxScrollDepth
      });
    }
  };

  // Handling session duration when the page is about to unload
  const handleBeforeUnload = () => {
    const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
    trackEvent('session_end', {
      session_duration_seconds: sessionDuration,
      pages_viewed: getPagesViewedCount(),
      exit_page: window.location.pathname
    });
  };

  // Get number of pages viewed in this session
  const getPagesViewedCount = () => {
    try {
      // This could be stored in sessionStorage in a real implementation
      return 1;
    } catch (e) {
      return 1;
    }
  };

  // This component doesn't render anything
  return null;
};

export default EngagementTracker; 
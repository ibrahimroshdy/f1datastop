import React, { useEffect, useState, useRef } from 'react';
import { trackEvent } from './GA4';

// Maximum scroll depth reached
let maxScrollDepth = 0;
// Session start time
let sessionStartTime = Date.now();
// Is this the first page in the session
let isFirstPage = true;
// Store navigation path history
let navigationHistory: string[] = [];
// Store user interactions for session replay
let userInteractions: {event: string, timestamp: number, data: any}[] = [];

interface EngagementTrackerProps {
  trackScrollDepth?: boolean;
  trackTimeOnPage?: boolean;
  trackInactivity?: boolean;
  trackSession?: boolean; // Added session tracking option
  scrollThresholds?: number[]; // Scroll depth percentage thresholds
  timeThresholds?: number[]; // Time thresholds in seconds
  inactivityThreshold?: number; // Time in seconds before considered inactive
  sessionSampleRate?: number; // Rate at which to sample detailed session data (0-100)
}

const EngagementTracker: React.FC<EngagementTrackerProps> = ({
  trackScrollDepth = true,
  trackTimeOnPage = true,
  trackInactivity = true,
  trackSession = true, // Enable session tracking by default
  scrollThresholds = [25, 50, 75, 90],
  timeThresholds = [10, 30, 60, 120, 300],
  inactivityThreshold = 120, // 2 minutes
  sessionSampleRate = 10 // 10% of sessions will be tracked in detail
}) => {
  const [visitStartTime] = useState(Date.now());
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const [isInactive, setIsInactive] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [shouldRecordDetailed, setShouldRecordDetailed] = useState(false);
  const thresholdsReached = useRef<{
    scroll: number[];
    time: number[];
  }>({
    scroll: [],
    time: []
  });

  // Generate session ID
  const generateSessionId = () => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  };

  // Initialize session
  useEffect(() => {
    if (isFirstPage) {
      // Generate session ID
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
      
      // Determine if this session should be recorded in detail
      const shouldRecord = Math.random() * 100 < sessionSampleRate;
      setShouldRecordDetailed(shouldRecord);
      
      sessionStartTime = Date.now();
      isFirstPage = false;
      navigationHistory = [window.location.pathname];
      
      // Track session start
      trackEvent('session_start', {
        session_id: newSessionId,
        referrer: document.referrer || 'direct',
        landing_page: window.location.pathname,
        detailed_recording: shouldRecord,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString()
      });
    } else {
      // Add page to navigation history
      navigationHistory.push(window.location.pathname);
    }

    // Track page view start time
    trackEvent('page_engagement', {
      session_id: sessionId,
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

  // Track user interactions if detailed recording is enabled
  useEffect(() => {
    if (!trackSession || !shouldRecordDetailed) return;
    
    const captureInteraction = (event: MouseEvent | KeyboardEvent | TouchEvent) => {
      const interactionData: any = {
        type: event.type,
        timestamp: Date.now()
      };
      
      // For mouse events, capture position
      if (event instanceof MouseEvent) {
        interactionData.x = event.clientX;
        interactionData.y = event.clientY;
        interactionData.target = (event.target as HTMLElement)?.tagName || 'unknown';
      }
      
      // Store interaction
      userInteractions.push({
        event: event.type,
        timestamp: Date.now(),
        data: interactionData
      });
      
      // If we've collected a significant amount, send a batch
      if (userInteractions.length >= 20) {
        sendInteractionBatch();
      }
    };
    
    // Add event listeners for key interactions
    const events = ['click', 'keypress', 'touchstart'];
    events.forEach(eventType => {
      window.addEventListener(eventType, captureInteraction as EventListener);
    });
    
    return () => {
      events.forEach(eventType => {
        window.removeEventListener(eventType, captureInteraction as EventListener);
      });
      
      // Send any remaining interactions
      if (userInteractions.length > 0) {
        sendInteractionBatch();
      }
    };
  }, [trackSession, shouldRecordDetailed, sessionId]);

  // Send batch of user interactions to analytics
  const sendInteractionBatch = () => {
    if (userInteractions.length === 0) return;
    
    trackEvent('session_interactions', {
      session_id: sessionId,
      interactions: JSON.stringify(userInteractions.slice(0, 20)),
      page_path: window.location.pathname,
      timestamp: new Date().toISOString()
    });
    
    // Clear sent interactions
    userInteractions = userInteractions.slice(20);
  };

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
              session_id: sessionId,
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
  }, [trackScrollDepth, scrollThresholds, sessionId]);

  // Track time spent on page
  useEffect(() => {
    if (!trackTimeOnPage) return;
    
    const timeInterval = setInterval(() => {
      trackTimeSpent(true);
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(timeInterval);
  }, [trackTimeOnPage, timeThresholds, sessionId]);

  // Track user inactivity
  useEffect(() => {
    if (!trackInactivity) return;
    
    // Reset inactivity timer on user interactions
    const resetInactivityTimer = () => {
      if (isInactive) {
        // User became active again
        setIsInactive(false);
        trackEvent('user_activity', {
          session_id: sessionId,
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
          session_id: sessionId,
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
  }, [trackInactivity, inactivityThreshold, isInactive, sessionId]);

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
          session_id: sessionId,
          time_seconds: threshold,
          page_path: window.location.pathname,
          page_title: document.title
        });
      }
    });
    
    // For the final tracking when component unmounts or page changes
    if (!isInterval) {
      trackEvent('page_engagement', {
        session_id: sessionId,
        event_type: 'page_view_end',
        url: window.location.pathname,
        time_spent_seconds: timeSpent,
        max_scroll_depth: maxScrollDepth
      });
    }
  };

  // Handling session duration when the page is about to unload
  const handleBeforeUnload = () => {
    // Send any remaining interactions
    if (userInteractions.length > 0) {
      sendInteractionBatch();
    }
    
    const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
    trackEvent('session_end', {
      session_id: sessionId,
      session_duration_seconds: sessionDuration,
      pages_viewed: navigationHistory.length,
      navigation_path: JSON.stringify(navigationHistory),
      exit_page: window.location.pathname
    });
  };

  // Get number of pages viewed in this session
  const getPagesViewedCount = () => {
    return navigationHistory.length;
  };

  // This component doesn't render anything
  return null;
};

export default EngagementTracker; 
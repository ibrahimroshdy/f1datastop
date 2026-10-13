import React, { useEffect, useState, useRef } from 'react';
import { trackEvent } from './GA4.tsx';
import { getScrollContainer, newThresholds, scrollPercent, VisibleClock } from './engagementUtils';

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
// Throttle flags to prevent too many events
let lastScrollEventTime = 0;
let lastTimeEventTime = 0;

// Safely track events with error handling
const safeTrackEvent = (eventName: string, eventParams?: Record<string, any>) => {
  try {
    trackEvent(eventName, eventParams);
  } catch (error) {
    // Silent error in production
    if (process.env.NODE_ENV === 'development') {
      console.error(`[Engagement] Error tracking ${eventName}:`, error);
    }
  }
};

interface EngagementTrackerProps {
  trackScrollDepth?: boolean;
  trackTimeOnPage?: boolean;
  trackSession?: boolean; // Added session tracking option
  scrollThresholds?: number[]; // Scroll depth percentage thresholds
  timeThresholds?: number[]; // Time thresholds in seconds
  sessionSampleRate?: number; // Rate at which to sample detailed session data (0-100)
}

const EngagementTracker: React.FC<EngagementTrackerProps> = ({
  trackScrollDepth = true,
  trackTimeOnPage = true,
  trackSession = true, // Enable session tracking by default
  scrollThresholds = [25, 50, 75, 90],
  timeThresholds = [10, 30, 60, 120, 300],
  sessionSampleRate = 10 // 10% of sessions will be tracked in detail
}) => {
  const clock = useRef(new VisibleClock(Date.now(), typeof document === 'undefined' || !document.hidden));
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
    try {
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
        safeTrackEvent('session_start', {
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

      // Track page view start time (only if not already tracking too many events)
      if (Date.now() - lastTimeEventTime > 5000) {
        lastTimeEventTime = Date.now();
        safeTrackEvent('page_engagement', {
          session_id: sessionId,
          event_type: 'page_view_start',
          url: window.location.pathname,
          timestamp: new Date().toISOString()
        });
      }

      // Set up session tracking
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        // Track time spent on page when component unmounts
        trackTimeSpent(false);
      };
    } catch (error) {
      console.error('[Engagement] Error in initialization:', error);
    }
  }, []);

  // Track user interactions if detailed recording is enabled
  useEffect(() => {
    if (!trackSession || !shouldRecordDetailed) return;
    
    try {
      const captureInteraction = (event: MouseEvent | KeyboardEvent | TouchEvent) => {
        // Throttle events - max 1 per second
        if (Date.now() - lastTimeEventTime < 1000) return;
        lastTimeEventTime = Date.now();

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
    } catch (error) {
      console.error('[Engagement] Error in interaction tracking:', error);
    }
  }, [trackSession, shouldRecordDetailed, sessionId]);

  // Send batch of user interactions to analytics
  const sendInteractionBatch = () => {
    if (userInteractions.length === 0) return;
    
    try {
      safeTrackEvent('session_interactions', {
        session_id: sessionId,
        interactions: JSON.stringify(userInteractions.slice(0, 20)),
        page_path: window.location.pathname,
        timestamp: new Date().toISOString()
      });
      
      // Clear sent interactions
      userInteractions = userInteractions.slice(20);
    } catch (error) {
      console.error('[Engagement] Error sending interaction batch:', error);
      // Clear the interactions to prevent buildup if there's an error
      userInteractions = [];
    }
  };

  // Track scroll depth on the element that really scrolls (see engagementUtils).
  useEffect(() => {
    if (!trackScrollDepth) return;

    const container = getScrollContainer();
    // When the container is the document, scroll events fire on window, not on <html>.
    const target: HTMLElement | Window = container === document.documentElement ? window : container;

    const handleScroll = () => {
      if (Date.now() - lastScrollEventTime < 500) return;
      const percent = scrollPercent(container);
      if (percent === null || percent <= maxScrollDepth) return;
      maxScrollDepth = percent;
      newThresholds(percent, scrollThresholds, thresholdsReached.current.scroll).forEach((threshold) => {
        lastScrollEventTime = Date.now();
        thresholdsReached.current.scroll.push(threshold);
        safeTrackEvent('scroll_depth', {
          session_id: sessionId,
          scroll_percent: threshold,
          page_path: window.location.pathname,
          page_title: document.title
        });
      });
    };

    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, [trackScrollDepth, scrollThresholds, sessionId]);

  // Track time on page. Time only counts while the tab is visible, the interval is
  // paused while hidden, and it stops for good once the last threshold has been sent,
  // so an idle or background tab cannot keep a GA session alive or start new ones.
  useEffect(() => {
    if (!trackTimeOnPage) return;

    let timeInterval: ReturnType<typeof setInterval> | null = null;
    const lastThreshold = Math.max(...timeThresholds);
    const stop = () => {
      if (timeInterval) clearInterval(timeInterval);
      timeInterval = null;
    };
    const start = () => {
      if (timeInterval || document.hidden) return;
      if (thresholdsReached.current.time.includes(lastThreshold)) return;
      timeInterval = setInterval(() => {
        trackTimeSpent(true);
        if (thresholdsReached.current.time.includes(lastThreshold)) stop();
      }, 10000);
    };
    const onVisibility = () => {
      clock.current.setVisible(!document.hidden, Date.now());
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [trackTimeOnPage, timeThresholds, sessionId]);

  // Track time spent on page
  const trackTimeSpent = (isInterval: boolean) => {
    try {
      const timeSpent = clock.current.seconds(Date.now());
      
      // Check for time thresholds
      newThresholds(timeSpent, timeThresholds, thresholdsReached.current.time).forEach(threshold => {
        {
          thresholdsReached.current.time.push(threshold);
          safeTrackEvent('time_on_page', {
            session_id: sessionId,
            time_seconds: threshold,
            page_path: window.location.pathname,
            page_title: document.title
          });
        }
      });
      
      // For the final tracking when component unmounts or page changes
      if (!isInterval) {
        safeTrackEvent('page_engagement', {
          session_id: sessionId,
          event_type: 'page_view_end',
          url: window.location.pathname,
          time_spent_seconds: timeSpent,
          max_scroll_depth: maxScrollDepth
        });
      }
    } catch (error) {
      console.error('[Engagement] Error tracking time spent:', error);
    }
  };

  // Handling session duration when the page is about to unload
  const handleBeforeUnload = () => {
    try {
      // Send any remaining interactions
      if (userInteractions.length > 0) {
        sendInteractionBatch();
      }
      
      const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
      safeTrackEvent('session_end', {
        session_id: sessionId,
        session_duration_seconds: sessionDuration,
        pages_viewed: navigationHistory.length,
        navigation_path: JSON.stringify(navigationHistory),
        exit_page: window.location.pathname
      });
    } catch (error) {
      console.error('[Engagement] Error in beforeunload handler:', error);
    }
  };

  // This component doesn't render anything
  return null;
};

export default EngagementTracker; 
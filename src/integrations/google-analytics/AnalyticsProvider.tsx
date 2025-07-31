import { ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView, initializeGA, trackPerformance, trackDeviceInfo, trackError } from './GA4.tsx';
import EngagementTracker from './EngagementTracker';

interface AnalyticsProviderProps {
  children: ReactNode;
}

// Initialize Google Analytics with direct gtag implementation
const initializeAnalytics = () => {
  if (typeof window !== 'undefined') {
    initializeGA();
    
    // Track device info once per session
    setTimeout(() => {
      trackDeviceInfo();
    }, 1000);
    
    // Set up global error tracking
    window.addEventListener('error', (event) => {
      trackError(event.error, {
        filename: event.filename,
        line: event.lineno,
        column: event.colno
      });
    });
    
    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      trackError(new Error(`Unhandled Promise Rejection: ${event.reason}`), {
        type: 'promise_rejection'
      });
    });
  }
};

// Call initializeAnalytics on module load
initializeAnalytics();

const AnalyticsProvider = ({ children }: AnalyticsProviderProps) => {
  const location = useLocation();
  
  // Track page views and performance on route change
  useEffect(() => {
    trackPageView(location.pathname + location.search);
    
    // Track performance metrics after a short delay
    setTimeout(() => {
      trackPerformance();
    }, 1500);
  }, [location]);

  return (
    <>
      {/* Add user engagement tracking */}
      <EngagementTracker 
        trackScrollDepth={true}
        trackTimeOnPage={true}
        trackInactivity={true}
      />
      
      {children}
    </>
  );
};

export default AnalyticsProvider; 
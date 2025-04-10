import { ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from './GA4';
import EngagementTracker from './EngagementTracker';
import { initAnalytics } from '../firebase/config';

interface AnalyticsProviderProps {
  children: ReactNode;
}

// Initialize Firebase Analytics
const initializeAnalytics = () => {
  if (typeof window !== 'undefined') {
    initAnalytics();
  }
};

// Call initializeAnalytics on module load
initializeAnalytics();

const AnalyticsProvider = ({ children }: AnalyticsProviderProps) => {
  const location = useLocation();
  
  // Track page views on route change
  useEffect(() => {
    trackPageView(location.pathname + location.search);
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
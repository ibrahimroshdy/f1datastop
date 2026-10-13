import { ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isGaEnabled } from '@/config/integrations';
import { trackPerformance, trackDeviceInfo, trackError } from './GA4.tsx';
import EngagementTracker from './EngagementTracker';

interface AnalyticsProviderProps {
  children: ReactNode;
}

const initializeAnalytics = () => {
  if (!isGaEnabled || typeof window === 'undefined') return;

  setTimeout(() => {
    trackDeviceInfo();
  }, 1000);

  window.addEventListener('error', (event) => {
    trackError(event.error, {
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    trackError(new Error(`Unhandled Promise Rejection: ${event.reason}`), {
      type: 'promise_rejection',
    });
  });
};

if (isGaEnabled) {
  initializeAnalytics();
}

const AnalyticsProvider = ({ children }: AnalyticsProviderProps) => {
  const location = useLocation();
  // Page views are NOT sent from here. index.html's gtag('config') counts the first
  // load, and GA4 Enhanced Measurement ("page changes based on browser history
  // events", on by default) counts every SPA route change from history.pushState.
  // Sending a manual page_view as well double-counted every navigation.
  useEffect(() => {
    if (!isGaEnabled) return;

    const timer = setTimeout(() => {
      trackPerformance();
    }, 1500);

    return () => clearTimeout(timer);
  }, [location]);

  if (!isGaEnabled) {
    return <>{children}</>;
  }

  return (
    <>
      <EngagementTracker
        trackScrollDepth={true}
        trackTimeOnPage={true}
      />
      {children}
    </>
  );
};

export default AnalyticsProvider;

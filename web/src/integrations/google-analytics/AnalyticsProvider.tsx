import { ReactNode, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { isGaEnabled } from '@/config/integrations';
import { trackPageView, initializeGA, trackPerformance, trackDeviceInfo, trackError } from './GA4.tsx';
import EngagementTracker from './EngagementTracker';

interface AnalyticsProviderProps {
  children: ReactNode;
}

const initializeAnalytics = () => {
  if (!isGaEnabled || typeof window === 'undefined') return;

  initializeGA();

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
  // index.html's gtag config already auto-sends the FIRST page_view. Skip the
  // initial render here so the landing page isn't counted twice; send manual
  // page_views only on subsequent SPA route changes.
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!isGaEnabled) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
    } else {
      trackPageView(location.pathname + location.search);
    }

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
        trackInactivity={true}
      />
      {children}
    </>
  );
};

export default AnalyticsProvider;

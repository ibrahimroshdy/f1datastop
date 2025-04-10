import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Replace with your actual measurement ID
const GA_MEASUREMENT_ID = 'G-1Y6GKNVD2J';

// Interface for the gtag function
interface GTagFunction {
  (command: 'js', date: Date): void;
  (command: 'config', targetId: string, config?: object): void;
  (command: 'event', eventName: string, eventParams?: object): void;
}

// Extend Window interface to include gtag
declare global {
  interface Window {
    dataLayer: any[];
    gtag: GTagFunction;
  }
}

// Initialize Google Analytics
export const initializeGA = () => {
  // Create script for Google Analytics
  const gtagScript = document.createElement('script');
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(gtagScript);

  // Initialize the dataLayer
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false, // We'll handle page views manually
  });
};

// Helper function to track page views
export const trackPageView = (url: string) => {
  if (!window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: url,
    page_location: window.location.href,
    page_title: document.title,
  });
};

// Helper function to track events
export const trackEvent = (
  eventName: string, 
  eventParams?: Record<string, any>
) => {
  if (!window.gtag) return;
  window.gtag('event', eventName, eventParams);
};

// Google Analytics Component
const GoogleAnalytics = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Initialize GA on first render
    if (!window.gtag) {
      initializeGA();
    }
  }, []);
  
  useEffect(() => {
    // Track page views on route change
    trackPageView(location.pathname + location.search);
  }, [location]);
  
  return null; // This component doesn't render anything
};

export default GoogleAnalytics; 
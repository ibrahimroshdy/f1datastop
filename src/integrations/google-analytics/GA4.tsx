import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Replace with your actual measurement ID
const GA_MEASUREMENT_ID = 'G-1Y6GKNVD2J';

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

// Initialize Google Analytics
export const initializeGA = () => {
  // Skip if already initialized
  if (window.gtag) return;
  
  // Create script for Google Analytics
  const gtagScript = document.createElement('script');
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  
  // Handle script load errors
  gtagScript.onerror = () => {
    console.error('[GA4] Failed to load Google Analytics script');
  };
  
  document.head.appendChild(gtagScript);

  // Initialize the dataLayer
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false, // We'll handle page views manually
    cookie_flags: 'samesite=none;secure', // Ensure cookies work properly
    cookie_domain: window.location.hostname,
    user_id: getUserId(), // Use user ID if available
    session_timeout: 30, // 30 minutes session timeout (default)
  });
};

// Get a user ID from localStorage if available
const getUserId = (): string | undefined => {
  try {
    return localStorage.getItem('userId') || undefined;
  } catch (e) {
    return undefined;
  }
};

// Helper function to track page views
export const trackPageView = (url: string) => {
  if (!window.gtag) {
    initializeGA(); // Initialize if not done yet
  }
  
  try {
    window.gtag('event', 'page_view', {
      page_path: url,
      page_location: window.location.href,
      page_title: document.title,
      send_to: GA_MEASUREMENT_ID
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
  if (!window.gtag) {
    initializeGA(); // Initialize if not done yet
  }
  
  try {
    // Log event in development environment
    if (process.env.NODE_ENV === 'development') {
      console.log('[GA4 Direct Event]', eventName, eventParams);
    }
    
    // Include timestamp if not provided
    const params = {
      ...eventParams,
      timestamp: eventParams?.timestamp || new Date().toISOString(),
      send_to: GA_MEASUREMENT_ID
    };
    
    window.gtag('event', eventName, params);
  } catch (error) {
    console.error('[GA4] Error tracking event:', error);
  }
};

// Set user ID when known
export const setUserId = (userId: string) => {
  if (!window.gtag) {
    initializeGA(); // Initialize if not done yet
  }
  
  try {
    // Store in localStorage for future visits
    localStorage.setItem('userId', userId);
    
    // Set user ID in GA
    window.gtag('set', { user_id: userId });
    
    // Track user identification event
    trackEvent('user_identified', {
      method: 'explicit_set',
      user_properties: {
        authenticated: true
      }
    });
  } catch (e) {
    console.error('[GA4] Error setting user ID', e);
  }
};

// Google Analytics Component
const GoogleAnalytics = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Initialize GA on first render
    if (typeof window !== 'undefined' && !window.gtag) {
      initializeGA();
    }
  }, []);
  
  useEffect(() => {
    // Track page views on route change
    if (typeof window !== 'undefined') {
      trackPageView(location.pathname + location.search);
    }
  }, [location]);
  
  return null; // This component doesn't render anything
};

export default GoogleAnalytics; 
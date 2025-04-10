import { getAnalytics, logEvent, isSupported } from 'firebase/analytics';
import { app } from '../firebase/config';

/**
 * Track an event in Google Analytics
 * @param eventName The name of the event to track
 * @param eventParams Additional parameters to include with the event
 */
export const trackEvent = async (eventName: string, eventParams?: Record<string, any>): Promise<void> => {
  try {
    // Check if analytics is supported in this environment
    if (await isSupported()) {
      const analytics = getAnalytics(app);
      logEvent(analytics, eventName, eventParams);
      
      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[GA4 Event]', eventName, eventParams);
      }
    }
  } catch (error) {
    // Silent fail in production, log in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[GA4 Error]', error);
    }
  }
};

/**
 * Initialize page view tracking
 * Can be called in app layout or on route changes
 */
export const trackPageView = async (url?: string): Promise<void> => {
  const pageUrl = url || window.location.pathname + window.location.search;
  
  await trackEvent('page_view', {
    page_location: pageUrl,
    page_title: document.title,
    page_referrer: document.referrer
  });
};

/**
 * Enhanced e-commerce: Track product view
 */
export const trackProductView = (product: {
  id: string;
  name: string;
  price?: number;
  category?: string;
  variant?: string;
}): void => {
  trackEvent('view_item', {
    currency: 'USD',
    value: product.price,
    items: [{
      item_id: product.id,
      item_name: product.name,
      price: product.price,
      item_category: product.category,
      item_variant: product.variant
    }]
  });
};

/**
 * Track user login
 */
export const trackLogin = (method: string): void => {
  trackEvent('login', {
    method
  });
};

/**
 * Track user signup
 */
export const trackSignup = (method: string): void => {
  trackEvent('sign_up', {
    method
  });
};

/**
 * Track form submission
 */
export const trackFormSubmission = (formName: string, success: boolean): void => {
  trackEvent('form_submit', {
    form_name: formName,
    success
  });
};

/**
 * Track search
 */
export const trackSearch = (searchTerm: string): void => {
  trackEvent('search', {
    search_term: searchTerm
  });
};

/**
 * Track outbound link clicks
 */
export const trackOutboundLink = (url: string): void => {
  trackEvent('click', {
    content_type: 'link',
    item_id: url
  });
};

/**
 * Track download
 */
export const trackDownload = (fileName: string, fileType: string): void => {
  trackEvent('file_download', {
    file_name: fileName,
    file_type: fileType
  });
}; 
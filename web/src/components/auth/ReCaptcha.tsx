import { useEffect, useRef } from 'react';
import { RECAPTCHA } from '@/constants/apiConfig';
import { isRecaptchaEnabled } from '@/config/integrations';

// Define the props for the ReCaptcha component
interface ReCaptchaProps {
  sitekey?: string;
  onChange: (token: string) => void;
  theme?: 'light' | 'dark';
  size?: 'normal' | 'compact';
  version?: 'v2' | 'v3';  // Support both v2 and v3
  hideBadge?: boolean;    // Option to hide the badge
}

// Check if the Google reCAPTCHA script is already loaded
const isReCaptchaScriptLoaded = () => {
  return typeof window !== 'undefined' && typeof window.grecaptcha !== 'undefined';
};

// Load the Google reCAPTCHA script dynamically
const loadReCaptchaScript = (version: 'v2' | 'v3', callback: () => void) => {
  // Skip if script is already loaded
  if (isReCaptchaScriptLoaded()) {
    callback();
    return;
  }

  // Create the script element
  const script = document.createElement('script');
  
  // Set the src based on the version
  if (version === 'v3') {
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA.SITE_KEY}`;
  } else {
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
  }
  
  script.async = true;
  script.defer = true;

  // Set up the callback for when the script is loaded
  script.onload = callback;

  // Add the script to the document
  document.head.appendChild(script);
};

// Add CSS to hide the badge
const addHideBadgeStyles = () => {
  const style = document.createElement('style');
  style.innerHTML = `
    .grecaptcha-badge { 
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
};

const ReCaptcha = ({ 
  sitekey = RECAPTCHA.SITE_KEY, 
  onChange, 
  theme = 'dark', 
  size = 'normal',
  version = 'v2',
  hideBadge = true
}: ReCaptchaProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const executed = useRef<boolean>(false);
  const enabled = isRecaptchaEnabled && !!sitekey;

  // Initialize v3 reCAPTCHA
  const initializeV3 = () => {
    if (!isReCaptchaScriptLoaded() || !window.grecaptcha.ready) {
      setTimeout(initializeV3, 100);
      return;
    }

    // Wait for grecaptcha to be ready
    window.grecaptcha.ready(() => {
      if (!executed.current) {
        executed.current = true;
        window.grecaptcha.execute(sitekey, { action: 'signup' })
          .then(token => {
            onChange(token);
            // Refresh the token every 2 minutes
            setTimeout(() => {
              executed.current = false;
              initializeV3();
            }, 2 * 60 * 1000);
          })
          .catch(error => {
            console.error("reCAPTCHA execution error:", error);
            onChange('');
          });
      }
    });
  };

  // Initialize v2 reCAPTCHA
  const initializeV2 = () => {
    if (!containerRef.current || widgetId.current !== null) return;

    // Make sure grecaptcha is available
    if (typeof window.grecaptcha === 'undefined' || 
        typeof window.grecaptcha.render === 'undefined') {
      setTimeout(initializeV2, 100);
      return;
    }

    // Render the reCAPTCHA widget
    widgetId.current = window.grecaptcha.render(containerRef.current, {
      sitekey,
      theme,
      size,
      callback: onChange,
      'expired-callback': () => onChange(''),
      'error-callback': () => onChange(''),
    });
  };

  useEffect(() => {
    if (!enabled) return;
    // Add styles to hide badge if requested
    if (hideBadge) {
      addHideBadgeStyles();
    }
    
    // Load the appropriate script based on version
    loadReCaptchaScript(version, () => {
      if (version === 'v3') {
        initializeV3();
      } else {
        initializeV2();
      }
    });

    // Cleanup function
    return () => {
      if (version === 'v2' && widgetId.current !== null && 
          typeof window.grecaptcha !== 'undefined' && 
          typeof window.grecaptcha.reset === 'function') {
        window.grecaptcha.reset(widgetId.current);
      }
    };
  }, [sitekey, version, hideBadge, enabled]);

  if (!enabled) {
    return null;
  }

  // For v3, we need to render a disclaimer instead of the widget
  if (version === 'v3') {
    if (hideBadge) {
      return (
        <div className="text-xs text-muted-foreground mt-3 text-center">
          This site is protected by reCAPTCHA and the Google{" "}
          <a 
            href="https://policies.google.com/privacy" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Privacy Policy
          </a>{" "}
          and{" "}
          <a 
            href="https://policies.google.com/terms" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Terms of Service
          </a>{" "}
          apply.
        </div>
      );
    }
    return null;
  }

  // For v2, render the container for the CAPTCHA widget
  return <div ref={containerRef} className="g-recaptcha mt-4" />;
};

export default ReCaptcha;

// Add type definitions for window object
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      render: (
        container: HTMLElement,
        parameters: {
          sitekey: string;
          theme?: 'light' | 'dark';
          size?: 'normal' | 'compact';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => number;
      reset: (widgetId: number) => void;
      execute: (sitekey: string, options: { action: string }) => Promise<string>;
      getResponse: (widgetId: number) => string;
    };
  }
} 
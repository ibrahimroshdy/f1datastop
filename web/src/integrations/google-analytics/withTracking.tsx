import React from 'react';
import { trackEvent } from './GA4.tsx';

// HOC to automatically track component mounts and interactions
export const withTracking = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string,
  trackInteractions = true
) => {
  // Create a wrapped component with the original component's props
  const WithTracking: React.FC<P> = (props) => {
    // Track component mount
    React.useEffect(() => {
      trackEvent('component_view', {
        component_name: componentName,
        timestamp: new Date().toISOString()
      });

      // Track component unmount
      return () => {
        trackEvent('component_exit', {
          component_name: componentName,
          view_duration: 'calculated_on_exit',
          timestamp: new Date().toISOString()
        });
      };
    }, []);

    // Interaction click tracking (always register effect; no-op when disabled)
    React.useEffect(() => {
      if (!trackInteractions) return;

      const handleInteractionTracking = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const trackElement = findTrackableElement(target);

        if (trackElement) {
          const trackId = trackElement.getAttribute('data-track-id');
          const trackType = trackElement.getAttribute('data-track-type') || 'click';

          if (trackId) {
            trackEvent('element_interaction', {
              component_name: componentName,
              element_id: trackId,
              interaction_type: trackType,
              timestamp: new Date().toISOString()
            });
          }
        }
      };

      const findTrackableElement = (element: HTMLElement | null): HTMLElement | null => {
        if (!element) return null;
        if (element.hasAttribute('data-track-id')) return element;
        if (element.parentElement) {
          return findTrackableElement(element.parentElement);
        }
        return null;
      };

      document.addEventListener('click', handleInteractionTracking);
      return () => {
        document.removeEventListener('click', handleInteractionTracking);
      };
    }, [trackInteractions]);

    // Render the original component with its props
    return <Component {...props} />;
  };

  // Set display name for debugging
  WithTracking.displayName = `withTracking(${componentName})`;
  
  return WithTracking;
};

export default withTracking; 
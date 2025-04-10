import React from 'react';
import { trackEvent } from './GA4';

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

    // If tracking interactions, add click handlers to the component
    if (trackInteractions) {
      // Function to handle click tracking
      const handleInteractionTracking = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        
        // Get the data-track attribute from the target or its parents
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

      // Function to find the nearest element with data-track attributes
      const findTrackableElement = (element: HTMLElement | null): HTMLElement | null => {
        if (!element) return null;
        if (element.hasAttribute('data-track-id')) return element;
        
        // Try parent elements until we find a trackable one or reach the component root
        if (element.parentElement) {
          return findTrackableElement(element.parentElement);
        }
        
        return null;
      };

      // Add document click listener when component mounts
      React.useEffect(() => {
        document.addEventListener('click', handleInteractionTracking);
        
        // Clean up listener when component unmounts
        return () => {
          document.removeEventListener('click', handleInteractionTracking);
        };
      }, []);
    }

    // Render the original component with its props
    return <Component {...props} />;
  };

  // Set display name for debugging
  WithTracking.displayName = `withTracking(${componentName})`;
  
  return WithTracking;
};

export default withTracking; 
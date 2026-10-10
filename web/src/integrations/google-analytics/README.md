# Google Analytics Integration

This directory contains the implementation of Google Analytics 4 (GA4) for F1 DataStop. The analytics setup is designed to track user behavior, engagement metrics, and F1-specific interactions across the application.

## Components

1. **GA4.ts**: Core utility functions for tracking events in Google Analytics
2. **AnalyticsProvider.tsx**: React component to provide analytics context and track page views
3. **EngagementTracker.tsx**: Component that tracks user engagement metrics like scroll depth and time on page
4. **withTracking.tsx**: Higher-Order Component (HOC) for tracking component-level events

## Firebase Configuration

The analytics implementation uses Firebase Analytics under the hood. The Firebase configuration is in:
`src/integrations/firebase/config.ts`

## Event Tracking Capabilities

The analytics setup tracks the following:

### Page & Screen Views
- Automatic page view tracking on route changes
- Detailed page engagement metrics (time on page, scroll depth)

### User Engagement
- Active/inactive user detection
- Scroll depth tracking (25%, 50%, 75%, 90%)
- Session duration tracking
- Number of pages viewed per session

### User Interactions
- Clicks on UI elements (can be configured via data attributes)
- Feature usage tracking
- Form submissions and validation

### F1-Specific Events
- Race selection
- Driver profile views
- Team/constructor views
- Season changes

### Anonymous Usage (no login exists)
- Page views and navigation
- Chart and telemetry requests

## Usage

### Basic Event Tracking

```typescript
import { trackEvent } from '@/integrations/google-analytics/GA4';

// Track a simple event
trackEvent('button_click', { button_name: 'chart_request' });
```

### Using the Analytics Hook

```typescript
import useAnalytics from '@/hooks/useAnalytics';

function MyComponent() {
  const analytics = useAnalytics();
  
  const handleClick = () => {
    analytics.trackInteraction('feature_button', 'click', {
      location: 'homepage'
    });
  };
  
  return <button onClick={handleClick}>Click Me</button>;
}
```

### Track F1-Specific Events

```typescript
analytics.trackF1Event('race_selection', 'Monaco Grand Prix', {
  race_id: 'monaco',
  season: '2023'
});
```

### Component Tracking with HOC

```typescript
import withTracking from '@/integrations/google-analytics/withTracking';

const MyComponent = () => {
  return <div>My Component Content</div>;
};

export default withTracking(MyComponent, 'feature_component');
```

### Trackable HTML Elements

You can add data attributes to track specific elements:

```jsx
<button 
  data-track-id="chart_request_button"
  data-track-type="click"
>
  Request Chart
</button>
```

## Google Analytics Dashboard

The GA4 measurement ID used is: `G-1Y6GKNVD2J`

You can view analytics data in the Google Analytics dashboard at:
https://analytics.google.com/analytics/web/

## Debugging

In development mode, all analytics events are logged to the console. 
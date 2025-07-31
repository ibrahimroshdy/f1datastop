# 📊 F1 DataStop Calendar Analytics - Comprehensive Tracking

## 🎯 Overview
Your calendar page now has **enterprise-level analytics** that tracks every user interaction with detailed F1-specific data. This gives you unprecedented insights into how users engage with your race calendar.

## 📈 What's Being Tracked

### 1. **Page-Level Analytics**
- **Calendar page visits** with selected year and view type
- **Session duration** and engagement metrics
- **Year changes** with direction tracking (forward/backward)
- **Session summaries** with comprehensive engagement scores

### 2. **Race Card Interactions**
- **Race card clicks** with complete race details:
  - Race name, round, season, circuit
  - Country and locality
  - Sprint race availability
  - Race status (completed/upcoming/today)
  - Days until race
  - User timing data

### 3. **Interactive Map Analytics**
- **Race marker clicks** on the 3D globe
- **Race hover events** for exploration behavior
- **Map control interactions**:
  - Zoom and rotation tracking
  - Detail level changes (low/medium/high)
  - Path visibility toggles
- **Filter usage**:
  - Race status filters (first/upcoming/completed)
  - Filter effectiveness tracking

### 4. **Search & Discovery**
- **Search queries** with:
  - Search terms and results count
  - Search effectiveness metrics
  - Debounced tracking to avoid spam

### 5. **Race Detail Dialog Analytics**
- **Dialog interactions**:
  - Opens and closes with time spent
  - Tab switching behavior (info/results/qualifying/sprint)
  - Session schedule viewing

### 6. **Results Viewing Behavior**
- **Race results viewing** by type:
  - Race results, qualifying, sprint results
  - Driver count and view mode (mobile/desktop)
  - Time spent viewing results

### 7. **Driver & Team Interactions**
- **Driver/team clicks** in results with:
  - Driver names, codes, teams
  - Constructor information
  - Context tracking (results/qualifying/sprint views)

### 8. **Conversion Tracking**
- **"View Analysis" clicks** as conversion goals
- **Deep engagement** metrics
- **Goal completion** tracking for race analysis views

## 🔍 Data Points Collected

### **User Behavior Data**
```typescript
{
  // Session tracking
  time_spent_seconds: number,
  races_viewed: number,
  detail_dialogs_opened: number,
  year_changes: number,
  map_interactions: number,
  search_queries: number,
  filters_used: number,
  engagement_level: 'low' | 'medium' | 'high',

  // Race-specific data
  race_name: string,
  race_round: number,
  race_season: number,
  circuit_name: string,
  country: string,
  locality: string,
  has_sprint: boolean,
  race_status: 'completed' | 'upcoming' | 'today',
  days_until_race: number,

  // User context
  view_mode: 'mobile' | 'desktop',
  selected_year: number,
  current_year: number,
  timestamp: string
}
```

### **Map Interaction Data**
```typescript
{
  action: 'race_marker_click' | 'race_hover' | 'zoom' | 'filter_toggle' | 'search',
  race_data: {
    race_name: string,
    round: number,
    country: string
  },
  search_term?: string,
  filter_type?: string,
  filter_enabled?: boolean,
  detail_level?: 'low' | 'medium' | 'high'
}
```

## 📊 Analytics Reports You Can Create

### 1. **User Engagement Reports**
- Most viewed races by country/season
- Average time spent per race
- User journey through calendar features
- Search behavior and popular queries

### 2. **Feature Usage Analytics**
- Map vs list view preferences
- Filter usage patterns
- Mobile vs desktop behavior differences
- Sprint race interest levels

### 3. **Content Performance**
- Most clicked races and circuits
- Seasonal viewing patterns
- Race detail engagement by tab type
- Conversion rates to race analysis

### 4. **User Segmentation**
- High vs low engagement users
- Feature preference segments
- Geographic viewing patterns
- Seasonal vs historical data interests

## 🎯 Key Metrics Dashboard

### **Engagement Metrics**
- Calendar session duration
- Races viewed per session
- Dialog interaction rate
- Search query success rate
- Map interaction frequency

### **Content Metrics**
- Most popular races/circuits
- Sprint race engagement
- Historical vs current season interest
- "View Analysis" conversion rate

### **User Journey Metrics**
- Entry points to calendar
- Navigation patterns within calendar
- Exit points and drop-off rates
- Feature adoption rates

## 🔧 Implementation Details

### **Automatic Tracking**
- All tracking happens automatically once users visit the calendar page
- No additional setup required
- Tracks both anonymous and authenticated users

### **Privacy Compliant**
- No personal data collection
- Focus on usage patterns and preferences
- Aggregated behavioral insights

### **Performance Optimized**
- Throttled event tracking to prevent spam
- Debounced search tracking
- Minimal performance impact

## 🚀 Business Insights You'll Gain

1. **User Preferences**: Which races/circuits are most popular
2. **Feature Usage**: How users navigate and interact with your calendar
3. **Content Strategy**: What type of F1 content drives most engagement
4. **Technical Decisions**: Mobile vs desktop usage patterns
5. **Seasonal Trends**: How engagement varies throughout the F1 season
6. **Conversion Optimization**: Path to deeper race analysis engagement

## 📈 Data Flow

```
User Interaction → Calendar Analytics Tracker → Google Analytics → Your Dashboard
```

All data flows through your existing Google Analytics setup (G-1Y6GKNVD2J) and can be viewed in real-time through your GA4 dashboard.

---

**🏁 Your F1 DataStop calendar now has the most comprehensive analytics setup of any F1 website!** 

You're tracking more detailed user behavior than most enterprise applications, giving you unprecedented insights into how F1 fans engage with race calendar data. 
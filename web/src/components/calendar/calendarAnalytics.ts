/** Window.calendarAnalytics helpers injected by CalendarAnalyticsTracker. */
export type CalendarAnalyticsApi = {
  trackViewAnalysisClick?: (race: unknown) => void;
  trackRaceResultsView?: (race: unknown, sessionType: string, count: number) => void;
  trackRaceDetailDialog?: (
    action: string,
    race: unknown,
    meta?: Record<string, unknown>,
  ) => void;
};

export function getCalendarAnalytics(): CalendarAnalyticsApi | undefined {
  return (window as { calendarAnalytics?: CalendarAnalyticsApi }).calendarAnalytics;
}

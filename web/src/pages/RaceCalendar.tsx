import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Grid3x3, List } from "lucide-react";
import CalendarAnalyticsTracker from "@/components/calendar/CalendarAnalyticsTracker";
import RaceCalendarListView, { RaceCalendarListSkeleton } from "@/components/calendar/RaceCalendarListView";
import RaceCalendarGridView, { RaceCalendarGridSkeleton } from "@/components/calendar/RaceCalendarGridView";
import { RaceListTools } from "@/components/calendar/RaceListTools";
import { useRaceRows } from "@/components/calendar/useRaceRows";
import { useOpenQuickLook } from "@/components/calendar/QuickLook";
import { getCalendarAnalytics } from "@/components/calendar/calendarAnalytics";
import {
  groupByMonth,
  matchesFilter,
  matchesSearch,
  parseRaceFilter,
  RACE_FILTERS,
  type RaceFilter,
  type RaceRow,
} from "@/components/calendar/raceRows";
import { F1EmptyState, PageHeader } from "@/components/f1";
import { ViewSwitcher } from "@/components/ui/view-switcher";
import { pageShell, pageStack } from "@/lib/layout";
import { useSeason } from "@/hooks/useSeason";
import { useUrlTab } from "@/hooks/useUrlTab";
import { cn } from "@/lib/utils";
import Seo from "@/components/common/Seo";
import { breadcrumbSchema } from "@/lib/structuredData";

const VIEWS = ["list", "grid"] as const;

const RaceCalendar = () => {
  const [season] = useSeason();
  const [viewMode, setViewMode] = useUrlTab("view", VIEWS, "list");
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const filter = parseRaceFilter(params.get("filter"));
  const openQuickLook = useOpenQuickLook();
  const { rows, isLoading } = useRaceRows(season);

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (value) p.set(key, value);
        else p.delete(key);
        return p;
      },
      { replace: true },
    );

  const counts = useMemo(() => {
    const searched = rows.filter((r) => matchesSearch(r, query));
    return Object.fromEntries(RACE_FILTERS.map((f) => [f, searched.filter((r) => matchesFilter(r, f)).length])) as Record<
      RaceFilter,
      number
    >;
  }, [rows, query]);

  const groups = useMemo(
    () => groupByMonth(rows.filter((r) => matchesFilter(r, filter) && matchesSearch(r, query))),
    [rows, filter, query],
  );

  const open = (row: RaceRow) => {
    getCalendarAnalytics()?.trackRaceCardClick?.(row.race);
    openQuickLook(row.race.season, row.race.round);
  };

  const sprintCount = rows.filter((r) => r.sprint).length;

  return (
    <CalendarAnalyticsTracker selectedYear={season} viewType="list">
      <Seo
        title={`${season} F1 Race Calendar`}
        path="/calendar"
        description={`Every Grand Prix of the ${season} Formula 1 season: dates, circuits, session times and results as the season unfolds.`}
        jsonLd={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Calendar", path: "/calendar" },
        ])}
      />
      <div className={pageShell}>
        <div className={cn("mx-auto w-full", pageStack, "animate-fade-in")}>
          <PageHeader
            title="Races"
            description={
              rows.length
                ? `Season ${season}, ${rows.length} Grands Prix${sprintCount ? `, ${sprintCount} with a sprint` : ""}`
                : `Season ${season}`
            }
            actions={
              <ViewSwitcher
                items={[
                  { key: "list", label: "List", icon: List },
                  { key: "grid", label: "Grid", icon: Grid3x3 },
                ]}
                value={viewMode}
                onChange={setViewMode}
              />
            }
          />

          <RaceListTools
            query={query}
            onQuery={(q) => setParam("q", q || null)}
            filter={filter}
            onFilter={(f) => setParam("filter", f === "all" ? null : f)}
            counts={counts}
          />

          {isLoading ? (
            viewMode === "list" ? (
              <RaceCalendarListSkeleton />
            ) : (
              <RaceCalendarGridSkeleton />
            )
          ) : rows.length === 0 ? (
            <F1EmptyState
              type="no-races"
              title={`No calendar for ${season} yet`}
              description="Pick another season, or come back when the calendar is published."
              size="md"
              showDecoration={false}
              className="rounded-xl border border-border bg-card/40 py-10"
            />
          ) : groups.length === 0 ? (
            <F1EmptyState
              type="no-races"
              title="No races match"
              description="Try another name, or show all races."
              size="md"
              showDecoration={false}
              className="rounded-xl border border-border bg-card/40 py-10"
            />
          ) : viewMode === "list" ? (
            <RaceCalendarListView season={season} groups={groups} onOpen={open} />
          ) : (
            <RaceCalendarGridView season={season} groups={groups} onOpen={open} />
          )}
        </div>
      </div>
    </CalendarAnalyticsTracker>
  );
};

export default RaceCalendar;

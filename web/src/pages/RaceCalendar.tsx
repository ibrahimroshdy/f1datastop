import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import YearSelector from "@/components/common/YearSelector";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import CalendarAnalyticsTracker from "@/components/calendar/CalendarAnalyticsTracker";
import RaceCalendarListView from "@/components/calendar/RaceCalendarListView";
import RaceCalendarGridView from "@/components/calendar/RaceCalendarGridView";
import { pageShell, pageStack } from "@/lib/layout";
import { PageHeader } from "@/components/f1";
import { useRaceCalendar } from "@/hooks/useRaceCalendar";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { useUrlTab } from "@/hooks/useUrlTab";
import { cn } from "@/lib/utils";
import { Grid3x3, List, Star } from "lucide-react";
import Seo from "@/components/common/Seo";
import { breadcrumbSchema } from "@/lib/structuredData";

const RaceCalendar = () => {
  const { isGlass, cardVariant, glassVariant } = useThemeVariant();
  const {
    selectedYear,
    selectedRace,
    isDialogOpen,
    expandedRaces,
    raceSchedule,
    isLoading,
    handleYearChange,
    toggleRaceExpansion,
    openRaceDetails,
    closeRaceDetails,
    getRaceStatus,
    raceTypes,
    racesWithBreak,
  } = useRaceCalendar();
  // List/grid view is URL-backed so a shared /calendar link keeps the chosen view.
  const [viewMode, setViewMode] = useUrlTab("view", ["list", "grid"] as const, "list");
  const [searchParams, setSearchParams] = useSearchParams();

  // Season is URL-backed (?year=) so a shared /calendar link pins the year.
  useEffect(() => {
    const y = parseInt(searchParams.get("year") ?? "", 10);
    if (!Number.isNaN(y) && y !== selectedYear) handleYearChange(y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const onYearChange = (year: number) => {
    handleYearChange(year);
    const next = new URLSearchParams(searchParams);
    next.set("year", String(year));
    setSearchParams(next, { replace: true });
  };

  const raceCount = raceSchedule?.data?.length ?? 0;

  return (
    <CalendarAnalyticsTracker selectedYear={selectedYear} viewType="list">
      <Seo
        title={`${selectedYear} F1 Race Calendar`}
        path="/calendar"
        description={`Every round of the ${selectedYear} Formula 1 season — dates, circuits, session times and results as the season unfolds.`}
        jsonLd={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Calendar", path: "/calendar" },
        ])}
      />
      <div className={pageShell}>
        <div className={cn("mx-auto w-full", pageStack, "animate-fade-in")}>
          {/* ── Compact app header (eyebrow + title + round readout) ──────── */}
          <PageHeader
            eyebrow={`Season ${selectedYear}`}
            title="Race Calendar"
            actions={
              <>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-primary">
                  Rounds
                  <span className="timing">{String(raceCount).padStart(2, "0")}</span>
                </span>
                <div className="flex items-center rounded-lg border border-border bg-card p-1 shadow-card">
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-8 gap-1.5 px-2 text-xs font-semibold uppercase tracking-widest sm:px-3",
                      viewMode === "list" && "bg-primary text-primary-foreground",
                    )}
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                    <span className="hidden sm:inline">List</span>
                  </Button>
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-8 gap-1.5 px-2 text-xs font-semibold uppercase tracking-widest sm:px-3",
                      viewMode === "grid" && "bg-primary text-primary-foreground",
                    )}
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid3x3 className="h-4 w-4" />
                    <span className="hidden sm:inline">Grid</span>
                  </Button>
                </div>
                <YearSelector selectedYear={selectedYear} onYearChange={onYearChange} />
              </>
            }
          />

          {/* ── Weekend-encoding legend (compact instrument row) ──────────── */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="instrument-label hidden text-primary sm:inline">Legend</span>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-1 rounded-full bg-status-upcoming" aria-hidden />
              <span className="instrument-label">Single</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-1 rounded-full bg-status-completed" aria-hidden />
              <span className="instrument-label">Double</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-1 rounded-full bg-primary" aria-hidden />
              <span className="instrument-label">Triple</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="h-3 w-3 fill-position-gold text-position-gold" aria-hidden />
              <span className="instrument-label">Sprint</span>
            </div>
          </div>

          {viewMode === "list" && (
            <RaceCalendarListView
              selectedYear={selectedYear}
              isLoading={isLoading}
              raceCount={raceCount}
              racesWithBreak={racesWithBreak}
              raceTypes={raceTypes}
              expandedRaces={expandedRaces}
              cardVariant={cardVariant}
              glassVariant={glassVariant}
              isGlass={isGlass}
              getRaceStatus={getRaceStatus}
              openRaceDetails={openRaceDetails}
              toggleRaceExpansion={toggleRaceExpansion}
            />
          )}

          {viewMode === "grid" && (
            <RaceCalendarGridView
              selectedYear={selectedYear}
              isLoading={isLoading}
              raceCount={raceCount}
              racesWithBreak={racesWithBreak}
              raceTypes={raceTypes}
              cardVariant={cardVariant}
              glassVariant={glassVariant}
              isGlass={isGlass}
              getRaceStatus={getRaceStatus}
              openRaceDetails={openRaceDetails}
            />
          )}

        </div>

        {selectedRace && (
          <RaceDetailDialog
            isOpen={isDialogOpen}
            onClose={closeRaceDetails}
            race={selectedRace}
          />
        )}
      </div>
    </CalendarAnalyticsTracker>
  );
};

export default RaceCalendar;

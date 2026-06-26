import { Button } from "@/components/ui/button";
import YearSelector from "@/components/common/YearSelector";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import CalendarAnalyticsTracker from "@/components/calendar/CalendarAnalyticsTracker";
import RaceCalendarListView from "@/components/calendar/RaceCalendarListView";
import RaceCalendarGridView from "@/components/calendar/RaceCalendarGridView";
import { PageHeader } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { useRaceCalendar } from "@/hooks/useRaceCalendar";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { cn } from "@/lib/utils";
import { Grid3x3, List, Star } from "lucide-react";

const RaceCalendar = () => {
  const { isGlass, cardVariant, glassVariant } = useThemeVariant();
  const {
    selectedYear,
    selectedRace,
    isDialogOpen,
    viewMode,
    setViewMode,
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

  const raceCount = raceSchedule?.data?.length ?? 0;

  return (
    <CalendarAnalyticsTracker selectedYear={selectedYear} viewType="list">
      <div className={pageShell}>
        <div className={cn(pageStack, "animate-fade-in")}>
          <PageHeader
            eyebrow={String(selectedYear)}
            title="Race Calendar"
            description={`${raceCount} rounds scheduled for ${selectedYear}`}
            actions={
              <div className="flex items-center gap-3">
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
              <YearSelector selectedYear={selectedYear} onYearChange={handleYearChange} />
              </div>
            }
          />

          {(viewMode === "list" || viewMode === "grid") && (
            <div
              className={cn(
                "flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border px-3 py-2 shadow-card",
                isGlass ? "border-white/10 bg-white/[0.03]" : "border-border bg-card",
              )}
            >
              <span className="instrument-label hidden sm:inline">Legend</span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-1 rounded-full bg-blue-500" />
                  <span className="instrument-label">Single</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-1 rounded-full bg-green-500" />
                  <span className="instrument-label">Double</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-1 rounded-full bg-violet-500" />
                  <span className="instrument-label">Triple</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  <span className="instrument-label">Sprint</span>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="instrument-label">Rounds</span>
                <span className="timing text-sm font-semibold text-foreground">
                  {String(raceCount).padStart(2, "0")}
                </span>
              </div>
            </div>
          )}

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

import React, { useState, useRef, lazy, Suspense, useEffect, useMemo } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { F1Card, F1CardContent, F1EmptyState } from "@/components/f1";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, differenceInDays, getMonth, getWeek, getYear, addDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRaceSchedule, useRaceResults, useSprintResults } from "@/hooks/useF1Data";
import YearSelector from "@/components/common/YearSelector";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import RaceInfographic from "@/components/calendar/RaceInfographic";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { Calendar as CalendarIcon, Star, Download, Globe, List, Loader2, Grid3x3, ChevronDown, ChevronUp, BarChart3, Clock, MapPin } from "lucide-react";
import CountryFlag from "@/components/common/CountryFlag";
import CalendarAnalyticsTracker from "@/components/calendar/CalendarAnalyticsTracker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/ThemeContext";
import { getTeamColorById } from "@/constants/f1Colors";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PointsDistributionView from "@/components/calendar/PointsDistributionView";

// Lazy load the globe component for better performance
const F1GlobeContainer = lazy(() => import("@/components/calendar/map/F1GlobeContainer"));

// View type for calendar
type CalendarView = "list" | "grid" | "globe" | "distribution";

// Race type constants
const SINGLE_RACE = "single";
const DOUBLE_HEADER = "double";
const TRIPLE_HEADER = "triple";

// Color mapping for race types - subtle, minimal
const raceTypeColors = {
  [SINGLE_RACE]: "bg-blue-500",
  [DOUBLE_HEADER]: "bg-green-500",
  [TRIPLE_HEADER]: "bg-purple-500",
  "summer-break": "bg-sky-400/50",
};

// Status badge colors - clean, monochromatic with only necessary color
const statusColors = {
  completed: "bg-muted text-muted-foreground",
  next: "bg-f1-red text-white",
  upcoming: "bg-muted text-muted-foreground",
};

interface RaceTypeResult {
  raceTypes: string[];
  summerBreakStart: number;
  summerBreakEnd: number;
}

// Helper function to determine if dates represent consecutive weekends
const areConsecutiveWeekends = (date1: Date, date2: Date): boolean => {
  // Get the week numbers
  const week1 = getWeek(date1);
  const week2 = getWeek(date2);
  const year1 = getYear(date1);
  const year2 = getYear(date2);
  
  // If same year, check if weeks are consecutive
  if (year1 === year2) {
    return week2 - week1 === 1;
  }
  
  // If different years, check if it's the last week of year1 and first week of year2
  // This is a simplification - actual logic might need to account for ISO week numbering
  return year2 > year1 && week1 >= 52 && week2 <= 1;
};

const RaceCalendar = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedRace, setSelectedRace] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [downloadingRace, setDownloadingRace] = useState<string | null>(null);
  const [infographicRace, setInfographicRace] = useState<any>(null);
  const [viewMode, setViewMode] = useState<CalendarView>("list");
  const [expandedRaces, setExpandedRaces] = useState<Set<string>>(new Set());
  const infographicRef = useRef<HTMLDivElement>(null);
  const { isGlass } = useTheme();
  const listCardVariant = isGlass ? ("glass" as const) : ("default" as const);
  const listGlassVariant = isGlass ? ("panel" as const) : ("default" as const);
  
  const toggleRaceExpansion = (raceRound: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedRaces(prev => {
      const newSet = new Set(prev);
      if (newSet.has(raceRound)) {
        newSet.delete(raceRound);
      } else {
        newSet.add(raceRound);
      }
      return newSet;
    });
  };
  
  const { data: raceSchedule, isLoading } = useRaceSchedule(selectedYear);
  const currentDate = new Date();
  
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };
  
  const openRaceDetails = (race: any) => {
    // Track race card click
    if ((window as any).calendarAnalytics) {
      (window as any).calendarAnalytics.trackRaceCardClick(race);
    }
    
    setSelectedRace(race);
    setIsDialogOpen(true);
  };
  
  const closeRaceDetails = () => {
    setIsDialogOpen(false);
  };

  // Handle direct download from calendar card
  const handleDirectDownload = async (race: any, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening the modal
    
    if (downloadingRace === race.round) return; // Prevent multiple downloads
    
    setDownloadingRace(race.round);
    setInfographicRace(race);
    
    try {
      // Wait a moment for the infographic to render
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Trigger the download from the hidden infographic
      const downloadEvent = new CustomEvent('triggerInfographicDownload', {
        detail: { raceRound: race.round }
      });
      window.dispatchEvent(downloadEvent);
      
    } catch (error) {
      console.error("Error downloading infographic:", error);
      toast.error("Failed to download infographic");
      setDownloadingRace(null);
    }
  };
  
  const getRaceStatus = (race: any) => {
    // Parse the race date and time if available
    const raceDateTime = race.time 
      ? parseISO(`${race.date}T${race.time}`) 
      : parseISO(`${race.date}T00:00:00Z`);
    
    if (raceDateTime < currentDate) {
      return "completed";
    }
    
    // Check if it's the next race
    const nextRaceIndex = raceSchedule?.data?.findIndex((r: any) => {
      const rDateTime = r.time 
        ? parseISO(`${r.date}T${r.time}`) 
        : parseISO(`${r.date}T00:00:00Z`);
      return rDateTime > currentDate;
    });
    
    if (nextRaceIndex !== undefined && nextRaceIndex >= 0) {
      const nextRace = raceSchedule?.data?.[nextRaceIndex];
      if (nextRace && nextRace.round === race.round) {
        return "next";
      }
    }
    
    return "upcoming";
  };

  // Function to determine race types and summer break
  const determineRaceTypes = (races: any[]): RaceTypeResult => {
    if (!races || races.length === 0) {
      return { raceTypes: [], summerBreakStart: -1, summerBreakEnd: -1 };
    }
    
    const raceTypes = Array(races.length).fill(SINGLE_RACE);
    let summerBreakStart = -1;
    let summerBreakEnd = -1;
    
    // Find consecutive weekend races to determine headers
    let currentHeader: number[] = [];
    
    for (let i = 0; i < races.length; i++) {
      const currentRaceDate = parseISO(races[i].date);
      
      // Check if this race is consecutive with the previous race in our current header
      if (i > 0) {
        const prevRaceDate = parseISO(races[i-1].date);
        if (areConsecutiveWeekends(prevRaceDate, currentRaceDate)) {
          // This is part of the current header
          currentHeader.push(i);
        } else {
          // This is not consecutive - process the previous header if we have one
          if (currentHeader.length > 0) {
            // We have a header to process
            const headerType = 
              currentHeader.length === 2 ? DOUBLE_HEADER : 
              currentHeader.length === 3 ? TRIPLE_HEADER : 
              SINGLE_RACE;
            
            // Only mark as a header if it's double or triple
            if (headerType !== SINGLE_RACE) {
              for (const idx of currentHeader) {
                raceTypes[idx] = headerType;
              }
            }
            
            // Reset for next header
            currentHeader = [i];
          } else {
            // Start a new potential header
            currentHeader = [i];
          }
        }
      } else {
        // First race is always the start of a potential header
        currentHeader = [i];
      }
      
      // Find summer break (races in August with a gap between them)
      if (getMonth(currentRaceDate) === 7) { // August is month 7 (0-indexed)
        // This race is in August - check if it's the last race before the summer break
        if (i < races.length - 1) {
          const nextRaceDate = parseISO(races[i+1].date);
          const daysBetween = differenceInDays(nextRaceDate, currentRaceDate);
          
          // If there's a substantial gap after this race in August
          if (daysBetween > 14) {
            summerBreakStart = i;
            summerBreakEnd = i + 1;
          }
        }
      }
    }
    
    // Process the last header if there is one
    if (currentHeader.length > 1) {
      const headerType = 
        currentHeader.length === 2 ? DOUBLE_HEADER : 
        currentHeader.length === 3 ? TRIPLE_HEADER : 
        SINGLE_RACE;
      
      if (headerType !== SINGLE_RACE) {
        for (const idx of currentHeader) {
          raceTypes[idx] = headerType;
        }
      }
    }
    
    // If we couldn't find a clear summer break in August, look for the longest break
    if (summerBreakStart === -1) {
      let longestBreakLength = 0;
      
      for (let i = 0; i < races.length - 1; i++) {
        const currentRaceDate = parseISO(races[i].date);
        const nextRaceDate = parseISO(races[i+1].date);
        const daysBetween = differenceInDays(nextRaceDate, currentRaceDate);
        
        // Look for a substantial break (at least 3 weeks) in the middle of the season
        if (daysBetween > 21 && daysBetween > longestBreakLength && i >= races.length / 4 && i <= (3 * races.length) / 4) {
          longestBreakLength = daysBetween;
          summerBreakStart = i;
          summerBreakEnd = i + 1;
        }
      }
    }
    
    return { raceTypes, summerBreakStart, summerBreakEnd };
  };
  
  // Process race data for types (single, double, triple headers)
  const raceTypeData = determineRaceTypes(raceSchedule?.data || []);
  const raceTypes = raceTypeData.raceTypes;
  const summerBreakStart = raceTypeData.summerBreakStart;
  const summerBreakEnd = raceTypeData.summerBreakEnd;
  
  // Calculate summer break dates (for display)
  const getSummerBreakDates = () => {
    if (summerBreakStart >= 0 && summerBreakEnd >= 0 && raceSchedule?.data) {
      const startRace = raceSchedule.data[summerBreakStart];
      const endRace = raceSchedule.data[summerBreakEnd];
      
      if (startRace && endRace) {
        const startDate = parseISO(startRace.date);
        const endDate = parseISO(endRace.date);
        
        // Summer break starts the day after the race
        const breakStartDate = addDays(startDate, 1);
        // Summer break ends the day before the next race
        const breakEndDate = addDays(endDate, -1);
        
        return {
          start: format(breakStartDate, 'dd MMM'),
          end: format(breakEndDate, 'dd MMM')
        };
      }
    }
    
    return { start: '', end: '' };
  };
  
  const summerBreakDates = getSummerBreakDates();

  // Prepare races with summer break indicator at the correct position
  const prepareRacesWithBreak = () => {
    if (!raceSchedule?.data) return [];

    const result = [];
    let breakInserted = false;

    for (let i = 0; i < raceSchedule.data.length; i++) {
      // Insert summer break indicator at the right position
      if (i === summerBreakStart + 1 && !breakInserted) {
        result.push({
          isSummerBreak: true,
          dates: summerBreakDates
        });
        breakInserted = true;
      }
      
      // Add the race
      result.push({
        race: raceSchedule.data[i],
        index: i
      });
    }

    return result;
  };

  const racesWithBreak = prepareRacesWithBreak();
  
  return (
    <MainLayout>
      <CalendarAnalyticsTracker selectedYear={selectedYear} viewType="list">
        <div className="space-y-6">
          {/* Header Section - Clean, minimal */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Race Calendar</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {raceSchedule?.data?.length || 0} races scheduled for {selectedYear}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center rounded-lg border border-border p-1 bg-muted/30">
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 px-2 sm:px-3 gap-1.5",
                    viewMode === "list" && "bg-primary text-primary-foreground"
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
                    "h-8 px-2 sm:px-3 gap-1.5",
                    viewMode === "grid" && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3x3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Grid</span>
                </Button>
                <Button
                  variant={viewMode === "globe" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 px-2 sm:px-3 gap-1.5",
                    viewMode === "globe" && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => setViewMode("globe")}
                >
                  <Globe className="h-4 w-4" />
                  <span className="hidden sm:inline">Globe</span>
                </Button>
                <Button
                  variant={viewMode === "distribution" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 px-2 sm:px-3 gap-1.5",
                    viewMode === "distribution" && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => setViewMode("distribution")}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Distribution</span>
                </Button>
              </div>
              <YearSelector selectedYear={selectedYear} onYearChange={handleYearChange} />
            </div>
        </div>

          {/* Legend - Compact (only show for list and grid views) */}
          {(viewMode === "list" || viewMode === "grid") && (
            <div
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2 text-xs sm:text-sm",
                isGlass ? "border-white/10 bg-white/[0.03]" : "border-border bg-muted/25"
              )}
            >
              <span className="text-muted-foreground font-medium hidden sm:inline">Legend</span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-1 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground text-xs">Single</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-1 rounded-full bg-green-500" />
                  <span className="text-muted-foreground text-xs">Double</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-1 rounded-full bg-purple-500" />
                  <span className="text-muted-foreground text-xs">Triple</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  <span className="text-muted-foreground text-xs">Sprint</span>
                </div>
              </div>
            </div>
          )}

          {/* Globe View */}
          {viewMode === "globe" && (
            <Suspense fallback={
              <F1Card
                variant={listCardVariant}
                glassVariant={listGlassVariant}
                className={cn(
                  "flex h-[min(70vh,780px)] min-h-[420px] items-center justify-center p-0",
                  isGlass && "border-white/10"
                )}
              >
                <F1CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-foreground">Loading 3D globe</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                      Preparing the map module. First load can take a moment on slower networks.
                    </p>
                  </div>
                </F1CardContent>
              </F1Card>
            }>
              <F1GlobeContainer 
                selectedYear={selectedYear} 
                onYearChange={handleYearChange}
              />
            </Suspense>
          )}

          {/* List view — dense schedule rows with F1Card + type stripe */}
          {viewMode === "list" && (
        <div className="mt-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array(6).fill(0).map((_, index) => (
                  <F1Card
                    key={index}
                    variant={listCardVariant}
                    glassVariant={listGlassVariant}
                    className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
                  >
                    <F1CardContent className="p-0">
                      <div className="flex min-h-[52px]">
                        <Skeleton className="w-1 shrink-0 self-stretch rounded-l-xl" />
                        <div className="flex flex-1 flex-col gap-2 p-3 sm:p-3.5">
                          <Skeleton className="h-4 w-2/3" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    </F1CardContent>
                  </F1Card>
              ))}
            </div>
          ) : raceSchedule?.data?.length === 0 ? (
              <F1EmptyState
                type="no-races"
                title={`No schedule for ${selectedYear}`}
                description="Try another season from the year selector, or check back when the calendar is published."
                size="md"
                showDecoration={false}
                className={cn(
                  "rounded-xl border py-10 sm:py-12",
                  isGlass ? "border-white/10 bg-white/[0.02]" : "border-border bg-card/40"
                )}
              />
          ) : (
            <ul className="list-none space-y-2 p-0 m-0" aria-label={`${selectedYear} race calendar`}>
              {racesWithBreak.map((item, idx) => {
                if (item.isSummerBreak) {
                  return (
                      <li key={`summer-break-${idx}`} className="list-none">
                        <div className="flex items-center gap-3 py-1 sm:py-2">
                          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                          <span className="shrink-0 rounded-full border border-dashed border-border/80 bg-muted/30 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                            Summer break · {item.dates.start} – {item.dates.end}
                          </span>
                          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border to-transparent" />
                        </div>
                      </li>
                  );
                }
                
                const race = item.race;
                const index = item.index;
                const status = getRaceStatus(race);
                const raceDate = parseISO(race.date);
                const country = race.Circuit?.Location?.country || "";
                const raceName = getRaceNameWithoutEmoji(race.raceName);
                const circuitName = race.Circuit?.circuitName || "Unknown Circuit";
                const raceType = raceTypes[index] || SINGLE_RACE;
                const hasSprint = !!race.Sprint;
                const isExpanded = expandedRaces.has(race.round);
                const typeStripe = raceTypeColors[raceType] ?? raceTypeColors[SINGLE_RACE];
                
                return (
                  <li key={race.round} className="list-none">
                  <F1Card
                    variant={listCardVariant}
                    glassVariant={listGlassVariant}
                    className={cn(
                      "overflow-hidden p-0 transition-shadow duration-200",
                      isGlass && "border-white/10",
                      status === "next" && "ring-1 ring-f1-red shadow-sm shadow-primary/10",
                      status === "completed" && "opacity-95 hover:opacity-100"
                    )}
                  >
                    <F1CardContent className="p-0">
                      <div className="flex min-h-[56px]">
                        <div
                          className={cn("w-1 shrink-0 self-stretch rounded-l-xl", typeStripe)}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`${raceName}, round ${race.round}. Open race details.`}
                          className={cn(
                            "flex cursor-pointer items-start gap-2 p-3 outline-none transition-colors sm:gap-3 sm:p-3.5",
                            "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          )}
                          onClick={() => openRaceDetails(race)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openRaceDetails(race);
                            }
                          }}
                        >
                          <div className="flex shrink-0 flex-col items-center gap-1.5 pt-0.5">
                            <span className="rounded-md bg-muted/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground tabular-nums sm:text-[11px]">
                              R{race.round}
                            </span>
                            <CountryFlag country={country} size={22} svg className="shrink-0" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <h3 className="text-sm font-semibold leading-snug sm:text-base">{raceName}</h3>
                              {hasSprint && (
                                <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-500 text-yellow-500" aria-label="Sprint weekend" />
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground sm:text-xs">
                              <span className="inline-flex min-w-0 items-center gap-1">
                                <MapPin className="h-3 w-3 shrink-0 opacity-70" />
                                <span className="truncate">{circuitName}</span>
                              </span>
                              <span className="hidden text-border sm:inline">·</span>
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <CalendarIcon className="h-3 w-3 shrink-0 opacity-70" />
                                {format(raceDate, "EEE d MMM yyyy")}
                              </span>
                              {race.time && (
                                <>
                                  <span className="hidden text-border sm:inline">·</span>
                                  <span className="inline-flex items-center gap-1 tabular-nums">
                                    <Clock className="h-3 w-3 shrink-0 opacity-70" />
                                    {format(parseISO(`${race.date}T${race.time}`), "HH:mm")} UTC
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex shrink-0 items-start gap-1.5 pt-0.5">
                            <Badge 
                              variant={status === "next" ? "default" : "secondary"}
                              className={cn(
                                "h-6 px-2 text-[10px] font-medium sm:h-6 sm:px-2.5 sm:text-[11px]",
                                status === "next" && "bg-primary hover:bg-primary/90"
                              )}
                            >
                              {status === "completed" ? "Done" : 
                               status === "next" ? "Next" : 
                               "Upcoming"}
                            </Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 shrink-0 p-0"
                              aria-label={isExpanded ? "Collapse race details" : "Expand race details"}
                              aria-expanded={isExpanded}
                              onClick={(e) => toggleRaceExpansion(race.round, e)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className="space-y-2 border-t border-border/60 bg-muted/20 px-3 py-3 sm:px-3.5">
                            <div className="flex flex-wrap gap-1.5">
                              {hasSprint && (
                                <Badge variant="outline" className="text-[10px] h-6 sm:text-xs">Sprint</Badge>
                              )}
                              {race.Qualifying && (
                                <Badge variant="outline" className="text-[10px] h-6 sm:text-xs">Qualifying</Badge>
                              )}
                              {race.FirstPractice && (
                                <Badge variant="outline" className="text-[10px] h-6 sm:text-xs">Practice</Badge>
                              )}
                            </div>
                            
                            {status === "completed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-2 text-xs"
                                onClick={(e) => handleDirectDownload(race, e)}
                                disabled={downloadingRace === race.round}
                              >
                                {downloadingRace === race.round ? (
                                  <>
                                    <div className="h-3.5 w-3.5 shrink-0 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    <span>Downloading…</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="h-3.5 w-3.5 shrink-0" />
                                    <span>Download infographic</span>
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                        </div>
                      </div>
                    </F1CardContent>
                  </F1Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
          )}

          {/* Grid View */}
          {viewMode === "grid" && (
        <div className="mt-3">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
              {Array(10).fill(0).map((_, index) => (
                  <F1Card
                    key={index}
                    variant={listCardVariant}
                    glassVariant={listGlassVariant}
                    className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
                  >
                    <Skeleton className="h-0.5 w-full" />
                    <F1CardContent className="p-2 sm:p-2.5">
                      <Skeleton className="h-3.5 w-3/4 mb-1.5" />
                      <Skeleton className="h-3 w-1/2" />
                    </F1CardContent>
                  </F1Card>
              ))}
            </div>
          ) : raceSchedule?.data?.length === 0 ? (
              <F1EmptyState
                type="no-races"
                title={`No schedule for ${selectedYear}`}
                description="Try another season from the year selector."
                size="md"
                showDecoration={false}
                className={cn(
                  "rounded-xl border py-10 sm:py-12",
                  isGlass ? "border-white/10 bg-white/[0.02]" : "border-border bg-card/40"
                )}
              />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
              {racesWithBreak.map((item, idx) => {
                if (item.isSummerBreak) {
                  return (
                      <div key={`summer-break-${idx}`} className="col-span-2 sm:col-span-3 lg:col-span-4 xl:col-span-5 flex items-center gap-2 sm:gap-3 my-1.5 sm:my-2">
                        <div className="h-px flex-1 bg-border"></div>
                        <span className="text-[10px] sm:text-xs text-muted-foreground px-2 sm:px-3 py-1 bg-muted rounded-full">
                        Summer Break ({item.dates.start} - {item.dates.end})
                      </span>
                        <div className="h-px flex-1 bg-border"></div>
                    </div>
                  );
                }
                
                const race = item.race;
                const index = item.index;
                const status = getRaceStatus(race);
                const raceDate = parseISO(race.date);
                const country = race.Circuit?.Location?.country || "";
                const raceName = getRaceNameWithoutEmoji(race.raceName);
                const raceType = raceTypes[index] || SINGLE_RACE;
                const hasSprint = !!race.Sprint;
                
                return (
                  <F1Card
                    key={race.round}
                    variant={listCardVariant}
                    glassVariant={listGlassVariant}
                    className={cn(
                      "cursor-pointer overflow-hidden p-0 transition-all hover:shadow-md",
                      status === "next" && "ring-1 ring-f1-red",
                      isGlass && "border-white/10"
                    )}
                    onClick={() => openRaceDetails(race)}
                  >
                      {/* Top color bar */}
                      <div className={`h-0.5 w-full ${raceTypeColors[raceType]}`}></div>
                      
                    <F1CardContent className="p-2 sm:p-2.5">
                        <div className="flex flex-col items-center text-center gap-1.5 sm:gap-2">
                          <CountryFlag country={country} size={20} svg={true} />
                          <div className="w-full">
                            <h3 className="font-semibold text-xs sm:text-sm leading-tight truncate mb-0.5">{raceName}</h3>
                            <div className="flex items-center justify-center gap-1 text-[9px] sm:text-[10px] text-muted-foreground">
                              <span>R{race.round}</span>
                              {hasSprint && (
                                <>
                                  <span>•</span>
                                  <Star className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
                                </>
                              )}
                            </div>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-1">
                              {format(raceDate, 'dd MMM')}
                            </p>
                          </div>
                          <Badge 
                            variant={status === "next" ? "default" : "secondary"}
                            className={cn(
                              "text-[9px] sm:text-[10px] h-4 px-1.5",
                              status === "next" && "bg-f1-red hover:bg-f1-red"
                            )}
                          >
                            {status === "completed" ? "Done" : 
                             status === "next" ? "Next" : 
                             "Upcoming"}
                          </Badge>
                        </div>
                    </F1CardContent>
                  </F1Card>
                );
              })}
            </div>
          )}
        </div>
          )}

          {/* Distribution View */}
          {viewMode === "distribution" && (
            <PointsDistributionView 
              selectedYear={selectedYear}
              raceSchedule={raceSchedule?.data || []}
              isLoading={isLoading}
              isGlass={isGlass}
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

      {/* Hidden infographic for direct downloads */}
      {infographicRace && (
        <div className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none">
          <div ref={infographicRef}>
            <RaceInfographic 
              race={infographicRace}
              isVisible={true}
              onDownloadStart={() => {}}
              onDownloadComplete={() => {
                setDownloadingRace(null);
                setInfographicRace(null);
              }}
            />
          </div>
        </div>
      )}
      </CalendarAnalyticsTracker>
    </MainLayout>
  );
};

export default RaceCalendar;

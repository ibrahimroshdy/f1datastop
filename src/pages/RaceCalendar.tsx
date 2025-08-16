import React, { useState, useRef } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, differenceInDays, getMonth, getWeek, getYear, addDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRaceSchedule } from "@/hooks/useF1Data";
import YearSelector from "@/components/common/YearSelector";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import RaceInfographic from "@/components/calendar/RaceInfographic";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { Calendar as CalendarIcon, Star, Download } from "lucide-react";
import CountryFlag from "@/components/common/CountryFlag";
import CalendarAnalyticsTracker from "@/components/calendar/CalendarAnalyticsTracker";
import { toast } from "sonner";

// Race type constants
const SINGLE_RACE = "single";
const DOUBLE_HEADER = "double";
const TRIPLE_HEADER = "triple";

// Color mapping for race types
const raceTypeColors = {
  [SINGLE_RACE]: "bg-blue-500",
  [DOUBLE_HEADER]: "bg-green-500",
  [TRIPLE_HEADER]: "bg-purple-500",
  "summer-break": "bg-sky-300",
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
  const infographicRef = useRef<HTMLDivElement>(null);
  
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

    let result = [];
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <h1 className="text-3xl font-bold">Race Calendar</h1>
          <YearSelector selectedYear={selectedYear} onYearChange={handleYearChange} />
        </div>

        {/* Legend */}
        <div className="bg-muted/20 rounded-lg p-3 flex flex-wrap gap-3 items-center">
          <div className="text-sm font-medium">Legend:</div>
          <div className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${raceTypeColors[SINGLE_RACE]}`}></div>
            <span className="text-xs">Single Race</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${raceTypeColors[DOUBLE_HEADER]}`}></div>
            <span className="text-xs">Double Header</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${raceTypeColors[TRIPLE_HEADER]}`}></div>
            <span className="text-xs">Triple Header</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs">Sprint Race</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${raceTypeColors["summer-break"]}`}></div>
            <span className="text-xs">Summer Break</span>
          </div>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, index) => (
                <Skeleton key={index} className="h-[180px] w-full rounded-md" />
              ))}
            </div>
          ) : raceSchedule?.data?.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No race schedule data available for {selectedYear}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {racesWithBreak.map((item, idx) => {
                if (item.isSummerBreak) {
                  return (
                    <div key={`summer-break-${idx}`} className="col-span-1 md:col-span-2 lg:col-span-3 flex items-center gap-2 my-2">
                      <div className={`h-1 flex-1 ${raceTypeColors["summer-break"]}`}></div>
                      <span className="text-xs font-medium px-2">
                        Summer Break ({item.dates.start} - {item.dates.end})
                      </span>
                      <div className={`h-1 flex-1 ${raceTypeColors["summer-break"]}`}></div>
                    </div>
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
                
                return (
                  <Card 
                    key={race.round} 
                    className={`overflow-hidden hover:shadow-md cursor-pointer transition-all duration-200 ${
                      status === "next" ? "border-f1-red" : ""
                    }`}
                    onClick={() => openRaceDetails(race)}
                  >
                    <div className={`h-1.5 w-full ${raceTypeColors[raceType]}`}></div>
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <CountryFlag country={country} size={24} svg={true} />
                            <h3 className="font-bold text-lg">{raceName}</h3>
                            {hasSprint && (
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              className={
                                status === "completed" ? "bg-green-600" : 
                                status === "next" ? "bg-f1-red" : 
                                "bg-gray-500"
                              }>
                              {status === "completed" ? "Completed" : 
                               status === "next" ? "Next Race" : 
                               "Upcoming"}
                            </Badge>
                            {status === "completed" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-accent"
                                onClick={(e) => handleDirectDownload(race, e)}
                                disabled={downloadingRace === race.round}
                                title="Download race infographic"
                              >
                                {downloadingRace === race.round ? (
                                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <p className="text-sm text-gray-400">{circuitName}</p>
                          <p className="mt-2 text-sm">
                            {format(raceDate, 'dd MMM yyyy')}
                            {race.time && ` • ${format(parseISO(`${race.date}T${race.time}`), 'HH:mm')}`}
                          </p>
                        </div>
                        
                        <div className="mt-2 flex flex-wrap gap-2">
                          {race.Sprint && (
                            <Badge variant="outline" className="text-xs">Sprint</Badge>
                          )}
                          {race.FirstPractice && (
                            <Badge variant="outline" className="text-xs">Practice</Badge>
                          )}
                          {race.Qualifying && (
                            <Badge variant="outline" className="text-xs">Qualifying</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
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

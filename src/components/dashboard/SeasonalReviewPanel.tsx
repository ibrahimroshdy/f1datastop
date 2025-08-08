import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Clock, CheckCircle2, Circle, Trophy } from "lucide-react";
import { useState, useEffect } from "react";
import { formatDistance, parseISO, differenceInDays, getMonth, getWeek, getYear } from "date-fns";
import { useRaceSchedule, useNextRace } from "@/hooks/useF1Data";
import CountryFlag from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { getNextSession } from "@/utils/nextSessionUtils";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";

interface SeasonalReviewPanelProps {
  year?: number;
  expandedView?: boolean;
}

const SeasonalReviewPanel = ({ year, expandedView = false }: SeasonalReviewPanelProps) => {
  const currentYear = year || new Date().getFullYear();
  const { data: raceSchedule, isLoading: scheduleLoading } = useRaceSchedule(currentYear);
  const { data: nextRace, isLoading: nextRaceLoading } = useNextRace(currentYear);
  const [selectedRace, setSelectedRace] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Calculate season progress
  const now = new Date();
  const completedRaces = raceSchedule?.data?.filter((race: any) => new Date(race.date) < now) || [];
  const totalRaces = raceSchedule?.data?.length || 24;
  const progressPercentage = (completedRaces.length / totalRaces) * 100;
  
  // Get next 3 upcoming sessions
  const getUpcomingSessions = () => {
    if (!raceSchedule?.data) return [];
    
    const upcoming = raceSchedule.data
      .filter((race: any) => new Date(race.date) >= now)
      .slice(0, 3);
    
    return upcoming.map((race: any) => {
      const { session, raceName, country } = getNextSession(race);
      return {
        race,
        session,
        raceName,
        country,
        date: new Date(session?.date + "T" + (session?.time || "00:00:00Z"))
      };
    });
  };
  
  const upcomingSessions = getUpcomingSessions();

  // Race type constants and colors (align with RaceCalendar)
  const SINGLE_RACE = "single";
  const DOUBLE_HEADER = "double";
  const TRIPLE_HEADER = "triple";
  const raceTypeColors: Record<string, string> = {
    [SINGLE_RACE]: "bg-blue-500",
    [DOUBLE_HEADER]: "bg-green-500",
    [TRIPLE_HEADER]: "bg-purple-500",
    "summer-break": "bg-sky-300",
  };

  // Helper: consecutive weekends (same as RaceCalendar)
  const areConsecutiveWeekends = (date1: Date, date2: Date): boolean => {
    const week1 = getWeek(date1);
    const week2 = getWeek(date2);
    const year1 = getYear(date1);
    const year2 = getYear(date2);
    if (year1 === year2) return week2 - week1 === 1;
    return year2 > year1 && week1 >= 52 && week2 <= 1;
  };

  // Compute current season status: Summer Break or header type (single/double/triple)
  const computeSeasonStatus = () => {
    const races = raceSchedule?.data || [];
    if (races.length === 0) return { label: "Season", color: "bg-muted" };

    const nowTs = now.getTime();
    // Find index of next race
    let nextIdx = races.findIndex((r: any) => {
      const dt = r.time ? parseISO(`${r.date}T${r.time}`) : parseISO(`${r.date}T00:00:00Z`);
      return dt.getTime() >= nowTs;
    });
    if (nextIdx === -1) nextIdx = races.length - 1;

    const prevIdx = Math.max(0, nextIdx - 1);
    const nextRace = races[nextIdx];
    const prevRace = races[prevIdx];
    const nextDate = nextRace ? (nextRace.time ? parseISO(`${nextRace.date}T${nextRace.time}`) : parseISO(`${nextRace.date}T00:00:00Z`)) : null;
    const prevDate = prevRace ? (prevRace.time ? parseISO(`${prevRace.date}T${prevRace.time}`) : parseISO(`${prevRace.date}T00:00:00Z`)) : null;

    // Determine if currently within a summer break window
    let isSummerBreak = false;
    if (prevDate && nextDate) {
      const daysGap = differenceInDays(nextDate, prevDate);
      const isAugust = getMonth(prevDate) === 7 || getMonth(nextDate) === 7; // August
      const threshold = isAugust ? 14 : 21;
      const betweenPrevNext = prevDate.getTime() <= nowTs && nowTs <= nextDate.getTime();
      if (betweenPrevNext && daysGap > threshold) {
        isSummerBreak = true;
      }
    }

    if (isSummerBreak) {
      return { label: "Summer Break", color: raceTypeColors["summer-break"] };
    }

    // Build the current header cluster around nextIdx
    let start = nextIdx;
    let end = nextIdx;
    // expand backward
    while (start > 0) {
      const d1 = parseISO(races[start - 1].date);
      const d2 = parseISO(races[start].date);
      if (areConsecutiveWeekends(d1, d2)) start -= 1; else break;
    }
    // expand forward
    while (end < races.length - 1) {
      const d1 = parseISO(races[end].date);
      const d2 = parseISO(races[end + 1].date);
      if (areConsecutiveWeekends(d1, d2)) end += 1; else break;
    }
    const clusterLen = end - start + 1;
    const headerType = clusterLen >= 3 ? TRIPLE_HEADER : clusterLen === 2 ? DOUBLE_HEADER : SINGLE_RACE;
    const label = headerType === TRIPLE_HEADER ? "Triple Header" : headerType === DOUBLE_HEADER ? "Double Header" : "Single Race";
    const color = raceTypeColors[headerType];
    return { label, color };
  };

  const seasonStatus = computeSeasonStatus();

  // Determine race types across the calendar (similar to RaceCalendar)
  const determineRaceTypes = (races: any[]) => {
    const SINGLE = SINGLE_RACE;
    const DOUBLE = DOUBLE_HEADER;
    const TRIPLE = TRIPLE_HEADER;
    if (!races || races.length === 0) {
      return { raceTypes: [] as string[], summerBreakStart: -1, summerBreakEnd: -1 };
    }
    const raceTypes: string[] = Array(races.length).fill(SINGLE);
    let summerBreakStart = -1;
    let summerBreakEnd = -1;
    let currentHeader: number[] = [];
    for (let i = 0; i < races.length; i++) {
      const currentRaceDate = parseISO(races[i].date);
      if (i > 0) {
        const prevRaceDate = parseISO(races[i - 1].date);
        if (areConsecutiveWeekends(prevRaceDate, currentRaceDate)) {
          currentHeader.push(i);
        } else {
          if (currentHeader.length > 0) {
            const headerType = currentHeader.length === 2 ? DOUBLE : currentHeader.length === 3 ? TRIPLE : SINGLE;
            if (headerType !== SINGLE) {
              for (const idx of currentHeader) raceTypes[idx] = headerType;
            }
            currentHeader = [i];
          } else {
            currentHeader = [i];
          }
        }
      } else {
        currentHeader = [i];
      }
      if (getMonth(currentRaceDate) === 7) {
        if (i < races.length - 1) {
          const nextRaceDate = parseISO(races[i + 1].date);
          const daysBetween = differenceInDays(nextRaceDate, currentRaceDate);
          if (daysBetween > 14) {
            summerBreakStart = i;
            summerBreakEnd = i + 1;
          }
        }
      }
    }
    if (currentHeader.length > 1) {
      const headerType = currentHeader.length === 2 ? DOUBLE : currentHeader.length === 3 ? TRIPLE : SINGLE;
      if (headerType !== SINGLE) {
        for (const idx of currentHeader) raceTypes[idx] = headerType;
      }
    }
    return { raceTypes, summerBreakStart, summerBreakEnd };
  };

  const raceTypesData = determineRaceTypes(raceSchedule?.data || []);
  const raceTypes = raceTypesData.raceTypes;

  // Season insights
  const sprintCount = (raceSchedule?.data || []).filter((r: any) => !!r.Sprint).length;
  const { doubleHeaderClusters, tripleHeaderClusters } = (() => {
    let d = 0, t = 0;
    let i = 0;
    while (i < raceTypes.length) {
      if (raceTypes[i] === DOUBLE_HEADER) {
        d += 1;
        while (i < raceTypes.length && raceTypes[i] === DOUBLE_HEADER) i += 1;
        continue;
      }
      if (raceTypes[i] === TRIPLE_HEADER) {
        t += 1;
        while (i < raceTypes.length && raceTypes[i] === TRIPLE_HEADER) i += 1;
        continue;
      }
      i += 1;
    }
    return { doubleHeaderClusters: d, tripleHeaderClusters: t };
  })();
  const longestBreakDays = (() => {
    const races = raceSchedule?.data || [];
    let maxGap = 0;
    for (let i = 0; i < races.length - 1; i++) {
      const a = parseISO(races[i].date);
      const b = parseISO(races[i + 1].date);
      maxGap = Math.max(maxGap, differenceInDays(b, a));
    }
    return maxGap;
  })();

  const getUpcomingRaces = (count: number) => {
    const races = raceSchedule?.data || [];
    const upcoming = races.filter((r: any) => new Date(r.date) >= now);
    return upcoming.slice(0, count).map((race: any) => race);
  };
  
  const openRaceDetails = (race: any) => {
    setSelectedRace(race);
    setIsDialogOpen(true);
  };
  
  const closeRaceDetails = () => {
    setSelectedRace(null);
    setIsDialogOpen(false);
  };
  
  if (scheduleLoading || nextRaceLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Season Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Season Overview
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Season Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {currentYear} Championship Progress
              </span>
              <Badge variant="secondary" className="text-xs font-mono">
                {completedRaces.length}/{totalRaces}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <Progress 
                value={progressPercentage} 
                className="h-2 bg-muted"
                indicatorClassName="bg-gradient-to-r from-red-600 to-red-500"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{completedRaces.length} completed</span>
                <span>{totalRaces - completedRaces.length} remaining</span>
              </div>
            </div>
            
            {/* Season status indicator (aligns with Calendar legend colors) */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className={`w-2 h-2 rounded-full ${seasonStatus.color}`} />
              <span className="text-xs text-muted-foreground">{seasonStatus.label}</span>
              <div className={`w-2 h-2 rounded-full ${seasonStatus.color}`} />
            </div>
          </div>
          
          {/* Next Sessions - always visible */}
          <div className="space-y-3 border-t border-dashed border-purple-500/30 pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-foreground">Next Sessions</span>
            </div>
            <div className="space-y-2">
              {upcomingSessions.length > 0 ? upcomingSessions.map((item, index) => {
                const timeUntil = formatDistance(item.date, now, { addSuffix: true });
                const isNext = index === 0;
                return (
                  <div
                    key={item.race.round}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:bg-accent/30 ${
                      isNext
                        ? 'bg-gradient-to-r from-purple-500/10 to-transparent border-purple-500/30'
                        : 'bg-card border-border'
                    }`}
                    onClick={() => openRaceDetails(item.race)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <CountryFlag country={item.country} size={16} svg={true} />
                        <div>
                          <div className="text-sm font-medium">{getRaceNameWithoutEmoji(item.raceName)}</div>
                          <div className="text-xs text-muted-foreground">{item.session?.shortName || 'Race'}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono text-muted-foreground">{timeUntil}</div>
                      {isNext && (
                        <Badge variant="outline" className="text-xs mt-1 border-purple-500/50 text-purple-600 dark:text-purple-400">Next</Badge>
                      )}
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-4 text-muted-foreground text-sm">Season complete</div>
              )}
            </div>
          </div>

          {/* Season Stats (moved just below Next Sessions) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-border">
            <div className="text-center p-3 rounded-lg bg-gradient-to-r from-green-500/10 to-transparent border border-green-500/20">
              <div className="text-lg font-mono font-bold text-foreground">{completedRaces.length}</div>
              <div className="text-xs text-muted-foreground">Races Done</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20">
              <div className="text-lg font-mono font-bold text-foreground">{totalRaces - completedRaces.length}</div>
              <div className="text-xs text-muted-foreground">Races Remaining</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-transparent border border-purple-500/20">
              <div className="text-lg font-mono font-bold text-foreground">{sprintCount}</div>
              <div className="text-xs text-muted-foreground">Sprint Weekends</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20">
              <div className="text-lg font-mono font-bold text-foreground">{longestBreakDays}d</div>
              <div className="text-xs text-muted-foreground">Longest Gap</div>
            </div>
          </div>

          {/* Upcoming Calendar - exclude any races shown in Next Sessions. Expands when expandedView, scrolls otherwise */}
          <div className="space-y-2 pt-4 border-t border-border/50">
            <div className="mb-2 text-sm font-medium text-foreground">Upcoming Calendar</div>
            <div className={`space-y-2 pr-1 ${expandedView ? '' : 'max-h-100 overflow-y-auto'}`}>
              {(() => {
                const excludedRounds = new Set((upcomingSessions || []).map((u: any) => u.race.round));
                const upcoming = (raceSchedule?.data || []).filter((r: any) => new Date(r.date) >= now && !excludedRounds.has(r.round));
                const displayed = expandedView ? upcoming : upcoming.slice(0, 12);
                return displayed.map((race: any) => {
                  const raceDate = new Date(race.date);
                  const idxInSchedule = (raceSchedule?.data || []).findIndex((r: any) => r.round === race.round);
                  const typeKey = raceTypes[idxInSchedule] || SINGLE_RACE;
                  const typeLabel = typeKey === TRIPLE_HEADER ? 'Triple Header' : typeKey === DOUBLE_HEADER ? 'Double Header' : 'Single';
                  const typeColor = raceTypeColors[typeKey] || raceTypeColors[SINGLE_RACE];
                  return (
                    <div
                      key={race.round}
                      className="flex items-center justify-between p-2 rounded-lg border bg-card border-border hover:bg-accent/30 transition-colors"
                      onClick={() => openRaceDetails(race)}
                    >
                      <div className="flex items-center gap-2">
                        <CountryFlag country={race.Circuit?.Location?.country || ''} size={14} svg={true} />
                        <div>
                          <div className="text-xs font-medium">{getRaceNameWithoutEmoji(race.raceName)}</div>
                          <div className="text-xs text-muted-foreground">R{race.round} • {raceDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!!race.Sprint && <Badge variant="outline" className="text-[10px] h-5 border-yellow-500/50 text-yellow-600 dark:text-yellow-400">Sprint</Badge>}
                        <div className="flex items-center gap-1 text-[10px]">
                          <div className={`w-2 h-2 rounded-full ${typeColor}`} />
                          <span className="text-muted-foreground">{typeLabel}</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
          
          {/* (stats moved above) */}

          {/* Removed duplicate extended preview; Upcoming Calendar handled above */}
        </CardContent>
      </Card>
      
      {/* Race Detail Dialog */}
      {selectedRace && (
        <RaceDetailDialog 
          isOpen={isDialogOpen} 
          onClose={closeRaceDetails} 
          race={selectedRace} 
        />
      )}
    </>
  );
};

export default SeasonalReviewPanel;
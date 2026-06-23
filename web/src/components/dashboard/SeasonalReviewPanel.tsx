import { F1Card, F1CardContent, F1CardHeader, F1CardTitle } from "@/components/f1";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Clock, Zap } from "lucide-react";
import { useState } from "react";
import { formatDistance, parseISO, differenceInDays, getMonth, getWeek, getYear } from "date-fns";
import { useRaceSchedule, useNextRace } from "@/hooks/useF1Data";
import CountryFlag from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { getNextSession } from "@/utils/nextSessionUtils";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

interface SeasonalReviewPanelProps {
  year?: number;
  expandedView?: boolean;
}

const SeasonalReviewPanel = ({ year, expandedView = false }: SeasonalReviewPanelProps) => {
  const currentYear = year || new Date().getFullYear();
  const { data: raceSchedule, isLoading: scheduleLoading } = useRaceSchedule(currentYear);
  const { isLoading: nextRaceLoading } = useNextRace(currentYear);
  const [selectedRace, setSelectedRace] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { isGlass } = useTheme();
  const surfaceVariant = isGlass ? ("glass" as const) : ("default" as const);
  const surfaceGlass = isGlass ? ("panel" as const) : ("default" as const);
  
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

  // Race type constants
  const SINGLE_RACE = "single";
  const DOUBLE_HEADER = "double";
  const TRIPLE_HEADER = "triple";
  
  const raceTypeColors: Record<string, { bg: string; text: string; border: string }> = {
    [SINGLE_RACE]: { bg: "bg-muted-foreground/50", text: "text-muted-foreground", border: "border-muted" },
    [DOUBLE_HEADER]: { bg: "bg-green-500", text: "text-green-500", border: "border-green-500/30" },
    [TRIPLE_HEADER]: { bg: "bg-primary", text: "text-primary", border: "border-primary/30" },
    "summer-break": { bg: "bg-sky-400", text: "text-sky-400", border: "border-sky-400/30" },
  };

  const areConsecutiveWeekends = (date1: Date, date2: Date): boolean => {
    const week1 = getWeek(date1);
    const week2 = getWeek(date2);
    const year1 = getYear(date1);
    const year2 = getYear(date2);
    if (year1 === year2) return week2 - week1 === 1;
    return year2 > year1 && week1 >= 52 && week2 <= 1;
  };

  const computeSeasonStatus = () => {
    const races = raceSchedule?.data || [];
    if (races.length === 0) return { label: "Season", type: SINGLE_RACE };

    const nowTs = now.getTime();
    let nextIdx = races.findIndex((r: any) => {
      const dt = r.time ? parseISO(`${r.date}T${r.time}`) : parseISO(`${r.date}T00:00:00Z`);
      return dt.getTime() >= nowTs;
    });
    if (nextIdx === -1) nextIdx = races.length - 1;

    const prevIdx = Math.max(0, nextIdx - 1);
    const nextRaceData = races[nextIdx];
    const prevRace = races[prevIdx];
    const nextDate = nextRaceData ? (nextRaceData.time ? parseISO(`${nextRaceData.date}T${nextRaceData.time}`) : parseISO(`${nextRaceData.date}T00:00:00Z`)) : null;
    const prevDate = prevRace ? (prevRace.time ? parseISO(`${prevRace.date}T${prevRace.time}`) : parseISO(`${prevRace.date}T00:00:00Z`)) : null;

    let isSummerBreak = false;
    if (prevDate && nextDate) {
      const daysGap = differenceInDays(nextDate, prevDate);
      const isAugust = getMonth(prevDate) === 7 || getMonth(nextDate) === 7;
      const threshold = isAugust ? 14 : 21;
      const betweenPrevNext = prevDate.getTime() <= nowTs && nowTs <= nextDate.getTime();
      if (betweenPrevNext && daysGap > threshold) isSummerBreak = true;
    }

    if (isSummerBreak) return { label: "Summer Break", type: "summer-break" };

    let start = nextIdx;
    let end = nextIdx;
    while (start > 0) {
      const d1 = parseISO(races[start - 1].date);
      const d2 = parseISO(races[start].date);
      if (areConsecutiveWeekends(d1, d2)) start -= 1; else break;
    }
    while (end < races.length - 1) {
      const d1 = parseISO(races[end].date);
      const d2 = parseISO(races[end + 1].date);
      if (areConsecutiveWeekends(d1, d2)) end += 1; else break;
    }
    const clusterLen = end - start + 1;
    const headerType = clusterLen >= 3 ? TRIPLE_HEADER : clusterLen === 2 ? DOUBLE_HEADER : SINGLE_RACE;
    const label = headerType === TRIPLE_HEADER ? "Triple Header" : headerType === DOUBLE_HEADER ? "Double Header" : "Single Race";
    return { label, type: headerType };
  };

  const seasonStatus = computeSeasonStatus();
  const statusColors = raceTypeColors[seasonStatus.type] || raceTypeColors[SINGLE_RACE];

  const determineRaceTypes = (races: any[]) => {
    if (!races || races.length === 0) return { raceTypes: [] as string[], summerBreakStart: -1, summerBreakEnd: -1 };
    const raceTypes: string[] = Array(races.length).fill(SINGLE_RACE);
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
          if (currentHeader.length > 1) {
            const headerType = currentHeader.length === 2 ? DOUBLE_HEADER : currentHeader.length >= 3 ? TRIPLE_HEADER : SINGLE_RACE;
            for (const idx of currentHeader) raceTypes[idx] = headerType;
          }
          currentHeader = [i];
        }
      } else {
        currentHeader = [i];
      }
      if (getMonth(currentRaceDate) === 7 && i < races.length - 1) {
        const nextRaceDate = parseISO(races[i + 1].date);
        if (differenceInDays(nextRaceDate, currentRaceDate) > 14) {
          summerBreakStart = i;
          summerBreakEnd = i + 1;
        }
      }
    }
    if (currentHeader.length > 1) {
      const headerType = currentHeader.length === 2 ? DOUBLE_HEADER : currentHeader.length >= 3 ? TRIPLE_HEADER : SINGLE_RACE;
      for (const idx of currentHeader) raceTypes[idx] = headerType;
    }
    return { raceTypes, summerBreakStart, summerBreakEnd };
  };

  const raceTypesData = determineRaceTypes(raceSchedule?.data || []);
  const raceTypes = raceTypesData.raceTypes;

  const sprintCount = (raceSchedule?.data || []).filter((r: any) => !!r.Sprint).length;
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

  const openRaceDetails = (race: any) => {
    setSelectedRace(race);
    setIsDialogOpen(true);
  };
  
  if (scheduleLoading || nextRaceLoading) {
    return (
      <F1Card
        variant={surfaceVariant}
        glassVariant={surfaceGlass}
        className={cn("h-full p-0", isGlass && "border-white/10")}
      >
        <F1CardHeader className="pb-3">
          <F1CardTitle icon={<CalendarDays className="h-5 w-5" />}>
            Season Overview
          </F1CardTitle>
        </F1CardHeader>
        <F1CardContent>
          <div className="space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </F1CardContent>
      </F1Card>
    );
  }
  
  return (
    <>
      <F1Card
        variant={surfaceVariant}
        glassVariant={surfaceGlass}
        className={cn("h-full p-0", isGlass && "border-white/10")}
      >
        <F1CardHeader className="pb-3">
          <F1CardTitle icon={<CalendarDays className="h-5 w-5" />}>
            Season Overview
          </F1CardTitle>
        </F1CardHeader>
        
        <F1CardContent className="space-y-3 md:space-y-4">
          {/* Season Progress */}
          <div className="space-y-2 md:space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-medium text-foreground truncate">{currentYear} Championship Progress</span>
              <Badge variant="secondary" className="font-mono text-[10px] sm:text-xs shrink-0">
                {completedRaces.length}/{totalRaces}
              </Badge>
            </div>
            
            <div className="space-y-1.5 md:space-y-2">
              <Progress 
                value={progressPercentage} 
                className="h-1.5 md:h-2"
                indicatorClassName="bg-gradient-to-r from-primary to-primary/80"
              />
              <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                <span>{completedRaces.length} completed</span>
                <span>{totalRaces - completedRaces.length} remaining</span>
              </div>
            </div>
            
            {/* Season Status */}
            <div className="flex items-center justify-center gap-1.5 md:gap-2 pt-1.5 md:pt-2">
              <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${statusColors.bg}`} />
              <span className={`text-[10px] sm:text-xs ${statusColors.text}`}>{seasonStatus.label}</span>
              <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${statusColors.bg}`} />
            </div>
          </div>
          
          {/* Next Sessions */}
          <div className={`space-y-2 md:space-y-3 pt-3 md:pt-4 border-t border-dashed ${statusColors.border}`}>
            <div className="flex items-center gap-1.5 md:gap-2">
              <Clock className={`h-3.5 w-3.5 md:h-4 md:w-4 ${statusColors.text} shrink-0`} />
              <span className="text-xs sm:text-sm font-medium text-foreground">Next Sessions</span>
            </div>
            
            <div className="space-y-1.5 md:space-y-2">
              {upcomingSessions.length > 0 ? upcomingSessions.map((item: { race: { round: string }; session?: { session_type?: string; shortName?: string } | null; date: Date; country: string; raceName: string }, index: number) => {
                const timeUntil = formatDistance(item.date, now, { addSuffix: false });
                const isNext = index === 0;
                return (
                  <div
                    key={item.race.round}
                    onClick={() => openRaceDetails(item.race)}
                    className={`flex items-center justify-between p-2 md:p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:bg-accent/30 ${
                      isNext 
                        ? `bg-gradient-to-r from-primary/10 to-transparent border-primary/30`
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                      <div className="shrink-0">
                        <CountryFlag country={item.country} size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-medium truncate">{getRaceNameWithoutEmoji(item.raceName)}</div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground">{item.session?.shortName || 'Race'}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="text-[10px] sm:text-xs font-mono text-muted-foreground">in {timeUntil}</div>
                      {isNext && (
                        <Badge variant="outline" className="text-[10px] sm:text-xs mt-0.5 md:mt-1 border-primary/50 text-primary">
                          Next
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-3 md:py-4 text-muted-foreground text-xs sm:text-sm">Season complete</div>
              )}
            </div>
          </div>

          {/* Season Stats - Responsive grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4 pt-4 border-t border-border">
            <div className="text-center p-2 sm:p-2.5 md:p-3 rounded-lg bg-gradient-to-r from-green-500/10 to-transparent border border-green-500/20">
              <div className="text-base sm:text-lg font-mono font-bold text-foreground">{completedRaces.length}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Races Done</div>
            </div>
            <div className="text-center p-2 sm:p-2.5 md:p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20">
              <div className="text-base sm:text-lg font-mono font-bold text-foreground">{totalRaces - completedRaces.length}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Races Remaining</div>
            </div>
            <div className="text-center p-2 sm:p-2.5 md:p-3 rounded-lg bg-gradient-to-r from-[hsl(var(--position-gold)/0.1)] to-transparent border border-[hsl(var(--position-gold)/0.2)]">
              <div className="text-base sm:text-lg font-mono font-bold text-foreground">{sprintCount}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Sprint Weekends</div>
            </div>
            <div className="text-center p-2 sm:p-2.5 md:p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20">
              <div className="text-base sm:text-lg font-mono font-bold text-foreground">{longestBreakDays}d</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Longest Gap</div>
            </div>
          </div>

          {/* Upcoming Calendar */}
          <div className="space-y-1.5 md:space-y-2 pt-3 md:pt-4 border-t border-border/50">
            <div className="mb-1.5 md:mb-2 text-xs sm:text-sm font-medium text-foreground">Upcoming Calendar</div>
            
            <div className={`space-y-1.5 md:space-y-2 pr-1 ${!expandedView ? "max-h-[180px] sm:max-h-[200px] overflow-y-auto" : ""}`}>
              {(() => {
                const excludedRounds = new Set((upcomingSessions || []).map((u: any) => u.race.round));
                const upcoming = (raceSchedule?.data || []).filter((r: any) => new Date(r.date) >= now && !excludedRounds.has(r.round));
                const displayed = expandedView ? upcoming : upcoming.slice(0, 8);
                
                return displayed.map((race: any) => {
                  const raceDate = new Date(race.date);
                  const idxInSchedule = (raceSchedule?.data || []).findIndex((r: any) => r.round === race.round);
                  const typeKey = raceTypes[idxInSchedule] || SINGLE_RACE;
                  const typeColor = raceTypeColors[typeKey];
                  
                  return (
                    <div
                      key={race.round}
                      onClick={() => openRaceDetails(race)}
                      className="flex items-center justify-between p-1.5 md:p-2 rounded-lg hover:bg-accent/30 transition-colors cursor-pointer gap-2"
                    >
                      <div className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-1">
                        <div className="shrink-0">
                          <CountryFlag country={race.Circuit?.Location?.country || ''} size={12} />
                        </div>
                        <span className="text-xs sm:text-sm truncate">{getRaceNameWithoutEmoji(race.raceName)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                        {!!race.Sprint && (
                          <Zap className="h-2.5 w-2.5 md:h-3 md:w-3 text-yellow-500 fill-yellow-500 shrink-0" />
                        )}
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                          {raceDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${typeColor.bg} shrink-0`} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </F1CardContent>
      </F1Card>
      
      {/* Race Detail Dialog */}
      {selectedRace && (
        <RaceDetailDialog 
          isOpen={isDialogOpen} 
          onClose={() => { setSelectedRace(null); setIsDialogOpen(false); }} 
          race={selectedRace} 
        />
      )}
    </>
  );
};

export default SeasonalReviewPanel;

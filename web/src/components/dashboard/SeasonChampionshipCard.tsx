import { F1Card, F1CardContent, F1CardHeader, F1CardTitle } from "@/components/f1";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Clock } from "lucide-react";
import { useState, useMemo } from "react";
import { formatDistance, parseISO, differenceInDays, getMonth, getWeek, getYear } from "date-fns";
import { useRaceSchedule, useNextRace } from "@/hooks/useF1Data";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import CountryFlag from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { getNextSession } from "@/utils/nextSessionUtils";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

interface SeasonChampionshipCardProps {
  year?: number;
}

const SeasonChampionshipCard = ({ year }: SeasonChampionshipCardProps) => {
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
  const remainingRaces = totalRaces - completedRaces.length;
  const progressPercentage = (completedRaces.length / totalRaces) * 100;
  
  // Check if season is complete
  const isSeasonComplete = remainingRaces === 0 && completedRaces.length > 0;
  
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
    [DOUBLE_HEADER]: { bg: "bg-status-completed", text: "text-status-completed", border: "border-status-completed/30" },
    [TRIPLE_HEADER]: { bg: "bg-primary", text: "text-primary", border: "border-primary/30" },
    "summer-break": { bg: "bg-status-upcoming", text: "text-status-upcoming", border: "border-status-upcoming/30" },
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
  const sprintCount = (raceSchedule?.data || []).filter((r: any) => !!r.Sprint).length;
  
  // Calculate longest gap
  const longestBreakDays = useMemo(() => {
    const races = raceSchedule?.data || [];
    let maxGap = 0;
    for (let i = 0; i < races.length - 1; i++) {
      const a = parseISO(races[i].date);
      const b = parseISO(races[i + 1].date);
      maxGap = Math.max(maxGap, differenceInDays(b, a));
    }
    return maxGap;
  }, [raceSchedule?.data]);
  
  const openRaceDetails = (race: any) => {
    setSelectedRace(race);
    setIsDialogOpen(true);
  };
  
  const isLoading = scheduleLoading || nextRaceLoading;

  if (isLoading) {
    return (
      <F1Card
        variant={surfaceVariant}
        glassVariant={surfaceGlass}
        className={cn("h-full p-0", isGlass && "border-white/10")}
      >
        <F1CardHeader className="pb-3">
          <F1CardTitle icon={<CalendarDays className="h-5 w-5" />} className="text-base font-semibold">
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
  
  // Hide the card when season is complete
  if (isSeasonComplete) {
    return null;
  }
  
  return (
    <>
      <F1Card
        variant={surfaceVariant}
        glassVariant={surfaceGlass}
        className={cn("h-full p-0", isGlass && "border-white/10")}
      >
        <F1CardHeader className="pb-3">
          <F1CardTitle icon={<CalendarDays className="h-5 w-5" />} className="text-base font-semibold">
            Season Overview
          </F1CardTitle>
        </F1CardHeader>
        
        <F1CardContent className="space-y-3">
          {/* Season Progress */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">{currentYear} Championship Progress</span>
              <Badge variant="secondary" className="timing text-xs">
                {completedRaces.length}/{totalRaces}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <Progress 
                value={progressPercentage}
                className="h-2"
                indicatorClassName="bg-primary"
              />
              <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
                <span>{completedRaces.length} completed</span>
                <span>{remainingRaces} remaining</span>
              </div>
            </div>
            
            {/* Season Status */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className={`w-2 h-2 rounded-full ${statusColors.bg}`} />
              <span className={`text-xs font-medium ${statusColors.text}`}>{seasonStatus.label}</span>
              <div className={`w-2 h-2 rounded-full ${statusColors.bg}`} />
            </div>
          </div>
          
          {/* Next Sessions */}
          <div className="space-y-2.5 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <Clock className={`h-4 w-4 ${statusColors.text}`} />
              <span className="text-sm font-medium text-foreground">Next Sessions</span>
            </div>

            <div className="space-y-1.5">
              {upcomingSessions.map((item: { race: { round: string }; session?: { session_type?: string; shortName?: string } | null; date: Date; country: string; raceName: string }, index: number) => {
                const timeUntil = formatDistance(item.date, now, { addSuffix: false });
                const isNext = index === 0;
                return (
                  <div
                    key={item.race.round}
                    onClick={() => openRaceDetails(item.race)}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg border transition-all duration-200 cursor-pointer hover:bg-accent/30",
                      isNext
                        ? "bg-primary/5 border-primary/30"
                        : "border-border"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <CountryFlag country={item.country} size={16} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{getRaceNameWithoutEmoji(item.raceName)}</div>
                        <div className="text-xs text-muted-foreground">{item.session?.shortName || 'Race'}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="text-xs timing text-muted-foreground">in {timeUntil}</div>
                      {isNext && (
                        <Badge variant="outline" className="instrument-label mt-1 border-primary/50 text-primary">
                          Next
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Season Stats — one cohesive instrument cluster */}
          <div className="mt-3 grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/40 sm:grid-cols-4 sm:divide-y-0">
            <div className="px-3 py-2.5">
              <p className="instrument-label text-[10px]">Done</p>
              <AnimatedNumber value={completedRaces.length} mono className="readout mt-1 block text-lg leading-none text-gain" />
            </div>
            <div className="px-3 py-2.5">
              <p className="instrument-label text-[10px]">Left</p>
              <AnimatedNumber value={remainingRaces} mono className="readout mt-1 block text-lg leading-none text-foreground" />
            </div>
            <div className="px-3 py-2.5">
              <p className="instrument-label text-[10px]">Sprints</p>
              <AnimatedNumber value={sprintCount} mono className="readout mt-1 block text-lg leading-none text-foreground" />
            </div>
            <div className="px-3 py-2.5">
              <p className="instrument-label text-[10px]">Max Gap</p>
              <AnimatedNumber value={longestBreakDays} mono suffix="d" className="readout mt-1 block text-lg leading-none text-foreground" />
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

export default SeasonChampionshipCard;

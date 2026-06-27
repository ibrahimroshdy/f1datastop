import { useState, useMemo } from "react";
import { format, parseISO, addDays } from "date-fns";
import { useRaceSchedule } from "@/hooks/useF1Data";
import {
  determineRaceTypes,
  type CalendarView,
} from "@/components/calendar/raceCalendarUtils";

export type RaceStatus = "completed" | "next" | "upcoming";

export interface SummerBreakItem {
  isSummerBreak: true;
  dates: { start: string; end: string };
}

export interface RaceScheduleItem {
  isSummerBreak?: false;
  race: any;
  index: number;
}

export type RaceWithBreakItem = SummerBreakItem | RaceScheduleItem;

export function useRaceCalendar() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedRace, setSelectedRace] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // Dense list is the native-app default; grid remains available via the toggle
  const [viewMode, setViewMode] = useState<CalendarView>("list");
  const [expandedRaces, setExpandedRaces] = useState<Set<string>>(new Set());

  const { data: raceSchedule, isLoading } = useRaceSchedule(selectedYear);
  const currentDate = new Date();

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  const toggleRaceExpansion = (raceRound: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedRaces((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(raceRound)) {
        newSet.delete(raceRound);
      } else {
        newSet.add(raceRound);
      }
      return newSet;
    });
  };

  const openRaceDetails = (race: any) => {
    if ((window as any).calendarAnalytics) {
      (window as any).calendarAnalytics.trackRaceCardClick(race);
    }

    setSelectedRace(race);
    setIsDialogOpen(true);
  };

  const closeRaceDetails = () => {
    setIsDialogOpen(false);
  };

  const getRaceStatus = (race: any): RaceStatus => {
    const raceDateTime = race.time
      ? parseISO(`${race.date}T${race.time}`)
      : parseISO(`${race.date}T00:00:00Z`);

    if (raceDateTime < currentDate) {
      return "completed";
    }

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

  const raceTypeData = useMemo(
    () => determineRaceTypes(raceSchedule?.data || []),
    [raceSchedule?.data],
  );
  const raceTypes = raceTypeData.raceTypes;
  const summerBreakStart = raceTypeData.summerBreakStart;
  const summerBreakEnd = raceTypeData.summerBreakEnd;

  const summerBreakDates = useMemo(() => {
    if (summerBreakStart >= 0 && summerBreakEnd >= 0 && raceSchedule?.data) {
      const startRace = raceSchedule.data[summerBreakStart];
      const endRace = raceSchedule.data[summerBreakEnd];

      if (startRace && endRace) {
        const startDate = parseISO(startRace.date);
        const endDate = parseISO(endRace.date);
        const breakStartDate = addDays(startDate, 1);
        const breakEndDate = addDays(endDate, -1);

        return {
          start: format(breakStartDate, "dd MMM"),
          end: format(breakEndDate, "dd MMM"),
        };
      }
    }

    return { start: "", end: "" };
  }, [raceSchedule?.data, summerBreakStart, summerBreakEnd]);

  const racesWithBreak = useMemo((): RaceWithBreakItem[] => {
    if (!raceSchedule?.data) return [];

    const result: RaceWithBreakItem[] = [];
    let breakInserted = false;

    for (let i = 0; i < raceSchedule.data.length; i++) {
      if (i === summerBreakStart + 1 && !breakInserted) {
        result.push({
          isSummerBreak: true,
          dates: summerBreakDates,
        });
        breakInserted = true;
      }

      result.push({
        race: raceSchedule.data[i],
        index: i,
      });
    }

    return result;
  }, [raceSchedule?.data, summerBreakStart, summerBreakDates]);

  return {
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
  };
}

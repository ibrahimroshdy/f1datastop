import { useState, useEffect } from "react";
import {
  useRaceResults,
  useRaceQualifying,
  useSprintResults,
} from "@/hooks/useF1Data";
import { getSprintQualifyingResults } from "./raceDetailUtils";

type RaceLike = {
  season?: string;
  round?: string;
  Sprint?: unknown;
  FirstPractice?: unknown;
  SecondPractice?: unknown;
  ThirdPractice?: unknown;
  SprintQualifying?: unknown;
  Qualifying?: unknown;
};

export function useRaceDetailDialog(race: RaceLike | null | undefined, isOpen: boolean) {
  const [selectedTab, setSelectedTab] = useState("info");
  const [dialogOpenTime, setDialogOpenTime] = useState(0);

  const season = parseInt(race?.season || "0", 10);
  const round = race?.round || "0";
  const hasSprint = !!race?.Sprint;

  const { data: raceResults, isLoading: isResultsLoading } = useRaceResults(
    season,
    round,
  );
  const { data: qualifyingResults, isLoading: isQualifyingLoading } =
    useRaceQualifying(season, round);
  const { data: sprintResults, isLoading: isSprintLoading } = useSprintResults(
    season,
    round,
  );

  const sprintQualifyingResults = getSprintQualifyingResults(
    sprintResults?.data,
  );

  useEffect(() => {
    if (race && isOpen) {
      if ((window as { calendarAnalytics?: { trackRaceDetailDialog: Function } }).calendarAnalytics) {
        (window as { calendarAnalytics: { trackRaceDetailDialog: Function } }).calendarAnalytics.trackRaceDetailDialog(
          "open",
          race,
        );
      }
      setDialogOpenTime(Date.now());
      setSelectedTab("info");

      const sessions: string[] = [];
      if (race.FirstPractice) sessions.push("FirstPractice");
      if (race.SecondPractice) sessions.push("SecondPractice");
      if (race.ThirdPractice) sessions.push("ThirdPractice");
      if (race.SprintQualifying) sessions.push("SprintQualifying");
      if (race.Sprint) sessions.push("Sprint");
      if (race.Qualifying) sessions.push("Qualifying");

      if ((window as { calendarAnalytics?: { trackSessionScheduleView: Function } }).calendarAnalytics) {
        (window as { calendarAnalytics: { trackSessionScheduleView: Function } }).calendarAnalytics.trackSessionScheduleView(
          race,
          sessions,
        );
      }
    }
  }, [race?.round, race?.season, isOpen, race]);

  useEffect(() => {
    const analytics = (window as { calendarAnalytics?: Record<string, Function> }).calendarAnalytics;
    if (!race || !selectedTab || !analytics) return;

    switch (selectedTab) {
      case "results":
        if (raceResults?.data?.Results?.length) {
          analytics.trackRaceResultsView?.(race, "race", raceResults.data.Results.length);
        }
        break;
      case "sprint":
        if (sprintResults?.data?.SprintResults?.length) {
          analytics.trackRaceResultsView?.(
            race,
            "sprint",
            sprintResults.data.SprintResults.length,
          );
        }
        break;
      case "sprint-qualifying":
        if (sprintQualifyingResults?.length) {
          analytics.trackRaceResultsView?.(
            race,
            "sprint-qualifying",
            sprintQualifyingResults.length,
          );
        }
        break;
      case "qualifying":
        if (qualifyingResults?.data?.QualifyingResults?.length) {
          analytics.trackRaceResultsView?.(
            race,
            "qualifying",
            qualifyingResults.data.QualifyingResults.length,
          );
        }
        break;
      case "distribution":
        if (
          raceResults?.data?.Results?.length ||
          sprintResults?.data?.SprintResults?.length
        ) {
          analytics.trackRaceResultsView?.(
            race,
            "distribution",
            (raceResults?.data?.Results?.length || 0) +
              (sprintResults?.data?.SprintResults?.length || 0),
          );
        }
        break;
    }
  }, [
    selectedTab,
    raceResults,
    sprintResults,
    qualifyingResults,
    sprintQualifyingResults,
    race,
  ]);

  const handleTabChange = (newTab: string) => {
    const analytics = (window as { calendarAnalytics?: { trackRaceDetailDialog: Function } }).calendarAnalytics;
    if (analytics && race) {
      analytics.trackRaceDetailDialog("tab_change", race, {
        selectedTab: newTab,
        previousTab: selectedTab,
      });
    }
    setSelectedTab(newTab);
  };

  const handleClose = () => {
    const analytics = (window as { calendarAnalytics?: { trackRaceDetailDialog: Function } }).calendarAnalytics;
    if (analytics && race && dialogOpenTime > 0) {
      analytics.trackRaceDetailDialog("close", race, {
        selectedTab,
        timeSpent: Math.floor((Date.now() - dialogOpenTime) / 1000),
      });
    }
  };

  return {
    selectedTab,
    setSelectedTab: handleTabChange,
    hasSprint,
    raceResults,
    isResultsLoading,
    qualifyingResults,
    isQualifyingLoading,
    sprintResults,
    isSprintLoading,
    sprintQualifyingResults,
    handleClose,
  };
}

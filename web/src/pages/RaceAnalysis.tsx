import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RaceAnalysisHeader } from "@/components/race-analysis/RaceAnalysisHeader";
import { RacePicker } from "@/components/race-analysis/RacePicker";
import { RaceAnalysisTabs } from "@/components/race-analysis/RaceAnalysisTabs";
import {
  DEFAULT_RACE_ANALYSIS_TAB,
  isAdvancedTab,
  type RaceAnalysisTabId,
} from "@/components/race-analysis/raceAnalysisTabs.config";
import { type SessionOption } from "@/components/f1";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { useSessionsByYear } from "@/hooks/useOpenF1Data";
import { pageShellWide, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";

type RaceScheduleEntry = {
  round: string;
  raceName: string;
  date: string;
  Circuit?: { circuitName?: string; Location?: { country?: string } };
};

type OpenF1SessionEntry = {
  date_start: string;
  session_key: number;
  session_type: string;
  meeting_key: number;
  session_name: string;
  date_end: string;
};

const getDefaultYear = () => new Date().getFullYear();

const RaceAnalysis = () => {
  const { year: urlYear, round: urlRound } = useParams();
  const navigate = useNavigate();

  const [selectedYear, setSelectedYear] = useState<number>(
    urlYear ? parseInt(urlYear, 10) : getDefaultYear()
  );
  const [selectedRace, setSelectedRace] = useState<string>(urlRound || "1");
  const [selectedTab, setSelectedTab] = useState<RaceAnalysisTabId>(
    DEFAULT_RACE_ANALYSIS_TAB
  );
  const [selectedSessionKey, setSelectedSessionKey] = useState<number | null>(null);
  const [availableSessions, setAvailableSessions] = useState<SessionOption[]>([]);

  const { data: raceScheduleData, isLoading: isRaceScheduleLoading } =
    useRaceSchedule(selectedYear);
  const { data: openF1SessionsData, isLoading: isOpenF1Loading } =
    useSessionsByYear(selectedYear);

  const currentRace = useMemo(() => {
    if (!raceScheduleData?.data) return null;
    return raceScheduleData.data.find(
      (race: RaceScheduleEntry) => race.round === selectedRace
    );
  }, [raceScheduleData, selectedRace]);

  useEffect(() => {
    if (urlYear) {
      setSelectedYear(parseInt(urlYear, 10));
    }
    if (urlRound) {
      setSelectedRace(urlRound);
    }
  }, [urlYear, urlRound]);

  useEffect(() => {
    if (!openF1SessionsData?.data || !currentRace) {
      setAvailableSessions([]);
      return;
    }

    const raceDate = new Date(currentRace.date);
    const matchingSessions = openF1SessionsData.data.filter(
      (session: OpenF1SessionEntry) => {
        const sessionDate = new Date(session.date_start);
        const daysDiff = Math.abs(
          (sessionDate.getTime() - raceDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysDiff < 7;
      }
    );

    if (matchingSessions.length === 0) {
      setAvailableSessions([]);
      return;
    }

    const sortedSessions = [...matchingSessions].sort(
      (a: OpenF1SessionEntry, b: OpenF1SessionEntry) =>
        new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
    );
    setAvailableSessions(sortedSessions);

    const raceSession = sortedSessions.find(
      (session: OpenF1SessionEntry) => session.session_type === "Race"
    );
    if (raceSession && !selectedSessionKey) {
      setSelectedSessionKey(raceSession.session_key);
    } else if (!selectedSessionKey && sortedSessions.length > 0) {
      setSelectedSessionKey(sortedSessions[0].session_key);
    }
  }, [openF1SessionsData, currentRace, selectedSessionKey]);

  const hasOpenF1Data = selectedYear >= 2023 && availableSessions.length > 0;

  useEffect(() => {
    if (!hasOpenF1Data && isAdvancedTab(selectedTab)) {
      setSelectedTab(DEFAULT_RACE_ANALYSIS_TAB);
    }
  }, [hasOpenF1Data, selectedTab]);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setSelectedRace("1");
    setSelectedSessionKey(null);
    navigate(`/race-analysis/${year}/1`);
  };

  const handleRaceChange = (round: string) => {
    setSelectedRace(round);
    setSelectedSessionKey(null);
    navigate(`/race-analysis/${selectedYear}/${round}`);
  };

  const handleSessionChange = (value: string) => {
    setSelectedSessionKey(null);
    setTimeout(() => setSelectedSessionKey(Number(value)), 50);
  };

  return (
    <div className={pageShellWide}>
      <div className={cn(pageStack, "animate-fade-in")}>
        <RaceAnalysisHeader selectedYear={selectedYear} currentRace={currentRace} />

        <RacePicker
          selectedYear={selectedYear}
          selectedRace={selectedRace}
          currentRace={currentRace}
          raceSchedule={raceScheduleData?.data}
          isRaceScheduleLoading={isRaceScheduleLoading}
          hasOpenF1Data={hasOpenF1Data}
          availableSessions={availableSessions}
          selectedSessionKey={selectedSessionKey}
          isOpenF1Loading={isOpenF1Loading}
          onYearChange={handleYearChange}
          onRaceChange={handleRaceChange}
          onSessionChange={handleSessionChange}
        />

        <RaceAnalysisTabs
          selectedTab={selectedTab}
          onTabChange={setSelectedTab}
          hasOpenF1Data={hasOpenF1Data}
          selectedYear={selectedYear}
          selectedRace={selectedRace}
          selectedSessionKey={selectedSessionKey}
        />
      </div>
    </div>
  );
};

export default RaceAnalysis;

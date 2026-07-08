import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RaceAnalysisHeader } from "@/components/race-analysis/RaceAnalysisHeader";
import { RacePicker } from "@/components/race-analysis/RacePicker";
import { RaceAnalysisTabs } from "@/components/race-analysis/RaceAnalysisTabs";
import {
  DEFAULT_RACE_ANALYSIS_TAB,
  type RaceAnalysisTabId,
} from "@/components/race-analysis/raceAnalysisTabs.config";
import { type SessionOption } from "@/components/f1";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { useDbSessions } from "@/hooks/useWarehouse";
import { pageShellWide, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";

type RaceScheduleEntry = {
  round: string;
  raceName: string;
  date: string;
  Circuit?: { circuitName?: string; Location?: { country?: string } };
};

// Stable synthetic session_key per canonical code, so the existing RacePicker
// (which keys sessions by number) keeps working without OpenF1 session keys.
const SESSION_KEY: Record<string, number> = {
  FP1: 1, FP2: 2, FP3: 3, SQ: 4, S: 5, Q: 6, R: 7,
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
  const { data: dbSessions, isLoading: isSessionsLoading } =
    useDbSessions(selectedYear, parseInt(selectedRace, 10));

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

  // Build the picker's session list from the warehouse (canonical, deduped,
  // correctly named). session_type IS the code (R/Q/S/SQ/FP1-3).
  useEffect(() => {
    const rows = (dbSessions ?? []).filter(
      (s) => String(s.round) === String(selectedRace),
    );
    if (rows.length === 0) {
      setAvailableSessions([]);
      return;
    }
    const opts: SessionOption[] = rows
      .map((s) => ({
        session_key: SESSION_KEY[s.session_type] ?? 99,
        session_name: s.session_name,
        session_type: s.session_type,
        date_start: s.date_start ?? "",
        date_end: s.date_end ?? "",
        meeting_key: 0,
      }))
      .sort((a, b) => a.session_key - b.session_key);
    setAvailableSessions(opts);
    if (!selectedSessionKey) {
      const race = opts.find((o) => o.session_type === "R");
      setSelectedSessionKey(race ? race.session_key : opts[opts.length - 1].session_key);
    }
  }, [dbSessions, selectedRace, selectedSessionKey]);

  const hasSessions = availableSessions.length > 0;

  // The selected canonical session code (R/Q/S/SQ/FP1-3).
  const selectedSession = useMemo(() => {
    const s = availableSessions.find((x) => x.session_key === selectedSessionKey);
    return (s?.session_type as string) || "R";
  }, [availableSessions, selectedSessionKey]);

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
          hasOpenF1Data={hasSessions}
          availableSessions={availableSessions}
          selectedSessionKey={selectedSessionKey}
          isOpenF1Loading={isSessionsLoading}
          onYearChange={handleYearChange}
          onRaceChange={handleRaceChange}
          onSessionChange={handleSessionChange}
        />

        <RaceAnalysisTabs
          selectedTab={selectedTab}
          onTabChange={setSelectedTab}
          hasOpenF1Data
          selectedYear={selectedYear}
          selectedRace={selectedRace}
          selectedSession={selectedSession}
        />
      </div>
    </div>
  );
};

export default RaceAnalysis;

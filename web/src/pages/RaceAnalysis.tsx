import { pickInitialSession } from "@/lib/f1/sessionPick";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { RaceAnalysisHeader } from "@/components/race-analysis/RaceAnalysisHeader";
import { RacePicker } from "@/components/race-analysis/RacePicker";
import { RaceAnalysisTabs } from "@/components/race-analysis/RaceAnalysisTabs";
import {
  DEFAULT_RACE_ANALYSIS_TAB,
  isRaceAnalysisTab,
  type RaceAnalysisTabId,
} from "@/components/race-analysis/raceAnalysisTabs.config";
import { type SessionOption } from "@/components/f1";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { useDbSessions } from "@/hooks/useWarehouse";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import Seo from "@/components/common/Seo";
import { useTheme } from "@/context/ThemeContext";
import { breadcrumbSchema, raceSchema } from "@/lib/structuredData";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";

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
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedYear, setSelectedYear] = useState<number>(
    urlYear ? parseInt(urlYear, 10) : getDefaultYear()
  );
  const [selectedRace, setSelectedRace] = useState<string>(urlRound || "1");
  const [selectedTab, setSelectedTab] = useState<RaceAnalysisTabId>(() => {
    const t = searchParams.get("tab");
    return isRaceAnalysisTab(t) ? t : DEFAULT_RACE_ANALYSIS_TAB;
  });
  const [selectedSessionKey, setSelectedSessionKey] = useState<number | null>(null);
  const [availableSessions, setAvailableSessions] = useState<SessionOption[]>([]);

  const { data: raceScheduleData, isLoading: isRaceScheduleLoading } =
    useRaceSchedule(selectedYear);
  const { data: dbSessions, isLoading: isSessionsLoading } =
    useDbSessions(selectedYear, parseInt(selectedRace, 10));
  const { isGlass } = useTheme();

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

  // Keep the active tab in the URL so views are shareable, and react to a
  // shared link / back-button that carries a different ?tab=.
  useEffect(() => {
    const t = searchParams.get("tab");
    if (isRaceAnalysisTab(t) && t !== selectedTab) setSelectedTab(t);
  }, [searchParams, selectedTab]);

  // Build the picker's session list from the warehouse (canonical, deduped,
  // correctly named). session_type IS the code (R/Q/S/SQ/FP1-3).
  useEffect(() => {
    const rows = (dbSessions ?? []).filter(
      (s) => String(s.round) === String(selectedRace),
    );
    const opts: SessionOption[] = rows.map((s) => ({
      session_key: SESSION_KEY[s.session_type] ?? 99,
      session_name: s.session_name,
      session_type: s.session_type,
      date_start: s.date_start ?? "",
      date_end: s.date_end ?? "",
      meeting_key: 0,
    }));
    // Guarantee the universal sessions (Quali + Race) so there is always ONE
    // working session picker — warehouse session rows can be missing even when
    // FastF1 has the telemetry/replay for that session.
    const ensure = (type: string, name: string, key: number) => {
      if (!opts.some((o) => o.session_type === type))
        opts.push({ session_key: key, session_name: name, session_type: type, date_start: "", date_end: "", meeting_key: 0 });
    };
    ensure("Q", "Qualifying", 6);
    ensure("R", "Race", 7);
    opts.sort((a, b) => a.session_key - b.session_key);
    setAvailableSessions(opts);
    if (!selectedSessionKey) {
      const chosen = pickInitialSession(opts, searchParams.get("session"), !isSessionsLoading);
      if (chosen) setSelectedSessionKey(chosen.session_key);
    }
  }, [dbSessions, isSessionsLoading, selectedRace, selectedSessionKey, searchParams]);

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
    navigate(`/race-analysis/${year}/1?tab=${selectedTab}`);
  };

  const handleRaceChange = (round: string) => {
    setSelectedRace(round);
    setSelectedSessionKey(null);
    navigate(`/race-analysis/${selectedYear}/${round}?tab=${selectedTab}`);
  };

  const handleTabChange = (tab: RaceAnalysisTabId) => {
    setSelectedTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const handleSessionChange = (value: string) => {
    setSelectedSessionKey(null);
    const key = Number(value);
    const st = availableSessions.find((s) => s.session_key === key)?.session_type;
    setTimeout(() => setSelectedSessionKey(key), 50);
    if (st) {
      const next = new URLSearchParams(searchParams);
      next.set("session", st);
      setSearchParams(next, { replace: true });
    }
  };

  // Race pages are the deepest, most numerous and most search-visible routes — each one
  // gets its own title, canonical and SportsEvent card rather than inheriting the
  // homepage's metadata.
  const raceLabel = currentRace?.raceName
    ? getRaceNameWithoutEmoji(currentRace.raceName)
    : `Round ${selectedRace}`;
  const racePath = `/race-analysis/${selectedYear}/${selectedRace}`;

  return (
    <div className={pageShell}>
      <Seo
        title={`${raceLabel} ${selectedYear} — Race Analysis`}
        path={racePath}
        description={`Telemetry and strategy analysis for the ${selectedYear} ${raceLabel}${
          currentRace?.Circuit?.circuitName ? ` at ${currentRace.Circuit.circuitName}` : ""
        } — lap times, tyre stints, pit strategy, sector pace and driver head-to-heads.`}
        jsonLd={[
          raceSchema({
            name: `${raceLabel} ${selectedYear}`,
            season: selectedYear,
            round: Number(selectedRace),
            circuit: currentRace?.Circuit?.circuitName,
            country: currentRace?.Circuit?.Location?.country,
            startDate: currentRace?.date,
          }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Race Analysis", path: "/race-analysis" },
            { name: `${raceLabel} ${selectedYear}`, path: racePath },
          ]),
        ]}
      />
      <div className={cn("mx-auto w-full", pageStack, "animate-fade-in")}>
        <RaceAnalysisHeader selectedYear={selectedYear} currentRace={currentRace} />

        {/* Sticky race-context bar (desktop only — the picker is a single compact
            row there; on mobile it stacks tall so it scrolls normally). Keeps the
            selected GP/session visible while scrolling long analysis tabs. */}
        <div className={cn("lg:sticky lg:top-0 lg:z-20 lg:-mx-6 lg:border-b lg:border-border/60 lg:px-6 lg:py-2", isGlass ? "lg:bg-background/90 lg:backdrop-blur-sm" : "lg:bg-background")}>
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
        </div>

        <RaceAnalysisTabs
          selectedTab={selectedTab}
          onTabChange={handleTabChange}
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

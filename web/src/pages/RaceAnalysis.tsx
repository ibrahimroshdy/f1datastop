import { pickInitialSession } from "@/lib/f1/sessionPick";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowUpRight, Link2 } from "lucide-react";
import { RaceAnalysisHeader, type RaceContext } from "@/components/race-analysis/RaceAnalysisHeader";
import { RacePicker } from "@/components/race-analysis/RacePicker";
import { RaceAnalysisTabs } from "@/components/race-analysis/RaceAnalysisTabs";
import {
  DEFAULT_RACE_ANALYSIS_TAB,
  isRaceAnalysisTab,
  type RaceAnalysisTabId,
} from "@/components/race-analysis/raceAnalysisTabs.config";
import { type SessionOption } from "@/components/f1";
import { useRaceSchedule, useSpoilerShield } from "@/hooks/useF1Data";
import { getLatestRace } from "@/hooks/f1/useSpoilerShield";
import { useSeason } from "@/hooks/useSeason";
import { raceHref, seasonSearch } from "@/lib/links";
import { useDbSessions } from "@/hooks/useWarehouse";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { F1Loader } from "@/components/f1";
import Seo from "@/components/common/Seo";
import { breadcrumbSchema, raceSchema } from "@/lib/structuredData";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { Button } from "@/components/ui/button";

type RaceScheduleEntry = RaceContext & { date: string };

// Stable synthetic session_key per canonical code, so the existing RacePicker
// (which keys sessions by number) keeps working without OpenF1 session keys.
const SESSION_KEY: Record<string, number> = {
  FP1: 1, FP2: 2, FP3: 3, SQ: 4, S: 5, Q: 6, R: 7,
};

const RaceAnalysis = () => {
  const { year: urlYear, round: urlRound } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [season, setSeason] = useSeason();

  // A shared moment link (?driver=&lap=) opens the race at a specific lap and
  // driver on the lap-times tab.
  const focusDriver = searchParams.get("driver") || undefined;
  const focusLapRaw = searchParams.get("lap");
  const focusLapParsed = focusLapRaw ? parseInt(focusLapRaw, 10) : NaN;
  const focusLap = Number.isFinite(focusLapParsed) ? focusLapParsed : undefined;

  // The race's season comes from the address (/race-analysis/:year/:round); without one, the
  // season in the top bar (useSeason) and its latest finished race.
  const selectedYear = urlYear ? parseInt(urlYear, 10) : season;
  const selectedRace = urlRound ?? "";
  const [selectedTab, setSelectedTab] = useState<RaceAnalysisTabId>(() => {
    const t = searchParams.get("tab");
    // A moment link with a driver always opens the lap-times tab.
    if (focusDriver && !t) return "lapTimes";
    return isRaceAnalysisTab(t) ? t : DEFAULT_RACE_ANALYSIS_TAB;
  });
  const [selectedSessionKey, setSelectedSessionKey] = useState<number | null>(null);
  const [availableSessions, setAvailableSessions] = useState<SessionOption[]>([]);

  const { data: raceScheduleData, isLoading: isRaceScheduleLoading } =
    useRaceSchedule(selectedYear);
  const races = raceScheduleData?.data as RaceScheduleEntry[] | undefined;
  const { data: dbSessions, isLoading: isSessionsLoading } =
    useDbSessions(selectedYear, parseInt(selectedRace || "0", 10));

  // No round in the address: open the latest finished race of the season (round 1 before
  // the season starts), keeping ?tab= and the other view parameters.
  useEffect(() => {
    if (urlRound || !races?.length) return;
    const target = getLatestRace(races) ?? races[0];
    const q = new URLSearchParams(searchParams);
    q.delete("season");
    q.delete("year");
    const qs = q.toString();
    navigate(`${raceHref(selectedYear, target.round)}${qs ? `?${qs}` : ""}`, { replace: true });
  }, [urlRound, races, searchParams, selectedYear, navigate]);

  // Keep the top-bar season on this race's season, and follow it when it changes there.
  const syncedYear = useRef<string | null>(null);
  useEffect(() => {
    if (!urlYear) return;
    const y = Number(urlYear);
    if (syncedYear.current !== urlYear) {
      syncedYear.current = urlYear;
      if (season !== y) setSeason(y);
      return;
    }
    if (season !== y) navigate(`/race-analysis${seasonSearch(season)}`);
  }, [urlYear, season, setSeason, navigate]);

  const { isShielded: raceShielded, showResults: raceShowResults, latestRace: raceLatestRace } =
    useSpoilerShield({ season: selectedYear, races: races ?? null });
  // Only the currently selected round is shielded, and only when it is the
  // latest race weekend; other rounds and past seasons are untouched.
  const isLatestRace = !!raceLatestRace && raceLatestRace.round === selectedRace;
  const shielded = isLatestRace && raceShielded;

  const currentRace = useMemo(
    () => races?.find((race) => race.round === selectedRace) ?? null,
    [races, selectedRace],
  );

  // Keep the active tab in the URL so views are shareable, and react to a
  // shared link / back-button that carries a different ?tab=.
  useEffect(() => {
    const t = searchParams.get("tab");
    if (isRaceAnalysisTab(t) && t !== selectedTab) setSelectedTab(t);
  }, [searchParams, selectedTab]);

  // A different race starts on its own session list.
  useEffect(() => {
    setSelectedSessionKey(null);
  }, [selectedYear, selectedRace]);

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

  // The selected canonical session code (R/Q/S/SQ/FP1-3).
  const selectedSession = useMemo(() => {
    const s = availableSessions.find((x) => x.session_key === selectedSessionKey);
    return (s?.session_type as string) || "R";
  }, [availableSessions, selectedSessionKey]);

  const handleRaceChange = (round: string) => {
    navigate(raceHref(selectedYear, round, selectedTab));
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

  // Copy a link that opens the current view (tab/session/driver/lap) so a
  // moment can be shared and opened by anyone with the URL.
  const handleCopyLink = () => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", selectedTab);
    if (focusDriver) params.set("driver", focusDriver);
    else params.delete("driver");
    if (focusLap != null) params.set("lap", String(focusLap));
    else params.delete("lap");
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Moment link copied"))
      .catch(() => toast.error("Couldn't copy link"));
  };

  // Race pages are the deepest, most numerous and most search-visible routes — each one
  // gets its own title, canonical and SportsEvent card rather than inheriting the
  // homepage's metadata.
  const raceLabel = currentRace?.raceName ? getRaceNameWithoutEmoji(currentRace.raceName) : "Grand Prix";
  const racePath = `/race-analysis/${selectedYear}/${selectedRace}`;
  const pitWallQuery = new URLSearchParams({ year: String(selectedYear), round: selectedRace, session: selectedSession });

  if (!urlRound) {
    return (
      <div className={pageShell}>
        <F1Loader label="Finding the latest Grand Prix…" />
      </div>
    );
  }

  return (
    <div className={pageShell}>
      <Seo
        title={`${raceLabel} ${selectedYear}`}
        path={racePath}
        description={`Telemetry and strategy analysis for the ${selectedYear} ${raceLabel}${
          currentRace?.Circuit?.circuitName ? ` at ${currentRace.Circuit.circuitName}` : ""
        }: lap times, tyre stints, pit strategy, sector pace and driver head-to-heads.`}
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
            { name: "Grand Prix", path: "/race-analysis" },
            { name: `${raceLabel} ${selectedYear}`, path: racePath },
          ]),
        ]}
      />
      <div className={cn("mx-auto w-full min-w-0", pageStack, "animate-fade-in")}>
        <RaceAnalysisHeader
          selectedYear={selectedYear}
          currentRace={currentRace}
          actions={
            <>
              <Button asChild variant="secondary" size="sm" className="rounded-full">
                <Link to={`/pit-wall?${pitWallQuery.toString()}`} viewTransition>
                  Open in Pit Wall
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={handleCopyLink}>
                <Link2 className="h-4 w-4" />
                Copy link
              </Button>
            </>
          }
        />

        <RacePicker
          selectedRace={selectedRace}
          raceSchedule={races}
          isRaceScheduleLoading={isRaceScheduleLoading}
          availableSessions={availableSessions}
          selectedSessionKey={selectedSessionKey}
          isSessionsLoading={isSessionsLoading}
          onRaceChange={handleRaceChange}
          onSessionChange={handleSessionChange}
        />

        <RaceAnalysisTabs
          selectedTab={selectedTab}
          onTabChange={handleTabChange}
          focusDriver={focusDriver}
          focusLap={focusLap}
          hasOpenF1Data
          selectedYear={selectedYear}
          selectedRace={selectedRace}
          selectedSession={selectedSession}
          isShielded={shielded}
          onShowResults={raceShowResults}
        />
      </div>
    </div>
  );
};

export default RaceAnalysis;

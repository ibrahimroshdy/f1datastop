import { useDriverStandings, useConstructorStandings, useRaceSchedule, useLastRaceResults } from "@/hooks/useF1Data";
import { useEffect, useMemo, Suspense, lazy } from "react";
import { TriangleAlert } from "lucide-react";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useSeason } from "@/hooks/useSeason";
import BuyMeCoffeeWidget from "@/components/common/BuyMeCoffeeWidget";
import CountryFlag from "@/components/common/CountryFlag";
import { useOpenQuickLook } from "@/components/calendar/QuickLook";
import { F1Card, PageHeader, F1Loader } from "@/components/f1";
import { F1EmptyState } from "@/components/f1/F1EmptyState";
import CombinedStandingsCard from "@/components/dashboard/CombinedStandingsCard";
import LastRaceResultsCard from "@/components/dashboard/LastRaceResultsCard";
import NextGrandPrixCard, { type NextRace } from "@/components/dashboard/NextGrandPrixCard";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import useAnalytics from "@/hooks/useAnalytics";
import useClarity from "@/hooks/useClarity";
import Seo from "@/components/common/Seo";

const MuiSankeyChart = lazy(() => import("@/components/analytics/MuiSankeyChart"));
const SeasonSankeyChart = lazy(() => import("@/components/analytics/SeasonSankeyChart"));

const raceStart = (r: NextRace) => new Date(`${r.date}T${r.time || "00:00:00Z"}`);

const Index = () => {
  // Next and last race are always the current season; the standings follow the season picker.
  const [season] = useSeason();
  const drivers = useDriverStandings(season);
  const teams = useConstructorStandings(season);
  const schedule = useRaceSchedule();
  const lastResults = useLastRaceResults();
  const openQuickLook = useOpenQuickLook();

  const analytics = useAnalytics();
  const clarity = useClarity();
  useEffect(() => {
    analytics.trackContentView("homepage", "page", "F1 DataStop Homepage", { sponsor_visible: true });
    clarity.setTag("page_type", "homepage");
    clarity.setTag("page_version", "v3");
  }, [analytics, clarity]);

  const races = useMemo(() => (schedule.data?.data ?? []) as NextRace[], [schedule.data?.data]);
  const now = Date.now();
  const nextRace = races.find((r) => raceStart(r).getTime() > now);
  const done = races.filter((r) => raceStart(r).getTime() <= now).length;
  const isSeasonComplete = races.length > 0 && done === races.length;

  // The last race with published results (useLastRaceResults walks back past races not yet
  // scored), matched to its schedule entry for the country.
  const last = lastResults.data?.data as { season?: string; round?: string } | null | undefined;
  const lastRace = last?.round
    ? races.find((r) => String(r.round) === String(last.round) && (!last.season || String(r.season) === String(last.season)))
    : undefined;

  const isOffline =
    (drivers.isError && !drivers.data?.data) ||
    (teams.isError && !teams.data?.data) ||
    (schedule.isError && !schedule.data?.data);

  const year = races[0]?.season ?? String(new Date().getFullYear());
  const description = races.length ? `Season ${year}, ${done} of ${races.length} Grands Prix run` : undefined;

  return (
    <div className={pageShell}>
      <Seo
        path="/"
        description="Formula 1 telemetry, race analysis and strategy breakdowns: lap time deltas, stint strategy, tyre life and driver head-to-heads, updated every race weekend."
      />
      <div className={cn("mx-auto w-full", pageStack, "animate-fade-in")}>
        <PageHeader
          title="Home"
          description={description}
          actions={
            isOffline ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-position-gold/10 px-2.5 py-1 text-xs font-medium text-position-gold">
                <TriangleAlert className="h-3.5 w-3.5" />
                Showing saved data
              </span>
            ) : null
          }
        />

        {/* Phones: next, last, Sankey, standings. Wide: next, last, standings, then the Sankey. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          <div className="order-1">
            <NextGrandPrixCard race={nextRace} isSeasonComplete={isSeasonComplete} />
          </div>
          <div className="order-2">
            <LastRaceResultsCard
              lastRaceResults={lastResults.data}
              isResultsLoading={lastResults.isLoading}
              country={lastRace?.Circuit?.Location?.country}
            />
          </div>
          <div className="order-4 md:col-span-2 lg:order-3 lg:col-span-1">
            <CombinedStandingsCard
              driverStandings={drivers.data}
              constructorStandings={teams.data}
              season={season}
              isLoading={drivers.isLoading || teams.isLoading}
            />
          </div>

          <F1Card className="order-3 p-0 md:col-span-2 lg:order-4 lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 md:px-6 md:pt-6">
              <h2 className="text-xl">Quali, grid, race</h2>
              {lastRace ? (
                <button
                  type="button"
                  onClick={() => openQuickLook(lastRace.season, lastRace.round)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-ink-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CountryFlag country={lastRace.Circuit?.Location?.country ?? ""} size={16} />
                  {getRaceNameWithoutEmoji(lastRace.raceName)}
                </button>
              ) : null}
            </div>
            {lastRace ? (
              <Suspense fallback={<F1Loader label="Loading the chart" className="h-[400px]" />}>
                <MuiSankeyChart year={Number(lastRace.season)} round={lastRace.round} />
              </Suspense>
            ) : lastResults.isLoading || schedule.isLoading ? (
              <F1Loader label="Loading the chart" className="h-[400px]" />
            ) : (
              <F1EmptyState
                type="season-start"
                title="Season starting soon"
                description="How qualifying, the grid and the race line up appears after the first race."
                size="md"
              />
            )}
          </F1Card>

          {/* The whole season, grid to finish: kept on Home with the race Sankey (D30). */}
          <F1Card className="order-5 p-0 md:col-span-2 lg:col-span-3">
            <div className="px-4 pt-4 md:px-6 md:pt-6">
              <h2 className="text-xl">Season, grid to finish</h2>
              <p className="mt-1 text-sm text-ink-2">Every start and finish of {season} so far.</p>
            </div>
            <Suspense fallback={<F1Loader label="Loading the season" className="h-[400px]" />}>
              <SeasonSankeyChart year={season} />
            </Suspense>
          </F1Card>
        </div>

        <div className="flex justify-center py-2">
          <BuyMeCoffeeWidget size="large" position="inline" />
        </div>
      </div>
    </div>
  );
};

export default Index;

import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDriverStandings, useConstructorStandings, useRaceSchedule, useSpoilerShield } from "@/hooks/useF1Data";
import { useSeason } from "@/hooks/useSeason";
import { getTeamHexColor, normalizeTeamId } from "@/components/standings/standingsUtils";
import { cn } from "@/lib/utils";
import { pageShell, pageStack } from "@/lib/layout";
import { F1Card, F1EmptyState, F1ErrorState, F1Skeleton, PageHeader } from "@/components/f1";
import PointsProgressionChart from "@/components/standings/PointsProgressionChart";
import ReliabilityBoard from "@/components/standings/ReliabilityBoard";
import {
  DriverStandingsList,
  TeamStandingsList,
  type ConstructorStandingRow,
  type DriverStandingRow,
} from "@/components/standings/StandingsLists";
import { SpoilerShield } from "@/components/spoiler-shield/SpoilerShield";
import Seo from "@/components/common/Seo";
import { breadcrumbSchema } from "@/lib/structuredData";

type Tab = "drivers" | "teams" | "reliability";

/** `?tab=` as before; older `?tab=constructors` links open Teams. */
function useStandingsTab(): [Tab, (t: Tab) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = raw === "teams" || raw === "constructors" ? "teams" : raw === "reliability" ? "reliability" : "drivers";
  const set = (t: Tab) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (t === "drivers") p.delete("tab");
        else p.set("tab", t);
        return p;
      },
      { replace: true },
    );
  return [tab, set];
}

const skeletonPlate = (
  <ul className="divide-y divide-border">
    {Array.from({ length: 10 }).map((_, i) => (
      <li key={i} className="flex items-center gap-3 px-4 py-2.5">
        <F1Skeleton className="h-4 w-6 shrink-0" />
        <F1Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <F1Skeleton className="h-4 w-32" />
          <F1Skeleton className="h-3 w-24" />
        </div>
        <F1Skeleton className="h-8 w-14 shrink-0" />
      </li>
    ))}
  </ul>
);

const Standings = () => {
  const [season] = useSeason();
  const [tab, setTab] = useStandingsTab();
  const drivers$ = useDriverStandings(season);
  const teams$ = useConstructorStandings(season);
  const { data: raceScheduleData } = useRaceSchedule(season);
  const { isShielded, showResults, latestRace } = useSpoilerShield({
    season,
    races: raceScheduleData?.data ?? null,
  });
  // Only the latest race weekend is shielded; once shown, everything stays revealed.
  const shielded = isShielded && !!latestRace;

  const drivers = (drivers$.data?.data ?? []) as DriverStandingRow[];
  const teams = (teams$.data?.data ?? []) as ConstructorStandingRow[];
  const driversReady = drivers.length > 0 && !drivers$.isLoading && !drivers$.isError;
  const teamsReady = teams.length > 0 && !teams$.isLoading && !teams$.isError;

  // Points after each round, every driver / team, for the progression chart.
  const teamDriverIds: Record<string, string[]> = {};
  for (const d of drivers) {
    const tid = normalizeTeamId(d.Constructors[0]?.constructorId || "default");
    (teamDriverIds[tid] ??= []).push(d.Driver.driverId || d.Driver.code);
  }
  const driverSeries = drivers.map((d) => ({
    driverIds: [d.Driver.driverId || d.Driver.code],
    code: d.Driver.code,
    color: getTeamHexColor(normalizeTeamId(d.Constructors[0]?.constructorId || "default")),
    constructorId: d.Constructors[0]?.constructorId,
    driverId: d.Driver.driverId,
  }));
  const teamSeries = teams.map((c) => {
    const tid = normalizeTeamId(c.Constructor?.constructorId || "default");
    return {
      driverIds: teamDriverIds[tid] ?? [],
      code: c.Constructor.name,
      color: getTeamHexColor(tid),
      constructorId: c.Constructor?.constructorId,
    };
  });

  const plate = (
    q: { isError: boolean; isLoading: boolean; refetch: () => unknown },
    count: number,
    list: React.ReactNode,
  ) => (
    <F1Card className="overflow-hidden p-0">
      {q.isError ? (
        <F1ErrorState type="network" variant="inline" className="py-8" onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        skeletonPlate
      ) : !count ? (
        <F1EmptyState type="no-data" className="py-10" />
      ) : (
        list
      )}
    </F1Card>
  );

  const layout = "grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start";

  return (
    <div className={pageShell}>
      <Seo
        title={`${season} F1 Championship Standings`}
        path="/standings"
        description={`Driver and team championship standings for the ${season} Formula 1 season: points, wins and the gap to the leader.`}
        jsonLd={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Standings", path: "/standings" }])}
      />
      <div className={cn("mx-auto w-full", pageStack, "animate-fade-in")}>
        <PageHeader
          title="Standings"
          description={latestRace ? `${season}, after the ${latestRace.raceName}` : `${season} season`}
        />

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
          <TabsList>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="reliability">Reliability</TabsTrigger>
          </TabsList>

          <TabsContent value="drivers" className="mt-4 md:mt-6">
            <SpoilerShield isShielded={shielded && driversReady} onShowResults={showResults}>
              <div className={layout}>
                {plate(drivers$, drivers.length, <DriverStandingsList rows={drivers} />)}
                {drivers.length > 0 && (
                  <PointsProgressionChart year={season} series={driverSeries} title="Points after each round" />
                )}
              </div>
            </SpoilerShield>
          </TabsContent>

          <TabsContent value="teams" className="mt-4 md:mt-6">
            <SpoilerShield isShielded={shielded && teamsReady} onShowResults={showResults}>
              <div className={layout}>
                {plate(teams$, teams.length, <TeamStandingsList rows={teams} season={season} />)}
                {teams.length > 0 && (
                  <PointsProgressionChart year={season} series={teamSeries} title="Points after each round" />
                )}
              </div>
            </SpoilerShield>
          </TabsContent>

          <TabsContent value="reliability" className="mt-4 md:mt-6">
            <ReliabilityBoard year={season} drivers={drivers} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Standings;

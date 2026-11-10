import { useMemo } from "react";
import { useConstructorStandings, useDriverStandings } from "@/hooks/useF1Data";
import { useSeason } from "@/hooks/useSeason";
import { F1Card, F1EmptyState, F1ErrorState, F1Skeleton, PageHeader } from "@/components/f1";
import { ListPager, SearchField, paginate, useListParams } from "@/components/drivers/ListControls";
import {
  TeamStandingsList,
  driversByTeam,
  type ConstructorStandingRow,
  type DriverStandingRow,
} from "@/components/standings/StandingsLists";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import Seo from "@/components/common/Seo";
import { breadcrumbSchema } from "@/lib/structuredData";

const skeletonPlate = (
  <ul className="divide-y divide-border">
    {Array.from({ length: 10 }).map((_, i) => (
      <li key={i} className="flex items-center gap-3 px-4 py-3">
        <F1Skeleton className="h-4 w-6 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <F1Skeleton className="h-5 w-40" />
          <F1Skeleton className="h-3 w-28" />
        </div>
        <F1Skeleton className="h-8 w-14 shrink-0" />
      </li>
    ))}
  </ul>
);

/** The teams list (route /constructors): search and pages in the address, each team linked. */
const Constructors = () => {
  const [season] = useSeason();
  const { data, isLoading, isError, refetch } = useConstructorStandings(season);
  const { data: driverData } = useDriverStandings(season);
  const list = useListParams();
  const q = list.get("q");

  const all = useMemo(() => (data?.data ?? []) as ConstructorStandingRow[], [data]);
  const lineups = useMemo(() => driversByTeam((driverData?.data ?? []) as DriverStandingRow[]), [driverData]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((t) => {
      const drivers = (lineups[t.Constructor.constructorId ?? ""] ?? []).map((d) => d.name).join(" ");
      return `${t.Constructor.name} ${drivers}`.toLowerCase().includes(needle);
    });
  }, [all, q, lineups]);

  const pg = paginate(filtered, list.get("page"));

  return (
    <div className={pageShell}>
      <Seo
        title={`${season} F1 Teams`}
        path="/constructors"
        description={`Every Formula 1 team in ${season}: championship position, points, wins and drivers.`}
        jsonLd={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Teams", path: "/constructors" }])}
      />
      <div className={cn("mx-auto w-full", pageStack, "animate-fade-in")}>
        <PageHeader title="Teams" description={`${season} season`} />

        <SearchField label="Search teams or drivers" value={q} onChange={(v) => list.set({ q: v })} />

        <F1Card className="overflow-hidden p-0">
          {isError ? (
            <F1ErrorState type="network" variant="inline" className="py-8" onRetry={() => refetch()} />
          ) : isLoading ? (
            skeletonPlate
          ) : !filtered.length ? (
            <F1EmptyState
              type="no-data"
              className="py-10"
              {...(all.length ? { title: "No teams match", description: "Try another team or driver name." } : {})}
            />
          ) : (
            <TeamStandingsList
              rows={pg.items}
              season={season}
              leaderPoints={Number(all[0]?.points ?? 0)}
              driversByTeam={lineups}
            />
          )}
        </F1Card>

        <ListPager
          page={pg.page}
          pages={pg.pages}
          total={filtered.length}
          from={pg.from}
          shown={pg.items.length}
          noun={filtered.length === 1 ? "team" : "teams"}
          onPage={(p) => list.set({ page: p })}
        />
      </div>
    </div>
  );
};

export default Constructors;

import { Fragment, useMemo } from "react";
import { useDriverStandings } from "@/hooks/useF1Data";
import { useSeason } from "@/hooks/useSeason";
import { F1Card, F1EmptyState, F1ErrorState, F1Skeleton, PageHeader } from "@/components/f1";
import { DriverIdentity } from "@/components/f1/DriverIdentity";
import { TeamName } from "@/components/f1/TeamName";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListPager, SearchField, paginate, useListParams } from "@/components/drivers/ListControls";
import { winsWords, type DriverStandingRow } from "@/components/standings/StandingsLists";
import { teamHref } from "@/lib/links";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import Seo from "@/components/common/Seo";
import { breadcrumbSchema } from "@/lib/structuredData";

const ALL = "all";

const lastTeam = (d: DriverStandingRow) => d.Constructors[d.Constructors.length - 1];

const skeletonPlate = (
  <ul className="divide-y divide-border">
    {Array.from({ length: 10 }).map((_, i) => (
      <li key={i} className="flex items-center gap-3 px-4 py-2.5">
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

const Drivers = () => {
  const [season] = useSeason();
  const { data, isLoading, isError, refetch } = useDriverStandings(season);
  const list = useListParams();
  const q = list.get("q");
  const team = list.get("team");
  const grouped = list.get("group") === "team";

  const all = useMemo(() => (data?.data ?? []) as DriverStandingRow[], [data]);

  // Teams in championship order of their best driver, for the filter and the groups.
  const teams = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of all) {
      const t = lastTeam(d);
      if (t?.constructorId && !seen.has(t.constructorId)) seen.set(t.constructorId, t.name);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [all]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = all.filter((d) => {
      if (team && lastTeam(d)?.constructorId !== team) return false;
      if (!needle) return true;
      const hay = `${d.Driver.givenName} ${d.Driver.familyName} ${d.Driver.code} ${lastTeam(d)?.name ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
    if (grouped) {
      const order = new Map(teams.map((t, i) => [t.id, i]));
      rows = [...rows].sort(
        (a, b) => (order.get(lastTeam(a)?.constructorId ?? "") ?? 99) - (order.get(lastTeam(b)?.constructorId ?? "") ?? 99),
      );
    }
    return rows;
  }, [all, q, team, grouped, teams]);

  const pg = paginate(filtered, list.get("page"));

  const rows = (
    <ul className="divide-y divide-border">
      {pg.items.map((d, i) => {
        const t = lastTeam(d);
        const prev = i > 0 ? lastTeam(pg.items[i - 1]) : undefined;
        const header = grouped && t?.constructorId && prev?.constructorId !== t.constructorId;
        return (
          <Fragment key={d.Driver.driverId ?? d.Driver.code}>
            {header && (
              <li className="bg-raised px-4 py-2">
                <TeamName
                  constructorId={t.constructorId!}
                  name={t.name}
                  to={teamHref(t.constructorId!, season)}
                  size={16}
                  className="text-sm font-semibold text-heading"
                />
              </li>
            )}
            <li className="flex items-center gap-3 px-4 py-2.5">
              <span className="timing w-6 shrink-0 text-center text-sm font-semibold text-ink-2" aria-label={`Position ${d.position}`}>
                {d.position}
              </span>
              <DriverIdentity
                driverId={d.Driver.driverId ?? d.Driver.code}
                givenName={d.Driver.givenName}
                familyName={d.Driver.familyName}
                nationality={d.Driver.nationality}
                constructorId={t?.constructorId}
                teamName={t?.name}
                className="flex-1"
              />
              <span className="flex shrink-0 flex-col items-end text-right">
                <span className="readout text-base font-semibold text-figure">
                  {Number(d.points).toLocaleString()}
                  <span className="sr-only"> points</span>
                </span>
                <span className="text-[13px] text-muted-foreground">{winsWords(Number(d.wins ?? 0))}</span>
              </span>
            </li>
          </Fragment>
        );
      })}
    </ul>
  );

  return (
    <div className={pageShell}>
      <Seo
        title={`${season} F1 Drivers`}
        path="/drivers"
        description={`Every driver on the ${season} Formula 1 grid: championship position, points, wins and team.`}
        jsonLd={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Drivers", path: "/drivers" }])}
      />
      <div className={cn("mx-auto w-full", pageStack, "animate-fade-in")}>
        <PageHeader title="Drivers" description={`${season} season`} />

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchField label="Search drivers" value={q} onChange={(v) => list.set({ q: v })} />
          <Select value={team || ALL} onValueChange={(v) => list.set({ team: v === ALL ? null : v })}>
            <SelectTrigger aria-label="Team" className="h-10 w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={grouped ? "team" : "none"} onValueChange={(v) => list.set({ group: v === "team" ? "team" : null })}>
            <SelectTrigger aria-label="Grouping" className="h-10 w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No grouping</SelectItem>
              <SelectItem value="team">Group by team</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <F1Card className="overflow-hidden p-0">
          {isError ? (
            <F1ErrorState type="network" variant="inline" className="py-8" onRetry={() => refetch()} />
          ) : isLoading ? (
            skeletonPlate
          ) : !filtered.length ? (
            <F1EmptyState
              type="no-data"
              className="py-10"
              {...(all.length ? { title: "No drivers match", description: "Try another name or team." } : {})}
            />
          ) : (
            rows
          )}
        </F1Card>

        <ListPager
          page={pg.page}
          pages={pg.pages}
          total={filtered.length}
          from={pg.from}
          shown={pg.items.length}
          noun={filtered.length === 1 ? "driver" : "drivers"}
          onPage={(p) => list.set({ page: p })}
        />
      </div>
    </div>
  );
};

export default Drivers;

import { Link, useParams } from "react-router-dom";
import { F1Avatar, F1Card, F1EmptyState, F1ErrorState, F1Skeleton } from "@/components/f1";
import { DriverIdentity } from "@/components/f1/DriverIdentity";
import { TeamName } from "@/components/f1/TeamName";
import CountryFlag from "@/components/common/CountryFlag";
import DriverCareerPanel from "@/components/drivers/DriverCareerPanel";
import DriverPositionChart from "@/components/drivers/DriverPositionChart";
import DriverComparePanel from "@/components/drivers/DriverComparePanel";
import { useDriverCareer } from "@/hooks/entity";
import { useDriverStandings, useDriverResultsBySeason } from "@/hooks/useF1Data";
import { useSeason } from "@/hooks/useSeason";
import { getTeamColorById } from "@/constants/f1Colors";
import { buildF1DriverHeadshotUrl, getF1PortraitPathForErgastDriverId } from "@/constants/f1DriverPortraitMedia";
import { pageShell, pageStack } from "@/lib/layout";
import { raceHref, seasonSearch, teamHref } from "@/lib/links";
import { isEntityDbConfigured } from "@/services/entityService";
import { BackLink } from "@/components/ui/back-link";
import type { DriverStandingRow } from "@/components/standings/StandingsLists";
import NotFound from "./NotFound";
import { cn } from "@/lib/utils";
import Seo from "@/components/common/Seo";

type SeasonRace = {
  round: string;
  raceName: string;
  date: string;
  position?: string;
  points: number;
  country?: string;
  isDNF?: boolean;
  status?: string;
  constructor?: string;
  grid?: number;
  qualiPosition?: number;
};

const fromWords = (grid?: number) =>
  grid == null ? null : grid === 0 ? "From the pit lane" : `From P${grid}`;

const pointsWords = (p: number) => (p === 1 ? "1 point" : `${p} points`);

const DriverProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const [season] = useSeason();

  const { data: profile, isLoading: isProfileLoading, isFetched: isProfileFetched } = useDriverCareer({
    slug,
    enabled: !!slug,
  });
  const { data: driverStandings, isError: isStandingsError, refetch: refetchStandings } = useDriverStandings(season);
  const standings = (driverStandings?.data ?? []) as DriverStandingRow[];
  const ergastId = profile?.ergast_id;

  const standing = standings.find(
    (row) => row.Driver.driverId === ergastId || (slug && row.Driver.driverId?.replace(/_/g, "-") === slug),
  );
  const resolvedDriverId = ergastId ?? standing?.Driver?.driverId ?? undefined;

  const { data: seasonResultsResp, isLoading: isResultsLoading } = useDriverResultsBySeason(
    season,
    resolvedDriverId ?? "",
    !!resolvedDriverId,
  );

  if (!slug) return <NotFound />;
  if (isEntityDbConfigured() && isProfileFetched && !profile && !isProfileLoading) return <NotFound />;

  const team = standing?.Constructors?.[standing.Constructors.length - 1];
  const constructorId = team?.constructorId ?? "";
  const teamColor = getTeamColorById(constructorId);
  const portraitPath =
    profile?.portrait_path ?? (resolvedDriverId ? getF1PortraitPathForErgastDriverId(resolvedDriverId) : undefined);
  const headshotUrl = portraitPath ? buildF1DriverHeadshotUrl(portraitPath) : undefined;

  const displayName =
    profile?.display_name ??
    (standing ? `${standing.Driver.givenName} ${standing.Driver.familyName}` : slug.replace(/-/g, " "));
  const nationality = profile?.nationality ?? standing?.Driver?.nationality;
  const driverNumber = profile?.permanent_number ?? (standing?.Driver as { permanentNumber?: string } | undefined)?.permanentNumber;

  const races = ((seasonResultsResp?.data ?? []) as SeasonRace[]).map((r) => ({ ...r, points: Number(r.points) || 0 }));
  const finished = races.filter((r) => !r.isDNF);
  const wins = finished.filter((r) => Number(r.position) === 1).length;
  const podiums = finished.filter((r) => Number(r.position) <= 3).length;
  const hasQuali = races.some((r) => r.qualiPosition != null);
  const poles = races.filter((r) => r.qualiPosition === 1).length;
  const pointsFinishes = races.filter((r) => r.points > 0).length;
  const points = standing ? Number(standing.points) : races.reduce((s, r) => s + r.points, 0);

  const teammates = standings.filter(
    (row) =>
      row.Driver.driverId !== resolvedDriverId &&
      !!constructorId &&
      row.Constructors[row.Constructors.length - 1]?.constructorId === constructorId,
  );

  const tiles = [
    { label: "Points", value: points.toLocaleString() },
    { label: "Wins", value: wins },
    { label: "Podiums", value: podiums },
    hasQuali ? { label: "Poles", value: poles } : { label: "Points finishes", value: pointsFinishes },
  ];

  return (
    <div className={pageShell}>
      <Seo
        title={`${displayName}, F1 stats and results`}
        path={`/drivers/${slug}`}
        type="profile"
        description={`${displayName}'s Formula 1 results, race by race, head to head and career records.`}
      />
      <div className={cn("mx-auto w-full", pageStack, "animate-fade-in")}>
        <BackLink to={`/drivers${seasonSearch(season)}`}>Drivers</BackLink>

        {isStandingsError && <F1ErrorState type="network" variant="inline" onRetry={() => refetchStandings()} />}

        <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
          <div className="grid gap-4 md:gap-6">
            {/* Lead card: face, name, flag and team, then the season in four figures. */}
            <F1Card livery={teamColor} className="p-5 md:p-6">
              <div className="flex items-center gap-4 pr-14">
                <F1Avatar
                  size="xl"
                  src={headshotUrl}
                  alt=""
                  fallback={displayName
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)}
                  teamColor={teamColor}
                  showRing={!!constructorId}
                />
                <div className="min-w-0 space-y-1.5">
                  {standing && (
                    <span className="inline-flex rounded-full bg-act px-2.5 py-0.5 text-xs font-semibold text-on-act">
                      P{standing.position} in the {season} championship
                    </span>
                  )}
                  <h1 className="text-2xl leading-tight md:text-3xl">{displayName}</h1>
                  <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-ink-2">
                    {nationality ? <CountryFlag country={nationality} size={16} /> : null}
                    {team && constructorId ? (
                      <TeamName constructorId={constructorId} name={team.name} to={teamHref(constructorId, season)} size={16} />
                    ) : null}
                    {driverNumber != null ? <span className="timing">Car {driverNumber}</span> : null}
                  </p>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {tiles.map((t) => (
                  <div key={t.label} className="flex flex-col-reverse rounded-xl bg-raised px-3 py-2.5">
                    <dt className="text-[13px] text-muted-foreground">{t.label}</dt>
                    <dd className="readout text-2xl font-semibold text-figure">{t.value}</dd>
                  </div>
                ))}
              </dl>
            </F1Card>

            {/* The season, one row per Grand Prix. */}
            <F1Card className="overflow-hidden p-0">
              <h2 className="px-4 pb-1 pt-4 text-lg">{season} results</h2>
              {isResultsLoading && resolvedDriverId ? (
                <div className="p-4">
                  <F1Skeleton variant="text" lines={5} />
                </div>
              ) : races.length === 0 ? (
                <F1EmptyState type="no-data" className="py-8" title="No races yet" description={`No results for ${season} yet.`} />
              ) : (
                <ul className="divide-y divide-border">
                  {races.map((r) => {
                    const from = fromWords(r.grid);
                    return (
                      <li key={r.round} className="flex items-center gap-3 px-4 py-2.5">
                        {r.country ? <CountryFlag country={r.country} size={21} className="shrink-0" /> : null}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <Link
                            to={raceHref(season, r.round)}
                            viewTransition
                            className="font-semibold leading-tight text-heading hover:underline"
                          >
                            {r.raceName}
                          </Link>
                          {from ? <span className="text-[13px] text-muted-foreground">{from}</span> : null}
                        </span>
                        <span className="flex shrink-0 flex-col items-end text-right">
                          <span className={cn("readout text-base font-semibold", r.isDNF ? "text-loss" : "text-figure")}>
                            {r.isDNF ? "DNF" : r.position ? `P${r.position}` : "–"}
                          </span>
                          <span className="text-[13px] text-muted-foreground">{pointsWords(r.points)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </F1Card>
          </div>

          <div className="grid gap-4 md:gap-6">
            {standings.length > 0 && resolvedDriverId && (
              <F1Card className="p-4">
                <h2 className="mb-3 text-lg">Head to head</h2>
                <DriverComparePanel
                  seasonYear={season}
                  standings={standings as React.ComponentProps<typeof DriverComparePanel>["standings"]}
                  driverAId={resolvedDriverId}
                  driverAName={displayName}
                  driverAColor={teamColor}
                  historyA={races}
                />
              </F1Card>
            )}

            {teammates.length > 0 && (
              <F1Card className="overflow-hidden p-0">
                <h2 className="px-4 pb-1 pt-4 text-lg">{teammates.length === 1 ? "Teammate" : "Teammates"}</h2>
                <ul className="divide-y divide-border">
                  {teammates.map((m) => (
                    <li key={m.Driver.driverId} className="flex items-center gap-3 px-4 py-2.5">
                      <DriverIdentity
                        driverId={m.Driver.driverId ?? m.Driver.code}
                        givenName={m.Driver.givenName}
                        familyName={m.Driver.familyName}
                        nationality={m.Driver.nationality}
                        constructorId={constructorId}
                        teamName={team?.name}
                        size={40}
                        className="flex-1"
                      />
                      <span className="flex shrink-0 flex-col items-end text-right">
                        <span className="readout text-base font-semibold text-figure">
                          {Number(m.points).toLocaleString()}
                          <span className="sr-only"> points</span>
                        </span>
                        <span className="text-[13px] text-muted-foreground">P{m.position}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </F1Card>
            )}

            <F1Card className="p-4">
              {isProfileLoading ? (
                <F1Skeleton variant="card" className="h-32" />
              ) : (
                <DriverCareerPanel slug={slug} ergastId={resolvedDriverId} />
              )}
            </F1Card>
          </div>
        </div>

        {races.length > 0 && <DriverPositionChart history={races} teamColor={teamColor} />}

        {!isEntityDbConfigured() && !isProfileLoading && (
          <F1EmptyState
            type="coming-soon"
            title="Career records are not connected"
            description="Connect Supabase to load career records for this driver."
          />
        )}
      </div>
    </div>
  );
};

export default DriverProfile;

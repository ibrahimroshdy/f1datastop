import { useParams } from "react-router-dom";
import { F1Card, F1EmptyState, F1ErrorState, F1Skeleton } from "@/components/f1";
import { DriverIdentity } from "@/components/f1/DriverIdentity";
import { TeamName } from "@/components/f1/TeamName";
import TeamHeritagePanel from "@/components/constructors/TeamHeritagePanel";
import CountryFlag from "@/components/common/CountryFlag";
import { useConstructorCareer } from "@/hooks/entity";
import { useConstructorStandings, useDriverStandings } from "@/hooks/useF1Data";
import { useSeason } from "@/hooks/useSeason";
import { getTeamColorById } from "@/constants/f1Colors";
import { pageShell, pageStack } from "@/lib/layout";
import { seasonSearch } from "@/lib/links";
import { isEntityDbConfigured } from "@/services/entityService";
import { BackLink } from "@/components/ui/back-link";
import {
  gapWords,
  winsWords,
  type ConstructorStandingRow,
  type DriverStandingRow,
} from "@/components/standings/StandingsLists";
import NotFound from "./NotFound";
import { cn } from "@/lib/utils";
import Seo from "@/components/common/Seo";

const TeamProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const [season] = useSeason();

  const { data: profile, isLoading: isProfileLoading, isFetched: isProfileFetched } = useConstructorCareer({
    slug,
    enabled: !!slug,
  });
  const teams$ = useConstructorStandings(season);
  const drivers$ = useDriverStandings(season);
  const teams = (teams$.data?.data ?? []) as ConstructorStandingRow[];
  const drivers = (drivers$.data?.data ?? []) as DriverStandingRow[];

  const standing = teams.find(
    (row) =>
      row.Constructor.constructorId === profile?.ergast_id ||
      row.Constructor.constructorId === slug ||
      row.Constructor.name.toLowerCase().replace(/\s+/g, "-") === slug,
  );

  const constructorId = profile?.ergast_id ?? standing?.Constructor?.constructorId ?? slug ?? "";
  const teamColor = profile?.team_color_hex ?? getTeamColorById(constructorId);
  const displayName = profile?.display_name ?? standing?.Constructor?.name ?? slug?.replace(/-/g, " ") ?? "";
  const nationality = profile?.nationality ?? standing?.Constructor?.nationality;

  const lineup = drivers.filter((d) => d.Constructors.some((c) => c.constructorId === constructorId));

  if (!slug) return <NotFound />;
  if (isEntityDbConfigured() && isProfileFetched && !profile && !isProfileLoading) return <NotFound />;

  const points = Number(standing?.points ?? 0);
  const wins = Number(standing?.wins ?? 0);
  const leader = Number(teams[0]?.points ?? 0);

  return (
    <div className={pageShell}>
      <Seo
        title={`${displayName}, F1 team stats`}
        path={`/teams/${slug}`}
        description={`${displayName} in Formula 1: championship standing, drivers, results and team history.`}
      />
      <div className={cn("mx-auto w-full", pageStack, "animate-fade-in")}>
        <BackLink to={`/constructors${seasonSearch(season)}`}>Teams</BackLink>

        {(teams$.isError || drivers$.isError) && (
          <F1ErrorState
            type="network"
            variant="inline"
            onRetry={() => {
              teams$.refetch();
              drivers$.refetch();
            }}
          />
        )}

        <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
          <div className="grid gap-4 md:gap-6">
            {/* Lead card: emblem and name, then the season in words. */}
            <F1Card livery={teamColor} className="p-5 md:p-6">
              <div className="space-y-2 pr-14">
                {standing && (
                  <span className="inline-flex rounded-full bg-act px-2.5 py-0.5 text-xs font-semibold text-on-act">
                    P{standing.position} in the {season} championship
                  </span>
                )}
                <h1 className="text-3xl leading-tight md:text-4xl">
                  <TeamName constructorId={constructorId} name={displayName} size={30} className="gap-3" />
                </h1>
                {nationality ? <CountryFlag country={nationality} size={18} /> : null}
              </div>
              {teams$.isLoading ? (
                <F1Skeleton className="mt-5 h-16 w-full" />
              ) : standing ? (
                <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { label: "Points", value: points.toLocaleString() },
                    { label: "Wins", value: wins },
                    { label: "To the leader", value: gapWords(leader, points, standing.position === "1") },
                  ].map((t) => (
                    <div key={t.label} className="flex flex-col-reverse rounded-xl bg-raised px-3 py-2.5">
                      <dt className="text-[13px] text-muted-foreground">{t.label}</dt>
                      <dd className="readout text-2xl font-semibold text-figure">{t.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Not in the {season} standings.</p>
              )}
            </F1Card>

            {lineup.length > 0 && (
              <F1Card className="overflow-hidden p-0">
                <h2 className="px-4 pb-1 pt-4 text-lg">{season} drivers</h2>
                <ul className="divide-y divide-border">
                  {lineup.map((d) => (
                    <li key={d.Driver.driverId ?? d.Driver.code} className="flex items-center gap-3 px-4 py-2.5">
                      <DriverIdentity
                        driverId={d.Driver.driverId ?? d.Driver.code}
                        givenName={d.Driver.givenName}
                        familyName={d.Driver.familyName}
                        nationality={d.Driver.nationality}
                        constructorId={constructorId}
                        teamName={displayName}
                        className="flex-1"
                      />
                      <span className="flex shrink-0 flex-col items-end text-right">
                        <span className="readout text-base font-semibold text-figure">
                          {Number(d.points).toLocaleString()}
                          <span className="sr-only"> points</span>
                        </span>
                        <span className="text-[13px] text-muted-foreground">
                          P{d.position}, {winsWords(Number(d.wins ?? 0))}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </F1Card>
            )}
          </div>

          <F1Card className="p-4">
            {isProfileLoading ? (
              <F1Skeleton variant="card" className="h-40" />
            ) : (
              <TeamHeritagePanel constructorId={constructorId} slug={slug} teamName={displayName} teamColor={teamColor} />
            )}
          </F1Card>
        </div>

        {!isEntityDbConfigured() && !isProfileLoading && (
          <F1EmptyState
            type="coming-soon"
            title="Team history is not connected"
            description="Connect Supabase to load the history of this team."
          />
        )}
      </div>
    </div>
  );
};

export default TeamProfile;

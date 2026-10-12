import { Link, useParams } from "react-router-dom";
import {
  F1Card,
  F1CardContent,
  F1EmptyState,
  F1ErrorState,
  F1Skeleton,
  PageHeader,
} from "@/components/f1";
import TeamHeritagePanel from "@/components/constructors/TeamHeritagePanel";
import TeamLogo from "@/components/common/TeamLogo";
import CountryFlag from "@/components/common/CountryFlag";
import { useConstructorCareer } from "@/hooks/entity";
import {
  useConstructorStandings,
  useDriverStandings,
} from "@/hooks/useF1Data";
import { useTheme } from "@/context/ThemeContext";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { pageShell, pageStack } from "@/lib/layout";
import { isEntityDbConfigured } from "@/services/entityService";
import NotFound from "./NotFound";
import { cn } from "@/lib/utils";
import Seo from "@/components/common/Seo";

const TeamProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const { isGlass } = useTheme();
  const cardVariant = isGlass ? "glass" : "default";
  const glassVariant = isGlass ? "panel" : "default";
  const currentYear = new Date().getFullYear();

  const {
    data: profile,
    isLoading: isProfileLoading,
    isFetched: isProfileFetched,
  } = useConstructorCareer({ slug, enabled: !!slug });

  const {
    data: constructorStandings,
    isError: isConstructorsError,
    refetch: refetchConstructors,
  } = useConstructorStandings(currentYear);
  const {
    data: driverStandings,
    isError: isDriversError,
    refetch: refetchDrivers,
  } = useDriverStandings(currentYear);

  const standing = constructorStandings?.data?.find(
    (row: { Constructor: { constructorId: string; name: string } }) =>
      row.Constructor.constructorId === profile?.ergast_id ||
      row.Constructor.name.toLowerCase().replace(/\s+/g, "-") === slug,
  );

  const constructorId =
    profile?.ergast_id ?? standing?.Constructor?.constructorId ?? "";
  const teamColor =
    profile?.team_color_hex ??
    TEAM_COLORS[constructorId] ??
    TEAM_COLORS.default;
  const displayName =
    profile?.display_name ?? standing?.Constructor?.name ?? slug?.replace(/-/g, " ");

  const teamDrivers =
    driverStandings?.data?.filter(
      (driver: {
        Constructors: Array<{ constructorId: string }>;
      }) =>
        driver.Constructors.some((c) => c.constructorId === constructorId),
    ) ?? [];

  if (!slug) {
    return <NotFound />;
  }

  if (isEntityDbConfigured() && isProfileFetched && !profile && !isProfileLoading) {
    return <NotFound />;
  }

  return (
      <div className={pageShell}>
        <Seo
          title={`${displayName} — F1 Team Stats`}
          path={`/teams/${slug}`}
          description={`${displayName} in Formula 1 — championship standings, line-up, results and team history.`}
        />
        <div className={cn("mx-auto w-full", pageStack, "animate-fade-in")}>
        <PageHeader
          eyebrow="Team Profile"
          title={displayName}
          description={
            profile?.nationality ??
            standing?.Constructor?.nationality ??
            undefined
          }
          actions={
            <Link
              to="/constructors"
              className="text-sm text-primary hover:underline"
            >
              All teams
            </Link>
          }
        />

        {(isConstructorsError || isDriversError) && (
          <F1ErrorState
            type="network"
            variant="inline"
            onRetry={() => {
              refetchConstructors();
              refetchDrivers();
            }}
          />
        )}

        <F1Card
          variant={cardVariant}
          glassVariant={glassVariant}
          accent="top"
          teamColor={teamColor}
          className="overflow-hidden"
          style={{ borderTopColor: teamColor }}
        >
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
            <div
              className="flex h-24 w-full max-w-xs items-center justify-center rounded-md border-2 bg-neutral-950 px-4 sm:h-28"
              style={{ borderColor: teamColor }}
            >
              {constructorId ? (
                <TeamLogo
                  constructorId={constructorId}
                  alt={displayName}
                  className="max-h-16 max-w-full object-contain"
                  noBackground
                />
              ) : (
                <span className="text-lg font-bold text-muted-foreground">
                  {displayName}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {standing && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="timing text-sm font-semibold tabular-nums text-foreground">
                    P{standing.position}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    <span className="timing tabular-nums text-foreground">{standing.points}</span> pts
                    · <span className="timing tabular-nums text-foreground">{standing.wins}</span> wins
                  </span>
                </div>
              )}
              {profile?.nationality && (
                <div className="flex items-center gap-2 text-sm">
                  <CountryFlag country={profile.nationality} size={16} />
                  <span>{profile.nationality}</span>
                </div>
              )}
            </div>
          </div>
        </F1Card>

        <F1Card variant={cardVariant} glassVariant={glassVariant}>
          <F1CardContent className="pt-6">
            {isProfileLoading ? (
              <F1Skeleton variant="card" className="h-40" />
            ) : (
              <TeamHeritagePanel
                constructorId={constructorId}
                slug={slug}
                teamName={displayName}
                teamColor={teamColor}
              />
            )}
          </F1CardContent>
        </F1Card>

        {teamDrivers.length > 0 && (
          <F1Card variant={cardVariant} glassVariant={glassVariant}>
            <F1CardContent className="pt-6 space-y-3">
              <h2 className="instrument-label text-muted-foreground">
                {currentYear} Drivers
              </h2>
              <div className="overflow-hidden rounded-xl border border-border/70">
                <div className="divide-y divide-border/50">
                  {teamDrivers.map(
                    (driver: {
                      position: string;
                      points?: string;
                      wins?: string;
                      Driver: {
                        driverId: string;
                        givenName: string;
                        familyName: string;
                        code: string;
                      };
                    }) => (
                      <div
                        key={driver.Driver.driverId}
                        className="relative overflow-hidden"
                      >
                        <div
                          className="pointer-events-none absolute inset-y-0 left-0"
                          style={{ width: "100%", backgroundColor: teamColor, opacity: 0.1 }}
                        />
                        <div className="relative flex items-center gap-2.5 px-3 py-2">
                          <span className="timing w-7 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                            P{driver.position}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold leading-tight">
                              {driver.Driver.givenName} {driver.Driver.familyName}
                            </p>
                            <p className="timing text-xs text-muted-foreground">
                              {driver.Driver.code}
                            </p>
                          </div>
                          {(driver.wins != null && Number(driver.wins) > 0) && (
                            <span className="timing shrink-0 text-xs font-medium tabular-nums text-primary">
                              {driver.wins}W
                            </span>
                          )}
                          {driver.points != null && (
                            <span className="readout shrink-0 text-sm font-bold leading-tight tabular-nums">
                              {driver.points}
                              <span className="ml-1 text-2xs font-normal text-muted-foreground">PTS</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </F1CardContent>
          </F1Card>
        )}

        {!isEntityDbConfigured() && !isProfileLoading && (
          <F1EmptyState
            type="coming-soon"
            title="Entity database not configured"
            description="Connect Supabase to load team heritage for this constructor."
          />
        )}
      </div>
      </div>
  );
};

export default TeamProfile;

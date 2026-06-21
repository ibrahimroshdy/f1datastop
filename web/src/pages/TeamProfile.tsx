import { Link, useParams } from "react-router-dom";
import {
  F1Card,
  F1CardContent,
  F1EmptyState,
  F1Skeleton,
  PageHeader,
} from "@/components/f1";
import TeamHeritagePanel from "@/components/constructors/TeamHeritagePanel";
import TeamLogo from "@/components/common/TeamLogo";
import CountryFlag from "@/components/common/CountryFlag";
import { Badge } from "@/components/ui/badge";
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

  const { data: constructorStandings } = useConstructorStandings(currentYear);
  const { data: driverStandings } = useDriverStandings(currentYear);

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
      <div className={cn(pageShell, pageStack)}>
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

        <F1Card
          variant={cardVariant}
          glassVariant={glassVariant}
          className="overflow-hidden p-0"
          style={{ borderTopColor: teamColor, borderTopWidth: 4 }}
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
                  <Badge variant="outline">P{standing.position}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {standing.points} pts · {standing.wins} wins
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
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {currentYear} Drivers
              </h2>
              <div className="space-y-2">
                {teamDrivers.map(
                  (driver: {
                    position: string;
                    Driver: {
                      driverId: string;
                      givenName: string;
                      familyName: string;
                      code: string;
                    };
                  }) => (
                    <div
                      key={driver.Driver.driverId}
                      className={cn(
                        "flex items-center gap-3 rounded-md p-3",
                        isGlass ? "bg-white/5" : "bg-muted/50",
                      )}
                    >
                      <div
                        className="w-1 self-stretch rounded-full shrink-0"
                        style={{ backgroundColor: teamColor }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {driver.Driver.givenName} {driver.Driver.familyName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {driver.Driver.code}
                        </p>
                      </div>
                      <Badge variant="outline">P{driver.position}</Badge>
                    </div>
                  ),
                )}
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
  );
};

export default TeamProfile;

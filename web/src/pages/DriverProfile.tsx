import { Link, useParams } from "react-router-dom";
import {
  F1Card,
  F1CardContent,
  F1EmptyState,
  F1Skeleton,
  PageHeader,
} from "@/components/f1";
import CountryFlag from "@/components/common/CountryFlag";
import DriverCareerPanel from "@/components/drivers/DriverCareerPanel";
import DriverPositionChart from "@/components/drivers/DriverPositionChart";
import { useDriverCareer } from "@/hooks/entity";
import { useDriverStandings, useDriverResultsBySeason } from "@/hooks/useF1Data";
import { useTheme } from "@/context/ThemeContext";
import { TEAM_COLORS } from "@/constants/f1Colors";
import {
  buildF1DriverHeadshotUrl,
  getF1PortraitPathForErgastDriverId,
} from "@/constants/f1DriverPortraitMedia";
import { pageShell, pageStack } from "@/lib/layout";
import { isEntityDbConfigured } from "@/services/entityService";
import NotFound from "./NotFound";
import { cn } from "@/lib/utils";

const DriverProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const { isGlass } = useTheme();
  const cardVariant = isGlass ? "glass" : "default";
  const glassVariant = isGlass ? "panel" : "default";
  const currentYear = new Date().getFullYear();

  const {
    data: profile,
    isLoading: isProfileLoading,
    isFetched: isProfileFetched,
  } = useDriverCareer({ slug, enabled: !!slug });

  const { data: driverStandings } = useDriverStandings(currentYear);
  const ergastId = profile?.ergast_id;

  const standing = driverStandings?.data?.find(
    (row: { Driver: { driverId: string } }) =>
      row.Driver.driverId === ergastId ||
      (slug && row.Driver.driverId.replace(/_/g, "-") === slug),
  );

  const resolvedDriverId =
    ergastId ?? standing?.Driver?.driverId ?? undefined;

  const { data: seasonResultsResp } = useDriverResultsBySeason(
    currentYear,
    resolvedDriverId ?? "",
    !!resolvedDriverId,
  );

  if (!slug) {
    return <NotFound />;
  }

  if (isEntityDbConfigured() && isProfileFetched && !profile && !isProfileLoading) {
    return <NotFound />;
  }

  const constructorId = standing?.Constructors?.[0]?.constructorId ?? "";
  const teamColor =
    TEAM_COLORS[constructorId] ?? TEAM_COLORS.default;
  const portraitPath =
    profile?.portrait_path ??
    (resolvedDriverId
      ? getF1PortraitPathForErgastDriverId(resolvedDriverId)
      : undefined);
  const headshotUrl = portraitPath
    ? buildF1DriverHeadshotUrl(portraitPath)
    : undefined;

  const displayName =
    profile?.display_name ??
    (standing
      ? `${standing.Driver.givenName} ${standing.Driver.familyName}`
      : slug.replace(/-/g, " "));

  const pointsHistory =
    seasonResultsResp?.data?.map((race) => ({
      round: race.round,
      raceName: race.raceName,
      date: race.date,
      position: race.position,
      points: Number(race.points) || 0,
      country: race.country,
      isDNF: race.isDNF,
      constructor: race.constructor,
    })) ?? [];

  return (
    <div className={cn(pageShell, pageStack)}>
        <PageHeader
          eyebrow="Driver Profile"
          title={displayName}
          description={
            profile?.nationality
              ? `${profile.nationality}${profile.code ? ` · ${profile.code}` : ""}`
              : standing?.Driver?.nationality
          }
          actions={
            standing ? (
              <Link
                to="/drivers"
                className="text-sm text-primary hover:underline"
              >
                All drivers
              </Link>
            ) : undefined
          }
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
          <F1Card
            variant={cardVariant}
            glassVariant={glassVariant}
            className="scope-frame overflow-hidden p-0"
          >
            <div
              className="aspect-[3/4] w-full bg-neutral-950 flex items-end justify-center overflow-hidden"
              style={{
                borderBottom: `3px solid ${teamColor}`,
              }}
            >
              {headshotUrl ? (
                <img
                  src={headshotUrl}
                  alt={displayName}
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-4xl font-bold text-white/80"
                  style={{ backgroundColor: teamColor }}
                >
                  {profile?.code ??
                    standing?.Driver?.code ??
                    displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <F1CardContent className="pt-4">
              <div className="hairline-grid">
                {profile?.nationality && (
                  <div className="data-row">
                    <span className="instrument-label">Nationality</span>
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <CountryFlag country={profile.nationality} size={16} />
                      {profile.nationality}
                    </span>
                  </div>
                )}
                {profile?.permanent_number && (
                  <div className="data-row">
                    <span className="instrument-label">Number</span>
                    <span className="timing font-semibold">
                      #{profile.permanent_number}
                    </span>
                  </div>
                )}
                {standing && (
                  <>
                    <div className="data-row">
                      <span className="instrument-label">Position</span>
                      <span className="readout text-2xl text-foreground">
                        P{standing.position}
                      </span>
                    </div>
                    <div className="data-row">
                      <span className="instrument-label">Points</span>
                      <span className="readout text-2xl text-foreground">
                        {standing.points}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </F1CardContent>
          </F1Card>

          <div className="space-y-6">
            <F1Card variant={cardVariant} glassVariant={glassVariant}>
              <F1CardContent className="pt-6">
                {isProfileLoading ? (
                  <F1Skeleton variant="card" className="h-40" />
                ) : (
                  <DriverCareerPanel slug={slug} ergastId={resolvedDriverId} />
                )}
              </F1CardContent>
            </F1Card>

            {pointsHistory.length > 0 && (
              <F1Card variant={cardVariant} glassVariant={glassVariant}>
                <F1CardContent className="pt-6 space-y-3">
                  <h2 className="instrument-label">
                    {currentYear} Season
                  </h2>
                  <DriverPositionChart
                    history={pointsHistory}
                    teamColor={teamColor}
                  />
                </F1CardContent>
              </F1Card>
            )}

            {!isEntityDbConfigured() && !isProfileLoading && (
              <F1EmptyState
                type="coming-soon"
                title="Entity database not configured"
                description="Connect Supabase to load career records for this driver."
              />
            )}
          </div>
        </div>
      </div>
  );
};

export default DriverProfile;

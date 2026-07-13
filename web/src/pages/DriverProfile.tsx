import { useParams } from "react-router-dom";
import {
  DriverAvatar,
  F1Card,
  F1CardContent,
  F1EmptyState,
  F1Skeleton,
  PositionBadge,
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
import { CountUp } from "@/components/CountUp";
import { isEntityDbConfigured } from "@/services/entityService";
import { Activity, Flag as FlagIcon } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import NotFound from "./NotFound";
import { cn } from "@/lib/utils";

// ── Instrument section eyebrow (mirrors Home) ──────────────────────────────
const SectionLabel = ({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="instrument-label -mb-1 flex items-center gap-1.5 text-primary">
    {icon}
    <span>{children}</span>
  </div>
);

// ── Stat readout tile (mono number + instrument caption) ───────────────────
const StatTile = ({
  label,
  value,
  count,
  accent,
}: {
  label: string;
  value: string | number | undefined;
  count?: number;
  accent?: boolean;
}) => (
  <div className="flex flex-col gap-1 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
    <span className="instrument-label text-muted-foreground">{label}</span>
    <span
      className={cn(
        "readout text-xl md:text-2xl leading-none",
        accent ? "text-primary" : "text-foreground",
      )}
    >
      {count != null && Number.isFinite(count) ? <CountUp value={count} /> : value ?? "—"}
    </span>
  </div>
);

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

  const resolvedDriverId = ergastId ?? standing?.Driver?.driverId ?? undefined;

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
  const teamColor = TEAM_COLORS[constructorId] ?? TEAM_COLORS.default;
  const teamName = standing?.Constructors?.[0]?.name;
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

  const driverCode =
    profile?.code ??
    standing?.Driver?.code ??
    displayName.slice(0, 3).toUpperCase();

  const nationality = profile?.nationality ?? standing?.Driver?.nationality;
  const driverNumber = profile?.permanent_number ?? standing?.Driver?.permanentNumber;

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

  const podiumCount = pointsHistory.filter(
    (r) => !r.isDNF && Number(r.position) <= 3,
  ).length;
  const winCount = pointsHistory.filter(
    (r) => !r.isDNF && Number(r.position) === 1,
  ).length;

  const pointsNum = standing ? Number(standing.points) : NaN;

  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full", pageStack, "animate-fade-in")}>
        {/* ── Back link (← Drivers) ───────────────────────────────────────── */}
        <BackLink to="/drivers">Drivers</BackLink>

        {/* ── Compact identity + stat readouts header ─────────────────────── */}
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-[minmax(0,360px)_1fr] lg:items-start">
          {/* Identity row */}
          <F1Card
            variant={cardVariant}
            glassVariant={glassVariant}
            className="scope-frame overflow-hidden p-0"
          >
            <div
              className="flex items-center gap-3 p-4"
              style={{ borderLeft: `3px solid ${teamColor}` }}
            >
              <DriverAvatar
                src={headshotUrl}
                driverCode={driverCode}
                driverName={displayName}
                teamColor={teamColor}
                size="xl"
                className="shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="instrument-label flex items-center gap-1.5 text-primary">
                  <FlagIcon className="h-3 w-3" />
                  Driver Profile
                </div>
                <h1 className="truncate font-heading text-xl font-bold leading-tight tracking-tight md:text-2xl">
                  {displayName}
                </h1>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                  {driverNumber != null && (
                    <span className="timing font-semibold text-foreground">
                      #{driverNumber}
                    </span>
                  )}
                  {teamName && (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: teamColor }}
                        aria-hidden
                      />
                      <span className="truncate">{teamName}</span>
                    </span>
                  )}
                  {nationality && (
                    <span className="flex items-center gap-1.5">
                      <CountryFlag country={nationality} size={14} />
                      {nationality}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </F1Card>

          {/* Stat readout tiles */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3">
            <StatTile
              label="Points"
              count={Number.isFinite(pointsNum) ? pointsNum : undefined}
              value={standing?.points}
              accent
            />
            <StatTile label="Wins" value={winCount} count={winCount} />
            <StatTile
              label="Position"
              value={standing ? `P${standing.position}` : undefined}
            />
            <StatTile label="Podiums" value={podiumCount} count={podiumCount} />
          </div>
        </div>

        {/* ── Career records ──────────────────────────────────────────────── */}
        <SectionLabel icon={<FlagIcon className="h-3 w-3" />}>
          Career Records
        </SectionLabel>
        <F1Card variant={cardVariant} glassVariant={glassVariant}>
          <F1CardContent className="pt-4 md:pt-5">
            {isProfileLoading ? (
              <F1Skeleton variant="card" className="h-32" />
            ) : (
              <DriverCareerPanel slug={slug} ergastId={resolvedDriverId} />
            )}
          </F1CardContent>
        </F1Card>

        {/* ── Recent results — dense hairline list ────────────────────────── */}
        {pointsHistory.length > 0 && (
          <>
            <SectionLabel icon={<FlagIcon className="h-3 w-3" />}>
              {currentYear} Results
            </SectionLabel>
            <F1Card
              variant={cardVariant}
              glassVariant={glassVariant}
              className="overflow-hidden p-0"
            >
              <ul className="divide-y divide-border">
                {pointsHistory.map((race) => {
                  const pos = Number(race.position);
                  const isPodium = !race.isDNF && pos <= 3;
                  return (
                    <li
                      key={race.round}
                      className="flex items-center gap-3 px-4 py-2"
                    >
                      <span className="timing w-7 shrink-0 text-center text-xs text-muted-foreground">
                        R{race.round}
                      </span>
                      {race.country && (
                        <span className="shrink-0 rounded-md bg-muted p-1">
                          <CountryFlag country={race.country} size={16} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold leading-tight">
                          {race.raceName}
                        </div>
                        <div className="truncate text-2xs text-muted-foreground">
                          {race.constructor ?? teamName ?? ""}
                        </div>
                      </div>
                      {race.isDNF ? (
                        <span className="timing shrink-0 rounded px-1.5 py-0.5 text-2xs font-semibold uppercase text-status-cancelled">
                          DNF
                        </span>
                      ) : isPodium && Number.isFinite(pos) ? (
                        <PositionBadge position={pos} className="shrink-0" />
                      ) : (
                        <span className="timing w-7 shrink-0 text-center text-sm font-semibold tabular-nums">
                          P{race.position}
                        </span>
                      )}
                      <span className="timing w-11 shrink-0 text-right text-sm font-semibold tabular-nums">
                        {race.points}
                        <span className="ml-1 text-2xs text-muted-foreground">
                          PTS
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </F1Card>

            {/* ── Season position scope (self-themed chart) ───────────────── */}
            <SectionLabel icon={<Activity className="h-3 w-3" />}>
              Race Progression Scope
            </SectionLabel>
            <DriverPositionChart history={pointsHistory} teamColor={teamColor} />
          </>
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
  );
};

export default DriverProfile;

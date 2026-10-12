import { useParams } from "react-router-dom";
import {
  DriverAvatar,
  F1Card,
  F1CardContent,
  F1EmptyState,
  F1ErrorState,
  F1Skeleton,
  PageHeader,
  PositionBadge,
} from "@/components/f1";
import CountryFlag from "@/components/common/CountryFlag";
import DriverCareerPanel from "@/components/drivers/DriverCareerPanel";
import DriverPositionChart from "@/components/drivers/DriverPositionChart";
import DriverComparePanel from "@/components/drivers/DriverComparePanel";
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
import { Activity, Flag as FlagIcon, GitCompare } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import NotFound from "./NotFound";
import { cn } from "@/lib/utils";
import Seo from "@/components/common/Seo";

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

  const {
    data: driverStandings,
    isError: isStandingsError,
    refetch: refetchStandings,
  } = useDriverStandings(currentYear);
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
      grid: race.grid,
      qualiPosition: race.qualiPosition,
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
      <Seo
        title={`${displayName} — F1 Stats & Telemetry`}
        path={`/drivers/${slug}`}
        type="profile"
        description={`${displayName}'s Formula 1 results, race pace, qualifying record and telemetry breakdowns.`}
      />
      <div className={cn("mx-auto w-full", pageStack, "animate-fade-in")}>
        {/* ── Back link (← Drivers) ───────────────────────────────────────── */}
        <BackLink to="/drivers">Drivers</BackLink>

        <PageHeader
          eyebrow="Driver Profile"
          title={displayName}
          description={teamName ?? nationality ?? undefined}
        />

        {isStandingsError && (
          <F1ErrorState
            type="network"
            variant="inline"
            onRetry={() => refetchStandings()}
          />
        )}

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
                <div className="font-heading text-xl font-bold leading-tight tracking-tight md:text-2xl truncate">
                  {displayName}
                </div>
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

          {/* Stat readout cluster — hairline tiles, mono readouts */}
          <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-lg border border-border sm:grid-cols-4">
            {[
              {
                label: "Points",
                node:
                  Number.isFinite(pointsNum) ? <CountUp value={pointsNum} /> : standing?.points ?? "—",
                accent: true,
              },
              { label: "Wins", node: <CountUp value={winCount} />, accent: false },
              {
                label: "Position",
                node: standing ? `P${standing.position}` : "—",
                accent: false,
              },
              { label: "Podiums", node: <CountUp value={podiumCount} />, accent: false },
            ].map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center justify-center gap-0.5 p-2.5 text-center"
              >
                <span
                  className={cn(
                    "readout text-lg font-semibold tabular-nums",
                    s.accent ? "text-primary" : "text-foreground",
                  )}
                >
                  {s.node}
                </span>
                <span className="instrument-label text-muted-foreground">{s.label}</span>
              </div>
            ))}
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

        {/* ── Head to head — compare this driver vs any rival ─────────────── */}
        {(driverStandings?.data?.length ?? 0) > 0 && resolvedDriverId && (
          <>
            <SectionLabel icon={<GitCompare className="h-3 w-3" />}>
              Head to Head
            </SectionLabel>
            <DriverComparePanel
              seasonYear={currentYear}
              standings={driverStandings?.data ?? []}
              driverAId={resolvedDriverId}
              driverAName={displayName}
              driverAColor={teamColor}
              historyA={pointsHistory}
            />
          </>
        )}

        {pointsHistory.length > 0 && (
          <>
            {/* ── Race progression scope — shown first (the season at a glance) ── */}
            <SectionLabel icon={<Activity className="h-3 w-3" />}>
              Race Progression Scope
            </SectionLabel>
            <DriverPositionChart history={pointsHistory} teamColor={teamColor} />

            {/* ── Results — compact single-line hairline list w/ quali + grid ── */}
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
                      className="flex items-center gap-2.5 px-3 py-1.5"
                    >
                      <span className="timing w-6 shrink-0 text-center text-2xs text-muted-foreground">
                        R{race.round}
                      </span>
                      {race.country && (
                        <CountryFlag country={race.country} size={15} className="shrink-0 rounded-[2px]" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold leading-tight">
                        {race.raceName}
                      </span>
                      {/* Qualifying + grid — revealed where there's room */}
                      <span className="hidden shrink-0 items-center gap-2.5 sm:flex">
                        {race.qualiPosition != null && (
                          <span className="timing tabular-nums text-2xs text-muted-foreground">
                            Q{race.qualiPosition}
                          </span>
                        )}
                        {race.grid != null && (
                          <span className="timing tabular-nums text-2xs text-muted-foreground">
                            Grid {race.grid}
                          </span>
                        )}
                      </span>
                      {race.isDNF ? (
                        <span className="timing shrink-0 text-2xs font-semibold uppercase text-status-cancelled">
                          DNF
                        </span>
                      ) : isPodium && Number.isFinite(pos) ? (
                        <PositionBadge position={pos} showIcon={false} className="shrink-0" />
                      ) : (
                        <span className="timing w-7 shrink-0 text-center text-xs font-semibold tabular-nums">
                          P{race.position}
                        </span>
                      )}
                      <span className="timing w-9 shrink-0 text-right text-xs font-semibold tabular-nums">
                        {race.points}
                        <span className="ml-0.5 text-2xs text-muted-foreground">PTS</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </F1Card>
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

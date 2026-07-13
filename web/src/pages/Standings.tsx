
import { useUrlTab } from "@/hooks/useUrlTab";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDriverStandings, useConstructorStandings } from "@/hooks/useF1Data";
import TeamLogo from "@/components/common/TeamLogo";
import ReactCountryFlag from "react-country-flag";
import {
  normalizeTeamId,
  getTeamHexColor,
  getNationalityCode,
} from "@/components/standings/standingsUtils";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { pageShell, pageStack } from "@/lib/layout";
import { ChevronRight, Flag as FlagIcon, Trophy, Car } from "lucide-react";
import { HelmetIcon } from "@/components/common/HelmetIcon";
import {
  F1Card,
  F1EmptyState,
  F1ErrorState,
  F1Skeleton,
  PageHeader,
  DriverAvatar,
} from "@/components/f1";
import {
  buildF1DriverHeadshotUrl,
  getF1PortraitPathForErgastDriverId,
} from "@/constants/f1DriverPortraitMedia";
import { AnimatedNumber } from "@/components/AnimatedNumber";

/** F1-media headshot for a current-grid driver; undefined falls back to initials. */
const headshotSrc = (driverId?: string): string | undefined => {
  if (!driverId) return undefined;
  const path = getF1PortraitPathForErgastDriverId(driverId);
  return path ? buildF1DriverHeadshotUrl(path) : undefined;
};

type DriverStandingRow = {
  position: string;
  points: string;
  wins?: string;
  Driver: { driverId?: string; givenName: string; familyName: string; code: string; nationality?: string };
  Constructors: Array<{ constructorId?: string; name: string; nationality?: string }>;
};

type ConstructorStandingRow = {
  position: string;
  points: string;
  wins?: string;
  Constructor: { constructorId?: string; name: string; nationality?: string };
};

const currentSeason = new Date().getFullYear();

const underlineTabTrigger =
  "rounded-none border-b-2 border-transparent bg-transparent px-3 pb-2 pt-1 text-sm shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none md:px-4 md:text-base";

// ── Nationality flag chip ────────────────────────────────────────────────────
const Flag = ({ nationality }: { nationality?: string }) => {
  const code = getNationalityCode(nationality);
  if (!code) return null;
  return (
    <ReactCountryFlag
      countryCode={code}
      svg
      style={{ width: 13, height: "auto" }}
      title={nationality}
    />
  );
};

// ── Mono position cell — podium gets medal-tinted mono digits, rest stay muted.
// (No pill: a badge in the w-6 column broke the mono column rhythm.)
const Pos = ({ position }: { position: string }) => {
  const n = Number(position);
  const medal =
    n === 1
      ? "text-position-gold"
      : n === 2
        ? "text-position-silver"
        : n === 3
          ? "text-position-bronze"
          : "text-muted-foreground";
  return (
    <span className={cn("timing w-6 shrink-0 text-center text-sm font-semibold", medal)}>
      {position}
    </span>
  );
};

// ── Mono points readout (matches Home's `.readout` + PTS suffix) ─────────────
const Points = ({ value }: { value: string }) => (
  <span className="shrink-0 text-right">
    <AnimatedNumber value={Number(value) || 0} mono className="readout text-sm md:text-base" />
    <span className="ml-1 text-2xs text-muted-foreground">PTS</span>
  </span>
);

// ── Compact list header (eyebrow + count) — mirrors Home ChampionshipMiniList ─
const ListHeader = ({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) => (
  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
    <div className="instrument-label flex items-center gap-1.5 text-primary">
      {icon}
      {label}
    </div>
    {count > 0 && (
      <span className="timing shrink-0 text-2xs text-muted-foreground">
        {count} entries
      </span>
    )}
  </div>
);

// ── Shared row skeleton (mono pos · hairline · avatar · name/team · pts · › ) ──
const skeletonPlate = (
  <ul className="divide-y divide-border">
    {Array.from({ length: 10 }).map((_, i) => (
      <li key={i} className="flex items-center gap-3 px-4 py-2.5">
        <F1Skeleton className="h-4 w-6 shrink-0" />
        <F1Skeleton className="h-8 w-0.5 shrink-0" />
        <F1Skeleton className="h-8 w-8 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <F1Skeleton className="h-4 w-32" />
          <F1Skeleton className="h-3 w-20" />
        </div>
        <F1Skeleton className="h-5 w-10 shrink-0" />
      </li>
    ))}
  </ul>
);

const Standings = () => {
  const [activeTab, setActiveTab] = useUrlTab("tab", ["drivers", "constructors"] as const, "drivers");
  const { isGlass } = useTheme();
  const {
    data: driverStandings,
    isLoading: isDriversLoading,
    isError: isDriversError,
    refetch: refetchDrivers,
  } = useDriverStandings();
  const {
    data: constructorStandings,
    isLoading: isConstructorsLoading,
    isError: isConstructorsError,
    refetch: refetchConstructors,
  } = useConstructorStandings();

  const cardVariant = isGlass ? "glass" : "default";
  const glassVariant = isGlass ? "panel" : "default";

  const drivers = (driverStandings?.data ?? []) as DriverStandingRow[];
  const constructors = (constructorStandings?.data ?? []) as ConstructorStandingRow[];

  const leaderDriverPts = Number(drivers[0]?.points ?? 0);
  const leaderTeamPts = Number(constructors[0]?.points ?? 0);

  // ── Driver rows — one plate, divide-y, links to /drivers/:id ───────────────
  const driverRows = (
    <ul className="divide-y divide-border stagger-children">
      {drivers.map((driver) => {
        const teamId = normalizeTeamId(driver.Constructors[0]?.constructorId || "default");
        const teamColor = getTeamHexColor(teamId);
        const driverId = driver.Driver.driverId || driver.Driver.code;
        const name = `${driver.Driver.givenName} ${driver.Driver.familyName}`.trim();
        const gap = Math.max(0, leaderDriverPts - Number(driver.points));
        const wins = Number(driver.wins ?? 0);

        const row = (
          <div className="flex items-center gap-3 px-4 py-2.5 transition-colors group-hover:bg-muted/50">
            <Pos position={driver.position} />
            <span
              className="h-8 w-0.5 shrink-0 rounded-full"
              style={{ backgroundColor: teamColor }}
              aria-hidden
            />
            <DriverAvatar
              driverCode={driver.Driver.code}
              driverName={name}
              teamColor={teamColor}
              size="sm"
              src={headshotSrc(driver.Driver.driverId)}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold leading-tight md:text-base">
                {name}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-muted-foreground md:text-xs">
                <Flag nationality={driver.Driver.nationality} />
                <span className="timing font-medium">{driver.Driver.code}</span>
                <span className="opacity-40">·</span>
                <span className="truncate">{driver.Constructors[0]?.name}</span>
              </div>
            </div>

            {/* Desktop-only extra columns: wins · gap (same row skeleton) */}
            <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground md:flex">
              <Trophy className="h-3 w-3" />
              <AnimatedNumber value={wins} mono className="timing" />
            </span>
            <span className="timing hidden w-16 shrink-0 text-right text-2xs text-muted-foreground md:block">
              {gap > 0 ? <AnimatedNumber value={gap} mono prefix="+" /> : "—"}
            </span>

            <Points value={driver.points} />
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </div>
        );

        return (
          <li key={driver.position}>
            <Link to={`/drivers/${driverId}`} className="group block">
              {row}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  // ── Constructor rows — one plate, divide-y, links to /constructors/:id ──────
  const constructorRows = (
    <ul className="divide-y divide-border stagger-children">
      {constructors.map((constructor) => {
        const rawId = constructor.Constructor?.constructorId || "default";
        const teamId = normalizeTeamId(rawId);
        const teamColor = getTeamHexColor(teamId);
        const nat = constructor.Constructor?.nationality;
        const gap = Math.max(0, leaderTeamPts - Number(constructor.points));
        const wins = Number(constructor.wins ?? 0);

        const row = (
          <div className="flex items-center gap-3 px-4 py-2.5 transition-colors group-hover:bg-muted/50">
            <Pos position={constructor.position} />
            <span
              className="h-8 w-0.5 shrink-0 rounded-full"
              style={{ backgroundColor: teamColor }}
              aria-hidden
            />
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <TeamLogo constructorId={teamId} alt={constructor.Constructor?.name} size="sm" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold leading-tight md:text-base">
                {constructor.Constructor.name}
              </div>
              {nat && (
                <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted-foreground md:text-xs">
                  <Flag nationality={nat} />
                  <span className="truncate">{nat}</span>
                </div>
              )}
            </div>

            {/* Desktop-only extra columns: wins · gap (same row skeleton) */}
            <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground md:flex">
              <Trophy className="h-3 w-3" />
              <AnimatedNumber value={wins} mono className="timing" />
            </span>
            <span className="timing hidden w-16 shrink-0 text-right text-2xs text-muted-foreground md:block">
              {gap > 0 ? <AnimatedNumber value={gap} mono prefix="+" /> : "—"}
            </span>

            <Points value={constructor.points} />
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </div>
        );

        return (
          <li key={constructor.position}>
            <Link to={`/constructors/${rawId}`} className="group block">
              {row}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full", pageStack, "animate-fade-in")}>
        <PageHeader
          eyebrow={`${currentSeason} Season`}
          title="Championship Standings"
          description="Current Formula 1 season standings"
        />

        <Tabs defaultValue="drivers" value={activeTab}
          onValueChange={(v) => setActiveTab(v as "drivers" | "constructors")} className="w-full">
          <TabsList className="inline-flex h-auto w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="drivers" className={cn(underlineTabTrigger, "inline-flex items-center gap-1.5")}>
              <HelmetIcon className="h-4 w-4" /> Drivers
            </TabsTrigger>
            <TabsTrigger value="constructors" className={cn(underlineTabTrigger, "inline-flex items-center gap-1.5")}>
              <Car className="h-4 w-4" /> Constructors
            </TabsTrigger>
          </TabsList>

          <TabsContent value="drivers" className="mt-4 md:mt-6">
            <F1Card variant={cardVariant} glassVariant={glassVariant} className="overflow-hidden p-0">
              <ListHeader
                icon={<FlagIcon className="h-3 w-3" />}
                label={`Drivers ${currentSeason}`}
                count={drivers.length}
              />
              {isDriversError ? (
                <F1ErrorState type="network" variant="inline" className="py-8" onRetry={() => refetchDrivers()} />
              ) : isDriversLoading ? (
                skeletonPlate
              ) : !drivers.length ? (
                <F1EmptyState type="no-data" className="py-10" />
              ) : (
                driverRows
              )}
            </F1Card>
          </TabsContent>

          <TabsContent value="constructors" className="mt-4 md:mt-6">
            <F1Card variant={cardVariant} glassVariant={glassVariant} className="overflow-hidden p-0">
              <ListHeader
                icon={<FlagIcon className="h-3 w-3" />}
                label={`Constructors ${currentSeason}`}
                count={constructors.length}
              />
              {isConstructorsError ? (
                <F1ErrorState type="network" variant="inline" className="py-8" onRetry={() => refetchConstructors()} />
              ) : isConstructorsLoading ? (
                skeletonPlate
              ) : !constructors.length ? (
                <F1EmptyState type="no-data" className="py-10" />
              ) : (
                constructorRows
              )}
            </F1Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Standings;

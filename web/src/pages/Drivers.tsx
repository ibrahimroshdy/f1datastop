
import { useState } from "react";
import { Link } from "react-router-dom";
import { useDriverStandings } from "@/hooks/useF1Data";
import { useTheme } from "@/context/ThemeContext";
import {
  F1Card,
  F1EmptyState,
  F1Skeleton,
  PageHeader,
  PositionBadge,
  DriverAvatar,
} from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { Search, Users, Trophy, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import ReactCountryFlag from "react-country-flag";
import {
  normalizeTeamId,
  getTeamHexColor,
  getNationalityCode,
} from "@/components/standings/standingsUtils";
import YearSelector from "@/components/common/YearSelector";

type DriverStandingEntry = {
  position: string;
  points: string;
  wins: string;
  Driver: {
    driverId: string;
    givenName: string;
    familyName: string;
    code: string;
    nationality?: string;
  };
  Constructors: Array<{ constructorId?: string; name: string }>;
};

// ── Nationality flag chip (mirrors Standings) ────────────────────────────────
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

// ── Mono position cell — P1 gets the restrained-red badge, rest stay mono ─────
const Pos = ({ position }: { position: string }) => {
  const n = Number(position);
  if (n === 1) {
    return (
      <span className="flex w-6 shrink-0 justify-center">
        <PositionBadge position={1} />
      </span>
    );
  }
  return (
    <span className="timing w-6 shrink-0 text-center text-sm font-semibold text-muted-foreground">
      {position}
    </span>
  );
};

// ── Mono points readout (matches Home's `.readout` + PTS suffix) ─────────────
const Points = ({ value }: { value: string }) => (
  <span className="shrink-0 text-right">
    <span className="readout text-sm md:text-base">{value}</span>
    <span className="ml-1 text-2xs text-muted-foreground">PTS</span>
  </span>
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

const Drivers = () => {
  const { isGlass } = useTheme();
  const cardVariant = isGlass ? "glass" : "default";
  const glassVariant = isGlass ? "panel" : "default";
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data: driverStandings, isLoading } = useDriverStandings(selectedYear);
  const [searchQuery, setSearchQuery] = useState("");

  const all = (driverStandings?.data ?? []) as DriverStandingEntry[];
  const filteredDrivers = all.filter((driver) => {
    const q = searchQuery.toLowerCase();
    const fullName = `${driver.Driver.givenName} ${driver.Driver.familyName}`.toLowerCase();
    return (
      fullName.includes(q) ||
      driver.Driver.code.toLowerCase().includes(q) ||
      (driver.Constructors[0]?.name ?? "").toLowerCase().includes(q)
    );
  });

  const driverRows = (
    <ul className="divide-y divide-border stagger-children">
      {filteredDrivers.map((driver) => {
        const team = driver.Constructors[0];
        const teamId = normalizeTeamId(team?.constructorId || "default");
        const teamColor = getTeamHexColor(teamId);
        const driverId = driver.Driver.driverId || driver.Driver.code;
        const name = `${driver.Driver.givenName} ${driver.Driver.familyName}`.trim();
        const wins = Number(driver.wins ?? 0);

        return (
          <li key={driverId}>
            <Link to={`/drivers/${driverId}`} className="group block">
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
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold leading-tight md:text-base">
                    {name}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-muted-foreground md:text-xs">
                    <Flag nationality={driver.Driver.nationality} />
                    <span className="timing font-medium">{driver.Driver.code}</span>
                    <span className="opacity-40">·</span>
                    <span className="truncate">{team?.name}</span>
                  </div>
                </div>

                {/* Desktop-only extra column: wins (same row skeleton) */}
                <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground md:flex">
                  <Trophy className="h-3 w-3" />
                  <span className="timing tabular-nums">{wins}</span>
                </span>

                <Points value={driver.points} />
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full max-w-4xl", pageStack, "animate-fade-in")}>
        <PageHeader
          eyebrow={`${selectedYear} Season`}
          title="Drivers"
          description={`Formula 1 drivers for the ${selectedYear} season`}
          actions={<YearSelector selectedYear={selectedYear} onYearChange={setSelectedYear} />}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border py-2 md:gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground md:top-3" />
            <Input
              placeholder="Search drivers..."
              className="h-9 pl-9 md:h-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {!isLoading && (
            <div className="flex items-center gap-2">
              <span className="instrument-label">Drivers</span>
              <span className="readout text-base text-foreground md:text-lg">
                {filteredDrivers.length}
              </span>
            </div>
          )}
        </div>

        <F1Card variant={cardVariant} glassVariant={glassVariant} className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="instrument-label flex items-center gap-1.5 text-primary">
              <Users className="h-3 w-3" />
              {`Drivers ${selectedYear}`}
            </div>
            {filteredDrivers.length > 0 && (
              <span className="timing shrink-0 text-2xs text-muted-foreground">
                {filteredDrivers.length} entries
              </span>
            )}
          </div>

          {isLoading ? (
            skeletonPlate
          ) : !filteredDrivers.length ? (
            <F1EmptyState type="no-data" className="py-10" />
          ) : (
            driverRows
          )}
        </F1Card>
      </div>
    </div>
  );
};

export default Drivers;

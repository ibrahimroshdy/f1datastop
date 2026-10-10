import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import {
  F1Card,
  F1CardContent,
  F1EmptyState,
  F1ErrorState,
  F1Skeleton,
  PageHeader,
} from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { Input } from "@/components/ui/input";
import { Search, Trophy } from "lucide-react";
import { useConstructorStandings, useDriverStandings } from "@/hooks/useF1Data";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import TeamLogo from "@/components/common/TeamLogo";
import YearSelector from "@/components/common/YearSelector";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { cn } from "@/lib/utils";
import TeamHeritagePanel from "@/components/constructors/TeamHeritagePanel";
import Seo from "@/components/common/Seo";
import { breadcrumbSchema } from "@/lib/structuredData";

type ConstructorListEntry = {
  position: string;
  points: string;
  wins: string;
  Constructor: {
    constructorId: string;
    name: string;
    nationality: string;
    url?: string;
  };
};

type DriverStandingForTeam = {
  position: string;
  Driver: {
    driverId: string;
    givenName: string;
    familyName: string;
    code: string;
    permanentNumber?: string;
  };
  Constructors: Array<{ constructorId: string }>;
};

/** Compact instrument readout used for Points / Wins. */
const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-[3.25rem]">
    <div className="instrument-label">{label}</div>
    <AnimatedNumber value={Number(value) || 0} mono className="readout mt-0.5 block text-xl text-foreground" />
  </div>
);

const Constructors = () => {
  const { isGlass } = useTheme();
  const cardVariant = isGlass ? "glass" : "default";
  const glassVariant = isGlass ? "panel" : "default";
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data: constructorStandings, isLoading, isError, refetch } = useConstructorStandings(selectedYear);
  const { data: driverStandings } = useDriverStandings(selectedYear);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConstructors = constructorStandings?.data.filter((constructor: ConstructorListEntry) => {
    return constructor.Constructor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      constructor.Constructor.nationality.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getTeamDrivers = (constructorId: string) => {
    if (!driverStandings?.data) return [];
    return driverStandings.data.filter((driver: DriverStandingForTeam) =>
      driver.Constructors.some((c) => c.constructorId === constructorId)
    );
  };

  const isChampion = (constructor: ConstructorListEntry) => constructor.position === "1";

  return (
    <div className={pageShell}>
      <Seo
        title="F1 Constructors"
        path="/constructors"
        description="Formula 1 teams — championship standings, driver line-ups and constructor performance across the season."
        jsonLd={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Constructors", path: "/constructors" }])}
      />
      <div className={cn("mx-auto w-full", pageStack, "animate-fade-in")}>
        <PageHeader
          eyebrow={`${selectedYear} Season`}
          title="Teams"
          description={`Formula 1 constructors for the ${selectedYear} season`}
          actions={<YearSelector selectedYear={selectedYear} onYearChange={setSelectedYear} />}
        />

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isError ? (
          <F1ErrorState type="network" variant="inline" className="py-8" onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="flex flex-col gap-3">
            {Array(10).fill(0).map((_, i) => (
              <F1Card key={i} variant={cardVariant} glassVariant={glassVariant} size="default">
                <div className="flex items-center gap-3">
                  <F1Skeleton className="h-12 w-12 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <F1Skeleton className="h-4 w-40" />
                    <F1Skeleton className="h-3 w-24" />
                  </div>
                  <F1Skeleton className="h-8 w-16" />
                  <F1Skeleton className="hidden h-10 w-56 md:block" />
                </div>
              </F1Card>
            ))}
          </div>
        ) : !filteredConstructors?.length ? (
          <F1EmptyState type="no-data" className="py-10" />
        ) : (
          <div className="flex flex-col gap-3">
            {filteredConstructors?.map((constructor: ConstructorListEntry) => {
              const teamColor = TEAM_COLORS[constructor.Constructor.constructorId] || TEAM_COLORS.default;
              const teamDrivers = getTeamDrivers(constructor.Constructor.constructorId);
              const champion = isChampion(constructor);

              return (
                <F1Card
                  key={constructor.Constructor.constructorId}
                  variant={cardVariant}
                  glassVariant={glassVariant}
                  accent="team"
                  teamColor={teamColor}
                  hover="lift"
                  className="p-0"
                >
                  <F1CardContent className="p-0">
                    <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                      {/* Identity: rank + logo + name */}
                      <div className="flex items-center gap-3 lg:w-[19rem] lg:shrink-0">
                        <span className="readout w-7 shrink-0 text-center text-lg text-muted-foreground">
                          {constructor.position}
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 bg-background"
                                style={{ borderColor: teamColor }}
                              >
                                <TeamLogo
                                  constructorId={constructor.Constructor.constructorId}
                                  alt={constructor.Constructor.name}
                                  className="max-h-7 max-w-[2.25rem] object-contain"
                                  noBackground
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{constructor.Constructor.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <div className="min-w-0">
                          <Link
                            to={`/teams/${constructor.Constructor.constructorId}`}
                            className="font-heading text-base font-semibold leading-tight transition-colors hover:text-primary"
                          >
                            {constructor.Constructor.name}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{constructor.Constructor.nationality}</span>
                            {champion && selectedYear < currentYear && (
                              <span className="inline-flex items-center gap-1 rounded border border-position-gold/40 bg-position-gold/15 px-1.5 py-0.5 text-xs font-semibold text-position-gold">
                                <Trophy className="h-3 w-3" /> Champion
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Points / Wins readouts */}
                      <div className="flex items-center gap-6 border-t border-border pt-3 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                        <Stat label="Points" value={constructor.points} />
                        <Stat label="Wins" value={constructor.wins} />
                      </div>

                      {/* Drivers */}
                      <div className="flex flex-1 flex-wrap gap-2 lg:justify-end">
                        {teamDrivers.map((driver: DriverStandingForTeam) => (
                          <div
                            key={driver.Driver.driverId}
                            className="relative flex min-w-[9.5rem] flex-1 items-center gap-2 overflow-hidden rounded-md border border-border/60 py-1.5 pl-3 pr-2.5 lg:flex-none"
                          >
                            <span
                              className="pointer-events-none absolute inset-y-0 left-0 w-0.5"
                              style={{ backgroundColor: teamColor }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium leading-tight">
                                {driver.Driver.givenName} {driver.Driver.familyName}
                              </div>
                              <div className="timing text-xs text-muted-foreground">
                                {driver.Driver.code} · #{driver.Driver.permanentNumber || "—"}
                              </div>
                            </div>
                            <span className="timing shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                              P{driver.position}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Heritage */}
                    <div className="border-t border-border px-4 py-2.5">
                      <TeamHeritagePanel
                        constructorId={constructor.Constructor.constructorId}
                        teamName={constructor.Constructor.name}
                        teamColor={teamColor}
                        compact
                        className="w-full"
                      />
                    </div>
                  </F1CardContent>
                </F1Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Constructors;


import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDriverStandings, useConstructorStandings } from "@/hooks/useF1Data";
import { Skeleton } from "@/components/ui/skeleton";
import TeamLogo from "@/components/common/TeamLogo";
import DriverImage from "@/components/drivers/DriverImage";
import ReactCountryFlag from "react-country-flag";
import {
  normalizeTeamId,
  getTeamHexColor,
  getNationalityCode,
} from "@/components/standings/standingsUtils";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { pageShell, pageStack } from "@/lib/layout";
import {
  F1Card,
  F1CardContent,
  F1CardHeader,
  F1CardTitle,
  F1EmptyState,
  F1ErrorState,
  PageHeader,
  PositionBadge,
} from "@/components/f1";

type DriverStandingRow = {
  position: string;
  points: string;
  Driver: { driverId?: string; givenName: string; familyName: string; code: string; nationality?: string };
  Constructors: Array<{ constructorId?: string; name: string; nationality?: string }>;
};

type ConstructorStandingRow = {
  position: string;
  points: string;
  Constructor: { constructorId?: string; name: string; nationality?: string };
};

const currentSeason = new Date().getFullYear();

const underlineTabTrigger =
  "rounded-none border-b-2 border-transparent bg-transparent px-4 pb-2 pt-1 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none";

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

const Points = ({ value }: { value: string }) => (
  <div className="shrink-0 text-right">
    <div className="readout text-lg">{value}</div>
    <div className="instrument-label text-[10px] tracking-wide">pts</div>
  </div>
);

// Terminal-style position cell: P1 gets the restrained-red PositionBadge,
// everyone else stays monochrome mono-numeric.
const Pos = ({ position }: { position: string }) => {
  const n = Number(position);
  if (n === 1) return <PositionBadge position={1} />;
  return (
    <span className="timing text-sm font-semibold text-muted-foreground">{position}</span>
  );
};

const Standings = () => {
  const [activeTab, setActiveTab] = useState("drivers");
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
  const stickyHeaderClass = cn(
    "sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]",
    isGlass ? "bg-background/85 backdrop-blur-md" : "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
  );

  const drivers = (driverStandings?.data ?? []) as DriverStandingRow[];
  const constructors = (constructorStandings?.data ?? []) as ConstructorStandingRow[];

  // ── Mobile card lists (no horizontal scroll, names wrap) ──────────────────
  const driverCards = (
    <div className="hairline-grid stagger-children md:hidden">
      {drivers.map((driver) => {
        const teamId = normalizeTeamId(driver.Constructors[0]?.constructorId || "default");
        const teamColor = getTeamHexColor(teamId);
        return (
          <div key={driver.position} className="flex items-center gap-2.5 py-2">
            <span className="flex w-6 shrink-0 justify-center">
              <Pos position={driver.position} />
            </span>
            <DriverImage
              driverId={driver.Driver.driverId || driver.Driver.code}
              driverName={`${driver.Driver.givenName} ${driver.Driver.familyName}`}
              season={currentSeason}
              teamColor={teamColor}
              fallbackCode={driver.Driver.code}
              fallbackFamilyName={driver.Driver.familyName}
              className="h-10 w-10 shrink-0"
            />
            <div className="min-w-0 flex-1 border-l-2 pl-2.5" style={{ borderColor: teamColor }}>
              <div className="font-medium leading-tight break-words">
                {driver.Driver.givenName} {driver.Driver.familyName}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                <Flag nationality={driver.Driver.nationality} />
                <span className="timing font-medium">{driver.Driver.code}</span>
                <span className="opacity-40">·</span>
                <span className="break-words">{driver.Constructors[0]?.name}</span>
              </div>
            </div>
            <Points value={driver.points} />
          </div>
        );
      })}
    </div>
  );

  const constructorCards = (
    <div className="hairline-grid stagger-children md:hidden">
      {constructors.map((constructor) => {
        const teamId = normalizeTeamId(constructor.Constructor?.constructorId || "default");
        const teamColor = getTeamHexColor(teamId);
        const nat = constructor.Constructor?.nationality;
        return (
          <div key={constructor.position} className="flex items-center gap-2.5 py-2">
            <span className="flex w-6 shrink-0 justify-center">
              <Pos position={constructor.position} />
            </span>
            <TeamLogo
              constructorId={teamId}
              alt={constructor.Constructor?.name}
              size="md"
              className="shrink-0"
            />
            <div className="min-w-0 flex-1 border-l-2 pl-2.5" style={{ borderColor: teamColor }}>
              <div className="font-medium leading-tight break-words">
                {constructor.Constructor.name}
              </div>
              {nat && (
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Flag nationality={nat} />
                  <span className="break-words">{nat}</span>
                </div>
              )}
            </div>
            <Points value={constructor.points} />
          </div>
        );
      })}
    </div>
  );

  const mobileSkeleton = (
    <div className="hairline-grid md:hidden">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 py-2">
          <Skeleton className="h-4 w-6 shrink-0" />
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-6 w-8 shrink-0" />
        </div>
      ))}
    </div>
  );

  return (
    <div className={pageShell}>
      <div className={cn(pageStack, "animate-fade-in")}>
        <PageHeader
          eyebrow={`${currentSeason} Season`}
          title="Championship Standings"
          description="Current Formula 1 season standings"
        />

        <Tabs defaultValue="drivers" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="inline-flex h-auto w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="drivers" className={underlineTabTrigger}>
              Driver Standings
            </TabsTrigger>
            <TabsTrigger value="constructors" className={underlineTabTrigger}>
              Constructor Standings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="drivers" className="mt-6">
            <F1Card variant={cardVariant} glassVariant={glassVariant} className="w-full">
              <F1CardHeader>
                <F1CardTitle>Drivers Championship {currentSeason}</F1CardTitle>
              </F1CardHeader>
              <F1CardContent>
                {isDriversError ? (
                  <F1ErrorState type="network" variant="inline" className="py-8" onRetry={() => refetchDrivers()} />
                ) : isDriversLoading ? (
                  mobileSkeleton
                ) : !drivers.length ? (
                  <F1EmptyState type="no-data" className="py-10" />
                ) : (
                  driverCards
                )}

                {/* Desktop table */}
                {!isDriversError && !isDriversLoading && drivers.length > 0 && (
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader className={stickyHeaderClass}>
                        <TableRow>
                          <TableHead className="w-16 instrument-label">Pos</TableHead>
                          <TableHead className="instrument-label">Driver</TableHead>
                          <TableHead className="instrument-label">Team</TableHead>
                          <TableHead className="text-right instrument-label">Points</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="stagger-children">
                        {drivers.map((driver) => {
                          const teamId = normalizeTeamId(driver.Constructors[0]?.constructorId || "default");
                          const teamColor = getTeamHexColor(teamId);
                          return (
                            <TableRow key={driver.position}>
                              <TableCell className="py-2"><Pos position={driver.position} /></TableCell>
                              <TableCell className="py-2">
                                <div className="flex items-center gap-3">
                                  <DriverImage
                                    driverId={driver.Driver.driverId || driver.Driver.code}
                                    driverName={`${driver.Driver.givenName} ${driver.Driver.familyName}`}
                                    season={currentSeason}
                                    teamColor={teamColor}
                                    fallbackCode={driver.Driver.code}
                                    fallbackFamilyName={driver.Driver.familyName}
                                    className="h-9 w-9 shrink-0"
                                  />
                                  <div className="flex flex-col" style={{ borderLeft: `3px solid ${teamColor}`, paddingLeft: 8 }}>
                                    <span className="font-medium leading-tight">
                                      {driver.Driver.givenName} {driver.Driver.familyName}
                                    </span>
                                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Flag nationality={driver.Driver.nationality} />
                                      <span className="timing">{driver.Driver.code}</span>
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-2">
                                <div className="flex items-center gap-2">
                                  <TeamLogo constructorId={teamId} alt={driver.Constructors[0]?.name} size="sm" />
                                  <span>{driver.Constructors[0].name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-2 text-right"><span className="readout text-base">{driver.points}</span></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </F1CardContent>
            </F1Card>
          </TabsContent>

          <TabsContent value="constructors" className="mt-6">
            <F1Card variant={cardVariant} glassVariant={glassVariant} className="w-full">
              <F1CardHeader>
                <F1CardTitle>Constructors Championship {currentSeason}</F1CardTitle>
              </F1CardHeader>
              <F1CardContent>
                {isConstructorsError ? (
                  <F1ErrorState type="network" variant="inline" className="py-8" onRetry={() => refetchConstructors()} />
                ) : isConstructorsLoading ? (
                  mobileSkeleton
                ) : !constructors.length ? (
                  <F1EmptyState type="no-data" className="py-10" />
                ) : (
                  constructorCards
                )}

                {/* Desktop table */}
                {!isConstructorsError && !isConstructorsLoading && constructors.length > 0 && (
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader className={stickyHeaderClass}>
                        <TableRow>
                          <TableHead className="w-16 instrument-label">Pos</TableHead>
                          <TableHead className="instrument-label">Team</TableHead>
                          <TableHead className="text-right instrument-label">Points</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="stagger-children">
                        {constructors.map((constructor) => {
                          const teamId = normalizeTeamId(constructor.Constructor?.constructorId || "default");
                          const teamColor = getTeamHexColor(teamId);
                          const nat = constructor.Constructor?.nationality;
                          return (
                            <TableRow key={constructor.position}>
                              <TableCell className="py-2"><Pos position={constructor.position} /></TableCell>
                              <TableCell className="py-2">
                                <div className="flex items-center gap-3">
                                  <TeamLogo constructorId={teamId} alt={constructor.Constructor?.name} size="sm" />
                                  <div className="flex flex-col" style={{ borderLeft: `3px solid ${teamColor}`, paddingLeft: 8 }}>
                                    <span className="font-medium leading-tight">{constructor.Constructor.name}</span>
                                    {nat && (
                                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Flag nationality={nat} />
                                        {nat}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-2 text-right"><span className="readout text-base">{constructor.points}</span></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </F1CardContent>
            </F1Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Standings;

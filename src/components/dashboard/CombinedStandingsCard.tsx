import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import TeamLogo from "@/components/common/TeamLogo";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Caravan, Users, Trophy, Calendar, Flag } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/components/common/CountryFlag";
import { F1EmptyState } from "@/components/f1/F1EmptyState";
import { StandingsSkeleton } from "@/components/f1/F1Skeleton";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

export interface CombinedStandingsCardProps {
  driverStandings: any;
  constructorStandings: any;
  getTeamColor: (constructorId: string) => string;
  onExpandChange?: (expanded: boolean) => void;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

const normalizeTeamId = (constructorId: string): string => {
  const id = (constructorId || "").toLowerCase();
  if (id === "alphatauri") return "rb";
  if (id === "alfa") return "sauber";
  return id;
};

const getTeamHexColor = (constructorId: string): string => {
  const normalized = normalizeTeamId(constructorId);
  return TEAM_COLORS[normalized] || TEAM_COLORS.default;
};

// Nationality to ISO2 code mapping
const NATIONALITY_TO_CODE: Record<string, string> = {
  Argentine: "AR", Australian: "AU", Austrian: "AT", Belgian: "BE", Brazilian: "BR",
  British: "GB", Canadian: "CA", Chinese: "CN", Danish: "DK", Dutch: "NL",
  English: "GB", Egyptian: "EG", Finnish: "FI", French: "FR", German: "DE",
  Italian: "IT", Japanese: "JP", Mexican: "MX", Monegasque: "MC", Portuguese: "PT",
  Polish: "PL", Russian: "RU", Spanish: "ES", Swedish: "SE", Swiss: "CH",
  Thai: "TH", American: "US", Venezuelan: "VE", Singaporean: "SG",
  "Saudi Arabian": "SA", Saudi: "SA", Emirati: "AE", Qatari: "QA",
  "South African": "ZA", "New Zealander": "NZ",
};

const getNationalityCode = (nationality: string | undefined): string => {
  if (!nationality) return "";
  return NATIONALITY_TO_CODE[nationality] || getCountryCode(nationality) || "";
};

const CombinedStandingsCard = ({ 
  driverStandings,
  constructorStandings, 
  onExpandChange,
  isLoading = false,
  error = null,
  onRetry,
}: CombinedStandingsCardProps) => {
  const { isGlass } = useTheme();
  const [tab, setTab] = useState<"combined" | "drivers" | "constructors">("drivers");
  const [showAll, setShowAll] = useState<boolean>(false);

  // Check if season has started
  const hasSeasonStarted = useMemo(() => {
    const drivers = driverStandings?.data || [];
    return drivers.some((d: any) => Number(d.points || 0) > 0);
  }, [driverStandings?.data]);

  // Check if we have any data
  const hasData = useMemo(() => {
    return (driverStandings?.data?.length > 0) || (constructorStandings?.data?.length > 0);
  }, [driverStandings?.data, constructorStandings?.data]);

  const driverLeaderPoints = useMemo(() => {
    return Number(driverStandings?.data?.[0]?.points || 0);
  }, [driverStandings?.data]);

  const constructorLeaderPoints = useMemo(() => {
    return Number(constructorStandings?.data?.[0]?.points || 0);
  }, [constructorStandings?.data]);

  // Map of constructorId -> drivers
  const driversByTeam = useMemo(() => {
    const map: Record<string, { code: string; name: string; points: number }[]> = {};
    (driverStandings?.data || []).forEach((d: any) => {
      const constructors = d.Constructors || [];
      const current = constructors.length ? constructors[constructors.length - 1] : null;
      const teamId = normalizeTeamId(current?.constructorId || "default");
      if (!map[teamId]) map[teamId] = [];
      map[teamId].push({
        code: d.Driver?.code || d.Driver?.familyName?.substring(0, 3).toUpperCase() || "",
        name: `${d.Driver?.givenName || ""} ${d.Driver?.familyName || ""}`.trim(),
        points: Number(d.points || 0),
    });
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => b.points - a.points));
    return map;
  }, [driverStandings?.data]);

  // Team points map for contribution calculation
  const teamPointsMap = useMemo(() => {
    const map: Record<string, number> = {};
    (constructorStandings?.data || []).forEach((team: any) => {
      const id = normalizeTeamId(team?.Constructor?.constructorId || "default");
      map[id] = Number(team?.points || 0);
    });
    return map;
  }, [constructorStandings?.data]);

  const getGaps = (index: number, list: any[]) => {
    if (!list || list.length === 0) return { toLeader: 0, toNext: 0 };
    const pts = Number(list?.[index]?.points || 0);
    const leader = Number(list?.[0]?.points || 0);
    const toLeader = Math.max(0, leader - pts);
    let toNext = 0;
    if (index > 0) {
      const aheadPts = Number(list?.[index - 1]?.points || 0);
      toNext = Math.max(0, aheadPts - pts);
    }
    return { toLeader, toNext };
  };

  const toggleShowAll = () => {
    setShowAll((prev) => {
      const next = !prev;
      onExpandChange?.(next);
      return next;
    });
  };

  // Get title icon based on current tab
  const getTitleIcon = () => {
    if (tab === "drivers") return <Users className="h-5 w-5 text-primary" />;
    return <Trophy className="h-5 w-5 text-primary" />;
  };

  // Get toggle text based on current tab
  const getToggleText = () => {
    if (tab === "drivers") {
      return showAll ? "Show Top 10" : "Show All Drivers";
    }
    return showAll ? "Show Top 10" : "Show All Teams";
  };

  // Get footer text based on current tab
  const getFooterText = () => {
    if (tab === "drivers") return "Driver Championship";
    if (tab === "constructors") return "Constructor Championship";
    return "Championship Standings";
  };

    return (
    <Card 
      className={cn(
        "h-full",
        isGlass && "border-white/10"
      )}
      style={isGlass ? {
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        boxShadow: 'var(--glass-shadow), var(--glass-inner-shadow)'
      } : undefined}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {getTitleIcon()}
            Standings
          </CardTitle>
                <div className="flex items-center gap-2">
              <button
              onClick={toggleShowAll}
                className="text-xs lg:text-sm text-muted-foreground hover:text-foreground"
              >
              {getToggleText()}
              </button>
                    </div>
                  </div>
        
        <div className="mt-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <div className="w-full flex justify-center lg:justify-end">
              <TabsList className="mx-auto lg:mx-0 h-9 lg:h-10 p-0.5 lg:p-1">
                <TabsTrigger value="combined" className="gap-1 px-2 py-1 text-xs lg:px-3 lg:py-1.5 lg:text-sm">
                <Caravan className="h-4 w-4" /> Combined
              </TabsTrigger>
                <TabsTrigger value="drivers" className="gap-1 px-2 py-1 text-xs lg:px-3 lg:py-1.5 lg:text-sm">
                <Users className="h-4 w-4" /> Drivers
              </TabsTrigger>
                <TabsTrigger value="constructors" className="gap-1 px-2 py-1 text-xs lg:px-3 lg:py-1.5 lg:text-sm">
                <Caravan className="h-4 w-4" /> Constructors
              </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Loading State */}
        {isLoading && <StandingsSkeleton rows={8} />}

        {/* Error State */}
        {error && !isLoading && (
          <F1EmptyState
            type="loading-failed"
            title="Failed to Load"
            description="Couldn't load standings."
            actionText={onRetry ? "Retry" : undefined}
            onAction={onRetry}
            size="sm"
          />
        )}

        {/* Season Not Started */}
        {!isLoading && !error && hasData && !hasSeasonStarted && (
          <div className="py-4">
            <F1EmptyState
              type="season-start"
              title="Season Starting"
              description="All drivers at 0 points."
              icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
              size="sm"
              showDecoration={false}
            />
          </div>
        )}

        {/* No Data */}
        {!isLoading && !error && !hasData && (
          <F1EmptyState
            type="no-data"
            title="No Data"
            description="Standings not available."
            icon={<Flag className="h-8 w-8 text-muted-foreground" />}
            size="sm"
          />
        )}

        {/* Main Content */}
        {!isLoading && !error && hasData && (
        <Tabs value={tab}>
            {/* Combined Tab */}
            <TabsContent value="combined" className="mt-0">
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="w-10 lg:w-12 text-xs lg:text-sm">Pos</TableHead>
                      <TableHead className="text-xs lg:text-sm">Team</TableHead>
                      <TableHead className="text-right text-xs lg:text-sm">Total Pts</TableHead>
                      <TableHead className="text-left text-xs lg:text-sm">Driver Contribution</TableHead>
                      <TableHead className="text-right text-xs lg:text-sm">Gap</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(constructorStandings?.data || []).slice(0, showAll ? undefined : 10).map((team: any, idx: number) => {
                      const teamIdRaw = team.Constructor?.constructorId || "default";
                      const teamId = normalizeTeamId(teamIdRaw);
                      const borderColor = getTeamHexColor(teamId);
                      const totalPts = Number(team.points || 0);
                      const drivers = driversByTeam[teamId] || [];
                      const { toLeader, toNext } = getGaps(idx, constructorStandings?.data || []);
                      const progressPct = constructorLeaderPoints > 0 ? (totalPts / constructorLeaderPoints) * 100 : 0;
                      
                      return (
                        <TableRow key={team.position} className="border-border">
                          <TableCell className="font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">
                            {team.position}
                          </TableCell>
                          <TableCell className="py-2 px-1 lg:p-4">
                            <div className="space-y-1">
                              <div 
                                className="font-medium text-foreground text-xs lg:text-sm"
                                style={{ borderLeft: `4px solid ${borderColor}`, paddingLeft: '8px' }}
                              >
                                <div className="flex items-center gap-2">
                                  <TeamLogo constructorId={teamId} alt={team.Constructor?.name} size="sm" />
                                  <span className="hidden lg:inline">{team.Constructor?.name}</span>
                                  <span className="lg:hidden">{team.Constructor?.name?.split(' ')[0]}</span>
                                </div>
                              </div>
                              <Progress 
                                value={progressPct} 
                                className="h-2"
                                indicatorStyle={{ backgroundColor: borderColor, opacity: 0.8 }}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">
                            {team.points}
                          </TableCell>
                          <TableCell className="py-2 px-2 lg:p-4">
                            <div className="flex flex-col gap-1 text-[10px] lg:text-xs">
                              {drivers.map((dr) => {
                                const pct = totalPts > 0 ? Math.round((dr.points / totalPts) * 100) : 0;
                                return (
                                  <div key={dr.code} className="flex items-center gap-2">
                                    <span className="min-w-[36px] font-mono text-muted-foreground">{dr.code}</span>
                                    <div className="flex-1">
                                      <div className="h-2 bg-muted rounded overflow-hidden">
                                        <div 
                                          className="h-2" 
                                          style={{ width: `${pct}%`, backgroundColor: borderColor, opacity: 0.7 }}
                                        />
                                      </div>
                                      <div className="text-[10px] text-muted-foreground mt-0.5">{dr.points} pts</div>
                                    </div>
                                    <span className="w-10 text-right font-medium">{pct}%</span>
                                  </div>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2 px-2 lg:p-4 text-[10px] lg:text-xs text-muted-foreground">
                            {idx > 0 && (
                              <div className="flex flex-col items-end gap-0.5">
                                <span>To Leader: {toLeader}</span>
                                <span>To P{idx}: {toNext}</span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-2">
                {(constructorStandings?.data || []).slice(0, showAll ? undefined : 10).map((team: any, idx: number) => {
                  const teamIdRaw = team.Constructor?.constructorId || "default";
                  const teamId = normalizeTeamId(teamIdRaw);
                  const borderColor = getTeamHexColor(teamId);
                  const totalPts = Number(team.points || 0);
                  const drivers = driversByTeam[teamId] || [];
                  const { toLeader, toNext } = getGaps(idx, constructorStandings?.data || []);
                  const progressPct = constructorLeaderPoints > 0 ? (totalPts / constructorLeaderPoints) * 100 : 0;
                  
                  return (
                    <div key={team.position} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="text-xs text-muted-foreground w-5">{team.position}</div>
                          <TeamLogo constructorId={teamId} alt={team.Constructor?.name} size="sm" />
                          <div 
                            className="font-medium truncate"
                            style={{ borderLeft: `3px solid ${borderColor}`, paddingLeft: '6px' }}
                          >
                            {team.Constructor?.name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{team.points}</div>
                        </div>
                      </div>
                      
                      {/* Driver contributions */}
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {drivers.map((dr) => {
                          const pct = totalPts > 0 ? Math.round((dr.points / totalPts) * 100) : 0;
                          return (
                            <div 
                              key={dr.code} 
                              className="flex items-center justify-between text-[11px] bg-muted/40 rounded px-2 py-1"
                            >
                              <span className="font-mono text-muted-foreground">{dr.code}</span>
                              <span className="text-foreground">{dr.points} pts • {pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Gap info */}
                      {idx > 0 && (
                        <div className="mt-2 text-[10px] text-muted-foreground text-right">
                          <div>To Leader: {toLeader}</div>
                          <div>To P{idx}: {toNext}</div>
                        </div>
                      )}
                      
                      {/* Progress bar */}
                      <div className="mt-2">
                        <Progress 
                          value={progressPct} 
                          className="h-1.5"
                          indicatorStyle={{ backgroundColor: borderColor, opacity: 0.8 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Drivers Tab */}
          <TabsContent value="drivers" className="mt-0">
              {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="w-10 lg:w-12 text-xs lg:text-sm">Pos</TableHead>
                    <TableHead className="text-xs lg:text-sm">Driver</TableHead>
                    <TableHead className="text-center text-xs lg:text-sm">Team</TableHead>
                    <TableHead className="text-right text-xs lg:text-sm">Pts</TableHead>
                    <TableHead className="text-center text-xs lg:text-sm">Wins</TableHead>
                    <TableHead className="text-right text-xs lg:text-sm">Gap</TableHead>
                    <TableHead className="text-right text-xs lg:text-sm">Contrib</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {(driverStandings?.data || []).slice(0, showAll ? undefined : 10).map((standing: any, idx: number) => {
                    const currentConstructor = standing.Constructors?.length
                      ? standing.Constructors[standing.Constructors.length - 1]
                      : null;
                      const teamId = normalizeTeamId(currentConstructor?.constructorId || "default");
                    const borderColor = getTeamHexColor(teamId);
                    const points = Number(standing.points || 0);
                      const teamPoints = teamPointsMap[teamId] || 0;
                      const contrib = teamPoints > 0 ? Math.round((points / teamPoints) * 100) : 0;
                      const { toLeader, toNext } = getGaps(idx, driverStandings?.data || []);
                      const progressPct = driverLeaderPoints > 0 ? (points / driverLeaderPoints) * 100 : 0;
                      
                    return (
                      <TableRow key={standing.position} className="border-border">
                        <TableCell className="font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">
                          {standing.position}
                        </TableCell>
                        <TableCell className="py-2 px-1 lg:p-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <ReactCountryFlag
                                countryCode={getNationalityCode(standing.Driver?.nationality)}
                                svg
                                style={{ width: 16, height: "auto" }}
                                  title={standing.Driver?.nationality}
                              />
                              <div
                                className="font-medium text-foreground text-xs lg:text-sm"
                                  style={{ borderLeft: `4px solid ${borderColor}`, paddingLeft: '8px' }}
                              >
                                <span className="hidden lg:inline">
                                  {standing.Driver?.givenName} {standing.Driver?.familyName}
                                </span>
                                <span className="lg:hidden">{standing.Driver?.familyName}</span>
                </div>
              </div>
                            <Progress
                                value={progressPct} 
                                className="h-2"
                              indicatorStyle={{ backgroundColor: borderColor, opacity: 0.8 }}
                            />
                </div>
                        </TableCell>
                          <TableCell className="p-0 text-center align-middle">
                          <div className="flex items-center justify-center w-full h-8 lg:h-12">
                              <TeamLogo constructorId={teamId} alt={currentConstructor?.name} size="sm" />
              </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">
                          {standing.points}
                        </TableCell>
                        <TableCell className="text-center py-2 px-2 lg:p-4">
                          {Number(standing.wins || 0) > 0 ? (
                            <div className="inline-flex items-center justify-center gap-1 text-xs font-medium text-yellow-500">
                              <Trophy className="h-3 w-3" />
                              <span>{standing.wins}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right py-2 px-2 lg:p-4 text-[10px] lg:text-xs text-muted-foreground">
                            {idx > 0 && (
                            <div className="flex flex-col items-end gap-0.5">
                              <span>To Leader: {toLeader}</span>
                                <span>To P{idx}: {toNext}</span>
            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-[10px] lg:text-xs py-2 px-2 lg:p-4">
                            {contrib}%
                        </TableCell>
                      </TableRow>
          );
        })}
                </TableBody>
              </Table>
      </div>

              {/* Mobile Card View */}
            <div className="lg:hidden space-y-2">
                {(driverStandings?.data || []).slice(0, showAll ? undefined : 10).map((standing: any, idx: number) => {
                const currentConstructor = standing.Constructors?.length
                  ? standing.Constructors[standing.Constructors.length - 1]
                  : null;
                  const teamId = normalizeTeamId(currentConstructor?.constructorId || "default");
                const borderColor = getTeamHexColor(teamId);
                const points = Number(standing.points || 0);
                  const teamPoints = teamPointsMap[teamId] || 0;
                  const contrib = teamPoints > 0 ? Math.round((points / teamPoints) * 100) : 0;
                  const { toLeader, toNext } = getGaps(idx, driverStandings?.data || []);
                  const progressPct = driverLeaderPoints > 0 ? (points / driverLeaderPoints) * 100 : 0;
                  
    return (
                    <div key={standing.position} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-xs text-muted-foreground w-5">{standing.position}</div>
                        <div className="flex items-center gap-2 min-w-0">
                            <TeamLogo constructorId={teamId} alt={currentConstructor?.name} size="sm" />
                          <ReactCountryFlag
                            countryCode={getNationalityCode(standing.Driver?.nationality)}
                            svg
                            style={{ width: 14, height: "auto" }}
                              title={standing.Driver?.nationality}
                          />
                          <div className="min-w-0">
                            <div
                              className="font-medium truncate"
                                style={{ borderLeft: `3px solid ${borderColor}`, paddingLeft: '6px' }}
                            >
                              {standing.Driver?.givenName} {standing.Driver?.familyName}
                            </div>
                              {idx > 0 && (
                              <div className="mt-1 text-[10px] text-muted-foreground">
                                <div>To Leader: {toLeader}</div>
                                  <div>To P{idx}: {toNext}</div>
                    </div>
                            )}
                    </div>
                  </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{standing.points}</div>
                          <div className="text-[10px] text-muted-foreground">{contrib}%</div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Progress
                          value={progressPct} 
                          className="h-1.5"
                        indicatorStyle={{ backgroundColor: borderColor, opacity: 0.8 }}
                      />
              </div>
            </div>
          );
        })}
      </div>

              {/* Footer */}
            <div className="flex items-center justify-center gap-2 pt-3 border-t border-dashed border-purple-500/30">
              <div className="w-2 h-2 rounded-full bg-purple-500/50" />
              <span className="text-xs text-muted-foreground">Driver Championship</span>
              <div className="w-2 h-2 rounded-full bg-purple-500/50" />
            </div>
          </TabsContent>

            {/* Constructors Tab */}
          <TabsContent value="constructors" className="mt-0">
              {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="w-10 lg:w-12 text-xs lg:text-sm">Pos</TableHead>
                    <TableHead className="text-xs lg:text-sm">Team</TableHead>
                    <TableHead className="text-right text-xs lg:text-sm">Pts</TableHead>
                    <TableHead className="text-right text-xs lg:text-sm">Gap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {(constructorStandings?.data || []).slice(0, showAll ? undefined : 10).map((team: any, idx: number) => {
                      const teamIdRaw = team.Constructor?.constructorId || "default";
                      const teamId = normalizeTeamId(teamIdRaw);
                    const borderColor = getTeamHexColor(teamId);
                      const totalPts = Number(team.points || 0);
                      const { toLeader, toNext } = getGaps(idx, constructorStandings?.data || []);
                      const progressPct = constructorLeaderPoints > 0 ? (totalPts / constructorLeaderPoints) * 100 : 0;
                      
                    return (
                      <TableRow key={team.position} className="border-border">
                        <TableCell className="font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">
                          {team.position}
                        </TableCell>
                        <TableCell className="py-2 px-1 lg:p-4">
                          <div className="space-y-1">
                            <div
                              className="font-medium text-foreground text-xs lg:text-sm"
                                style={{ borderLeft: `4px solid ${borderColor}`, paddingLeft: '8px' }}
                            >
                              <div className="flex items-center gap-2">
                                <TeamLogo constructorId={teamId} alt={team.Constructor?.name} size="sm" />
                                <span className="hidden lg:inline">{team.Constructor?.name}</span>
                                  <span className="lg:hidden">{team.Constructor?.name?.split(' ')[0]}</span>
                              </div>
                            </div>
                            <Progress
                                value={progressPct} 
                                className="h-2"
                              indicatorStyle={{ backgroundColor: borderColor, opacity: 0.8 }}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">
                          {team.points}
                        </TableCell>
                        <TableCell className="text-right py-2 px-2 lg:p-4 text-[10px] lg:text-xs text-muted-foreground">
                            {idx > 0 && (
                            <div className="flex flex-col items-end gap-0.5">
                              <span>To Leader: {toLeader}</span>
                                <span>To P{idx}: {toNext}</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

              {/* Mobile Card View */}
            <div className="lg:hidden space-y-2">
                {(constructorStandings?.data || []).slice(0, showAll ? undefined : 10).map((team: any, idx: number) => {
                  const teamIdRaw = team.Constructor?.constructorId || "default";
                  const teamId = normalizeTeamId(teamIdRaw);
                const borderColor = getTeamHexColor(teamId);
                  const totalPts = Number(team.points || 0);
                  const { toLeader, toNext } = getGaps(idx, constructorStandings?.data || []);
                  const progressPct = constructorLeaderPoints > 0 ? (totalPts / constructorLeaderPoints) * 100 : 0;
                  
  return (
                  <div key={team.position} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-xs text-muted-foreground w-5">{team.position}</div>
                        <TeamLogo constructorId={teamId} alt={team.Constructor?.name} size="sm" />
                        <div
                          className="font-medium truncate"
                            style={{ borderLeft: `3px solid ${borderColor}`, paddingLeft: '6px' }}
                        >
                          {team.Constructor?.name}
        </div>
                </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{team.points}</div>
                </div>
              </div>
                      
                      {/* Gap info */}
                      {idx > 0 && (
                      <div className="mt-2 text-[10px] text-muted-foreground text-right">
                        <div>To Leader: {toLeader}</div>
                          <div>To P{idx}: {toNext}</div>
                </div>
                    )}
                      
                      {/* Progress bar */}
                    <div className="mt-2">
                      <Progress
                          value={progressPct} 
                          className="h-1.5"
                        indicatorStyle={{ backgroundColor: borderColor, opacity: 0.8 }}
                      />
                </div>
              </div>
                );
              })}
            </div>

              {/* Footer */}
            <div className="flex items-center justify-center gap-2 pt-3 border-t border-dashed border-purple-500/30">
              <div className="w-2 h-2 rounded-full bg-purple-500/50" />
              <span className="text-xs text-muted-foreground">Constructor Championship</span>
              <div className="w-2 h-2 rounded-full bg-purple-500/50" />
            </div>
          </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default CombinedStandingsCard;
 
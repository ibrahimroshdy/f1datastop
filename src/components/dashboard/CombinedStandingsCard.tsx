import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import TeamLogo from "@/components/common/TeamLogo";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Caravan, Users, Trophy } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/components/common/CountryFlag";

export interface CombinedStandingsCardProps {
  driverStandings: any;
  constructorStandings: any;
  getTeamColor: (constructorId: string) => string;
  onExpandChange?: (expanded: boolean) => void;
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

// Some driver nationalities are adjectives (e.g., "British", "Monegasque").
// Map common F1 nationalities to ISO2 codes for flag rendering.
const NATIONALITY_TO_CODE: Record<string, string> = {
  Argentine: "AR",
  Australian: "AU",
  Austrian: "AT",
  Belgian: "BE",
  Brazilian: "BR",
  British: "GB",
  Canadian: "CA",
  Chinese: "CN",
  Danish: "DK",
  Dutch: "NL",
  English: "GB",
  Egyptian: "EG",
  Finnish: "FI",
  French: "FR",
  German: "DE",
  Italian: "IT",
  Japanese: "JP",
  Mexican: "MX",
  Monegasque: "MC",
  Portuguese: "PT",
  Polish: "PL",
  Russian: "RU",
  Spanish: "ES",
  Swedish: "SE",
  Swiss: "CH",
  Thai: "TH",
  American: "US",
  Venezuelan: "VE",
  Singaporean: "SG",
  "Saudi Arabian": "SA",
  Saudi: "SA",
  Emirati: "AE",
  Qatari: "QA",
  "South African": "ZA",
  "New Zealander": "NZ",
};

const getNationalityCode = (nationality: string | undefined): string => {
  if (!nationality) return "";
  return NATIONALITY_TO_CODE[nationality] || getCountryCode(nationality) || "";
};

const CombinedStandingsCard = ({
  driverStandings,
  constructorStandings,
  onExpandChange,
}: CombinedStandingsCardProps) => {
  const [tab, setTab] = useState<"combined" | "drivers" | "constructors">("combined");
  const [showAllDrivers, setShowAllDrivers] = useState<boolean>(false);
  const [showAllConstructors, setShowAllConstructors] = useState<boolean>(false);

  const driverRows = useMemo(() => {
    const list = driverStandings?.data || [];
    return showAllDrivers ? list : list.slice(0, 10);
  }, [driverStandings?.data, showAllDrivers]);

  const constructorRows = useMemo(() => {
    const list = constructorStandings?.data || [];
    return showAllConstructors ? list : list.slice(0, 8);
  }, [constructorStandings?.data, showAllConstructors]);

  const driverLeaderPoints = useMemo(() => {
    return Number(driverStandings?.data?.[0]?.points || 0);
  }, [driverStandings?.data]);

  const constructorLeaderPoints = useMemo(() => {
    return Number(constructorStandings?.data?.[0]?.points || 0);
  }, [constructorStandings?.data]);

  // Map of constructorId -> total points for contribution calculations
  const teamPointsMap = useMemo(() => {
    const map: Record<string, number> = {};
    (constructorStandings?.data || []).forEach((team: any) => {
      const id = normalizeTeamId(team?.Constructor?.constructorId || "default");
      map[id] = Number(team?.points || 0);
    });
    return map;
  }, [constructorStandings?.data]);

  // Map of constructorId -> drivers and their points
  const driversByTeam = useMemo(() => {
    const map: Record<string, { code: string; name: string; points: number }[]> = {};
    (driverStandings?.data || []).forEach((d: any) => {
      const constructors = d.Constructors || [];
      const current = constructors.length ? constructors[constructors.length - 1] : null;
      const teamId = normalizeTeamId(current?.constructorId || "default");
      if (!map[teamId]) map[teamId] = [];
      map[teamId].push({
        code: d.Driver?.code || d.Driver?.familyName || "",
        name: `${d.Driver?.givenName || ""} ${d.Driver?.familyName || ""}`.trim(),
        points: Number(d.points || 0),
      });
    });
    // Sort drivers by points desc per team
    Object.keys(map).forEach((k) => map[k].sort((a, b) => b.points - a.points));
    return map;
  }, [driverStandings?.data]);

  const getGaps = (index: number, list: any[]) => {
    if (!list || list.length === 0) return { toLeader: 0, toNext: 0 };
    const pts = Number(list?.[index]?.points || 0);
    const leader = Number(list?.[0]?.points || 0);
    const toLeader = Math.max(0, leader - pts);
    let toNext = 0;
    if (index === 0) {
      toNext = 0; // no gap rendered for leader
    } else {
      const aheadPts = Number(list?.[index - 1]?.points || 0);
      toNext = Math.max(0, aheadPts - pts);
    }
    return { toLeader, toNext };
  };

  // Bars removed; keep simple textual gaps only

  const toggleShowAllDrivers = () => {
    setShowAllDrivers((prev) => {
      const next = !prev;
      onExpandChange?.(next);
      return next;
    });
  };

  return (
    <Card className="bg-card border-border h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {tab === "drivers" ? (
              <Users className="h-5 w-5 text-primary" />
            ) : (
              <Trophy className="h-5 w-5 text-primary" />
            )}
            Standings
          </CardTitle>
          <div className="flex items-center gap-2">
            {tab === "drivers" ? (
              <button
                onClick={toggleShowAllDrivers}
                className="text-xs lg:text-sm text-muted-foreground hover:text-foreground"
              >
                {showAllDrivers ? "Show Top 10" : "Show All Drivers"}
              </button>
            ) : (
              <button
                onClick={() => setShowAllConstructors((s) => !s)}
                className="text-xs lg:text-sm text-muted-foreground hover:text-foreground"
              >
                {showAllConstructors ? "Show Top 8" : "Show All Teams"}
              </button>
            )}
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
      <CardContent>
        <Tabs value={tab}>
          <TabsContent value="drivers" className="mt-0">
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="w-10 lg:w-12 text-xs lg:text-sm">Pos</TableHead>
                    <TableHead className="text-xs lg:text-sm">Driver</TableHead>
                    <TableHead className="text-center text-xs lg:text-sm">Team</TableHead>
                    <TableHead className="text-right text-xs lg:text-sm">Pts</TableHead>
                    <TableHead className="text-right text-xs lg:text-sm">Gap</TableHead>
                    <TableHead className="text-right text-xs lg:text-sm">Contrib</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driverRows?.map((standing: any) => {
                    const currentConstructor = standing.Constructors?.length
                      ? standing.Constructors[standing.Constructors.length - 1]
                      : null;
                    const teamId = currentConstructor?.constructorId || "default";
                    const borderColor = getTeamHexColor(teamId);
                    const points = Number(standing.points || 0);
                    const leader = driverLeaderPoints || points || 1;
                    const fullList = driverStandings?.data || [];
                    const fullIndex = fullList.findIndex((d: any) => d.position === standing.position);
                    const { toLeader, toNext } = getGaps(fullIndex, fullList);
                    const teamTotal = teamPointsMap[normalizeTeamId(teamId)] || 0;
                    const contribPct = teamTotal > 0 ? Math.round((points / teamTotal) * 100) : 0;
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
                                title={standing.Driver?.nationality || ""}
                              />
                              <div
                                style={{ borderLeft: `4px solid ${borderColor}`, paddingLeft: 8 }}
                                className="font-medium text-foreground text-xs lg:text-sm"
                              >
                                <span className="hidden lg:inline">
                                  {standing.Driver?.givenName} {standing.Driver?.familyName}
                                </span>
                                <span className="lg:hidden">{standing.Driver?.familyName}</span>
                              </div>
                            </div>
                            <Progress
                              value={(points / leader) * 100}
                              className="h-2 bg-muted"
                              indicatorClassName="bg-gradient-to-r from-purple-600 to-purple-400"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="p-0 text-center">
                          <div className="flex items-center justify-center w-full h-8 lg:h-12">
                            <TeamLogo
                              constructorId={teamId}
                              alt={currentConstructor?.name || "Unknown Team"}
                              size="sm"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">
                          {standing.points}
                        </TableCell>
                        <TableCell className="text-right py-2 px-2 lg:p-4 text-[10px] lg:text-xs text-muted-foreground">
                          {fullIndex === 0 ? null : (
                            <div className="flex flex-col items-end gap-0.5">
                              <span>To Leader: {toLeader}</span>
                              <span>To P{Number(standing.position) - 1}: {toNext}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-[10px] lg:text-xs py-2 px-2 lg:p-4">
                          {contribPct}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {/* Mobile compact list */}
            <div className="lg:hidden space-y-2">
              {driverRows?.map((standing: any) => {
                const currentConstructor = standing.Constructors?.length
                  ? standing.Constructors[standing.Constructors.length - 1]
                  : null;
                const teamId = currentConstructor?.constructorId || "default";
                const borderColor = getTeamHexColor(teamId);
                const points = Number(standing.points || 0);
                const fullList = driverStandings?.data || [];
                const fullIndex = fullList.findIndex((d: any) => d.position === standing.position);
                const { toLeader, toNext } = getGaps(fullIndex, fullList);
                const teamTotal = teamPointsMap[normalizeTeamId(teamId)] || 0;
                const contribPct = teamTotal > 0 ? Math.round((points / teamTotal) * 100) : 0;
                return (
                  <div
                    key={standing.position}
                    className="rounded-md border border-border p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-xs text-muted-foreground w-5">{standing.position}</div>
                        <div className="flex items-center gap-2 min-w-0">
                          <TeamLogo constructorId={teamId} alt={currentConstructor?.name || "Team"} size="sm" />
                          <ReactCountryFlag
                            countryCode={getNationalityCode(standing.Driver?.nationality)}
                            svg
                            style={{ width: 14, height: "auto" }}
                            title={standing.Driver?.nationality || ""}
                          />
                          <div className="min-w-0">
                            <div
                              className="font-medium truncate"
                              style={{ borderLeft: `3px solid ${borderColor}`, paddingLeft: 6 }}
                            >
                              {standing.Driver?.givenName} {standing.Driver?.familyName}
                            </div>
                            {fullIndex !== 0 && (
                              <div className="mt-1 text-[10px] text-muted-foreground">
                                <div>To Leader: {toLeader}</div>
                                <div>To P{Number(standing.position) - 1}: {toNext}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{standing.points}</div>
                        <div className="text-[10px] text-muted-foreground">{contribPct}%</div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Progress
                        value={(points / (driverLeaderPoints || points || 1)) * 100}
                        className="h-1.5 bg-muted"
                        indicatorClassName="bg-gradient-to-r from-purple-600 to-purple-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-2 pt-3 border-t border-dashed border-purple-500/30">
              <div className="w-2 h-2 rounded-full bg-purple-500/50" />
              <span className="text-xs text-muted-foreground">Driver Championship</span>
              <div className="w-2 h-2 rounded-full bg-purple-500/50" />
            </div>
          </TabsContent>

          <TabsContent value="constructors" className="mt-0">
            {/* Desktop table */}
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
                  {constructorRows?.map((team: any) => {
                    const teamId = team.Constructor?.constructorId || "default";
                    const borderColor = getTeamHexColor(teamId);
                    const points = Number(team.points || 0);
                    const leader = constructorLeaderPoints || points || 1;
                    const fullList = constructorStandings?.data || [];
                    const fullIndex = fullList.findIndex((t: any) => t.position === team.position);
                    const { toLeader, toNext } = getGaps(fullIndex, fullList);
                    return (
                      <TableRow key={team.position} className="border-border">
                        <TableCell className="font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">
                          {team.position}
                        </TableCell>
                        <TableCell className="py-2 px-1 lg:p-4">
                          <div className="space-y-1">
                            <div
                              style={{ borderLeft: `4px solid ${borderColor}`, paddingLeft: 8 }}
                              className="font-medium text-foreground text-xs lg:text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <TeamLogo constructorId={teamId} alt={team.Constructor?.name} size="sm" />
                                <span className="hidden lg:inline">{team.Constructor?.name}</span>
                                <span className="lg:hidden">{(team.Constructor?.name || "").split(" ")[0]}</span>
                              </div>
                            </div>
                            <Progress
                              value={(points / leader) * 100}
                              className="h-2 bg-muted"
                              indicatorClassName="bg-gradient-to-r from-purple-600 to-purple-400"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">
                          {team.points}
                        </TableCell>
                        <TableCell className="text-right py-2 px-2 lg:p-4 text-[10px] lg:text-xs text-muted-foreground">
                          {fullIndex === 0 ? null : (
                            <div className="flex flex-col items-end gap-0.5">
                              <span>To Leader: {toLeader}</span>
                              <span>To P{Number(team.position) - 1}: {toNext}</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {/* Mobile compact list */}
            <div className="lg:hidden space-y-2">
              {constructorRows?.map((team: any, idx: number) => {
                const teamId = team.Constructor?.constructorId || "default";
                const borderColor = getTeamHexColor(teamId);
                const points = Number(team.points || 0);
                const fullList = constructorStandings?.data || [];
                const fullIndex = fullList.findIndex((t: any) => t.position === team.position);
                const { toLeader, toNext } = getGaps(fullIndex, fullList);
                return (
                  <div key={team.position} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-xs text-muted-foreground w-5">{team.position}</div>
                        <TeamLogo constructorId={teamId} alt={team.Constructor?.name} size="sm" />
                        <div
                          className="font-medium truncate"
                          style={{ borderLeft: `3px solid ${borderColor}`, paddingLeft: 6 }}
                        >
                          {team.Constructor?.name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{team.points}</div>
                      </div>
                    </div>
                    {idx !== 0 && (
                      <div className="mt-2 text-[10px] text-muted-foreground text-right">
                        <div>To Leader: {toLeader}</div>
                        <div>To P{Number(team.position) - 1}: {toNext}</div>
                      </div>
                    )}
                    <div className="mt-2">
                      <Progress
                        value={(points / (constructorLeaderPoints || points || 1)) * 100}
                        className="h-1.5 bg-muted"
                        indicatorClassName="bg-gradient-to-r from-purple-600 to-purple-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-2 pt-3 border-t border-dashed border-purple-500/30">
              <div className="w-2 h-2 rounded-full bg-purple-500/50" />
              <span className="text-xs text-muted-foreground">Constructor Championship</span>
              <div className="w-2 h-2 rounded-full bg-purple-500/50" />
            </div>
          </TabsContent>

          <TabsContent value="combined" className="mt-0">
            {/* Desktop table */}
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
                  {(constructorStandings?.data || []).map((team: any, idx: number) => {
                    const teamIdRaw = team.Constructor?.constructorId || "default";
                    const teamId = normalizeTeamId(teamIdRaw);
                    const borderColor = getTeamHexColor(teamId);
                    const totalPts = Number(team.points || 0);
                    const leader = constructorLeaderPoints || totalPts || 1;
                    const list = constructorStandings?.data || [];
                    const leaderPts = Number(list?.[0]?.points || 0);
                    const toLeader = Math.max(0, leaderPts - totalPts);
                    const aheadPts = idx === 0 ? Number(list?.[1]?.points || 0) : Number(list?.[idx - 1]?.points || 0);
                    const toNext = idx === 0 ? Math.max(0, totalPts - aheadPts) : Math.max(0, aheadPts - totalPts);
                    const drivers = driversByTeam[teamId] || [];
                    return (
                      <TableRow key={team.position} className="border-border">
                        <TableCell className="font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">{team.position}</TableCell>
                        <TableCell className="py-2 px-1 lg:p-4">
                          <div className="space-y-1">
                            <div
                              style={{ borderLeft: `4px solid ${borderColor}`, paddingLeft: 8 }}
                              className="font-medium text-foreground text-xs lg:text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <TeamLogo constructorId={teamId} alt={team.Constructor?.name} size="sm" />
                                <span className="hidden lg:inline">{team.Constructor?.name}</span>
                                <span className="lg:hidden">{(team.Constructor?.name || "").split(" ")[0]}</span>
                              </div>
                            </div>
                            <Progress
                              value={(totalPts / leader) * 100}
                              className="h-2 bg-muted"
                              indicatorClassName="bg-gradient-to-r from-purple-600 to-purple-400"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">{team.points}</TableCell>
                        <TableCell className="py-2 px-2 lg:p-4">
                          {drivers.length > 0 ? (
                            <div className="flex flex-col gap-1 text-[10px] lg:text-xs">
                              {drivers.map((dr) => {
                                const pct = totalPts > 0 ? Math.round((dr.points / totalPts) * 100) : 0;
                                return (
                                  <div key={dr.code} className="flex items-center gap-2">
                                    <span className="min-w-[36px] font-mono text-muted-foreground">{dr.code}</span>
                                    <div className="flex-1">
                                      <div className="h-2 bg-muted rounded overflow-hidden">
                                        <div className="h-2 bg-purple-500/70" style={{ width: `${pct}%` }} />
                                      </div>
                                      <div className="text-[10px] text-muted-foreground mt-0.5">{dr.points} pts</div>
                                    </div>
                                    <span className="w-10 text-right font-medium">{pct}%</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">No drivers</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right py-2 px-2 lg:p-4 text-[10px] lg:text-xs text-muted-foreground">
                          {idx === 0 ? null : (
                            <div className="flex flex-col items-end gap-0.5">
                              <span>To Leader: {toLeader}</span>
                              <span>To P{Number(team.position) - 1}: {toNext}</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {/* Mobile compact list */}
            <div className="lg:hidden space-y-2">
              {(constructorStandings?.data || []).map((team: any, idx: number) => {
                const teamIdRaw = team.Constructor?.constructorId || "default";
                const teamId = normalizeTeamId(teamIdRaw);
                const borderColor = getTeamHexColor(teamId);
                const totalPts = Number(team.points || 0);
                const list = constructorStandings?.data || [];
                const leaderPts = Number(list?.[0]?.points || 0);
                const toLeader = Math.max(0, leaderPts - totalPts);
                const aheadPts = idx === 0 ? Number(list?.[1]?.points || 0) : Number(list?.[idx - 1]?.points || 0);
                const toNext = idx === 0 ? Math.max(0, totalPts - aheadPts) : Math.max(0, aheadPts - totalPts);
                const drivers = driversByTeam[teamId] || [];
                return (
                  <div key={team.position} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-xs text-muted-foreground w-5">{team.position}</div>
                        <TeamLogo constructorId={teamId} alt={team.Constructor?.name} size="sm" />
                        <div
                          className="font-medium truncate"
                          style={{ borderLeft: `3px solid ${borderColor}`, paddingLeft: 6 }}
                        >
                          {team.Constructor?.name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{team.points}</div>
                      </div>
                    </div>
                    {/* Driver contributions compact */}
                    {drivers.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {drivers.map((dr) => {
                          const pct = totalPts > 0 ? Math.round((dr.points / totalPts) * 100) : 0;
                          return (
                            <div key={dr.code} className="flex items-center justify-between text-[11px] bg-muted/40 rounded px-2 py-1">
                              <span className="font-mono text-muted-foreground">{dr.code}</span>
                              <span className="text-foreground">{dr.points} pts • {pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {idx !== 0 && (
                      <div className="mt-2 text-[10px] text-muted-foreground text-right">
                        <div>To Leader: {toLeader}</div>
                        <div>To P{Number(team.position) - 1}: {toNext}</div>
                      </div>
                    )}
                    <div className="mt-2">
                      <Progress
                        value={(totalPts / (constructorLeaderPoints || totalPts || 1)) * 100}
                        className="h-1.5 bg-muted"
                        indicatorClassName="bg-gradient-to-r from-purple-600 to-purple-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CombinedStandingsCard;
 
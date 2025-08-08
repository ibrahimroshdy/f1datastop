import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import TeamLogo from "@/components/common/TeamLogo";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Caravan, Users } from "lucide-react";

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

const CombinedStandingsCard = ({
  driverStandings,
  constructorStandings,
  onExpandChange,
}: CombinedStandingsCardProps) => {
  const [tab, setTab] = useState<"drivers" | "constructors">("drivers");
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
              <Caravan className="h-5 w-5 text-primary" />
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
        <div className="mt-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="drivers" className="gap-1">
                <Users className="h-4 w-4" /> Drivers
              </TabsTrigger>
              <TabsTrigger value="constructors" className="gap-1">
                <Caravan className="h-4 w-4" /> Constructors
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tab}>
          <TabsContent value="drivers" className="mt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="w-10 lg:w-12 text-xs lg:text-sm">Pos</TableHead>
                    <TableHead className="text-xs lg:text-sm">Driver</TableHead>
                    <TableHead className="text-center text-xs lg:text-sm">Team</TableHead>
                    <TableHead className="text-right text-xs lg:text-sm">Pts</TableHead>
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
                    return (
                      <TableRow key={standing.position} className="border-border">
                        <TableCell className="font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">
                          {standing.position}
                        </TableCell>
                        <TableCell className="py-2 px-1 lg:p-4">
                          <div className="space-y-1">
                            <div
                              style={{ borderLeft: `4px solid ${borderColor}`, paddingLeft: 8 }}
                              className="font-medium text-foreground text-xs lg:text-sm"
                            >
                              <span className="hidden lg:inline">
                                {standing.Driver?.givenName} {standing.Driver?.familyName}
                              </span>
                              <span className="lg:hidden">{standing.Driver?.familyName}</span>
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-center gap-2 pt-3 border-t border-dashed border-purple-500/30">
              <div className="w-2 h-2 rounded-full bg-purple-500/50" />
              <span className="text-xs text-muted-foreground">Driver Championship</span>
              <div className="w-2 h-2 rounded-full bg-purple-500/50" />
            </div>
          </TabsContent>

          <TabsContent value="constructors" className="mt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="w-10 lg:w-12 text-xs lg:text-sm">Pos</TableHead>
                    <TableHead className="text-xs lg:text-sm">Team</TableHead>
                    <TableHead className="text-right text-xs lg:text-sm">Pts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {constructorRows?.map((team: any) => {
                    const teamId = team.Constructor?.constructorId || "default";
                    const borderColor = getTeamHexColor(teamId);
                    const points = Number(team.points || 0);
                    const leader = constructorLeaderPoints || points || 1;
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-center gap-2 pt-3 border-t border-dashed border-purple-500/30">
              <div className="w-2 h-2 rounded-full bg-purple-500/50" />
              <span className="text-xs text-muted-foreground">Constructor Championship</span>
              <div className="w-2 h-2 rounded-full bg-purple-500/50" />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CombinedStandingsCard;
 
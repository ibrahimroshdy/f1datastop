import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Caravan, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TeamLogo from "@/components/common/TeamLogo";

interface ConstructorStandingsCardProps {
  constructorStandings: any;
  getTeamColor: (constructorId: string) => string;
}

const normalizeTeamId = (teamId: string) => {
  let id = (teamId || "").toLowerCase();
  if (id === "alphatauri") id = "rb";
  if (id === "alfa") id = "sauber";
  return id;
};

const getTeamHex = (teamId: string) => TEAM_COLORS[normalizeTeamId(teamId)] || TEAM_COLORS.default;

const ConstructorStandingsCard = ({ constructorStandings }: ConstructorStandingsCardProps) => {
  const [showAllConstructors, setShowAllConstructors] = useState<boolean>(false);

  const teamsToShow = useMemo(() => {
    const list = constructorStandings?.data || [];
    return showAllConstructors ? list : list.slice(0, 8);
  }, [constructorStandings?.data, showAllConstructors]);

  const leaderPoints = useMemo(() => Number(constructorStandings?.data?.[0]?.points || 0), [constructorStandings?.data]);

  return (
    <Card className="bg-card border-border h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Caravan className="h-5 w-5 text-primary" />
            Constructor Standings
          </CardTitle>
          <button
            onClick={() => setShowAllConstructors((s) => !s)}
            className="text-xs lg:text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Users className="h-4 w-4" />
            <span className="hidden lg:inline">{showAllConstructors ? "Show Top 8" : "Show All Teams"}</span>
            <span className="lg:hidden">{showAllConstructors ? "Top 8" : "All"}</span>
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="w-8 lg:w-12 text-xs lg:text-sm">Pos</TableHead>
              <TableHead className="text-xs lg:text-sm">Team</TableHead>
              <TableHead className="text-right text-xs lg:text-sm">Pts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamsToShow?.map((team: any) => {
              const teamId = team.Constructor?.constructorId || "default";
              const color = getTeamHex(teamId);
              const points = Number(team.points || 0);
              const leader = leaderPoints || points || 1;
              return (
                <TableRow key={team.position} className="border-border">
                  <TableCell className="font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">{team.position}</TableCell>
                  <TableCell className="py-2 px-1 lg:p-4">
                    <div className="space-y-1">
                      <div
                        style={{ borderLeft: `4px solid ${color}`, paddingLeft: 8 }}
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
                  <TableCell className="text-right font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">{team.points}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex items-center justify-center gap-2 pt-3 border-t border-dashed border-purple-500/30">
          <div className="w-2 h-2 rounded-full bg-purple-500/50" />
          <span className="text-xs text-muted-foreground">Constructor Championship</span>
          <div className="w-2 h-2 rounded-full bg-purple-500/50" />
        </div>
      </CardContent>
    </Card>
  );
};

export default ConstructorStandingsCard;

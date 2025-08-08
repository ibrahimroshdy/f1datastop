import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import TeamLogo from "@/components/common/TeamLogo";

interface DriverStandingsTableProps {
  driverStandings: any;
  getTeamColor: (constructorId: string) => string;
  showAllDrivers: boolean;
}

const normalizeTeamId = (teamId: string) => {
  let id = (teamId || "").toLowerCase();
  if (id === "alphatauri") id = "rb";
  if (id === "alfa") id = "sauber";
  return id;
};

const DriverStandingsTable = ({ driverStandings, showAllDrivers }: DriverStandingsTableProps) => {
  const driversToShow = showAllDrivers ? driverStandings?.data : driverStandings?.data?.slice(0, 10);
  const leaderPoints = Number(driverStandings?.data?.[0]?.points || 0);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border">
            <TableHead className="w-8 lg:w-12 text-xs lg:text-sm">Pos</TableHead>
            <TableHead className="text-xs lg:text-sm">Driver</TableHead>
            <TableHead className="text-center text-xs lg:text-sm">Team</TableHead>
            <TableHead className="text-right text-xs lg:text-sm">Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {driversToShow?.map((standing: any) => {
            const constructors = standing.Constructors || [];
            const currentConstructor = constructors.length ? constructors[constructors.length - 1] : null;
            const teamId = currentConstructor?.constructorId || "default";
            const color = TEAM_COLORS[normalizeTeamId(teamId)] || TEAM_COLORS.default;
            const points = Number(standing.points || 0);
            const leader = leaderPoints || points || 1;
            return (
              <TableRow key={standing.position} className="border-border">
                <TableCell className="font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">{standing.position}</TableCell>
                <TableCell className="py-2 px-1 lg:p-4">
                  <div className="space-y-1">
                    <div
                      style={{ borderLeft: `4px solid ${color}`, paddingLeft: 8 }}
                      className="font-medium text-foreground text-xs lg:text-sm"
                    >
                      <span className="hidden lg:inline">{standing.Driver?.givenName} {standing.Driver?.familyName}</span>
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-center w-full h-8 lg:h-12">
                          <TeamLogo constructorId={teamId} alt={currentConstructor?.name || "Unknown Team"} size="sm" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs lg:text-sm">{currentConstructor?.name || "Unknown Team"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="text-right font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">{standing.points}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default DriverStandingsTable;

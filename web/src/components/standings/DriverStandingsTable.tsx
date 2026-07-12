import TeamLogo from "@/components/common/TeamLogo";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import {
  DEFAULT_DRIVERS_VISIBLE,
  getGaps,
  getNationalityCode,
  getTeamHexColor,
  normalizeTeamId,
} from "./standingsUtils";

interface DriverStandingsTableProps {
  driverStandings: any;
  teamPointsMap: Record<string, number>;
  driverLeaderPoints: number;
  showAll: boolean;
}

const DriverStandingsTable = ({
  driverStandings,
  teamPointsMap,
  driverLeaderPoints,
  showAll,
}: DriverStandingsTableProps) => {
  const fullList = driverStandings?.data || [];
  const visible = fullList.slice(0, showAll ? undefined : DEFAULT_DRIVERS_VISIBLE);

  return (
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
          {visible.map((standing: any, idx: number) => {
            const currentConstructor = standing.Constructors?.length
              ? standing.Constructors[standing.Constructors.length - 1]
              : null;
            const teamId = normalizeTeamId(currentConstructor?.constructorId || "default");
            const borderColor = getTeamHexColor(teamId);
            const points = Number(standing.points || 0);
            const teamPoints = teamPointsMap[teamId] || 0;
            const contrib = teamPoints > 0 ? Math.round((points / teamPoints) * 100) : 0;
            const { toLeader, toNext } = getGaps(idx, fullList);
            const aheadPosition = idx > 0 ? (fullList[idx - 1]?.position || idx) : null;
            const progressPct = driverLeaderPoints > 0 ? (points / driverLeaderPoints) * 100 : 0;
            const displayPosition = standing.position || (idx + 1);

            return (
              <TableRow key={displayPosition} className="border-border">
                <TableCell className="font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">
                  {displayPosition}
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
                        style={{ borderLeft: `4px solid ${borderColor}`, paddingLeft: "8px" }}
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
                  <AnimatedNumber value={points} />
                </TableCell>
                <TableCell className="text-center py-2 px-2 lg:p-4">
                  {Number(standing.wins || 0) > 0 ? (
                    <div className="inline-flex items-center justify-center gap-1 text-xs font-medium text-primary">
                      <Trophy className="h-3 w-3" />
                      <AnimatedNumber value={Number(standing.wins) || 0} />
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right py-2 px-2 lg:p-4 text-[10px] lg:text-xs text-muted-foreground">
                  {idx > 0 && (
                    <div className="flex flex-col items-end gap-0.5">
                      <span>To Leader: <AnimatedNumber value={toLeader} /></span>
                      <span>To P{aheadPosition ?? idx}: <AnimatedNumber value={toNext} /></span>
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
  );
};

export default DriverStandingsTable;

import { useMemo } from "react";
import TeamLogo from "@/components/common/TeamLogo";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  buildDriversByTeam,
  DEFAULT_CONSTRUCTORS_VISIBLE,
  getGaps,
  getTeamHexColor,
  normalizeTeamId,
} from "./standingsUtils";

interface CombinedStandingsTabProps {
  driverStandings: any;
  constructorStandings: any;
  showAll: boolean;
}

const CombinedStandingsTab = ({
  driverStandings,
  constructorStandings,
  showAll,
}: CombinedStandingsTabProps) => {
  const constructorLeaderPoints = useMemo(
    () => Number(constructorStandings?.data?.[0]?.points || 0),
    [constructorStandings?.data],
  );

  const driversByTeam = useMemo(
    () => buildDriversByTeam(driverStandings),
    [driverStandings?.data],
  );

  const fullList = constructorStandings?.data || [];
  const visible = fullList.slice(0, showAll ? undefined : DEFAULT_CONSTRUCTORS_VISIBLE);

  const renderRow = (team: any, idx: number) => {
    const teamId = normalizeTeamId(team.Constructor?.constructorId || "default");
    const borderColor = getTeamHexColor(teamId);
    const totalPts = Number(team.points || 0);
    const drivers = driversByTeam[teamId] || [];
    const { toLeader, toNext } = getGaps(idx, fullList);
    const aheadPosition = idx > 0 ? (fullList[idx - 1]?.position || idx) : null;
    const progressPct = constructorLeaderPoints > 0 ? (totalPts / constructorLeaderPoints) * 100 : 0;
    const displayPosition = team.position || (idx + 1);

    return { teamId, borderColor, totalPts, drivers, toLeader, toNext, aheadPosition, progressPct, displayPosition, team };
  };

  return (
    <>
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
            {visible.map((team: any, idx: number) => {
              const row = renderRow(team, idx);
              return (
                <TableRow key={row.displayPosition} className="border-border">
                  <TableCell className="font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">
                    {row.displayPosition}
                  </TableCell>
                  <TableCell className="py-2 px-1 lg:p-4">
                    <div className="space-y-1">
                      <div
                        className="font-medium text-foreground text-xs lg:text-sm"
                        style={{ borderLeft: `4px solid ${row.borderColor}`, paddingLeft: "8px" }}
                      >
                        <div className="flex items-center gap-2">
                          <TeamLogo constructorId={row.teamId} alt={row.team.Constructor?.name} size="sm" />
                          <span className="hidden lg:inline">{row.team.Constructor?.name}</span>
                          <span className="lg:hidden">{row.team.Constructor?.name?.split(" ")[0]}</span>
                        </div>
                      </div>
                      <Progress
                        value={row.progressPct}
                        className="h-2"
                        indicatorStyle={{ backgroundColor: row.borderColor, opacity: 0.8 }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">
                    <AnimatedNumber value={row.totalPts} />
                  </TableCell>
                  <TableCell className="py-2 px-2 lg:p-4">
                    <div className="flex flex-col gap-1 text-[10px] lg:text-xs">
                      {row.drivers.map((dr) => {
                        const pct = row.totalPts > 0 ? Math.round((dr.points / row.totalPts) * 100) : 0;
                        return (
                          <div key={dr.code} className="flex items-center gap-2">
                            <span className="min-w-[36px] font-mono text-muted-foreground">{dr.code}</span>
                            <div className="flex-1">
                              <div className="h-2 bg-muted rounded overflow-hidden">
                                <div
                                  className="h-2"
                                  style={{ width: `${pct}%`, backgroundColor: row.borderColor, opacity: 0.7 }}
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
                        <span>To Leader: <AnimatedNumber value={row.toLeader} /></span>
                        <span>To P{row.aheadPosition ?? idx}: <AnimatedNumber value={row.toNext} /></span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="lg:hidden space-y-2">
        {visible.map((team: any, idx: number) => {
          const row = renderRow(team, idx);
          return (
            <div key={row.displayPosition} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-xs text-muted-foreground w-6">{row.displayPosition}</div>
                  <TeamLogo constructorId={row.teamId} alt={row.team.Constructor?.name} size="sm" />
                  <div
                    className="font-medium truncate"
                    style={{ borderLeft: `3px solid ${row.borderColor}`, paddingLeft: "6px" }}
                  >
                    {row.team.Constructor?.name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold"><AnimatedNumber value={row.totalPts} /></div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {row.drivers.map((dr) => {
                  const pct = row.totalPts > 0 ? Math.round((dr.points / row.totalPts) * 100) : 0;
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
              {idx > 0 && (
                <div className="mt-2 text-[10px] text-muted-foreground text-right">
                  <div>To Leader: <AnimatedNumber value={row.toLeader} /></div>
                  <div>To P{row.aheadPosition ?? idx}: <AnimatedNumber value={row.toNext} /></div>
                </div>
              )}
              <div className="mt-2">
                <Progress
                  value={row.progressPct}
                  className="h-1.5"
                  indicatorStyle={{ backgroundColor: row.borderColor, opacity: 0.8 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default CombinedStandingsTab;

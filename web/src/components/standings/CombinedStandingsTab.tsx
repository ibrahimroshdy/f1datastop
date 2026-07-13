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

      <div className="lg:hidden overflow-hidden rounded-xl border border-border/70">
        <div className="divide-y divide-border/50">
          {visible.map((team: any, idx: number) => {
            const row = renderRow(team, idx);
            return (
              <div key={row.displayPosition} className="relative overflow-hidden">
                <div
                  className="pointer-events-none absolute inset-y-0 left-0"
                  style={{ width: `${row.progressPct}%`, backgroundColor: row.borderColor, opacity: 0.1 }}
                />
                <div className="relative px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground">
                      {row.displayPosition}
                    </span>
                    <TeamLogo constructorId={row.teamId} alt={row.team.Constructor?.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.team.Constructor?.name}</span>
                    <AnimatedNumber value={row.totalPts} mono className="readout shrink-0 text-sm font-bold" />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[1.9rem] text-2xs text-muted-foreground">
                    {row.drivers.map((dr) => {
                      const pct = row.totalPts > 0 ? Math.round((dr.points / row.totalPts) * 100) : 0;
                      return (
                        <span key={dr.code} className="tabular-nums">
                          <span className="font-mono font-semibold text-foreground/80">{dr.code}</span> {dr.points} · {pct}%
                        </span>
                      );
                    })}
                    {idx > 0 && (
                      <span className="ml-auto tabular-nums">
                        Leader <AnimatedNumber value={row.toLeader} /> · P{row.aheadPosition ?? idx}{" "}
                        <AnimatedNumber value={row.toNext} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default CombinedStandingsTab;

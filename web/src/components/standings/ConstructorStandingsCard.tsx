import { useMemo } from "react";
import TeamLogo from "@/components/common/TeamLogo";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DEFAULT_CONSTRUCTORS_VISIBLE,
  getGaps,
  getTeamHexColor,
  normalizeTeamId,
} from "./standingsUtils";

interface ConstructorStandingsCardProps {
  constructorStandings: any;
  showAll: boolean;
}

const ConstructorStandingsCard = ({
  constructorStandings,
  showAll,
}: ConstructorStandingsCardProps) => {
  const constructorLeaderPoints = useMemo(
    () => Number(constructorStandings?.data?.[0]?.points || 0),
    [constructorStandings?.data],
  );

  const fullList = constructorStandings?.data || [];
  const visible = fullList.slice(0, showAll ? undefined : DEFAULT_CONSTRUCTORS_VISIBLE);

  return (
    <>
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
            {visible.map((team: any, idx: number) => {
              const teamId = normalizeTeamId(team.Constructor?.constructorId || "default");
              const borderColor = getTeamHexColor(teamId);
              const totalPts = Number(team.points || 0);
              const { toLeader, toNext } = getGaps(idx, fullList);
              const aheadPosition = idx > 0 ? (fullList[idx - 1]?.position || idx) : null;
              const progressPct = constructorLeaderPoints > 0 ? (totalPts / constructorLeaderPoints) * 100 : 0;
              const displayPosition = team.position || (idx + 1);

              return (
                <TableRow key={displayPosition} className="border-border">
                  <TableCell className="font-medium text-xs lg:text-sm py-2 px-2 lg:p-4">
                    {displayPosition}
                  </TableCell>
                  <TableCell className="py-2 px-1 lg:p-4">
                    <div className="space-y-1">
                      <div
                        className="font-medium text-foreground text-xs lg:text-sm"
                        style={{ borderLeft: `4px solid ${borderColor}`, paddingLeft: "8px" }}
                      >
                        <div className="flex items-center gap-2">
                          <TeamLogo constructorId={teamId} alt={team.Constructor?.name} size="sm" />
                          <span className="hidden lg:inline">{team.Constructor?.name}</span>
                          <span className="lg:hidden">{team.Constructor?.name?.split(" ")[0]}</span>
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
                    <AnimatedNumber value={totalPts} />
                  </TableCell>
                  <TableCell className="text-right py-2 px-2 lg:p-4 text-[10px] lg:text-xs text-muted-foreground">
                    {idx > 0 && (
                      <div className="flex flex-col items-end gap-0.5">
                        <span>To Leader: <AnimatedNumber value={toLeader} /></span>
                        <span>To P{aheadPosition ?? idx}: <AnimatedNumber value={toNext} /></span>
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
            const teamId = normalizeTeamId(team.Constructor?.constructorId || "default");
            const teamColor = getTeamHexColor(teamId);
            const totalPts = Number(team.points || 0);
            const { toLeader, toNext } = getGaps(idx, fullList);
            const aheadPosition = idx > 0 ? (fullList[idx - 1]?.position || idx) : null;
            const progressPct = constructorLeaderPoints > 0 ? (totalPts / constructorLeaderPoints) * 100 : 0;
            const displayPosition = team.position || (idx + 1);

            return (
              <div key={displayPosition} className="relative overflow-hidden">
                <div
                  className="pointer-events-none absolute inset-y-0 left-0"
                  style={{ width: `${progressPct}%`, backgroundColor: teamColor, opacity: 0.1 }}
                />
                <div className="relative flex items-center gap-2.5 px-3 py-2">
                  <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground">
                    {displayPosition}
                  </span>
                  <TeamLogo constructorId={teamId} alt={team.Constructor?.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold leading-tight">{team.Constructor?.name}</div>
                    {idx > 0 && (
                      <div className="text-2xs text-muted-foreground">
                        Leader <AnimatedNumber value={toLeader} /> · P{aheadPosition ?? idx}{" "}
                        <AnimatedNumber value={toNext} />
                      </div>
                    )}
                  </div>
                  <AnimatedNumber value={totalPts} mono className="readout shrink-0 text-sm font-bold leading-tight" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="instrument-label mt-3 border-t border-border pt-3 text-center text-muted-foreground">
        Constructor Championship
      </div>
    </>
  );
};

export default ConstructorStandingsCard;

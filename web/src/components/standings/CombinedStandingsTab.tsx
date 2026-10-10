import { useMemo } from "react";
import TeamLogo from "@/components/common/TeamLogo";
import { AnimatedNumber } from "@/components/AnimatedNumber";
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
    /* One integrated-bar list — team row + per-driver contribution, at every breakpoint. */
    <div className="overflow-hidden rounded-xl border border-border/70">
      <div className="divide-y divide-border/50">
        {visible.map((team: any, idx: number) => {
          const row = renderRow(team, idx);
          return (
            <div key={row.displayPosition} className="relative overflow-hidden">
              <div
                className="pointer-events-none absolute inset-y-0 left-0"
                style={{ width: `${row.progressPct}%`, backgroundColor: row.borderColor, opacity: 0.1 }}
              />
              <div className="relative px-3 py-2 lg:px-4 lg:py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground lg:w-7 lg:text-sm">
                    {row.displayPosition}
                  </span>
                  <TeamLogo constructorId={row.teamId} alt={row.team.Constructor?.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold lg:text-[0.95rem]">
                    {row.team.Constructor?.name}
                  </span>
                  {idx > 0 && (
                    <span className="hidden shrink-0 whitespace-nowrap text-2xs tabular-nums text-muted-foreground lg:inline">
                      Leader <AnimatedNumber value={row.toLeader} /> · P{row.aheadPosition ?? idx}{" "}
                      <AnimatedNumber value={row.toNext} />
                    </span>
                  )}
                  <AnimatedNumber
                    value={row.totalPts}
                    mono
                    className="readout shrink-0 text-sm font-bold lg:text-base"
                  />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[1.9rem] text-2xs text-muted-foreground lg:pl-[2.4rem]">
                  {row.drivers.map((dr) => {
                    const pct = row.totalPts > 0 ? Math.round((dr.points / row.totalPts) * 100) : 0;
                    return (
                      <span key={dr.code} className="tabular-nums">
                        <span className="font-mono font-semibold text-foreground/80">{dr.code}</span> {dr.points} · {pct}%
                      </span>
                    );
                  })}
                  {idx > 0 && (
                    <span className="ml-auto tabular-nums lg:hidden">
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
  );
};

export default CombinedStandingsTab;

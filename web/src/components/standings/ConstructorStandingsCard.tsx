import { useMemo } from "react";
import TeamLogo from "@/components/common/TeamLogo";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Trophy } from "lucide-react";
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
      {/* One integrated-bar list — same pattern at every breakpoint. */}
      <div className="overflow-hidden rounded-xl border border-border/70">
        <div className="divide-y divide-border/50">
          {visible.map((team: any, idx: number) => {
            const teamId = normalizeTeamId(team.Constructor?.constructorId || "default");
            const teamColor = getTeamHexColor(teamId);
            const totalPts = Number(team.points || 0);
            const wins = Number(team.wins || 0);
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
                <div className="relative flex items-center gap-2.5 px-3 py-2 lg:px-4 lg:py-2.5">
                  <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground lg:w-7 lg:text-sm">
                    {displayPosition}
                  </span>
                  <TeamLogo constructorId={teamId} alt={team.Constructor?.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold leading-tight lg:text-[0.95rem]">
                      {team.Constructor?.name}
                    </div>
                    {idx > 0 && (
                      <div className="text-2xs text-muted-foreground">
                        Leader <AnimatedNumber value={toLeader} /> · P{aheadPosition ?? idx}{" "}
                        <AnimatedNumber value={toNext} />
                      </div>
                    )}
                  </div>
                  {/* Wins — revealed where there's room (lg+) */}
                  <div className="hidden w-14 shrink-0 items-center justify-center lg:flex">
                    {wins > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                        <Trophy className="h-3 w-3" /> <AnimatedNumber value={wins} />
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </div>
                  <AnimatedNumber
                    value={totalPts}
                    mono
                    className="readout shrink-0 text-sm font-bold leading-tight lg:text-base"
                  />
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

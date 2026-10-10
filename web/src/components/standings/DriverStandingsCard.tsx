import { useMemo } from "react";
import TeamLogo from "@/components/common/TeamLogo";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Trophy } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import {
  buildTeamPointsMap,
  DEFAULT_DRIVERS_VISIBLE,
  getGaps,
  getNationalityCode,
  getTeamHexColor,
  normalizeTeamId,
} from "./standingsUtils";

interface DriverStandingsCardProps {
  driverStandings: any;
  constructorStandings: any;
  showAll: boolean;
}

const DriverStandingsCard = ({
  driverStandings,
  constructorStandings,
  showAll,
}: DriverStandingsCardProps) => {
  const driverLeaderPoints = useMemo(
    () => Number(driverStandings?.data?.[0]?.points || 0),
    [driverStandings?.data],
  );

  const teamPointsMap = useMemo(
    () => buildTeamPointsMap(constructorStandings),
    [constructorStandings?.data],
  );

  const fullList = driverStandings?.data || [];
  const visible = fullList.slice(0, showAll ? undefined : DEFAULT_DRIVERS_VISIBLE);

  return (
    <>
      {/* One integrated-bar list — same pattern at every breakpoint (extra columns
          revealed on lg where there's room). No separate desktop table to drift. */}
      <div className="overflow-hidden rounded-xl border border-border/70">
        <div className="divide-y divide-border/50">
          {visible.map((standing: any, idx: number) => {
            const currentConstructor = standing.Constructors?.length
              ? standing.Constructors[standing.Constructors.length - 1]
              : null;
            const teamId = normalizeTeamId(currentConstructor?.constructorId || "default");
            const teamColor = getTeamHexColor(teamId);
            const points = Number(standing.points || 0);
            const wins = Number(standing.wins || 0);
            const teamPoints = teamPointsMap[teamId] || 0;
            const contrib = teamPoints > 0 ? Math.round((points / teamPoints) * 100) : 0;
            const { toLeader, toNext } = getGaps(idx, fullList);
            const aheadPosition = idx > 0 ? (fullList[idx - 1]?.position || idx) : null;
            const progressPct = driverLeaderPoints > 0 ? (points / driverLeaderPoints) * 100 : 0;
            const displayPosition = standing.position || (idx + 1);

            return (
              <div key={displayPosition} className="relative overflow-hidden">
                {/* points-relative fill behind the row (team colour) — the bar, integrated */}
                <div
                  className="pointer-events-none absolute inset-y-0 left-0"
                  style={{ width: `${progressPct}%`, backgroundColor: teamColor, opacity: 0.1 }}
                />
                <div className="relative flex items-center gap-2.5 px-3 py-2 lg:px-4 lg:py-2.5">
                  <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground lg:w-7 lg:text-sm">
                    {displayPosition}
                  </span>
                  <TeamLogo constructorId={teamId} alt={currentConstructor?.name} size="sm" />
                  <ReactCountryFlag
                    countryCode={getNationalityCode(standing.Driver?.nationality)}
                    svg
                    style={{ width: 14, height: "auto" }}
                    title={standing.Driver?.nationality}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold leading-tight lg:text-[0.95rem]">
                      {standing.Driver?.givenName} {standing.Driver?.familyName}
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
                  <div className="shrink-0 text-right">
                    <AnimatedNumber
                      value={points}
                      mono
                      className="readout block text-sm font-bold leading-tight lg:text-base"
                    />
                    <div className="text-2xs text-muted-foreground">{contrib}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="instrument-label mt-3 border-t border-border pt-3 text-center text-muted-foreground">
        Driver Championship
      </div>
    </>
  );
};

export default DriverStandingsCard;

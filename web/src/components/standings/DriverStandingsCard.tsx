import { useMemo } from "react";
import TeamLogo from "@/components/common/TeamLogo";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Progress } from "@/components/ui/progress";
import ReactCountryFlag from "react-country-flag";
import DriverStandingsTable from "./DriverStandingsTable";
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
      <DriverStandingsTable
        driverStandings={driverStandings}
        teamPointsMap={teamPointsMap}
        driverLeaderPoints={driverLeaderPoints}
        showAll={showAll}
      />

      <div className="lg:hidden space-y-1.5">
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
            <div key={displayPosition} className="rounded-md border border-border px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                    {displayPosition}
                  </span>
                  <TeamLogo constructorId={teamId} alt={currentConstructor?.name} size="sm" />
                  <ReactCountryFlag
                    countryCode={getNationalityCode(standing.Driver?.nationality)}
                    svg
                    style={{ width: 13, height: "auto" }}
                    title={standing.Driver?.nationality}
                  />
                  <div
                    className="min-w-0"
                    style={{ borderLeft: `3px solid ${borderColor}`, paddingLeft: "6px" }}
                  >
                    <div className="truncate text-sm font-medium leading-tight">
                      {standing.Driver?.givenName} {standing.Driver?.familyName}
                    </div>
                    {idx > 0 && (
                      <div className="text-2xs text-muted-foreground">
                        Leader <AnimatedNumber value={toLeader} /> · P{aheadPosition ?? idx}{" "}
                        <AnimatedNumber value={toNext} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold leading-tight"><AnimatedNumber value={points} /></div>
                  <div className="text-2xs text-muted-foreground">{contrib}%</div>
                </div>
              </div>
              <Progress
                value={progressPct}
                className="mt-1.5 h-1"
                indicatorStyle={{ backgroundColor: borderColor, opacity: 0.8 }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 pt-3 border-t border-border">
        <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
        <span className="text-xs text-muted-foreground">Driver Championship</span>
        <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
      </div>
    </>
  );
};

export default DriverStandingsCard;

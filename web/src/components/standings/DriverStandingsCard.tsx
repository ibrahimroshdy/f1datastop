import { useMemo } from "react";
import TeamLogo from "@/components/common/TeamLogo";
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

      <div className="lg:hidden space-y-2">
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
            <div key={displayPosition} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-xs text-muted-foreground w-6">{displayPosition}</div>
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamLogo constructorId={teamId} alt={currentConstructor?.name} size="sm" />
                    <ReactCountryFlag
                      countryCode={getNationalityCode(standing.Driver?.nationality)}
                      svg
                      style={{ width: 14, height: "auto" }}
                      title={standing.Driver?.nationality}
                    />
                    <div className="min-w-0">
                      <div
                        className="font-medium truncate"
                        style={{ borderLeft: `3px solid ${borderColor}`, paddingLeft: "6px" }}
                      >
                        {standing.Driver?.givenName} {standing.Driver?.familyName}
                      </div>
                      {idx > 0 && (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          <div>To Leader: {toLeader}</div>
                          <div>To P{aheadPosition ?? idx}: {toNext}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{standing.points}</div>
                  <div className="text-[10px] text-muted-foreground">{contrib}%</div>
                </div>
              </div>
              <div className="mt-2">
                <Progress
                  value={progressPct}
                  className="h-1.5"
                  indicatorStyle={{ backgroundColor: borderColor, opacity: 0.8 }}
                />
              </div>
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

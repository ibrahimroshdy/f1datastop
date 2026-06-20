import { Progress } from "@/components/ui/progress";
import TeamLogo from "@/components/common/TeamLogo";

interface ConstructorStandingsContentProps {
  constructorStandings: any;
  getTeamColor: (constructorId: string) => string;
}

const ConstructorStandingsContent = ({ constructorStandings }: ConstructorStandingsContentProps) => {
  const leaderPoints = Number(constructorStandings?.data?.[0]?.points || 0);

  const list = constructorStandings?.data || [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      {list.map((team: any, idx: number) => {
        const teamId = team.Constructor?.constructorId || "default";
        const points = Number(team.points || 0);
        const leader = leaderPoints || points || 1;
        const leaderPts = Number(list?.[0]?.points || 0);
        const toLeader = Math.max(0, leaderPts - points);
        const aheadPts = idx === 0 ? Number(list?.[1]?.points || 0) : Number(list?.[idx - 1]?.points || 0);
        const toNext = idx === 0 ? Math.max(0, points - aheadPts) : Math.max(0, aheadPts - points);
        return (
          <div key={team.position} className="flex items-center gap-2 lg:gap-4">
            <span className="text-base lg:text-lg font-medium w-4 lg:w-6">{team.position}</span>
            <div className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2 min-w-[90px]">
                <TeamLogo constructorId={teamId} alt={team.Constructor?.name} size="sm" />
                <span className="font-medium text-sm lg:text-base">
                  <span className="hidden lg:inline">{team.Constructor?.name}</span>
                  <span className="lg:hidden">{(team.Constructor?.name || "").split(" ")[0]}</span>
                </span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  {idx === 0 ? <div /> : (
                    <div className="flex flex-col items-start gap-0.5 text-[10px] lg:text-xs text-muted-foreground">
                      <span>To Leader: {toLeader}</span>
                      <span>To P{Number(team.position) - 1}: {toNext}</span>
                    </div>
                  )}
                  <span className="font-medium text-sm lg:text-base">{team.points}</span>
                </div>
                <Progress
                  value={(points / leader) * 100}
                  className="h-1.5 lg:h-2 bg-muted"
                  indicatorClassName="bg-gradient-to-r from-purple-600 to-purple-400"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ConstructorStandingsContent;

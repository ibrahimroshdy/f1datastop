import { Progress } from "@/components/ui/progress";
import TeamLogo from "@/components/common/TeamLogo";
import { TEAM_COLORS } from "@/constants/f1Colors";

interface ConstructorStandingsContentProps {
  constructorStandings: any;
  getTeamColor: (constructorId: string) => string;
}

const normalizeTeamId = (id: string) => {
  const t = (id || "").toLowerCase();
  if (t === "alphatauri") return "rb";
  if (t === "alfa") return "sauber";
  return t;
};

const ConstructorStandingsContent = ({ constructorStandings }: ConstructorStandingsContentProps) => {
  const leaderPoints = Number(constructorStandings?.data?.[0]?.points || 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      {constructorStandings?.data?.map((team: any) => {
        const teamId = team.Constructor?.constructorId || "default";
        const color = TEAM_COLORS[normalizeTeamId(teamId)] || TEAM_COLORS.default;
        const points = Number(team.points || 0);
        const leader = leaderPoints || points || 1;
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
                  <span className="text-xs text-muted-foreground">points</span>
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

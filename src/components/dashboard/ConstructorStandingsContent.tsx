import { Progress } from "@/components/ui/progress";

interface ConstructorStandingsContentProps {
  constructorStandings: any;
  getTeamColor: (constructorId: string) => string;
}

const ConstructorStandingsContent = ({ constructorStandings, getTeamColor }: ConstructorStandingsContentProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      {constructorStandings?.data?.map(team => (
        <div key={team.position} className="flex items-center gap-2 lg:gap-4">
          <span className="text-base lg:text-lg font-medium w-4 lg:w-6">{team.position}</span>
          <div className={`w-1.5 lg:w-2 h-8 lg:h-10 ${getTeamColor(team.Constructor.constructorId)} rounded-sm`}></div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-sm lg:text-base">
                {/* Show abbreviated team name on small and medium screens */}
                <span className="hidden lg:inline">{team.Constructor.name}</span>
                <span className="lg:hidden">
                  {team.Constructor.name.split(' ')[0]}
                </span>
              </span>
              <span className="font-medium text-sm lg:text-base">{team.points} pts</span>
            </div>
            <Progress 
              value={Number(team.points) / Number(constructorStandings.data[0].points) * 100} 
              className="h-1.5 lg:h-2 bg-gray-800" 
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConstructorStandingsContent;

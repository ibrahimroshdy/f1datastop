
import { Progress } from "@/components/ui/progress";

interface ConstructorStandingsContentProps {
  constructorStandings: any;
  getTeamColor: (constructorId: string) => string;
}

const ConstructorStandingsContent = ({ constructorStandings, getTeamColor }: ConstructorStandingsContentProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
      {constructorStandings?.data?.map(team => (
        <div key={team.position} className="flex items-center gap-4">
          <span className="text-lg font-medium w-6">{team.position}</span>
          <div className={`w-2 h-10 ${getTeamColor(team.Constructor.constructorId)} rounded-sm`}></div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium">{team.Constructor.name}</span>
              <span className="font-medium">{team.points} pts</span>
            </div>
            <Progress 
              value={Number(team.points) / Number(constructorStandings.data[0].points) * 100} 
              className="h-2 bg-gray-800" 
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConstructorStandingsContent;

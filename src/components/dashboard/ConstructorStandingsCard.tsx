
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Building2 } from "lucide-react";

interface ConstructorStandingsCardProps {
  constructorStandings: any;
  getTeamColor: (constructorId: string) => string;
}

const ConstructorStandingsCard = ({ constructorStandings, getTeamColor }: ConstructorStandingsCardProps) => {
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-f1-red" />
          Constructor Standings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {constructorStandings?.data?.slice(0, 5).map(team => (
            <div key={team.position} className="flex items-center gap-3">
              <span className="text-lg font-medium w-6">{team.position}</span>
              <div className={`w-2 h-8 ${getTeamColor(team.Constructor.constructorId)} rounded-sm`}></div>
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
      </CardContent>
    </Card>
  );
};

export default ConstructorStandingsCard;

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Building2, Users } from "lucide-react";
import { useState } from "react";

interface ConstructorStandingsCardProps {
  constructorStandings: any;
  getTeamColor: (constructorId: string) => string;
}

// Define team type based on usage in the component
interface TeamStandingType {
  position: string;
  points: string;
  Constructor: {
    constructorId: string;
    name: string;
  };
}

const ConstructorStandingsCard = ({ constructorStandings, getTeamColor }: ConstructorStandingsCardProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [showAllConstructors, setShowAllConstructors] = useState<boolean>(true);
  const [selectedTeam, setSelectedTeam] = useState<TeamStandingType | null>(null);
  const teamsToShow = showAllConstructors ? constructorStandings?.data : constructorStandings?.data?.slice(0, 5);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Constructor Standings
          </CardTitle>
          <button 
            onClick={() => setShowAllConstructors(!showAllConstructors)} 
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Users className="h-4 w-4" />
            {showAllConstructors ? 'Show Top 5' : 'Show All Constructors'}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {teamsToShow?.map(team => (
            <div key={team.position} className="flex items-center gap-3">
              <span className="text-lg font-medium w-6">{team.position}</span>
              <div className={`w-2 h-8 ${getTeamColor(team.Constructor.constructorId)} rounded-sm`}></div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-foreground">{team.Constructor.name}</span>
                  <span className="font-medium">{team.points} pts</span>
                </div>
                <Progress 
                  value={Number(team.points) / Number(constructorStandings.data[0].points) * 100} 
                  className="h-2 bg-muted" 
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

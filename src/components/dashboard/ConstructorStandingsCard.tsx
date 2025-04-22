import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Caravan, Users } from "lucide-react";
import { useState } from "react";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

// Helper function to get team color style with border
const getTeamColorStyle = (teamId: string) => {
  // Normalize the team ID to match the keys in TEAM_COLORS
  let normalizedTeamId = teamId.toLowerCase();
  
  // Handle specific mappings
  if (normalizedTeamId === "alphatauri") {
    normalizedTeamId = "rb";
  } else if (normalizedTeamId === "alfa") {
    normalizedTeamId = "sauber";
  }
  
  // Get color from TEAM_COLORS or default to a gray color
  const color = TEAM_COLORS[normalizedTeamId] || "#666666";
  
  return {
    borderLeft: `4px solid ${color}`,
    paddingLeft: "0.5rem"
  };
};

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
            <Caravan className="h-5 w-5 text-primary" />
            Constructor Standings
          </CardTitle>
          <button 
            onClick={() => setShowAllConstructors(!showAllConstructors)} 
            className="text-xs lg:text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Users className="h-4 w-4" />
            <span className="hidden lg:inline">
              {showAllConstructors ? 'Show Top 5' : 'Show All Constructors'}
            </span>
            <span className="lg:hidden">
              {showAllConstructors ? 'Top 5' : 'All'}
            </span>
          </button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="w-8 lg:w-12 text-sm lg:text-base">Pos</TableHead>
              <TableHead className="text-sm lg:text-base">Team</TableHead>
              <TableHead className="text-right text-sm lg:text-base">Pts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamsToShow?.map(team => (
              <TableRow key={team.position} className="border-border">
                <TableCell className="font-medium text-sm lg:text-base py-2 px-2 lg:p-4">{team.position}</TableCell>
                <TableCell className="py-2 px-1 lg:p-4">
                  <div className="space-y-1">
                    <div style={getTeamColorStyle(team.Constructor.constructorId)} className="font-medium text-foreground text-sm lg:text-base">
                      {/* Show abbreviated team name on small and medium screens */}
                      <span className="hidden lg:inline">{team.Constructor.name}</span>
                      <span className="lg:hidden">
                        {team.Constructor.name.split(' ')[0]}
                      </span>
                    </div>
                    <Progress 
                      value={Number(team.points) / Number(constructorStandings.data[0].points) * 100} 
                      className="h-2 bg-muted" 
                      indicatorClassName="opacity-50"
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium text-sm lg:text-base py-2 px-2 lg:p-4">{team.points}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default ConstructorStandingsCard;

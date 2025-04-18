import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Building2, Users } from "lucide-react";
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
      
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="w-12 text-base">Pos</TableHead>
              <TableHead className="text-base">Team</TableHead>
              <TableHead className="text-right text-base">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamsToShow?.map(team => (
              <TableRow key={team.position} className="border-border">
                <TableCell className="font-medium text-base">{team.position}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div style={getTeamColorStyle(team.Constructor.constructorId)} className="font-medium text-foreground text-base">
                      {team.Constructor.name}
                    </div>
                    <Progress 
                      value={Number(team.points) / Number(constructorStandings.data[0].points) * 100} 
                      className="h-2 bg-muted" 
                      indicatorClassName="opacity-50"
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium text-base">{team.points} pts</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default ConstructorStandingsCard;

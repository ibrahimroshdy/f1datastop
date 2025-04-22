import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import TeamLogo from "@/components/common/TeamLogo";

interface DriverStandingsTableProps {
  driverStandings: any;
  getTeamColor: (constructorId: string) => string;
  showAllDrivers: boolean;
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

const DriverStandingsTable = ({ driverStandings, getTeamColor, showAllDrivers }: DriverStandingsTableProps) => {
  const driversToShow = showAllDrivers ? driverStandings?.data : driverStandings?.data?.slice(0, 10);

  // Helper function to get the current constructor (last in array)
  const getCurrentConstructor = (constructors: any[]) => {
    return constructors.length > 0 ? constructors[constructors.length - 1] : null;
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border">
            <TableHead className="w-8 lg:w-12 text-sm lg:text-base">Pos</TableHead>
            <TableHead className="text-sm lg:text-base">Driver</TableHead>
            <TableHead className="text-center text-sm lg:text-base">Team</TableHead>
            <TableHead className="text-right text-sm lg:text-base">Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {driversToShow?.map(driver => {
            const currentConstructor = getCurrentConstructor(driver.Constructors);
            return (
              <TableRow key={driver.position} className="border-border">
                <TableCell className="font-medium text-sm lg:text-base py-2 px-2 lg:p-4">{driver.position}</TableCell>
                <TableCell className="py-2 px-1 lg:p-4">
                  <div className="flex items-center gap-1 lg:gap-2">
                    <div style={getTeamColorStyle(currentConstructor?.constructorId || 'default')}>
                      <span className="text-sm lg:text-base">
                        {/* Show abbreviated name on small/medium screens */}
                        <span className="hidden lg:inline">{driver.Driver.givenName} {driver.Driver.familyName}</span>
                        <span className="lg:hidden">{driver.Driver.familyName}</span>
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="p-0 text-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-center w-full h-8 lg:h-12">
                          <TeamLogo 
                            constructorId={currentConstructor?.constructorId || 'default'}
                            alt={currentConstructor?.name || 'Unknown Team'}
                            size="sm"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-sm lg:text-base">{currentConstructor?.name || 'Unknown Team'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="text-right font-medium text-sm lg:text-base py-2 px-2 lg:p-4">{driver.points}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default DriverStandingsTable;

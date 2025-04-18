import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Import team logos
import mclarenLogo from "@/assets/constructor-logos/mclaren.png";
import mercedesLogo from "@/assets/constructor-logos/mercedes.png";
import redbullLogo from "@/assets/constructor-logos/redbull.png";
import ferrariLogo from "@/assets/constructor-logos/ferrari.png";
import haasLogo from "@/assets/constructor-logos/haas.png";
import williamsLogo from "@/assets/constructor-logos/williams.png";
import astonmartinLogo from "@/assets/constructor-logos/astonmartin.png";
import rbLogo from "@/assets/constructor-logos/rb.png";
import alpineLogo from "@/assets/constructor-logos/alpine.png";
import sauberLogo from "@/assets/constructor-logos/sauber.png";

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

// Function to get team logo based on constructor ID
const getTeamLogo = (constructorId: string) => {
  const normalizedId = constructorId.toLowerCase();
  
  switch (normalizedId) {
    case "mclaren":
      return mclarenLogo;
    case "mercedes":
      return mercedesLogo;
    case "red_bull":
      return redbullLogo;
    case "ferrari":
      return ferrariLogo;
    case "haas":
      return haasLogo;
    case "williams":
      return williamsLogo;
    case "aston_martin":
      return astonmartinLogo;
    case "alphatauri":
    case "rb":
      return rbLogo;
    case "alpine":
      return alpineLogo;
    case "alfa":
    case "sauber":
      return sauberLogo;
    default:
      // Return a default logo or placeholder
      return null;
  }
};

const DriverStandingsTable = ({ driverStandings, getTeamColor, showAllDrivers }: DriverStandingsTableProps) => {
  const driversToShow = showAllDrivers ? driverStandings?.data : driverStandings?.data?.slice(0, 10);

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow className="border-border">
            <TableHead className="w-12 text-base">Pos</TableHead>
            <TableHead className="text-base">Driver</TableHead>
            <TableHead className="text-center text-base">Team</TableHead>
            <TableHead className="text-right text-base">Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {driversToShow?.map(driver => (
            <TableRow key={driver.position} className="border-border">
              <TableCell className="font-medium text-base">{driver.position}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div style={getTeamColorStyle(driver.Constructors[0].constructorId)}>
                    <span className="text-base">{driver.Driver.givenName} {driver.Driver.familyName}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="p-0 text-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center w-full h-12">
                        {getTeamLogo(driver.Constructors[0].constructorId) ? (
                          <img 
                            src={getTeamLogo(driver.Constructors[0].constructorId)} 
                            alt={driver.Constructors[0].name} 
                            className="h-8 w-auto object-contain mx-auto"
                          />
                        ) : (
                          <span className="text-base">{driver.Constructors[0].name}</span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-base">{driver.Constructors[0].name}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
              <TableCell className="text-right font-medium text-base">{driver.points}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export { DriverStandingsTable, getTeamLogo };
export default DriverStandingsTable;

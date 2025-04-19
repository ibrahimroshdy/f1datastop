import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TEAM_COLORS } from "@/constants/f1Colors";

interface DriverStandingsTableProps {
  standings: any[];
}

const DriverStandingsTable = ({ standings }: DriverStandingsTableProps) => {
  const handleRowClick = (driverId: string) => {
    // If you need routing, implement it with your app's router
    window.location.href = `/drivers/${driverId}`;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Pos</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead className="text-right">Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((driver) => {
            // Get the last constructor in the array (the current team)
            const currentConstructor = driver.Constructors.length > 0 
              ? driver.Constructors[driver.Constructors.length - 1] 
              : null;
            
            // Get constructor color from TEAM_COLORS
            let constructorId = currentConstructor?.constructorId?.toLowerCase() || 'default';
            // Handle specific mappings
            if (constructorId === "alphatauri") {
              constructorId = "rb";
            } else if (constructorId === "alfa") {
              constructorId = "sauber";
            }
            const constructorColor = TEAM_COLORS[constructorId] || "#cccccc";
            
            return (
              <TableRow 
                key={driver.Driver.driverId} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(driver.Driver.driverId)}
              >
                <TableCell>{driver.position}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage 
                        src={`/driver-images/${driver.Driver.driverId}.jpg`} 
                        alt={`${driver.Driver.givenName} ${driver.Driver.familyName}`} 
                      />
                      <AvatarFallback 
                        style={{ backgroundColor: constructorColor, color: '#ffffff' }}
                      >
                        {driver.Driver.code || driver.Driver.familyName.substring(0, 3).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <div className="font-medium">
                        {driver.Driver.givenName} {driver.Driver.familyName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {currentConstructor?.name || 'Unknown Team'}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right">{driver.points}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default DriverStandingsTable; 
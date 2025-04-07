
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { Users } from "lucide-react";

interface DriverStandingsTableProps {
  driverStandings: any;
  getTeamColor: (constructorId: string) => string;
}

const DriverStandingsTable = ({ driverStandings, getTeamColor }: DriverStandingsTableProps) => {
  const [showAllDrivers, setShowAllDrivers] = useState(false);
  const driversToShow = showAllDrivers ? driverStandings?.data : driverStandings?.data?.slice(0, 10);

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">Driver Standings</h3>
        <button 
          onClick={() => setShowAllDrivers(!showAllDrivers)} 
          className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
        >
          <Users className="h-4 w-4" />
          {showAllDrivers ? 'Show Top 10' : 'Show All Drivers'}
        </button>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-gray-800">
            <TableHead className="w-12">Pos</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-right">Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {driversToShow?.map(driver => (
            <TableRow key={driver.position} className="border-gray-800">
              <TableCell className="font-medium">{driver.position}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-6 ${getTeamColor(driver.Constructors[0].constructorId)} rounded-sm`}></div>
                  <span>{driver.Driver.givenName} {driver.Driver.familyName}</span>
                </div>
              </TableCell>
              <TableCell>{driver.Constructors[0].name}</TableCell>
              <TableCell className="text-right font-medium">{driver.points}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default DriverStandingsTable;

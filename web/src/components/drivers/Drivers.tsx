import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import DriverCard from './DriverCard';

interface DriversProps {
  standings: any[];
}

const Drivers = ({ standings }: DriversProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const seasonYear = new Date().getFullYear();

  // Filter drivers based on search query
  const filteredDrivers = standings.filter(driver => {
    const fullName = `${driver.Driver.givenName} ${driver.Driver.familyName}`.toLowerCase();
    const code = driver.Driver.code?.toLowerCase() || '';
    const number = driver.Driver.permanentNumber?.toString() || '';
    
    // Get current constructor (last in the array)
    const currentConstructor = driver.Constructors.length > 0 
      ? driver.Constructors[driver.Constructors.length - 1] 
      : null;
    const team = currentConstructor?.name.toLowerCase() || '';
    
    // Search across multiple fields
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || code.includes(query) || number.includes(query) || team.includes(query);
  });

  // Compute total constructor points map from all standings
  const constructorIdToTotalPoints = new Map<string, number>();
  for (const driver of standings) {
    const currentConstructor = driver.Constructors.length > 0
      ? driver.Constructors[driver.Constructors.length - 1]
      : null;
    const constructorId: string | null = currentConstructor?.constructorId || null;
    if (!constructorId) continue;

    const previousTotal = constructorIdToTotalPoints.get(constructorId) || 0;
    const driverPoints = Number(driver.points) || 0;
    constructorIdToTotalPoints.set(constructorId, previousTotal + driverPoints);
  }

  return (
    <div>
      <div className="mb-6 relative">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search drivers by name, code, number or team..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredDrivers.map(driver => {
          const currentConstructor = driver.Constructors.length > 0
            ? driver.Constructors[driver.Constructors.length - 1]
            : null;
          const constructorId: string | null = currentConstructor?.constructorId || null;
          const teamTotalPoints = constructorId ? (constructorIdToTotalPoints.get(constructorId) || 0) : 0;

          return (
            <DriverCard
              key={driver.Driver.driverId}
              driver={driver}
              teamTotalPoints={teamTotalPoints}
              seasonYear={seasonYear}
            />
          );
        })}
      </div>

      {filteredDrivers.length === 0 && (
        <div className="text-center py-10">
          <p className="text-muted-foreground">No drivers found matching your search.</p>
        </div>
      )}
    </div>
  );
};

export default Drivers; 
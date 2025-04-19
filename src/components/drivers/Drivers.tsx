import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import DriverCard from './DriverCard';

interface DriversProps {
  standings: any[];
}

const Drivers = ({ standings }: DriversProps) => {
  const [searchQuery, setSearchQuery] = useState('');

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
        {filteredDrivers.map(driver => (
          <DriverCard key={driver.Driver.driverId} driver={driver} />
        ))}
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
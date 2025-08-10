import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { getCachedImage, getDriverImageUrls } from "@/utils/imageCache";

interface DriverStandingsTableProps {
  standings: any[];
}

interface DriverRowProps {
  driver: any;
  onClick: (driverId: string) => void;
}

const DriverRow = ({ driver, onClick }: DriverRowProps) => {
  const [cachedImageUrl, setCachedImageUrl] = useState<string>('');
  const [imageLoading, setImageLoading] = useState(true);

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

  // Load and cache driver image (local > OpenF1; else none, show initials)
  useEffect(() => {
    const loadDriverImage = async () => {
      try {
        setImageLoading(true);
        const imageUrls = getDriverImageUrls(driver.Driver.driverId);
        if (imageUrls.primary) {
          const cached = await getCachedImage(imageUrls.primary);
          setCachedImageUrl(cached);
        } else {
          setCachedImageUrl('');
        }
      } catch (error) {
        console.warn(`Failed to load image for driver ${driver.Driver.driverId}:`, error);
        setCachedImageUrl('');
      } finally {
        setImageLoading(false);
      }
    };

    loadDriverImage();
  }, [driver.Driver.driverId]);

  return (
    <TableRow 
      key={driver.Driver.driverId} 
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => onClick(driver.Driver.driverId)}
    >
      <TableCell>{driver.position}</TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {cachedImageUrl && (
              <AvatarImage 
                src={cachedImageUrl} 
                alt={`${driver.Driver.givenName} ${driver.Driver.familyName}`} 
              />
            )}
            <AvatarFallback 
              style={{ backgroundColor: constructorColor, color: '#ffffff' }}
            >
              {imageLoading ? '...' : (driver.Driver.code || driver.Driver.familyName.substring(0, 3).toUpperCase())}
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
};

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
          {standings.map((driver) => (
            <DriverRow 
              key={driver.Driver.driverId}
              driver={driver}
              onClick={handleRowClick}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default DriverStandingsTable; 
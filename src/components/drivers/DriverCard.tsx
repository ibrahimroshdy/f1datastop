import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer";
import { X } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { useLatestDriver } from "@/hooks/useOpenF1Data";
import { useDriverResultsBySeason } from "@/hooks/useF1Data";
import { useIsMobile } from "@/hooks/use-mobile";

interface DriverCardProps {
  driver: any;
  teamTotalPoints?: number;
  seasonYear?: number;
}

const DriverCard = ({ driver, teamTotalPoints, seasonYear }: DriverCardProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const isMobile = useIsMobile();
  
  // Get the current constructor (last in array)
  const currentConstructor = driver.Constructors.length > 0 
    ? driver.Constructors[driver.Constructors.length - 1] 
    : null;
  
  // Get the team color using the constructor ID
  const constructorId = currentConstructor?.constructorId || 'default';
  const teamColor = TEAM_COLORS[constructorId] || TEAM_COLORS.default;

  // Extract birth year for age calculation
  const birthYear = driver.Driver.dateOfBirth 
    ? new Date(driver.Driver.dateOfBirth).getFullYear() 
    : null;
  const currentYear = new Date().getFullYear();
  const age = birthYear ? currentYear - birthYear : "N/A";

  // Get driver number (fallback to Ergast, prefer OpenF1 latest)
  const driverNumber = driver.Driver.permanentNumber || 'N/A';
  const codeAcronym = (driver.Driver.code || '').toUpperCase();

  // Fetch latest OpenF1 driver info to get headshot_url (by driver code only)
  const latestDriverQuery = useLatestDriver(undefined, codeAcronym);
  const headshotUrl: string | undefined = latestDriverQuery.data?.data?.headshot_url;
  const latestNumber: number | undefined = latestDriverQuery.data?.data?.driver_number;
  const displayDriverNumber = latestNumber ?? driver.Driver.permanentNumber ?? 'N/A';
  
  // Driver contribution to constructor points
  const driverPoints = Number(driver.points) || 0;
  const teamPoints = Number(teamTotalPoints) || 0;
  const contributionPercent = teamPoints > 0 && driverPoints > 0 ? Math.round((driverPoints / teamPoints) * 100) : null;

  // Season year for per-race points history
  const season = seasonYear || new Date().getFullYear();
  const { data: resultsByRaceResp } = useDriverResultsBySeason(season, driver.Driver.driverId);
  const pointsHistory: Array<{
    round: string;
    raceName: string;
    date: string;
    circuit?: string;
    country?: string;
    position?: string;
    status?: string;
    points: number;
    constructor?: string;
  }> = resultsByRaceResp?.data || [];
  
  // Generate driver image URL based on driver ID (or use a fallback)
  const getDriverImageUrl = (driverId: string) => {
    return `https://raw.githubusercontent.com/npranav10/F1-Dashboard/main/public/img/drivers/${driverId}.png`;
  };

  // Component for the detail content (shared between dialog and drawer)
  const DetailContent = () => (
    <>
      <div className="grid grid-cols-2 gap-4 py-4">
        <div>
          <h4 className="font-medium text-muted-foreground mb-1">Personal Information</h4>
          <div className="space-y-2">
            <div>
              <span className="text-muted-foreground text-sm">Born:</span>
              <p>{driver.Driver.dateOfBirth || "Unknown"} ({age})</p>
            </div>
            <div>
              <span className="text-muted-foreground text-sm">Nationality:</span>
              <p>{driver.Driver.nationality}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-sm">Code:</span>
              <p>{driver.Driver.code}</p>
            </div>
          </div>
        </div>
        
        <div>
          <h4 className="font-medium text-muted-foreground mb-1">Season Statistics</h4>
          <div className="space-y-2">
            <div>
              <span className="text-muted-foreground text-sm">Position:</span>
              <p>{driver.position}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-sm">Points:</span>
              <p>{driver.points}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-sm">Wins:</span>
              <p>{driver.wins}</p>
            </div>
            {contributionPercent !== null && (
              <div>
                <span className="text-muted-foreground text-sm">Team Points Contribution:</span>
                <p>{contributionPercent}%</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {pointsHistory.length > 0 && (
        <div className="mt-2">
          <h4 className="font-medium text-muted-foreground mb-2">Points by Race ({season})</h4>
          <div className="max-h-60 overflow-auto pr-1 space-y-2">
            {pointsHistory.map((race) => (
              <div key={`${race.round}-${race.raceName}`} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {race.round}
                  </span>
                  <div className="truncate">
                    <p className="truncate font-medium">{race.raceName}</p>
                    <p className="text-xs text-muted-foreground truncate">{race.date}{race.position ? ` • P${race.position}` : ''}</p>
                  </div>
                </div>
                <div className="ml-2 shrink-0 font-semibold">+{race.points}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2">
        <h4 className="font-medium text-muted-foreground mb-2">F1 Profile</h4>
        <p className="text-sm">
          {driver.Driver.givenName} {driver.Driver.familyName} is a Formula 1 driver currently racing for {currentConstructor?.name || 'Unknown Team'}.
          {driver.Driver.url && (
            <a 
              href={driver.Driver.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block mt-2 text-primary hover:underline"
            >
              View Wikipedia Profile
            </a>
          )}
        </p>
      </div>
    </>
  );

  return (
    <>
      <Card className="overflow-hidden border-t-4 hover:shadow-md transition-shadow" style={{ borderTopColor: teamColor }}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: teamColor }}>
              <AvatarImage 
                src={headshotUrl || getDriverImageUrl(driver.Driver.driverId)} 
                alt={`${driver.Driver.givenName} ${driver.Driver.familyName}`} 
              />
              <AvatarFallback style={{ backgroundColor: teamColor }}>
                {driver.Driver.code?.slice(0, 2) || driver.Driver.familyName.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-bold">{driver.Driver.givenName} {driver.Driver.familyName}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: teamColor }}></span>
                {currentConstructor?.name || 'Unknown Team'}
                <span className="ml-1 text-xs font-medium">#{displayDriverNumber}</span>

              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-card">P{driver.position}</Badge>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Driver Code</p>
              <p className="font-semibold">{driver.Driver.code}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Points</p>
              <p className="font-semibold">{driver.points}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Nationality</p>
              <p className="font-semibold">{driver.Driver.nationality}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Driver Number</p>
              <p className="font-semibold">#{displayDriverNumber}</p>
            </div>
            {contributionPercent !== null && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Team Points Contribution</p>
                <p className="font-semibold">{contributionPercent}%</p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="pt-2">
          <Button 
            variant="outline" 
            className="w-full" 
            size="sm"
            onClick={() => setShowDetails(true)}
          >
            <Info className="h-4 w-4 mr-2" /> Driver Details
          </Button>
        </CardFooter>
      </Card>

      {isMobile ? (
        <Drawer open={showDetails} onOpenChange={setShowDetails}>
          <DrawerContent>
            <DrawerHeader className="relative">
              <DrawerClose asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-4 top-4 h-6 w-6"
                  onClick={() => setShowDetails(false)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DrawerClose>
              <DrawerTitle className="flex items-center gap-2 pr-8">
                <span 
                  className="inline-block w-4 h-4 rounded-full"
                  style={{ backgroundColor: teamColor }}
                ></span>
                {driver.Driver.givenName} {driver.Driver.familyName}
              </DrawerTitle>
              <DrawerDescription>
                {currentConstructor?.name || 'Unknown Team'} | #{displayDriverNumber}
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <DetailContent />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogClose asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-4 top-4 h-6 w-6"
                onClick={() => setShowDetails(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pr-8">
                <span 
                  className="inline-block w-4 h-4 rounded-full"
                  style={{ backgroundColor: teamColor }}
                ></span>
                {driver.Driver.givenName} {driver.Driver.familyName}
              </DialogTitle>
              <DialogDescription>
                {currentConstructor?.name || 'Unknown Team'} | #{displayDriverNumber}
              </DialogDescription>
            </DialogHeader>
            <DetailContent />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default DriverCard;


import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Info, Circle } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { TEAM_COLORS } from "@/constants/f1Colors";

interface DriverCardProps {
  driver: any;
}

const DriverCard = ({ driver }: DriverCardProps) => {
  const [showDetails, setShowDetails] = useState(false);
  
  // Get team color directly from the API (if available) or fall back to our constants
  const constructorId = driver.Constructors[0].constructorId;
  const apiTeamColor = driver.Constructors[0].team_colour;
  
  // Use the API's team color if available, otherwise fall back to our constants
  const teamColor = apiTeamColor 
    ? `#${apiTeamColor}` 
    : TEAM_COLORS[constructorId] || TEAM_COLORS.default;

  // Extract birth year for age calculation
  const birthYear = driver.Driver.dateOfBirth 
    ? new Date(driver.Driver.dateOfBirth).getFullYear() 
    : null;
  const currentYear = new Date().getFullYear();
  const age = birthYear ? currentYear - birthYear : "N/A";

  // Get driver number
  const driverNumber = driver.Driver.permanentNumber || 'N/A';
  
  // Get the headshot URL directly from the API or use a fallback
  const driverHeadshotUrl = driver.Driver.headshot_url;
  const driverCode = driver.Driver.code || 'N/A';
  const driverInitials = driverCode.slice(0, 2);
  
  // Get driver position for the position badge
  const position = driver.position || 'N/A';

  return (
    <>
      <Card className="overflow-hidden border-t-4 hover:shadow-md transition-shadow" style={{ borderTopColor: teamColor }}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: teamColor }}>
              {driverHeadshotUrl ? (
                <AvatarImage 
                  src={driverHeadshotUrl} 
                  alt={`${driver.Driver.givenName} ${driver.Driver.familyName}`} 
                />
              ) : (
                <AvatarFallback style={{ backgroundColor: teamColor }}>
                  {driverInitials}
                </AvatarFallback>
              )}
            </Avatar>
            <div>
              <h3 className="text-lg font-bold">{driver.Driver.givenName} {driver.Driver.familyName}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Circle className="h-2 w-2 fill-current" style={{ color: teamColor }} />
                {driver.Constructors[0].name}
                <span className="ml-1 text-xs font-medium">#{driverNumber}</span>
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-f1-dark">P{position}</Badge>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Driver Code</p>
              <p className="font-semibold">{driverCode}</p>
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
              <p className="font-semibold">#{driverNumber}</p>
            </div>
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

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Circle 
                className="h-4 w-4 fill-current"
                style={{ color: teamColor }}
              />
              {driver.Driver.givenName} {driver.Driver.familyName}
            </DialogTitle>
            <DialogDescription>
              {driver.Constructors[0].name} | #{driverNumber}
            </DialogDescription>
          </DialogHeader>
          
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
                  <p>{driverCode}</p>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-muted-foreground mb-1">Season Statistics</h4>
              <div className="space-y-2">
                <div>
                  <span className="text-muted-foreground text-sm">Position:</span>
                  <p>{position}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-sm">Points:</span>
                  <p>{driver.points}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-sm">Wins:</span>
                  <p>{driver.wins}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2">
            <h4 className="font-medium text-muted-foreground mb-2">F1 Profile</h4>
            <p className="text-sm">
              {driver.Driver.givenName} {driver.Driver.familyName} is a Formula 1 driver currently racing for {driver.Constructors[0].name}.
              {driver.Driver.url && (
                <a 
                  href={driver.Driver.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block mt-2 text-f1-red hover:underline"
                >
                  View Wikipedia Profile
                </a>
              )}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DriverCard;

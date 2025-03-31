
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

interface DriverCardProps {
  driver: any;
}

const DriverCard = ({ driver }: DriverCardProps) => {
  // Map constructor IDs to team colors
  const teamColors: Record<string, string> = {
    red_bull: "border-[#0600EF] bg-[#0600EF]/10",
    ferrari: "border-[#F91536] bg-[#F91536]/10",
    mercedes: "border-[#00D2BE] bg-[#00D2BE]/10",
    mclaren: "border-[#FF8700] bg-[#FF8700]/10",
    aston_martin: "border-[#006F62] bg-[#006F62]/10",
    alphatauri: "border-[#2B4562] bg-[#2B4562]/10",
    alpine: "border-[#0090FF] bg-[#0090FF]/10",
    williams: "border-[#005AFF] bg-[#005AFF]/10",
    alfa: "border-[#900000] bg-[#900000]/10",
    haas: "border-[#FFFFFF] bg-[#FFFFFF]/10",
    default: "border-gray-500 bg-gray-500/10"
  };

  const constructorId = driver.Constructors[0].constructorId;
  const teamColorClass = teamColors[constructorId] || teamColors.default;

  return (
    <Card className="overflow-hidden border-t-4 border-t-f1-red hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center text-white font-bold">
            {driver.Driver.code?.slice(0, 2) || driver.Driver.familyName.slice(0, 2)}
          </Avatar>
          <div>
            <h3 className="text-lg font-bold">{driver.Driver.givenName} {driver.Driver.familyName}</h3>
            <p className="text-sm text-muted-foreground">{driver.Constructors[0].name}</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-f1-dark">P{driver.position}</Badge>
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
            <p className="font-semibold">#{driver.Driver.permanentNumber || 'N/A'}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <Button variant="outline" className="w-full" size="sm">
          <Info className="h-4 w-4 mr-2" /> Driver Details
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DriverCard;

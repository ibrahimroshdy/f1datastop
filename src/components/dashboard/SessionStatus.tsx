
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const SessionStatus = () => {
  return (
    <Card className="race-card h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Current Session</CardTitle>
          <Badge variant="outline" className="bg-f1-red text-white border-0">LIVE</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-lg font-bold">Monaco Grand Prix</h3>
          <p className="text-sm text-gray-400">Circuit de Monaco</p>
        </div>
        
        <div className="flex justify-between text-sm">
          <div>
            <p className="text-gray-400">Session</p>
            <p className="font-medium">Race</p>
          </div>
          <div>
            <p className="text-gray-400">Lap</p>
            <p className="font-medium">45/78</p>
          </div>
          <div>
            <p className="text-gray-400">Weather</p>
            <p className="font-medium">Sunny, 22°C</p>
          </div>
        </div>
        
        <Separator className="bg-gray-800" />
        
        <div>
          <div className="flex justify-between mb-2">
            <p className="text-sm font-medium">Race Leader</p>
            <p className="text-sm font-medium">Gap</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-6 bg-redbull rounded-sm"></div>
                <p className="font-medium">Max Verstappen</p>
              </div>
              <p className="text-sm">-</p>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-6 bg-ferrari rounded-sm"></div>
                <p>Charles Leclerc</p>
              </div>
              <p className="text-sm">+3.2s</p>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-6 bg-mclaren rounded-sm"></div>
                <p>Lando Norris</p>
              </div>
              <p className="text-sm">+5.8s</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SessionStatus;


import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const LiveRaceInfo = () => {
  return (
    <Card className="race-card">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🇲🇨</span>
              <h2 className="text-xl font-bold">Monaco Grand Prix</h2>
              <Badge variant="outline" className="bg-f1-red text-white border-0">LIVE</Badge>
            </div>
            <p className="text-sm text-gray-400">Circuit de Monaco, Monte Carlo</p>
          </div>
          
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-gray-400">Lap</p>
              <p className="font-medium text-lg">45/78</p>
            </div>
            <div>
              <p className="text-gray-400">Weather</p>
              <p className="font-medium text-lg">22°C</p>
            </div>
            <div>
              <p className="text-gray-400">Track</p>
              <p className="font-medium text-lg">38°C</p>
            </div>
            <div>
              <p className="text-gray-400">Humidity</p>
              <p className="font-medium text-lg">40%</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LiveRaceInfo;

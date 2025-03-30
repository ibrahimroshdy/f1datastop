
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const LiveTimingPreview = () => {
  const timing = [
    { pos: 1, driver: "VER", team: "Red Bull Racing", lastLap: "1:12.645", gap: "-", color: "bg-redbull" },
    { pos: 2, driver: "LEC", team: "Ferrari", lastLap: "1:12.982", gap: "+3.214", color: "bg-ferrari" },
    { pos: 3, driver: "NOR", team: "McLaren", lastLap: "1:13.104", gap: "+5.782", color: "bg-mclaren" },
    { pos: 4, driver: "PER", team: "Red Bull Racing", lastLap: "1:12.988", gap: "+10.143", color: "bg-redbull" },
    { pos: 5, driver: "HAM", team: "Mercedes", lastLap: "1:13.245", gap: "+15.678", color: "bg-mercedes" },
  ];

  return (
    <Card className="race-card h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Live Timing</CardTitle>
          <Button variant="link" size="sm" asChild className="text-f1-red p-0">
            <Link to="/live">Full Timing</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 py-2">
        <div className="overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-800">
                <th className="font-medium pl-4 py-2">Pos</th>
                <th className="font-medium py-2">Driver</th>
                <th className="font-medium py-2">Last Lap</th>
                <th className="font-medium pr-4 py-2">Gap</th>
              </tr>
            </thead>
            <tbody>
              {timing.map((driver) => (
                <tr key={driver.pos} className="text-sm border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="pl-4 py-2">{driver.pos}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-5 ${driver.color} rounded-sm`}></div>
                      <span>{driver.driver}</span>
                    </div>
                  </td>
                  <td className="py-2">{driver.lastLap}</td>
                  <td className="pr-4 py-2">{driver.gap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default LiveTimingPreview;

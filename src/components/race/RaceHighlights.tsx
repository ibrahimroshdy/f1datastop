
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const RaceHighlights = () => {
  const highlights = [
    { 
      id: 1, 
      type: "Overtake", 
      description: "Lap 32: Norris overtakes Sainz at the hairpin for P3",
      time: "12:42:15"
    },
    { 
      id: 2, 
      type: "Pit Stop", 
      description: "Lap 28: Hamilton pits for hard tires, 2.3s stop",
      time: "12:36:48"
    },
    { 
      id: 3, 
      type: "Fastest Lap", 
      description: "Lap 25: Verstappen sets fastest lap - 1:12.414",
      time: "12:32:19"
    },
    { 
      id: 4, 
      type: "Incident", 
      description: "Lap 18: Zhou stopped on track with technical issues",
      time: "12:21:05"
    },
    { 
      id: 5, 
      type: "Team Radio", 
      description: "Lap 15: Leclerc reports increased tire degradation",
      time: "12:16:32"
    }
  ];

  const getHighlightBadgeColor = (type: string) => {
    switch (type) {
      case "Overtake":
        return "bg-purple-600 hover:bg-purple-700";
      case "Pit Stop":
        return "bg-blue-600 hover:bg-blue-700";
      case "Fastest Lap":
        return "bg-f1-red hover:bg-red-700";
      case "Incident":
        return "bg-yellow-600 hover:bg-yellow-700";
      case "Team Radio":
        return "bg-green-600 hover:bg-green-700";
      default:
        return "bg-gray-600 hover:bg-gray-700";
    }
  };

  return (
    <Card className="race-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Race Highlights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {highlights.map((highlight) => (
          <div key={highlight.id} className="flex justify-between border-b border-gray-800 pb-2">
            <div className="flex items-start gap-2">
              <Badge className={getHighlightBadgeColor(highlight.type)}>
                {highlight.type}
              </Badge>
              <p className="text-sm">{highlight.description}</p>
            </div>
            <span className="text-xs text-gray-400 shrink-0 mt-1">{highlight.time}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default RaceHighlights;

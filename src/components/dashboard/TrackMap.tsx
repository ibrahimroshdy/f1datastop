
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TrackMap = () => {
  return (
    <Card className="race-card h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Track Map</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center p-0">
        <div className="relative w-full h-[180px]">
          {/* Monaco track outline - stylized SVG path */}
          <svg viewBox="0 0 300 180" className="w-full h-full">
            <path
              d="M30,50 C30,30 70,30 90,45 C110,60 130,30 150,30 C170,30 200,50 220,50 C240,50 260,40 270,60 C280,80 280,100 270,120 C260,140 240,150 220,150 C200,150 180,140 160,140 C140,140 120,150 100,140 C80,130 60,140 50,120 C40,100 40,70 30,50"
              fill="none"
              stroke="#555"
              strokeWidth="4"
              strokeLinecap="round"
            />
            
            {/* Driver positions on track - small circles with team colors */}
            <circle cx="260" cy="80" r="3" fill="#0600EF" /> {/* Verstappen - Red Bull */}
            <circle cx="250" cy="85" r="3" fill="#DC0000" /> {/* Leclerc - Ferrari */}
            <circle cx="235" cy="90" r="3" fill="#FF8700" /> {/* Norris - McLaren */}
            <circle cx="220" cy="100" r="3" fill="#0600EF" /> {/* Perez - Red Bull */}
            <circle cx="200" cy="110" r="3" fill="#00D2BE" /> {/* Hamilton - Mercedes */}
            <circle cx="180" cy="120" r="3" fill="#006F62" /> {/* Alonso - Aston Martin */}
            
            {/* Start/Finish line */}
            <line x1="30" y1="50" x2="40" y2="60" stroke="#e10600" strokeWidth="2" strokeLinecap="round" />
            
            {/* DRS zones - highlighted sections */}
            <path
              d="M150,30 C170,30 200,50 220,50"
              fill="none"
              stroke="#e10600"
              strokeWidth="2"
              strokeDasharray="4 2"
              strokeLinecap="round"
            />
          </svg>
          
          {/* Legend */}
          <div className="absolute bottom-2 right-2 text-xs flex items-center gap-1">
            <div className="w-2 h-2 bg-f1-red rounded-full"></div>
            <span className="text-gray-400">DRS Zone</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrackMap;

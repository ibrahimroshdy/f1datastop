
import { Card, CardContent } from "@/components/ui/card";

const TrackPositions = () => {
  const drivers = [
    { pos: 1, number: 1, name: "VER", team: "Red Bull Racing", color: "bg-redbull", gap: "-", progress: 95 },
    { pos: 2, number: 16, name: "LEC", team: "Ferrari", color: "bg-ferrari", gap: "+3.2s", progress: 92 },
    { pos: 3, number: 4, name: "NOR", team: "McLaren", color: "bg-mclaren", gap: "+5.8s", progress: 88 },
    { pos: 4, number: 11, name: "PER", team: "Red Bull Racing", color: "bg-redbull", gap: "+10.1s", progress: 83 },
    { pos: 5, number: 44, name: "HAM", team: "Mercedes", color: "bg-mercedes", gap: "+15.7s", progress: 78 },
    { pos: 6, number: 55, name: "SAI", team: "Ferrari", color: "bg-ferrari", gap: "+18.2s", progress: 74 },
    { pos: 7, number: 14, name: "ALO", team: "Aston Martin", color: "bg-aston-martin", gap: "+22.9s", progress: 70 },
    { pos: 8, number: 63, name: "RUS", team: "Mercedes", color: "bg-mercedes", gap: "+23.7s", progress: 68 },
    { pos: 9, number: 18, name: "STR", team: "Aston Martin", color: "bg-aston-martin", gap: "+25.9s", progress: 65 },
    { pos: 10, number: 31, name: "OCO", team: "Alpine", color: "bg-alpine", gap: "+28.3s", progress: 62 },
  ];

  return (
    <Card className="race-card p-4">
      <CardContent className="p-0">
        <div className="relative h-[400px] border border-gray-800 rounded-lg overflow-hidden">
          {/* Track outline - stylized path */}
          <svg 
            viewBox="0 0 400 400" 
            className="absolute inset-0 w-full h-full"
            style={{ stroke: "#333", strokeWidth: 12, fill: "none" }}
          >
            <path d="M50,100 C50,50 150,50 200,75 C250,100 300,50 320,80 C340,110 350,150 350,200 C350,250 330,300 280,320 C230,340 150,340 100,320 C50,300 50,250 50,200 C50,150 50,120 50,100 Z" />
          </svg>
          
          {/* Driver markers */}
          {drivers.map((driver) => (
            <div 
              key={driver.pos}
              className="absolute"
              style={{ 
                top: `${10 + (driver.pos * 4)}%`, 
                right: `${driver.progress}%`,
                transform: 'translate(50%, -50%)',
                zIndex: 20 - driver.pos
              }}
            >
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 ${driver.color} rounded flex items-center justify-center font-bold text-sm`}>
                  {driver.number}
                </div>
                <div className="bg-f1-dark px-2 py-1 rounded">
                  <div className="text-xs font-bold">{driver.name}</div>
                  <div className="text-xs text-gray-400">{driver.gap}</div>
                </div>
              </div>
            </div>
          ))}
          
          {/* Sector markers */}
          <div className="absolute top-[10%] left-[33%] text-gray-400 text-xs">Sector 1</div>
          <div className="absolute top-[20%] right-[30%] text-gray-400 text-xs">Sector 2</div>
          <div className="absolute bottom-[30%] left-[30%] text-gray-400 text-xs">Sector 3</div>
          
          {/* Start/Finish */}
          <div className="absolute top-[10%] left-[8%] text-xs px-2 py-1 bg-f1-red rounded-sm">Start/Finish</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrackPositions;

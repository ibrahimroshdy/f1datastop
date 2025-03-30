
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const RaceCalendar = () => {
  const races = [
    { 
      id: 1, 
      name: "Monaco Grand Prix", 
      circuit: "Circuit de Monaco", 
      date: "May 26, 2023", 
      flag: "🇲🇨",
      status: "live"
    },
    { 
      id: 2, 
      name: "Canadian Grand Prix", 
      circuit: "Circuit Gilles Villeneuve", 
      date: "June 9, 2023", 
      flag: "🇨🇦",
      status: "upcoming"
    },
    { 
      id: 3, 
      name: "Spanish Grand Prix", 
      circuit: "Circuit de Barcelona-Catalunya", 
      date: "June 23, 2023", 
      flag: "🇪🇸",
      status: "upcoming"
    },
    { 
      id: 4, 
      name: "Austrian Grand Prix", 
      circuit: "Red Bull Ring", 
      date: "July 7, 2023", 
      flag: "🇦🇹",
      status: "upcoming"
    },
  ];

  return (
    <div className="space-y-3">
      {races.map((race) => (
        <Card key={race.id} className="race-card p-4 cursor-pointer hover:border-f1-red/30">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{race.flag}</span>
                <h3 className="font-bold">{race.name}</h3>
                {race.status === "live" && (
                  <Badge variant="outline" className="bg-f1-red text-white border-0 text-xs">LIVE</Badge>
                )}
              </div>
              <p className="text-sm text-gray-400">{race.circuit}</p>
            </div>
            <div className="text-right">
              <p className="text-sm">{race.date}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default RaceCalendar;


import { Progress } from "@/components/ui/progress";

const DriverStandings = () => {
  const drivers = [
    { pos: 1, driver: "Max Verstappen", team: "Red Bull Racing", points: 150, color: "bg-redbull" },
    { pos: 2, driver: "Sergio Perez", team: "Red Bull Racing", points: 102, color: "bg-redbull" },
    { pos: 3, driver: "Charles Leclerc", team: "Ferrari", points: 98, color: "bg-ferrari" },
    { pos: 4, driver: "Lando Norris", team: "McLaren", points: 87, color: "bg-mclaren" },
    { pos: 5, driver: "Carlos Sainz", team: "Ferrari", points: 86, color: "bg-ferrari" },
    { pos: 6, driver: "Lewis Hamilton", team: "Mercedes", points: 63, color: "bg-mercedes" },
    { pos: 7, driver: "Fernando Alonso", team: "Aston Martin", points: 55, color: "bg-aston-martin" },
  ];
  
  const maxPoints = Math.max(...drivers.map(d => d.points));

  return (
    <div className="space-y-3">
      {drivers.map((driver) => (
        <div key={driver.pos} className="space-y-1">
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">{driver.pos}</span>
              <span className="font-medium">{driver.driver}</span>
            </div>
            <span className="font-medium">{driver.points}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-4 ${driver.color} rounded-sm`}></div>
            <Progress 
              value={(driver.points / maxPoints) * 100} 
              className="h-2 bg-gray-800" 
              indicatorClassName={driver.color} 
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default DriverStandings;

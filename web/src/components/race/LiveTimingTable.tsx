import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const LiveTimingTable = () => {
  const drivers = [
    { 
      pos: 1, 
      driver: "Max Verstappen", 
      number: 1,
      team: "Red Bull Racing", 
      lastLap: "1:12.645", 
      gap: "-",
      interval: "-",
      laps: 45,
      color: "bg-redbull",
      status: "track"
    },
    { 
      pos: 2, 
      driver: "Charles Leclerc", 
      number: 16,
      team: "Ferrari", 
      lastLap: "1:12.982", 
      gap: "+3.214",
      interval: "+3.214",
      laps: 45,
      color: "bg-ferrari",
      status: "track"
    },
    { 
      pos: 3, 
      driver: "Lando Norris", 
      number: 4,
      team: "McLaren", 
      lastLap: "1:13.104", 
      gap: "+5.782",
      interval: "+2.568",
      laps: 45,
      color: "bg-mclaren",
      status: "track"
    },
    { 
      pos: 4, 
      driver: "Sergio Perez", 
      number: 11,
      team: "Red Bull Racing", 
      lastLap: "1:12.988", 
      gap: "+10.143",
      interval: "+4.361",
      laps: 45,
      color: "bg-redbull",
      status: "track"
    },
    { 
      pos: 5, 
      driver: "Lewis Hamilton", 
      number: 44,
      team: "Mercedes", 
      lastLap: "1:13.245", 
      gap: "+15.678",
      interval: "+5.535",
      laps: 45,
      color: "bg-mercedes",
      status: "track"
    },
    { 
      pos: 6, 
      driver: "Carlos Sainz", 
      number: 55,
      team: "Ferrari", 
      lastLap: "1:13.511", 
      gap: "+18.214",
      interval: "+2.536",
      laps: 45,
      color: "bg-ferrari",
      status: "track"
    },
    { 
      pos: 7, 
      driver: "Fernando Alonso", 
      number: 14,
      team: "Aston Martin", 
      lastLap: "1:13.720", 
      gap: "+22.918",
      interval: "+4.704",
      laps: 45,
      color: "bg-aston-martin",
      status: "track"
    },
    { 
      pos: 8, 
      driver: "George Russell", 
      number: 63,
      team: "Mercedes", 
      lastLap: "1:13.682", 
      gap: "+23.662",
      interval: "+0.744",
      laps: 45,
      color: "bg-mercedes",
      status: "track"
    },
    { 
      pos: 9, 
      driver: "Lance Stroll", 
      number: 18,
      team: "Aston Martin", 
      lastLap: "1:14.104", 
      gap: "+25.902",
      interval: "+2.240",
      laps: 45,
      color: "bg-aston-martin",
      status: "track"
    },
    { 
      pos: 10, 
      driver: "Esteban Ocon", 
      number: 31,
      team: "Alpine", 
      lastLap: "1:14.378", 
      gap: "+28.255",
      interval: "+2.353",
      laps: 45,
      color: "bg-alpine",
      status: "track"
    },
    { 
      pos: 11, 
      driver: "Pierre Gasly", 
      number: 10,
      team: "Alpine", 
      lastLap: "1:14.642", 
      gap: "+29.189",
      interval: "+0.934",
      laps: 45,
      color: "bg-alpine",
      status: "track"
    },
    { 
      pos: 12, 
      driver: "Daniel Ricciardo", 
      number: 3,
      team: "Racing Bulls", 
      lastLap: "1:14.922", 
      gap: "+40.982",
      interval: "+11.793",
      laps: 45,
      color: "bg-alphatauri",
      status: "track"
    },
    { 
      pos: 13, 
      driver: "Valtteri Bottas", 
      number: 77,
      team: "Kick Sauber", 
      lastLap: "1:15.045", 
      gap: "+45.117",
      interval: "+4.135",
      laps: 44,
      color: "bg-alfa-romeo",
      status: "track"
    },
    { 
      pos: 14, 
      driver: "Alex Albon", 
      number: 23,
      team: "Williams", 
      lastLap: "1:15.231", 
      gap: "+1 LAP",
      interval: "+1 LAP",
      laps: 44,
      color: "bg-williams",
      status: "track"
    },
    { 
      pos: 15, 
      driver: "Yuki Tsunoda", 
      number: 22,
      team: "Racing Bulls", 
      lastLap: "1:15.648", 
      gap: "+1 LAP",
      interval: "+10.235",
      laps: 44,
      color: "bg-alphatauri",
      status: "track"
    },
    { 
      pos: 16, 
      driver: "Kevin Magnussen", 
      number: 20,
      team: "Haas F1 Team", 
      lastLap: "1:15.789", 
      gap: "+1 LAP",
      interval: "+12.488",
      laps: 44,
      color: "bg-haas",
      status: "track"
    },
    { 
      pos: 17, 
      driver: "Logan Sargeant", 
      number: 2,
      team: "Williams", 
      lastLap: "1:16.103", 
      gap: "+1 LAP",
      interval: "+8.291",
      laps: 44,
      color: "bg-williams",
      status: "track"
    },
    { 
      pos: 18, 
      driver: "Nico Hulkenberg", 
      number: 27,
      team: "Haas F1 Team", 
      lastLap: "1:16.442", 
      gap: "+1 LAP",
      interval: "+5.782",
      laps: 44,
      color: "bg-haas",
      status: "track"
    },
    { 
      pos: 19, 
      driver: "Zhou Guanyu", 
      number: 24,
      team: "Kick Sauber", 
      lastLap: "1:18.882", 
      gap: "DNF",
      interval: "DNF",
      laps: 30,
      color: "bg-alfa-romeo",
      status: "dnf"
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "track":
        return "text-foreground";
      case "pits":
        return "text-yellow-500";
      case "dnf":
        return "text-red-500";
      default:
        return "text-foreground";
    }
  };

  return (
    <div className="race-card border border-border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader className="bg-secondary">
          <TableRow>
            <TableHead className="w-12">Pos</TableHead>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead className="hidden md:table-cell">Team</TableHead>
            <TableHead>Last Lap</TableHead>
            <TableHead>Gap</TableHead>
            <TableHead className="hidden md:table-cell">Interval</TableHead>
            <TableHead className="hidden md:table-cell">Laps</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drivers.map((driver) => (
            <TableRow key={driver.pos} className="hover:bg-muted/50 border-t border-border">
              <TableCell className="font-medium">{driver.pos}</TableCell>
              <TableCell>
                <div className={`w-6 h-6 ${driver.color} rounded-sm flex items-center justify-center text-xs font-bold`}>
                  {driver.number}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className={`w-1 h-5 ${driver.color} rounded-sm`}></div>
                  <span>{driver.driver}</span>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">{driver.team}</TableCell>
              <TableCell>{driver.lastLap}</TableCell>
              <TableCell>{driver.gap}</TableCell>
              <TableCell className="hidden md:table-cell">{driver.interval}</TableCell>
              <TableCell className="hidden md:table-cell">{driver.laps}</TableCell>
              <TableCell>
                <Badge className={`uppercase ${getStatusColor(driver.status)}`} variant="outline">
                  {driver.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default LiveTimingTable;

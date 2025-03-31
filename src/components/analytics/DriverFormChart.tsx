
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer } from 'recharts';
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface DriverFormChartProps {
  driverData: any[];
  isLoading: boolean;
}

const DriverFormChart = ({ driverData, isLoading }: DriverFormChartProps) => {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  
  // Set default selected drivers when data loads
  useEffect(() => {
    if (driverData && driverData.length > 0 && selectedDrivers.length === 0) {
      // Select top 3 drivers by default
      setSelectedDrivers(driverData.slice(0, 3).map(d => d.Driver.driverId));
    }
  }, [driverData, selectedDrivers.length]);

  const { data: driverStats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["driverStats", selectedDrivers],
    queryFn: async () => {
      if (!selectedDrivers.length) return [];
      
      // Since we don't have real stats from the API, we'll generate some stats
      // In a real app, you would fetch this data from the API for each driver
      return selectedDrivers.map(driverId => {
        const driver = driverData?.find(d => d.Driver.driverId === driverId);
        if (!driver) return null;
        
        // Generate random stats
        return {
          driverId,
          name: `${driver.Driver.givenName} ${driver.Driver.familyName}`,
          code: driver.Driver.code,
          team: driver.Constructors[0].name,
          stats: {
            qualifying: Math.floor(Math.random() * 50) + 50, // 50-100
            raceStart: Math.floor(Math.random() * 50) + 50,
            racePace: Math.floor(Math.random() * 50) + 50,
            tireManagement: Math.floor(Math.random() * 50) + 50,
            consistency: Math.floor(Math.random() * 50) + 50,
            wetWeather: Math.floor(Math.random() * 50) + 50,
          }
        };
      }).filter(Boolean);
    },
    enabled: selectedDrivers.length > 0
  });

  // Process driver stats for radar chart
  const processRadarData = () => {
    if (!driverStats?.length) return [];
    
    // Transform data for radar chart
    const categories = ['Qualifying', 'Race Start', 'Race Pace', 'Tire Management', 'Consistency', 'Wet Weather'];
    
    return categories.map(category => {
      const key = category.toLowerCase().replace(' ', '');
      const data: any = { category, fullMark: 100 };
      
      driverStats.forEach(driver => {
        if (driver) {
          data[driver.code] = driver.stats[key as keyof typeof driver.stats];
        }
      });
      
      return data;
    });
  };

  const radarData = processRadarData();

  // Team colors for the chart
  const teamColors: Record<string, string> = {
    "Red Bull": "#0600EF",
    "Ferrari": "#F91536",
    "Mercedes": "#00D2BE",
    "McLaren": "#FF8700",
    "Aston Martin": "#006F62",
    "Alpine": "#0090FF",
    "Williams": "#005AFF",
    "Sauber": "#900000",
    "Haas F1 Team": "#FFFFFF",
    "RB F1 Team": "#2B4562",
  };
  
  // Get driver color based on team
  const getDriverColor = (driverCode: string) => {
    const driver = driverStats?.find(d => d?.code === driverCode);
    if (!driver) return "#cccccc";
    return teamColors[driver.team] || "#cccccc";
  };

  // Handle driver selection
  const toggleDriverSelection = (driverId: string) => {
    setSelectedDrivers(prev => 
      prev.includes(driverId)
        ? prev.filter(id => id !== driverId)
        : [...prev, driverId]
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Driver Performance Analysis</CardTitle>
        <CardDescription>Comparison of driver abilities across different categories</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <p className="mb-2 text-sm text-muted-foreground">Select drivers to compare (max 3):</p>
          <div className="flex flex-wrap gap-2">
            {driverData?.slice(0, 10).map((driver) => (
              <button
                key={driver.Driver.driverId}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedDrivers.includes(driver.Driver.driverId)
                    ? "bg-f1-red text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
                onClick={() => toggleDriverSelection(driver.Driver.driverId)}
                disabled={selectedDrivers.length >= 3 && !selectedDrivers.includes(driver.Driver.driverId)}
              >
                {driver.Driver.code || driver.Driver.familyName}
              </button>
            ))}
          </div>
        </div>

        {isLoading || isStatsLoading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : selectedDrivers.length === 0 ? (
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            Select drivers to compare their performance
          </div>
        ) : (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart outerRadius={150} data={radarData}>
                <PolarGrid gridType="polygon" />
                <PolarAngleAxis dataKey="category" tick={{ fill: '#e4e4e7' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                
                {driverStats?.map(driver => (
                  driver && (
                    <Radar
                      key={driver.code}
                      name={driver.name}
                      dataKey={driver.code}
                      stroke={getDriverColor(driver.code)}
                      fill={getDriverColor(driver.code)}
                      fillOpacity={0.5}
                    />
                  )
                ))}
                
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DriverFormChart;

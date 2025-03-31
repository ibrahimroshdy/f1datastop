
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface HistoricalPerformanceChartProps {
  isLoading?: boolean;
}

const HistoricalPerformanceChart = ({ isLoading = false }: HistoricalPerformanceChartProps) => {
  const [selectedMetric, setSelectedMetric] = useState<string>("podiums");
  const [selectedDriver, setSelectedDriver] = useState<string>("hamilton");
  
  const topDrivers = [
    { id: "hamilton", name: "Lewis Hamilton" },
    { id: "max_verstappen", name: "Max Verstappen" },
    { id: "alonso", name: "Fernando Alonso" },
    { id: "vettel", name: "Sebastian Vettel" },
    { id: "leclerc", name: "Charles Leclerc" }
  ];
  
  const metrics = [
    { id: "wins", name: "Race Wins" },
    { id: "podiums", name: "Podium Finishes" },
    { id: "points", name: "Championship Points" },
    { id: "poles", name: "Pole Positions" }
  ];
  
  const seasons = Array.from({ length: 10 }, (_, i) => (2023 - i));
  
  // Fetch historical data for the selected driver
  const { data: driverData, isLoading: dataLoading } = useQuery({
    queryKey: ["driverHistorical", selectedDriver],
    queryFn: async () => {
      try {
        // In a real application, this would make API calls to get actual data
        // For this demo, we'll generate mock historical data
        
        const generateHistoricalData = (driverId: string) => {
          // Different base values and growth patterns for different drivers
          const baseValues: Record<string, number> = {
            "hamilton": 10,
            "max_verstappen": 5,
            "alonso": 8,
            "vettel": 7,
            "leclerc": 3
          };
          
          const growthFactors: Record<string, number> = {
            "hamilton": 1.2,
            "max_verstappen": 1.5,
            "alonso": 1.1,
            "vettel": 1.3,
            "leclerc": 1.6
          };
          
          const peakSeasons: Record<string, number> = {
            "hamilton": 2020,
            "max_verstappen": 2022,
            "alonso": 2012,
            "vettel": 2013,
            "leclerc": 2022
          };
          
          return seasons.map(season => {
            const base = baseValues[driverId] || 5;
            const growth = growthFactors[driverId] || 1.2;
            const peak = peakSeasons[driverId] || 2020;
            
            // Calculate a performance value that peaks at the driver's peak season
            const yearFactor = 1 - Math.abs(season - peak) / 15;
            
            return {
              season: season.toString(),
              wins: Math.round(base * growth * yearFactor * (Math.random() * 0.4 + 0.8)),
              podiums: Math.round((base * 3) * growth * yearFactor * (Math.random() * 0.3 + 0.85)),
              points: Math.round((base * 25) * growth * yearFactor * (Math.random() * 0.2 + 0.9)),
              poles: Math.round((base * 1.2) * growth * yearFactor * (Math.random() * 0.5 + 0.75))
            };
          }).sort((a, b) => parseInt(a.season) - parseInt(b.season));
        };
        
        return generateHistoricalData(selectedDriver);
      } catch (error) {
        toast.error("Error loading historical data");
        console.error(error);
        return [];
      }
    }
  });

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Driver Historical Performance</CardTitle>
          <CardDescription>Track a driver's performance metrics across seasons</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={selectedDriver} onValueChange={setSelectedDriver}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select driver" />
            </SelectTrigger>
            <SelectContent>
              {topDrivers.map(driver => (
                <SelectItem key={driver.id} value={driver.id}>{driver.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              {metrics.map(metric => (
                <SelectItem key={metric.id} value={metric.id}>{metric.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || dataLoading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : !driverData?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            No historical data available
          </div>
        ) : (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={driverData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="season" />
                <YAxis />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a',
                    borderColor: '#333',
                    borderRadius: '5px',
                    color: 'white'
                  }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey={selectedMetric} 
                  name={metrics.find(m => m.id === selectedMetric)?.name || selectedMetric}
                  stroke="#f91536" 
                  fill="#f9153670" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HistoricalPerformanceChart;

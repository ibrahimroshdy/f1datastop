
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface CircuitPerformanceChartProps {
  isLoading?: boolean;
}

const CircuitPerformanceChart = ({ isLoading = false }: CircuitPerformanceChartProps) => {
  const [selectedConstructor, setSelectedConstructor] = useState<string>("red_bull");

  const topConstructors = [
    { id: "red_bull", name: "Red Bull" },
    { id: "ferrari", name: "Ferrari" },
    { id: "mercedes", name: "Mercedes" },
    { id: "mclaren", name: "McLaren" },
    { id: "aston_martin", name: "Aston Martin" }
  ];
  
  const circuits = [
    "Monaco", "Silverstone", "Spa", "Monza", "Singapore", 
    "Suzuka", "COTA", "Interlagos", "Melbourne", "Bahrain"
  ];
  
  // Fetch circuit performance data for the selected constructor
  const { data: performanceData, isLoading: dataLoading } = useQuery({
    queryKey: ["constructorCircuits", selectedConstructor],
    queryFn: async () => {
      try {
        // In a real application, this would make API calls to get actual data
        // For this demo, we'll generate mock circuit performance data
        
        const generateCircuitData = (constructorId: string) => {
          // Different performance profiles for different constructors
          const basePerformance: Record<string, number> = {
            "red_bull": 8.5,
            "ferrari": 7.8,
            "mercedes": 8.0,
            "mclaren": 7.5,
            "aston_martin": 7.0
          };
          
          // Some constructors are stronger at certain track types
          const trackStrengths: Record<string, Record<string, number>> = {
            "red_bull": { "Monaco": 0.9, "Spa": 1.2, "Suzuka": 1.15 },
            "ferrari": { "Monaco": 1.1, "Monza": 1.15, "Singapore": 1.05 },
            "mercedes": { "Silverstone": 1.2, "COTA": 1.1, "Interlagos": 1.05 },
            "mclaren": { "Monza": 1.05, "Melbourne": 1.1, "Silverstone": 1.05 },
            "aston_martin": { "Monaco": 1.05, "Singapore": 1.05, "Bahrain": 1.1 }
          };
          
          return circuits.map(circuit => {
            const base = basePerformance[constructorId] || 7.0;
            const modifier = trackStrengths[constructorId]?.[circuit] || 1.0;
            
            // Calculate performance scores with some randomness
            return {
              circuit,
              performance: Math.round((base * modifier * (Math.random() * 0.2 + 0.9)) * 10) / 10,
              averageLapTime: 80 + Math.round((10 - base * modifier) * (Math.random() * 2 + 4) * 10) / 10,
              topSpeed: 310 + Math.round((base * modifier) * (Math.random() * 10 + 5)),
              downforce: Math.round((base * modifier * (Math.random() * 0.2 + 0.9)) * 10) / 10
            };
          });
        };
        
        return generateCircuitData(selectedConstructor);
      } catch (error) {
        toast.error("Error loading circuit performance data");
        console.error(error);
        return [];
      }
    }
  });

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Constructor Circuit Performance</CardTitle>
          <CardDescription>Analyze team performance across different circuits</CardDescription>
        </div>
        <Select value={selectedConstructor} onValueChange={setSelectedConstructor}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select constructor" />
          </SelectTrigger>
          <SelectContent>
            {topConstructors.map(constructor => (
              <SelectItem key={constructor.id} value={constructor.id}>{constructor.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading || dataLoading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : !performanceData?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            No performance data available
          </div>
        ) : (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={performanceData}
                margin={{ top: 10, right: 30, left: 0, bottom: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="circuit" angle={-45} textAnchor="end" tick={{ dy: 10 }} />
                <YAxis domain={[0, 10]} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a',
                    borderColor: '#333',
                    borderRadius: '5px',
                    color: 'white'
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="performance" 
                  name="Performance Rating (0-10)" 
                  fill="#f91536" 
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  dataKey="downforce" 
                  name="Downforce Rating (0-10)" 
                  fill="#0600EF" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CircuitPerformanceChart;

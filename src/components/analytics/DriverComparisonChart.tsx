
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DriverComparisonChartProps {
  driverData: any[];
  isLoading: boolean;
}

const DriverComparisonChart = ({ driverData, isLoading }: DriverComparisonChartProps) => {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>(["VER", "HAM", "LEC"]);

  // Process data for the chart
  const topDrivers = !isLoading && driverData
    ? driverData.slice(0, 20).map((driver) => ({
        code: driver.Driver.code,
        name: `${driver.Driver.givenName} ${driver.Driver.familyName}`,
        points: parseFloat(driver.points),
        position: parseInt(driver.position),
        team: driver.Constructors[0].name,
      }))
    : [];

  const handleDriverToggle = (driverCode: string) => {
    if (selectedDrivers.includes(driverCode)) {
      setSelectedDrivers(selectedDrivers.filter(code => code !== driverCode));
    } else {
      if (selectedDrivers.length < 5) {
        setSelectedDrivers([...selectedDrivers, driverCode]);
      }
    }
  };

  // Generate random stats for demonstration purposes
  const driversWithStats = topDrivers.map(driver => {
    const randomWins = Math.floor(Math.random() * 10);
    const randomPodiums = Math.floor(Math.random() * 20);
    const randomPoles = Math.floor(Math.random() * 10);
    const randomFastLaps = Math.floor(Math.random() * 10);
    
    return {
      ...driver,
      "Points": driver.points,
      "Wins": randomWins,
      "Podiums": randomPodiums,
      "Pole Positions": randomPoles,
      "Fast Laps": randomFastLaps,
    };
  });

  // Create chart data with all driver values
  const chartData = [
    { category: "Points", fullMark: Math.max(...topDrivers.map(d => d.points)) || 100 },
    { category: "Wins", fullMark: 10 },
    { category: "Podiums", fullMark: 20 },
    { category: "Pole Positions", fullMark: 10 },
    { category: "Fast Laps", fullMark: 10 },
  ].map(item => {
    // Add each selected driver's value to this category item
    const categoryData = { ...item };
    
    selectedDrivers.forEach(driverCode => {
      const driverData = driversWithStats.find(d => d.code === driverCode);
      if (driverData) {
        categoryData[driverCode] = driverData[item.category as keyof typeof driverData] || 0;
      }
    });
    
    return categoryData;
  });

  // Get colors for each team
  const driverColors: Record<string, string> = {
    "VER": "#0600EF",
    "PER": "#0600EF",
    "LEC": "#F91536",
    "SAI": "#F91536",
    "HAM": "#00D2BE",
    "RUS": "#00D2BE",
    "NOR": "#FF8700",
    "PIA": "#FF8700",
    "ALO": "#006F62",
    "STR": "#006F62",
  };

  const getColor = (driverCode: string) => {
    return driverColors[driverCode] || "#cccccc";
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Driver Performance Comparison</CardTitle>
        <CardDescription>Compare performance metrics between selected drivers</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[500px] w-full" />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {topDrivers.slice(0, 10).map((driver) => (
                <button
                  key={driver.code}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedDrivers.includes(driver.code)
                      ? "bg-f1-red text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                  onClick={() => handleDriverToggle(driver.code)}
                >
                  {driver.code}
                </button>
              ))}
            </div>
            <div className="h-[500px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart outerRadius={180} data={chartData}>
                  <PolarGrid strokeOpacity={0.2} />
                  <PolarAngleAxis dataKey="category" tick={{ fill: "white" }} />
                  <PolarRadiusAxis angle={30} domain={[0, "auto"]} stroke="rgba(255,255,255,0.3)" />
                  
                  {selectedDrivers.map((driverCode) => {
                    const driverData = driversWithStats.find(d => d.code === driverCode);
                    if (!driverData) return null;
                    
                    return (
                      <Radar
                        key={driverCode}
                        name={driverData.name}
                        dataKey={driverCode}
                        stroke={getColor(driverCode)}
                        fill={getColor(driverCode)}
                        fillOpacity={0.3}
                      />
                    );
                  })}
                  
                  <Legend />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: '#1a1a1a',
                      borderColor: '#333',
                      borderRadius: '5px',
                      color: 'white'
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DriverComparisonChart;

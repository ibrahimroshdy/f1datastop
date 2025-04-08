
import { useState, useEffect } from "react";
import { LineChart, Line, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { XAxis, YAxis } from "@/utils/rechartsWrapper";
import { useRaceQualifying } from "@/hooks/useF1Data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Clock3 } from "lucide-react";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";

interface QualifyingAnalyticsProps {
  year: number;
  round: string;
}

const QualifyingAnalytics = ({ year, round }: QualifyingAnalyticsProps) => {
  const { data: qualifyingData, isLoading } = useRaceQualifying(year, round);
  const [displayMode, setDisplayMode] = useState<string>("q3");
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  
  useEffect(() => {
    // Reset selected drivers when data changes
    setSelectedDrivers([]);
  }, [year, round]);
  
  const convertLapTimeToSeconds = (lapTime: string): number => {
    if (!lapTime) return 0;
    
    const parts = lapTime.includes(':') 
      ? lapTime.split(':') 
      : ['0', lapTime];
    
    if (parts.length !== 2) return 0;
    
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    
    return minutes * 60 + seconds;
  };
  
  const formatTime = (seconds: number): string => {
    if (!seconds) return "No Time";
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
  };
  
  const processQualifyingData = () => {
    if (!qualifyingData?.data?.QualifyingResults) {
      return { drivers: [], chartData: [] };
    }
    
    const results = qualifyingData.data.QualifyingResults;
    
    // Process drivers for selection
    const drivers = results.map((result: any) => {
      const driver = result.Driver;
      const constructor = result.Constructor;
      
      return {
        code: driver.code || driver.familyName.substring(0, 3).toUpperCase(),
        name: `${driver.givenName} ${driver.familyName}`,
        constructorId: constructor.constructorId.toLowerCase(),
        color: TEAM_COLORS[constructor.constructorId.toLowerCase()] || "#ffffff",
        driverId: driver.driverId
      };
    }).sort((a: any, b: any) => a.name.localeCompare(b.name));
    
    // Process qualifying times
    const chartData = results.map((result: any) => {
      const driver = result.Driver;
      const constructor = result.Constructor;
      const driverCode = driver.code || driver.familyName.substring(0, 3).toUpperCase();
      const driverId = driver.driverId;
      
      return {
        driver: driverCode,
        driverId,
        position: parseInt(result.position),
        q1Time: result.Q1 ? convertLapTimeToSeconds(result.Q1) : null,
        q2Time: result.Q2 ? convertLapTimeToSeconds(result.Q2) : null,
        q3Time: result.Q3 ? convertLapTimeToSeconds(result.Q3) : null,
        q1: result.Q1 || "No Time",
        q2: result.Q2 || "No Time",
        q3: result.Q3 || "No Time",
        constructorId: constructor.constructorId.toLowerCase(),
        color: TEAM_COLORS[constructor.constructorId.toLowerCase()] || "#ffffff"
      };
    }).sort((a: any, b: any) => a.position - b.position);
    
    return { drivers, chartData };
  };
  
  const { drivers, chartData } = processQualifyingData();
  
  // Filter chart data based on selected drivers
  const filteredChartData = selectedDrivers.length > 0 
    ? chartData.filter((item: any) => selectedDrivers.includes(item.driverId))
    : chartData;
  
  const toggleDriverSelection = (driverId: string) => {
    if (selectedDrivers.includes(driverId)) {
      setSelectedDrivers(selectedDrivers.filter(id => id !== driverId));
    } else {
      setSelectedDrivers([...selectedDrivers, driverId]);
    }
  };
  
  const getMinMaxValues = () => {
    if (filteredChartData.length === 0) return { min: 0, max: 100 };
    
    let min = Infinity;
    let max = 0;
    
    filteredChartData.forEach((item: any) => {
      const q1 = item.q1Time;
      const q2 = item.q2Time;
      const q3 = item.q3Time;
      
      if (q1 && q1 < min) min = q1;
      if (q2 && q2 < min) min = q2;
      if (q3 && q3 < min) min = q3;
      
      if (q1 && q1 > max) max = q1;
      if (q2 && q2 > max) max = q2;
      if (q3 && q3 > max) max = q3;
    });
    
    // Add a small buffer
    min = min === Infinity ? 0 : min - 0.5;
    max = max + 0.5;
    
    return { min, max };
  };
  
  const { min, max } = getMinMaxValues();
  
  const getSessionName = (mode: string) => {
    switch(mode) {
      case "q1": return "Q1";
      case "q2": return "Q2";
      case "q3": return "Q3";
      case "all": return "All Sessions";
      default: return "Q3";
    }
  };

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }
  
  if (!qualifyingData?.data?.QualifyingResults || qualifyingData.data.QualifyingResults.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
        <Clock3 className="h-16 w-16 text-gray-400 mb-4" />
        <h3 className="text-xl font-bold mb-2">No Qualifying Data Available</h3>
        <p className="text-gray-400">
          Qualifying data is not available for this race. This could be because qualifying hasn't occurred yet
          or the data wasn't recorded properly.
        </p>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center">
          <span className="text-sm text-gray-400 mr-2">View:</span>
          <Select value={displayMode} onValueChange={setDisplayMode}>
            <SelectTrigger className="w-[140px] bg-f1-black border-gray-700">
              <SelectValue placeholder={getSessionName(displayMode)} />
            </SelectTrigger>
            <SelectContent className="bg-f1-black border-gray-700">
              <SelectItem value="q1">Q1 Only</SelectItem>
              <SelectItem value="q2">Q2 Only</SelectItem>
              <SelectItem value="q3">Q3 Only</SelectItem>
              <SelectItem value="all">All Sessions</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex-1"></div>
        
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-400 mr-1">Filter Drivers:</span>
          <div className="flex flex-wrap gap-1">
            {drivers.map((driver: any) => (
              <Badge 
                key={driver.driverId}
                variant={selectedDrivers.includes(driver.driverId) ? "default" : "outline"}
                onClick={() => toggleDriverSelection(driver.driverId)}
                className="cursor-pointer"
                style={{ 
                  backgroundColor: selectedDrivers.includes(driver.driverId) ? driver.color : 'transparent',
                  borderColor: driver.color,
                  color: selectedDrivers.includes(driver.driverId) ? "#000000" : driver.color
                }}
              >
                {driver.code}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={filteredChartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis 
              dataKey="driver"
              padding={{ left: 30, right: 30 }}
            />
            <YAxis 
              domain={[min, max]}
              tickFormatter={formatTime}
              label={{ value: 'Lap Time', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value: any) => [formatTime(value), 'Time']}
              contentStyle={{ 
                backgroundColor: '#1a1a1a',
                borderColor: '#333',
                borderRadius: '5px'
              }}
            />
            <Legend />
            
            {(displayMode === "q1" || displayMode === "all") && (
              <Line 
                type="monotone" 
                dataKey="q1Time" 
                name="Q1" 
                stroke="#8884d8" 
                activeDot={{ r: 8 }}
                connectNulls
              />
            )}
            
            {(displayMode === "q2" || displayMode === "all") && (
              <Line 
                type="monotone" 
                dataKey="q2Time" 
                name="Q2" 
                stroke="#82ca9d" 
                activeDot={{ r: 8 }}
                connectNulls
              />
            )}
            
            {(displayMode === "q3" || displayMode === "all") && (
              <Line 
                type="monotone" 
                dataKey="q3Time" 
                name="Q3" 
                stroke="#ffc658" 
                activeDot={{ r: 8 }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-4 text-left text-sm">Pos</th>
              <th className="py-2 px-4 text-left text-sm">Driver</th>
              <th className="py-2 px-4 text-left text-sm">Q1</th>
              <th className="py-2 px-4 text-left text-sm">Q2</th>
              <th className="py-2 px-4 text-left text-sm">Q3</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((item: any) => (
              <tr 
                key={item.driverId}
                className={`border-b border-gray-800 hover:bg-gray-900 ${
                  selectedDrivers.includes(item.driverId) ? 'bg-gray-800' : ''
                }`}
                onClick={() => toggleDriverSelection(item.driverId)}
                style={{ cursor: 'pointer' }}
              >
                <td className="py-2 px-4 text-sm">{item.position}</td>
                <td className="py-2 px-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    ></div>
                    {item.driver}
                  </div>
                </td>
                <td className="py-2 px-4 text-sm">{item.q1}</td>
                <td className="py-2 px-4 text-sm">{item.q2}</td>
                <td className="py-2 px-4 text-sm">{item.q3}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QualifyingAnalytics;

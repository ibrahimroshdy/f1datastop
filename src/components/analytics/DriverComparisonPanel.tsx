import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { XAxis, YAxis, ReferenceLine } from '@/utils/rechartsWrapper';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";

interface DriverComparisonPanelProps {
  lapTimesData: any;
  tireStrategyData: any;
  isLapTimesLoading: boolean;
  isTireDataLoading: boolean;
  selectedRace: string;
  setSelectedRace: (value: string) => void;
}

const DriverComparisonPanel = ({ 
  lapTimesData,
  tireStrategyData,
  isLapTimesLoading,
  isTireDataLoading,
  selectedRace,
  setSelectedRace
}: DriverComparisonPanelProps) => {
  const [selectedDriver1, setSelectedDriver1] = useState("VER");
  const [selectedDriver2, setSelectedDriver2] = useState("HAM");
  const [selectedMetric, setSelectedMetric] = useState("lapTimes");

  const formatTime = (seconds: number | string) => {
    if (typeof seconds === 'string') return seconds;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
  };

  const getLapTimeChartData = () => {
    if (!lapTimesData?.data) return [];
    
    const driver1Data = lapTimesData.data.find((d: any) => d.driver === selectedDriver1)?.laps || [];
    const driver2Data = lapTimesData.data.find((d: any) => d.driver === selectedDriver2)?.laps || [];
    
    return driver1Data.map((lap: any, index: number) => {
      const driver2Lap = driver2Data[index] || { lap: lap.lap, time: 0 };
      return {
        lap: lap.lap,
        [selectedDriver1]: lap.time,
        [selectedDriver2]: driver2Lap.time
      };
    });
  };

  const getTireStrategyData = () => {
    if (!tireStrategyData?.data) return [];
    
    return tireStrategyData.data.map((driver: any) => {
      const totalLaps = driver.strategy.reduce((sum: number, stint: any) => sum + stint.laps, 0);
      
      const result = [];
      let currentLap = 0;
      
      driver.strategy.forEach((stint: any, index: number) => {
        const startLap = currentLap;
        currentLap += stint.laps;
        
        result.push({
          driver: driver.driver,
          stint: index + 1,
          compound: stint.tire,
          startLap,
          endLap: currentLap,
          laps: stint.laps,
        });
      });
      
      return { driver: driver.driver, totalLaps, stints: result };
    });
  };

  return (
    <Card className="md:col-span-3">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Driver Comparison</span>
          <div className="flex gap-4">
            <Select value={selectedDriver1} onValueChange={setSelectedDriver1}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Driver 1" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VER">VER</SelectItem>
                <SelectItem value="HAM">HAM</SelectItem>
                <SelectItem value="LEC">LEC</SelectItem>
                <SelectItem value="SAI">SAI</SelectItem>
                <SelectItem value="PER">PER</SelectItem>
                <SelectItem value="RUS">RUS</SelectItem>
                <SelectItem value="NOR">NOR</SelectItem>
                <SelectItem value="PIA">PIA</SelectItem>
                <SelectItem value="ALO">ALO</SelectItem>
                <SelectItem value="STR">STR</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={selectedDriver2} onValueChange={setSelectedDriver2}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Driver 2" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VER">VER</SelectItem>
                <SelectItem value="HAM">HAM</SelectItem>
                <SelectItem value="LEC">LEC</SelectItem>
                <SelectItem value="SAI">SAI</SelectItem>
                <SelectItem value="PER">PER</SelectItem>
                <SelectItem value="RUS">RUS</SelectItem>
                <SelectItem value="NOR">NOR</SelectItem>
                <SelectItem value="PIA">PIA</SelectItem>
                <SelectItem value="ALO">ALO</SelectItem>
                <SelectItem value="STR">STR</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={selectedRace} onValueChange={setSelectedRace}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Race" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bahrain">Bahrain</SelectItem>
                <SelectItem value="jeddah">Saudi Arabia</SelectItem>
                <SelectItem value="australia">Australia</SelectItem>
                <SelectItem value="japan">Japan</SelectItem>
                <SelectItem value="china">China</SelectItem>
                <SelectItem value="miami">Miami</SelectItem>
                <SelectItem value="monaco">Monaco</SelectItem>
                <SelectItem value="spain">Spain</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Metric" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lapTimes">Lap Times</SelectItem>
                <SelectItem value="tireStrategy">Tire Strategy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {selectedMetric === "lapTimes" ? (
          <div className="h-[400px]">
            {isLapTimesLoading ? (
              <div className="flex items-center justify-center h-full">
                <Skeleton className="h-full w-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={getLapTimeChartData()}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="lap" 
                    label={{ value: 'Lap Number', position: 'insideBottomRight', offset: -10 }} 
                  />
                  <YAxis 
                    label={{ value: 'Lap Time (seconds)', angle: -90, position: 'insideLeft' }} 
                    domain={['dataMin - 1', 'dataMax + 1']} 
                  />
                  <Tooltip formatter={(value) => {
                    if (typeof value === 'number') {
                      return [formatTime(value), 'Lap Time'];
                    }
                    return [value, ''];
                  }} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey={selectedDriver1} 
                    stroke={DRIVER_COLORS[selectedDriver1] || "#ff0000"} 
                    activeDot={{ r: 8 }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey={selectedDriver2} 
                    stroke={DRIVER_COLORS[selectedDriver2] || "#0000ff"} 
                    activeDot={{ r: 8 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        ) : (
          <div className="h-[400px]">
            {isTireDataLoading ? (
              <div className="flex items-center justify-center h-full">
                <Skeleton className="h-full w-full" />
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {getTireStrategyData()
                  .filter((d: any) => d.driver === selectedDriver1 || d.driver === selectedDriver2)
                  .map((driverData: any, idx: number) => (
                    <div key={driverData.driver} className="tire-strategy">
                      <h3 className="font-medium mb-2">{driverData.driver} - Tire Strategy</h3>
                      <div className="flex w-full h-8 rounded-md overflow-hidden">
                        {driverData.stints.map((stint: any, i: number) => {
                          const width = (stint.laps / driverData.totalLaps) * 100;
                          const bgColor = 
                            stint.compound === "SOFT" ? "bg-red-600" : 
                            stint.compound === "MEDIUM" ? "bg-yellow-500" : 
                            stint.compound === "HARD" ? "bg-white" : 
                            "bg-green-500"; // For wet/intermediate
                          
                          return (
                            <div 
                              key={i} 
                              className={`${bgColor} relative`}
                              style={{ width: `${width}%` }}
                            >
                              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-black">
                                {stint.compound[0]}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-1 text-xs text-gray-400">
                        <span>Lap 1</span>
                        <span>Lap {driverData.totalLaps}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DriverComparisonPanel;

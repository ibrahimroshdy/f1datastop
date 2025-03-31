
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Scatter,
  ScatterChart,
  ZAxis,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFastestLaps, useTopSpeeds, useLapTimes, useTireStrategies } from "@/hooks/useFastF1Data";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PointsProgressChart from "@/components/analytics/PointsProgressChart";
import TeamPerformanceChart from "@/components/analytics/TeamPerformanceChart";
import DriverComparisonChart from "@/components/analytics/DriverComparisonChart";
import ConstructorDominanceChart from "@/components/analytics/ConstructorDominanceChart";

const colors = {
  "red_bull": "#0600EF",
  "ferrari": "#DC0000",
  "mercedes": "#00D2BE",
  "mclaren": "#FF8700",
  "aston_martin": "#006F62",
  "alpine": "#0090FF",
  "alphatauri": "#2B4562",
  "haas": "#FFFFFF",
  "williams": "#005AFF",
  "alfa": "#900000",
  "VER": "#0600EF",
  "PER": "#0600EF",
  "LEC": "#DC0000",
  "SAI": "#DC0000",
  "HAM": "#00D2BE",
  "RUS": "#00D2BE",
  "NOR": "#FF8700",
  "PIA": "#FF8700",
  "ALO": "#006F62",
  "STR": "#006F62",
};

const RACECOLORS = [
  "#ff5f5f", "#5f5fff", "#5fff5f", "#ff5fff", "#5fffff", "#ffff5f",
  "#ff7f7f", "#7f7fff", "#7fff7f", "#ff7fff", "#7fffff", "#ffff7f",
  "#ff9f9f", "#9f9fff", "#9fff9f", "#ff9fff", "#9fffff", "#ffff9f",
  "#ffbfbf", "#bfbfff", "#bfffbf", "#ffbfff", "#bfffff", "#ffffbf",
];

const Analytics = () => {
  const [selectedRace, setSelectedRace] = useState("monaco"); // Default race
  const [selectedDriver1, setSelectedDriver1] = useState("VER");
  const [selectedDriver2, setSelectedDriver2] = useState("HAM");
  const [selectedMetric, setSelectedMetric] = useState("lapTimes");
  
  const { data: fastestLapsData, isLoading: isLapsLoading } = useFastestLaps();
  const { data: topSpeedsData, isLoading: isSpeedsLoading } = useTopSpeeds();
  const { data: lapTimesData, isLoading: isLapTimesLoading } = useLapTimes(selectedRace);
  const { data: tireStrategyData, isLoading: isTireDataLoading } = useTireStrategies(selectedRace);

  // Get current year for the UI
  const currentYear = new Date().getFullYear();

  // Transform lap time data for selected drivers
  const getLapTimeChartData = () => {
    if (!lapTimesData?.data) return [];
    
    const driver1Data = lapTimesData.data.find(d => d.driver === selectedDriver1)?.laps || [];
    const driver2Data = lapTimesData.data.find(d => d.driver === selectedDriver2)?.laps || [];
    
    return driver1Data.map((lap, index) => {
      const driver2Lap = driver2Data[index] || { lap: lap.lap, time: 0 };
      return {
        lap: lap.lap,
        [selectedDriver1]: lap.time,
        [selectedDriver2]: driver2Lap.time
      };
    });
  };
  
  // Transform tire strategy data
  const getTireStrategyData = () => {
    if (!tireStrategyData?.data) return [];
    
    return tireStrategyData.data.map(driver => {
      // Calculate total race distance for this driver
      const totalLaps = driver.strategy.reduce((sum, stint) => sum + stint.laps, 0);
      
      // Convert to a chart-friendly format
      const result = [];
      let currentLap = 0;
      
      driver.strategy.forEach((stint, index) => {
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
  
  // Helper to format time in seconds to MM:SS.sss
  const formatTime = (seconds: number | string) => {
    if (typeof seconds === 'string') return seconds;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
  };
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">F1 Analytics</h1>
          <p className="text-muted-foreground">
            Analyze Formula 1 performance data for the {currentYear} season
          </p>
        </div>
        
        <Tabs defaultValue="performance">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="comparison">Driver Comparison</TabsTrigger>
            <TabsTrigger value="simulation">Season Simulation</TabsTrigger>
          </TabsList>
          
          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Fastest Laps Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Fastest Laps of {currentYear}</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLapsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-[300px] w-full" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={fastestLapsData?.data?.slice(0, 10)}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                        <YAxis 
                          dataKey="driver" 
                          type="category" 
                          tick={{ fontSize: 12 }} 
                          width={40} 
                        />
                        <Tooltip 
                          formatter={(value: any) => {
                            return typeof value === 'number' 
                              ? [`${formatTime(value)}`, 'Lap Time'] 
                              : [value, ''];
                          }}
                        />
                        <Legend />
                        <Bar dataKey="fastestLap" name="Lap Time (seconds)" fill="#f1453d">
                          {fastestLapsData?.data?.slice(0, 10).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={colors[entry.driver] || RACECOLORS[index % RACECOLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              
              {/* Top Speeds Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Speeds of {currentYear}</CardTitle>
                </CardHeader>
                <CardContent>
                  {isSpeedsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-[300px] w-full" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={topSpeedsData?.data?.slice(0, 10)}
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="driver" />
                        <YAxis domain={['auto', 'auto']} />
                        <Tooltip formatter={(value) => [`${String(value)} km/h`, 'Top Speed']} />
                        <Legend />
                        <Bar dataKey="topSpeed" name="Speed (km/h)" fill="#3498db">
                          {topSpeedsData?.data?.slice(0, 10).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={colors[entry.driver] || RACECOLORS[index % RACECOLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Points Progress Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Driver Points Progression</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[400px]">
                  <PointsProgressChart />
                </div>
              </CardContent>
            </Card>
            
            {/* Constructor Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Constructor Performance</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[400px]">
                  <TeamPerformanceChart />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Comparison Tab */}
          <TabsContent value="comparison" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                            <XAxis dataKey="lap" label={{ value: 'Lap Number', position: 'insideBottomRight', offset: -10 }} />
                            <YAxis label={{ value: 'Lap Time (seconds)', angle: -90, position: 'insideLeft' }} domain={['dataMin - 1', 'dataMax + 1']} />
                            <Tooltip formatter={(value) => {
                              if (typeof value === 'number') {
                                return [formatTime(value), 'Lap Time'];
                              }
                              return [value, ''];
                            }} />
                            <Legend />
                            <Line type="monotone" dataKey={selectedDriver1} stroke={colors[selectedDriver1] || "#ff0000"} activeDot={{ r: 8 }} />
                            <Line type="monotone" dataKey={selectedDriver2} stroke={colors[selectedDriver2] || "#0000ff"} activeDot={{ r: 8 }} />
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
                            .filter(d => d.driver === selectedDriver1 || d.driver === selectedDriver2)
                            .map((driverData, idx) => (
                              <div key={driverData.driver} className="tire-strategy">
                                <h3 className="font-medium mb-2">{driverData.driver} - Tire Strategy</h3>
                                <div className="flex w-full h-8 rounded-md overflow-hidden">
                                  {driverData.stints.map((stint, i) => {
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
              
              <Card className="md:col-span-3">
                <CardHeader>
                  <CardTitle>Side-by-Side Performance</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-[400px]">
                    <DriverComparisonChart />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Simulation Tab */}
          <TabsContent value="simulation" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Constructor Win Probability</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ConstructorDominanceChart />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Championship Prediction</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart outerRadius={90} width={730} height={250} data={[
                      { subject: 'Verstappen', A: 120, fullMark: 150 },
                      { subject: 'Perez', A: 98, fullMark: 150 },
                      { subject: 'Hamilton', A: 86, fullMark: 150 },
                      { subject: 'Leclerc', A: 99, fullMark: 150 },
                      { subject: 'Sainz', A: 85, fullMark: 150 },
                      { subject: 'Norris', A: 65, fullMark: 150 },
                    ]}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" />
                      <PolarRadiusAxis angle={90} domain={[0, 150]} />
                      <Radar name="Championship Points" dataKey="A" stroke="#f1453d" fill="#f1453d" fillOpacity={0.6} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Performance Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart
                      margin={{ top: 20, right: 20, bottom: 10, left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="qualifying" name="Qualifying" unit="s" />
                      <YAxis dataKey="race" name="Race Pace" unit="s" />
                      <ZAxis dataKey="results" name="Results" range={[30, 200]} />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value) => {
                        return typeof value === 'number' ? [value.toFixed(3), ''] : [value, ''];
                      }} />
                      <Legend />
                      <Scatter name="Red Bull" data={[
                        { qualifying: 92.1, race: 97.2, results: 150, driver: 'VER' },
                        { qualifying: 92.7, race: 98.1, results: 120, driver: 'PER' },
                      ]} fill="#0600EF" />
                      <Scatter name="Ferrari" data={[
                        { qualifying: 92.2, race: 97.6, results: 140, driver: 'LEC' },
                        { qualifying: 92.4, race: 97.8, results: 130, driver: 'SAI' },
                      ]} fill="#DC0000" />
                      <Scatter name="Mercedes" data={[
                        { qualifying: 92.3, race: 97.5, results: 120, driver: 'HAM' },
                        { qualifying: 92.6, race: 97.9, results: 110, driver: 'RUS' },
                      ]} fill="#00D2BE" />
                      <Scatter name="McLaren" data={[
                        { qualifying: 92.4, race: 97.7, results: 110, driver: 'NOR' },
                        { qualifying: 92.9, race: 98.2, results: 90, driver: 'PIA' },
                      ]} fill="#FF8700" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Analytics;

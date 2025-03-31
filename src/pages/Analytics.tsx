
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useDriverStandings, useConstructorStandings } from "@/hooks/useF1Data";
import { useFastestLaps, useTopSpeeds } from "@/hooks/useFastF1Data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter } from 'recharts';
import { ChefHat, Flame, Gauge, Timer } from "lucide-react";

const Analytics = () => {
  const { data: driverStandings, isLoading: isDriversLoading } = useDriverStandings();
  const { data: constructorStandings, isLoading: isConstructorsLoading } = useConstructorStandings();
  const { data: fastestLaps, isLoading: isFastestLapsLoading } = useFastestLaps();
  const { data: topSpeeds, isLoading: isTopSpeedsLoading } = useTopSpeeds();
  
  const isLoading = isDriversLoading || isConstructorsLoading || isFastestLapsLoading || isTopSpeedsLoading;
  
  const currentYear = new Date().getFullYear();
  
  // Colors for each team
  const teamColors: Record<string, string> = {
    "Red Bull Racing": "#0600EF",
    "Ferrari": "#F91536",
    "Mercedes": "#00D2BE",
    "McLaren": "#FF8700",
    "Aston Martin": "#006F62",
    "Racing Bulls": "#2B4562",
    "Alpine": "#0090FF",
    "Williams": "#005AFF",
    "Kick Sauber": "#900000",
    "Haas F1 Team": "#FFFFFF",
  };
  
  // Process data for speed comparison chart
  const getSpeedComparisonData = () => {
    if (isLoading || !topSpeeds?.data) return [];
    
    return topSpeeds.data.slice(0, 10).map(item => ({
      name: item.driver,
      speed: item.topSpeed,
      race: item.race
    }));
  };
  
  // Process data for fastest lap comparison
  const getFastestLapData = () => {
    if (isLoading || !fastestLaps?.data) return [];
    
    return fastestLaps.data.slice(0, 10).map(item => ({
      name: item.driver,
      time: item.fastestLap,
      race: item.race
    }));
  };
  
  // Process driver standings data
  const getDriverPointsData = () => {
    if (isLoading || !driverStandings?.data) return [];
    
    return driverStandings.data.slice(0, 10).map(driver => ({
      name: driver.Driver.code,
      points: parseFloat(driver.points),
      team: driver.Constructors[0].name
    }));
  };
  
  // Process constructor standings data
  const getConstructorData = () => {
    if (isLoading || !constructorStandings?.data) return [];
    
    return constructorStandings.data.map(constructor => ({
      name: constructor.Constructor.name,
      value: parseFloat(constructor.points),
      color: teamColors[constructor.Constructor.name] || "#cccccc"
    }));
  };
  
  // Generate some race simulation data
  const getRaceSimulationData = () => {
    const driverCodes = ["VER", "HAM", "LEC", "SAI", "PER", "RUS", "NOR", "PIA", "ALO", "STR"];
    const laps = Array.from({ length: 20 }, (_, i) => i + 1);
    
    return laps.map(lap => {
      const lapData: any = { lap };
      
      driverCodes.forEach(code => {
        // Generate simulated gap to leader
        if (code === "VER") {
          lapData[code] = 0; // Leader
        } else {
          // Start with a base gap and add some randomness per lap
          const baseGap = ["HAM", "LEC", "SAI", "PER"].includes(code) ? 
            lap * 0.2 + Math.random() * 0.3 : 
            lap * 0.5 + Math.random() * 0.8;
          
          lapData[code] = parseFloat(baseGap.toFixed(1));
        }
      });
      
      return lapData;
    });
  };
  
  const speedComparisonData = getSpeedComparisonData();
  const fastestLapData = getFastestLapData();
  const driverPointsData = getDriverPointsData();
  const constructorData = getConstructorData();
  const raceSimulationData = getRaceSimulationData();
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold">F1 Analytics {currentYear}</h1>
          <p className="text-muted-foreground">Visualizations and analytics using Formula 1 data</p>
        </div>

        <Tabs defaultValue="performance" className="w-full">
          <TabsList className="grid w-full md:w-[600px] grid-cols-3">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="comparison">Driver Comparison</TabsTrigger>
            <TabsTrigger value="simulation">Race Simulation</TabsTrigger>
          </TabsList>
          
          <TabsContent value="performance" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Speed Chart */}
              <Card className="w-full">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Gauge className="h-5 w-5 text-f1-red" />
                    <CardTitle>Top Speeds</CardTitle>
                  </div>
                  <CardDescription>Highest speeds recorded in {currentYear}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[350px] w-full" />
                  ) : (
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={speedComparisonData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
                          <XAxis type="number" domain={[300, 'auto']} />
                          <YAxis type="category" dataKey="name" width={40} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1a1a1a',
                              borderColor: '#333',
                              borderRadius: '5px',
                              color: 'white'
                            }} 
                            formatter={(value) => [`${value} km/h`, "Top Speed"]}
                            labelFormatter={(value) => `${value} (${speedComparisonData.find(d => d.name === value)?.race})`}
                          />
                          <Bar 
                            dataKey="speed" 
                            fill="#f1263d" 
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Fastest Lap Chart */}
              <Card className="w-full">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Timer className="h-5 w-5 text-f1-red" />
                    <CardTitle>Fastest Laps</CardTitle>
                  </div>
                  <CardDescription>Best lap times recorded in {currentYear}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[350px] w-full" />
                  ) : (
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={fastestLapData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
                          <XAxis type="number" domain={[80, 'auto']} />
                          <YAxis type="category" dataKey="name" width={40} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1a1a1a',
                              borderColor: '#333',
                              borderRadius: '5px',
                              color: 'white'
                            }} 
                            formatter={(value) => [`${value.toFixed(3)}s`, "Lap Time"]}
                            labelFormatter={(value) => `${value} (${fastestLapData.find(d => d.name === value)?.race})`}
                          />
                          <Bar 
                            dataKey="time" 
                            fill="#0090FF" 
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Constructor Points Distribution */}
              <Card className="w-full">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <ChefHat className="h-5 w-5 text-f1-red" />
                    <CardTitle>Constructor Points</CardTitle>
                  </div>
                  <CardDescription>Points distribution among constructors</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[350px] w-full" />
                  ) : (
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={constructorData}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            outerRadius={130}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                          >
                            {constructorData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1a1a1a',
                              borderColor: '#333',
                              borderRadius: '5px',
                              color: 'white'
                            }} 
                            formatter={(value) => [`${value} points`, "Points"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Driver Points Chart */}
              <Card className="w-full">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Flame className="h-5 w-5 text-f1-red" />
                    <CardTitle>Driver Points</CardTitle>
                  </div>
                  <CardDescription>Points earned by top drivers in {currentYear}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[350px] w-full" />
                  ) : (
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={driverPointsData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1a1a1a',
                              borderColor: '#333',
                              borderRadius: '5px',
                              color: 'white'
                            }} 
                            formatter={(value) => [`${value} points`, "Points"]}
                            labelFormatter={(value) => {
                              const driver = driverPointsData.find(d => d.name === value);
                              return `${value} (${driver?.team})`;
                            }}
                          />
                          <Bar 
                            dataKey="points" 
                            fill="#f1263d" 
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="comparison" className="mt-6">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Driver Performance Metrics</CardTitle>
                <CardDescription>Visual comparison of driver performance across multiple metrics</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[500px] w-full" />
                ) : (
                  <div className="h-[500px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart outerRadius={180} data={[
                        { category: "Qualifying", VER: 90, HAM: 88, LEC: 87, NOR: 85, PER: 78 },
                        { category: "Race Pace", VER: 95, HAM: 90, LEC: 85, NOR: 82, PER: 83 },
                        { category: "Tire Management", VER: 92, HAM: 93, LEC: 80, NOR: 79, PER: 85 },
                        { category: "Wet Weather", VER: 94, HAM: 95, LEC: 82, NOR: 81, PER: 70 },
                        { category: "Overtaking", VER: 93, HAM: 88, LEC: 89, NOR: 84, PER: 79 },
                        { category: "Consistency", VER: 96, HAM: 90, LEC: 84, NOR: 85, PER: 80 },
                      ]}>
                        <PolarGrid strokeOpacity={0.2} />
                        <PolarAngleAxis dataKey="category" tick={{ fill: "white" }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="rgba(255,255,255,0.3)" />
                        
                        <Radar
                          name="Verstappen"
                          dataKey="VER"
                          stroke="#0600EF"
                          fill="#0600EF"
                          fillOpacity={0.3}
                        />
                        <Radar
                          name="Hamilton"
                          dataKey="HAM"
                          stroke="#00D2BE"
                          fill="#00D2BE"
                          fillOpacity={0.3}
                        />
                        <Radar
                          name="Leclerc"
                          dataKey="LEC"
                          stroke="#F91536"
                          fill="#F91536"
                          fillOpacity={0.3}
                        />
                        <Radar
                          name="Norris"
                          dataKey="NOR"
                          stroke="#FF8700"
                          fill="#FF8700"
                          fillOpacity={0.3}
                        />
                        <Radar
                          name="Perez"
                          dataKey="PER"
                          stroke="#6E59A5"
                          fill="#6E59A5"
                          fillOpacity={0.3}
                        />
                        
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
                )}
              </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Cornering Speed vs. Straight Line Speed</CardTitle>
                  <CardDescription>Comparison of driver performance in corners vs. straights</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[350px] w-full" />
                  ) : (
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart
                          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis type="number" dataKey="corner" name="Corner Speed" unit="km/h" domain={[170, 210]} />
                          <YAxis type="number" dataKey="straight" name="Straight Speed" unit="km/h" domain={[320, 360]} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1a1a1a',
                              borderColor: '#333',
                              borderRadius: '5px',
                              color: 'white'
                            }}
                            formatter={(value) => [`${value} km/h`, ""]}
                            cursor={{ strokeDasharray: '3 3' }}
                          />
                          <Scatter name="Ferrari" data={[
                            { corner: 190, straight: 335, driver: 'LEC' },
                            { corner: 187, straight: 338, driver: 'SAI' },
                          ]} fill="#F91536" />
                          <Scatter name="Red Bull" data={[
                            { corner: 195, straight: 340, driver: 'VER' },
                            { corner: 188, straight: 343, driver: 'PER' },
                          ]} fill="#0600EF" />
                          <Scatter name="Mercedes" data={[
                            { corner: 192, straight: 330, driver: 'HAM' },
                            { corner: 190, straight: 328, driver: 'RUS' },
                          ]} fill="#00D2BE" />
                          <Scatter name="McLaren" data={[
                            { corner: 193, straight: 336, driver: 'NOR' },
                            { corner: 186, straight: 334, driver: 'PIA' },
                          ]} fill="#FF8700" />
                          <Legend />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Qualifying vs. Race Performance</CardTitle>
                  <CardDescription>Comparison of qualifying position vs. race finish position</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[350px] w-full" />
                  ) : (
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart
                          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis type="number" dataKey="qualifying" name="Qualifying Position" reversed domain={[20, 1]} />
                          <YAxis type="number" dataKey="race" name="Race Position" reversed domain={[20, 1]} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1a1a1a',
                              borderColor: '#333',
                              borderRadius: '5px',
                              color: 'white'
                            }}
                            formatter={(value, name) => [`Position ${value}`, name]}
                            cursor={{ strokeDasharray: '3 3' }}
                          />
                          {/* Improvement line */}
                          <Line type="monotone" dataKey="same" stroke="gray" strokeDasharray="3 3" dot={false} activeDot={false} />
                          <Scatter name="Ferrari" data={[
                            { qualifying: 2, race: 3, driver: 'LEC' },
                            { qualifying: 3, race: 2, driver: 'SAI' },
                          ]} fill="#F91536" />
                          <Scatter name="Red Bull" data={[
                            { qualifying: 1, race: 1, driver: 'VER' },
                            { qualifying: 4, race: 4, driver: 'PER' },
                          ]} fill="#0600EF" />
                          <Scatter name="Mercedes" data={[
                            { qualifying: 6, race: 3, driver: 'HAM' },
                            { qualifying: 7, race: 5, driver: 'RUS' },
                          ]} fill="#00D2BE" />
                          <Scatter name="McLaren" data={[
                            { qualifying: 5, race: 5, driver: 'NOR' },
                            { qualifying: 8, race: 8, driver: 'PIA' },
                          ]} fill="#FF8700" />
                          <Legend />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="simulation" className="mt-6">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Race Gap Simulation</CardTitle>
                <CardDescription>Time gap to leader during race simulation</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[500px] w-full" />
                ) : (
                  <div className="h-[500px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={raceSimulationData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="lap" label={{ value: 'Lap', position: 'insideBottomRight', offset: -10 }} />
                        <YAxis label={{ value: 'Gap to Leader (sec)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1a1a1a',
                            borderColor: '#333',
                            borderRadius: '5px',
                            color: 'white'
                          }}
                          formatter={(value) => [`${parseFloat(value).toFixed(2)}s`, ""]}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="VER" name="Verstappen" stroke="#0600EF" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="HAM" name="Hamilton" stroke="#00D2BE" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="LEC" name="Leclerc" stroke="#F91536" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="SAI" name="Sainz" stroke="#F91536" dot={false} strokeWidth={1} strokeDasharray="5 5" />
                        <Line type="monotone" dataKey="PER" name="Perez" stroke="#0600EF" dot={false} strokeWidth={1} strokeDasharray="5 5" />
                        <Line type="monotone" dataKey="RUS" name="Russell" stroke="#00D2BE" dot={false} strokeWidth={1} strokeDasharray="5 5" />
                        <Line type="monotone" dataKey="NOR" name="Norris" stroke="#FF8700" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="PIA" name="Piastri" stroke="#FF8700" dot={false} strokeWidth={1} strokeDasharray="5 5" />
                        <Line type="monotone" dataKey="ALO" name="Alonso" stroke="#006F62" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="STR" name="Stroll" stroke="#006F62" dot={false} strokeWidth={1} strokeDasharray="5 5" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Tire Strategy Simulation</CardTitle>
                  <CardDescription>Various tire strategy simulations and their effect on race time</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[350px] w-full" />
                  ) : (
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis type="number" domain={[1, 50]} label={{ value: 'Lap', position: 'insideBottomRight', offset: -10 }} />
                          <YAxis label={{ value: 'Lap Time (sec)', angle: -90, position: 'insideLeft' }} domain={[80, 90]} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1a1a1a',
                              borderColor: '#333',
                              borderRadius: '5px',
                              color: 'white'
                            }}
                          />
                          <Legend />
                          <Line 
                            data={Array.from({ length: 50 }, (_, i) => ({
                              lap: i + 1,
                              time: i < 20 ? 83 + (i * 0.1) : i < 22 ? 88 : 83 + ((i - 22) * 0.08),
                              strategy: "One Stop (M-H)"
                            }))} 
                            type="monotone" 
                            dataKey="time" 
                            name="One Stop (M-H)" 
                            stroke="#FEF7CD" 
                            dot={false} 
                          />
                          <Line 
                            data={Array.from({ length: 50 }, (_, i) => ({
                              lap: i + 1,
                              time: i < 15 ? 82.5 + (i * 0.15) : i < 17 ? 88 : i < 32 ? 82.8 + ((i - 17) * 0.12) : i < 34 ? 88 : 83 + ((i - 34) * 0.08),
                              strategy: "Two Stop (S-M-S)"
                            }))} 
                            type="monotone" 
                            dataKey="time" 
                            name="Two Stop (S-M-S)" 
                            stroke="#F91536" 
                            dot={false} 
                          />
                          <Line 
                            data={Array.from({ length: 50 }, (_, i) => ({
                              lap: i + 1,
                              time: i < 25 ? 83.2 + (i * 0.08) : i < 27 ? 88 : 83.4 + ((i - 27) * 0.07),
                              strategy: "One Stop (H-M)"
                            }))} 
                            type="monotone" 
                            dataKey="time" 
                            name="One Stop (H-M)" 
                            stroke="#FFFFFF" 
                            dot={false} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Pit Stop Timing Analysis</CardTitle>
                  <CardDescription>Effect of pit stop timing on race position</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[350px] w-full" />
                  ) : (
                    <div className="h-[350px] w-full">
                      <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <Badge className="bg-f1-red">Optimal Window</Badge>
                              <span className="ml-2 text-sm">Lap 15-18</span>
                            </div>
                            <span className="text-sm">+0.0s race time</span>
                          </div>
                          <div className="h-8 bg-gray-800 rounded-md overflow-hidden">
                            <div className="bg-f1-red h-full" style={{ width: '15%' }}></div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <Badge className="bg-amber-600">Early Stop</Badge>
                              <span className="ml-2 text-sm">Lap 10-14</span>
                            </div>
                            <span className="text-sm">+3.2s race time</span>
                          </div>
                          <div className="h-8 bg-gray-800 rounded-md overflow-hidden">
                            <div className="bg-amber-600 h-full" style={{ width: '65%' }}></div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <Badge className="bg-blue-600">Late Stop</Badge>
                              <span className="ml-2 text-sm">Lap 19-25</span>
                            </div>
                            <span className="text-sm">+2.1s race time</span>
                          </div>
                          <div className="h-8 bg-gray-800 rounded-md overflow-hidden">
                            <div className="bg-blue-600 h-full" style={{ width: '45%' }}></div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <Badge className="bg-gray-600">Very Late</Badge>
                              <span className="ml-2 text-sm">Lap 26+</span>
                            </div>
                            <span className="text-sm">+7.8s race time</span>
                          </div>
                          <div className="h-8 bg-gray-800 rounded-md overflow-hidden">
                            <div className="bg-gray-600 h-full" style={{ width: '90%' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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

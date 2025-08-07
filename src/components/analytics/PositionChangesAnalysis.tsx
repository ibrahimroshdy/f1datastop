import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { LineChart, Line, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { XAxis, YAxis } from '@/utils/rechartsWrapper';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { getRaceResults, getLapTimes } from "@/services/f1Service";
import { toast } from "sonner";

interface PositionChangesAnalysisProps {
  year: number;
}

const PositionChangesAnalysis = ({ year }: PositionChangesAnalysisProps) => {
  // Helper function to get line style for drivers from the same team
  const getLineStyle = (currentDriver: any, allSelectedDrivers: any[]): { strokeDasharray?: string, dot?: any } => {
    // Find all drivers from the same team that are currently selected
    const sameTeamDrivers = allSelectedDrivers.filter(d => d.team === currentDriver.team);
    
    // If only one driver from this team, use solid line with default dots
    if (sameTeamDrivers.length <= 1) {
      return { 
        strokeDasharray: undefined,
        dot: { r: 3 }
      };
    }
    
    // Find the index of current driver among same-team drivers (sorted by code for consistency)
    const sortedSameTeamDrivers = sameTeamDrivers.sort((a, b) => a.code.localeCompare(b.code));
    const driverIndex = sortedSameTeamDrivers.findIndex(d => d.code === currentDriver.code);
    
    // Return different styles for each driver from the same team
    const lineStyles = [
      { strokeDasharray: undefined, dot: { r: 3 } },                    // Solid line with circles
      { strokeDasharray: "5 5", dot: { r: 3, fill: "transparent", strokeWidth: 2 } }, // Dashed line with hollow circles
      { strokeDasharray: "10 5 5 5", dot: { r: 4, symbol: "square" } }, // Dash-dot line with squares
      { strokeDasharray: "15 5 5 5 5 5", dot: { r: 3, symbol: "triangle" } }, // Dash-dot-dot with triangles
    ];
    
    return lineStyles[driverIndex] || { strokeDasharray: "3 3", dot: { r: 2 } }; // Fallback
  };

  const { data: raceScheduleData, isLoading: isScheduleLoading } = useRaceSchedule(year);
  const [selectedRace, setSelectedRace] = useState<string>("");
  const [positionData, setPositionData] = useState<any[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>(["VER", "HAM", "LEC"]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);

  useEffect(() => {
    if (raceScheduleData?.data && raceScheduleData.data.length > 0 && !selectedRace) {
      const sortedRaces = [...raceScheduleData.data].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const lastCompletedRace = sortedRaces
        .filter(race => new Date(race.date) < new Date())
        .pop();
        
      if (lastCompletedRace) {
        setSelectedRace(lastCompletedRace.round);
      } else if (sortedRaces.length > 0) {
        setSelectedRace(sortedRaces[0].round);
      }
    }
  }, [raceScheduleData, selectedRace]);

  useEffect(() => {
    if (selectedRace) {
      setIsLoading(true);
      setError(null);
      
      getRaceResults(year, selectedRace)
        .then(results => {
          if (results?.data?.Results) {
            const drivers = results.data.Results.map((result: any) => ({
              driverId: result.Driver.driverId,
              code: result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase(),
              name: `${result.Driver.givenName} ${result.Driver.familyName}`,
              team: result.Constructor?.constructorId || "unknown",
            }));
            
            setAvailableDrivers(drivers);
            
            return getLapTimes(year, selectedRace);
          } else {
            throw new Error("No race results found");
          }
        })
        .then(lapData => {
          if (lapData?.data?.Races && lapData.data.Races.length > 0) {
            const race = lapData.data.Races[0];
            
            if (race.Laps && race.Laps.length > 0) {
              const driverPositions: Record<string, any[]> = {};
              
              race.Laps.forEach((lap: any) => {
                const lapNumber = parseInt(lap.number);
                
                lap.Timings.forEach((timing: any) => {
                  const driverId = timing.driverId;
                  const position = parseInt(timing.position);
                  
                  if (!driverPositions[driverId]) {
                    driverPositions[driverId] = [];
                  }
                  
                  driverPositions[driverId].push({
                    lap: lapNumber,
                    position: position
                  });
                });
              });
              
              const lapsCount = race.Laps.length;
              const positionByLap = Array.from({ length: lapsCount }, (_, i) => ({
                lap: i + 1,
              }));
              
              Object.entries(driverPositions).forEach(([driverId, positions]) => {
                const driver = availableDrivers.find(d => d.driverId === driverId);
                const driverCode = driver?.code || driverId.substring(0, 3).toUpperCase();
                
                positions.forEach(pos => {
                  const lapIndex = pos.lap - 1;
                  if (lapIndex < positionByLap.length) {
                    positionByLap[lapIndex][driverCode] = pos.position;
                  }
                });
              });
              
              setPositionData(positionByLap);
            } else {
              setError("No lap data available for this race");
              setPositionData([]);
            }
          } else {
            setError("No lap data available");
            setPositionData([]);
          }
        })
        .catch(error => {
          console.error("Error fetching position data:", error);
          setError("Failed to load position data");
          setPositionData([]);
          toast.error("Failed to load position data");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [selectedRace, year, availableDrivers]);

  const handleRaceChange = (value: string) => {
    setSelectedRace(value);
  };

  const handleDriverToggle = (driverCode: string) => {
    setSelectedDrivers(prev => 
      prev.includes(driverCode)
        ? prev.filter(d => d !== driverCode)
        : [...prev, driverCode]
    );
  };

  const removeFlag = (raceName: string) => {
    if (raceName && raceName.length > 3 && raceName.indexOf(' ') > 0) {
      return raceName.substring(raceName.indexOf(' ') + 1);
    }
    return raceName;
  };

  const getRaceName = () => {
    if (!raceScheduleData?.data) return "Loading...";
    const race = raceScheduleData.data.find(race => race.round === selectedRace);
    return race ? removeFlag(race.raceName) : "Unknown Race";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <CardTitle>Position Changes During Race</CardTitle>
            <CardDescription>Track how drivers' positions change throughout the race</CardDescription>
          </div>
          <Select 
            value={selectedRace} 
            onValueChange={handleRaceChange}
            disabled={isScheduleLoading || isLoading}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select a race" />
            </SelectTrigger>
            <SelectContent>
              {isScheduleLoading ? (
                <SelectItem value="loading">Loading...</SelectItem>
              ) : (
                raceScheduleData?.data?.map((race) => (
                  <SelectItem key={race.round} value={race.round}>
                    {race.raceName && removeFlag(race.raceName)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : error || positionData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <p className="text-muted-foreground">
              {error || `No position data available for ${getRaceName()}`}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This could be because the race hasn't occurred yet or position data wasn't recorded.
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              {availableDrivers.map(driver => (
                <button
                  key={driver.code}
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    selectedDrivers.includes(driver.code)
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                  onClick={() => handleDriverToggle(driver.code)}
                  style={{
                    borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666'}`
                  }}
                >
                  {driver.code}
                </button>
              ))}
            </div>
            
            <div className="h-[350px] sm:h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={positionData}
                  margin={{ 
                    top: window.innerWidth < 640 ? 15 : 20, 
                    right: window.innerWidth < 640 ? 15 : 30, 
                    left: window.innerWidth < 640 ? 15 : 20, 
                    bottom: 5 
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis 
                    dataKey="lap" 
                    label={{ 
                      value: 'Lap Number', 
                      position: 'insideBottomRight', 
                      offset: -10,
                      style: { fontSize: window.innerWidth < 640 ? '11px' : '12px' }
                    }} 
                    tick={{ fontSize: window.innerWidth < 640 ? 10 : 12 }}
                    xAxisId="lap"
                  />
                  <YAxis 
                    reversed 
                    domain={[1, 20]} 
                    label={{ 
                      value: 'Position', 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { fontSize: window.innerWidth < 640 ? '11px' : '12px' }
                    }} 
                    tick={{ fontSize: window.innerWidth < 640 ? 10 : 12 }}
                    yAxisId="position"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1a1a1a',
                      borderColor: '#333',
                      borderRadius: '5px',
                      fontSize: window.innerWidth < 640 ? '11px' : '12px',
                      padding: window.innerWidth < 640 ? '6px' : '8px'
                    }}
                    formatter={(value) => [`Position: ${value}`, '']}
                  />
                  <Legend 
                    formatter={(value) => {
                      const driver = availableDrivers.find(d => d.code === value);
                      if (!driver) return value;
                      
                      const selectedDriversData = availableDrivers.filter(d => selectedDrivers.includes(d.code));
                      const lineStyle = getLineStyle(driver, selectedDriversData);
                      
                      // For mobile, use shorter format
                      if (window.innerWidth < 640) {
                        let styleIndicator = '';
                        if (lineStyle.strokeDasharray === "5 5") {
                          styleIndicator = '---'; // Dashed
                        } else if (lineStyle.strokeDasharray === "10 5 5 5") {
                          styleIndicator = '-·-'; // Dash-dot
                        } else if (lineStyle.strokeDasharray === "15 5 5 5 5 5") {
                          styleIndicator = '-··-'; // Dash-dot-dot
                        } else if (lineStyle.strokeDasharray === "3 3") {
                          styleIndicator = '···'; // Dotted
                        } else {
                          styleIndicator = '—'; // Solid
                        }
                        
                        let dotIndicator = '';
                        if (lineStyle.dot?.fill === "transparent") {
                          dotIndicator = '○'; // Hollow circle
                        } else {
                          dotIndicator = '●'; // Filled circle
                        }
                        
                        return `${value} ${styleIndicator}${dotIndicator}`;
                      }
                      
                      // Desktop format - full
                      let styleIndicator = '';
                      if (lineStyle.strokeDasharray === "5 5") {
                        styleIndicator = ' (---)'; // Dashed
                      } else if (lineStyle.strokeDasharray === "10 5 5 5") {
                        styleIndicator = ' (-·-)'; // Dash-dot
                      } else if (lineStyle.strokeDasharray === "15 5 5 5 5 5") {
                        styleIndicator = ' (-··-)'; // Dash-dot-dot
                      } else if (lineStyle.strokeDasharray === "3 3") {
                        styleIndicator = ' (···)'; // Dotted
                      } else {
                        styleIndicator = ' (—)'; // Solid
                      }
                      
                      let dotIndicator = '';
                      if (lineStyle.dot?.fill === "transparent") {
                        dotIndicator = ' ○'; // Hollow circle
                      } else {
                        dotIndicator = ' ●'; // Filled circle
                      }
                      
                      return `${value}${styleIndicator}${dotIndicator} (${driver.name.split(' ').pop()})`;
                    }}
                    wrapperStyle={{
                      fontSize: window.innerWidth < 640 ? '9px' : '12px',
                      paddingTop: window.innerWidth < 640 ? '3px' : '10px',
                      maxHeight: window.innerWidth < 640 ? '60px' : 'auto',
                      overflowX: window.innerWidth < 640 ? 'auto' : 'visible',
                      overflowY: window.innerWidth < 640 ? 'hidden' : 'visible',
                      whiteSpace: window.innerWidth < 640 ? 'nowrap' : 'normal'
                    }}
                  />
                  
                  {availableDrivers
                    .filter(driver => selectedDrivers.includes(driver.code))
                    .map(driver => {
                      const selectedDriversData = availableDrivers.filter(d => selectedDrivers.includes(d.code));
                      const lineStyle = getLineStyle(driver, selectedDriversData);
                      
                      return (
                        <Line
                          key={driver.code}
                          type="monotone"
                          dataKey={driver.code}
                          name={driver.code}
                          stroke={TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666"}
                          strokeWidth={2}
                          strokeDasharray={lineStyle.strokeDasharray}
                          dot={lineStyle.dot}
                          activeDot={{ r: 8 }}
                          connectNulls
                          xAxisId="lap"
                          yAxisId="position"
                        />
                      );
                    })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PositionChangesAnalysis;

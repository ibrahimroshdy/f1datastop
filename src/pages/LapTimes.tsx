
import { useState, useMemo } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from "sonner";

const seasons = Array.from({ length: 11 }, (_, i) => (2024 - i).toString());

// Function to convert lap time string (e.g., "1:30.456") to seconds (e.g., 90.456)
const lapTimeToSeconds = (lapTime: string): number => {
  if (!lapTime) return 0;
  
  const parts = lapTime.split(':');
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  } else {
    return parseFloat(lapTime);
  }
};

const LapTimes = () => {
  const [selectedSeason, setSelectedSeason] = useState("2023");
  const [selectedRace, setSelectedRace] = useState("");
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  
  const { data: races, isLoading: racesLoading } = useQuery({
    queryKey: ["lapTimeRaces", selectedSeason],
    queryFn: async () => {
      try {
        const response = await fetch(`https://api.jolpi.ca/ergast/f1/${selectedSeason}.json`);
        if (!response.ok) throw new Error("Failed to fetch races");
        const data = await response.json();
        return data.MRData?.RaceTable?.Races || [];
      } catch (error) {
        toast.error("Error loading races");
        console.error(error);
        return [];
      }
    }
  });
  
  const { data: raceResults, isLoading: driversLoading } = useQuery({
    queryKey: ["lapTimeDrivers", selectedSeason, selectedRace],
    queryFn: async () => {
      if (!selectedRace) return null;
      try {
        const response = await fetch(`https://api.jolpi.ca/ergast/f1/${selectedSeason}/${selectedRace}/results.json`);
        if (!response.ok) throw new Error("Failed to fetch race results");
        const data = await response.json();
        return data.MRData?.RaceTable?.Races?.[0] || null;
      } catch (error) {
        toast.error("Error loading race results");
        console.error(error);
        return null;
      }
    },
    enabled: !!selectedRace
  });
  
  const { data: lapTimes, isLoading: lapTimesLoading } = useQuery({
    queryKey: ["lapTimes", selectedSeason, selectedRace, selectedDrivers],
    queryFn: async () => {
      if (!selectedRace || selectedDrivers.length === 0) return null;
      
      try {
        // Fetch lap times for each selected driver
        const driverLapTimesPromises = selectedDrivers.map(async (driverId) => {
          const response = await fetch(`https://api.jolpi.ca/ergast/f1/${selectedSeason}/${selectedRace}/drivers/${driverId}/laps.json`);
          if (!response.ok) throw new Error(`Failed to fetch lap times for driver ${driverId}`);
          const data = await response.json();
          return {
            driverId,
            laps: data.MRData?.RaceTable?.Races?.[0]?.Laps || []
          };
        });
        
        const results = await Promise.all(driverLapTimesPromises);
        return results;
      } catch (error) {
        toast.error("Error loading lap times");
        console.error(error);
        return null;
      }
    },
    enabled: !!selectedRace && selectedDrivers.length > 0
  });
  
  // Process the lap times data for the chart
  const processedData = useMemo(() => {
    if (!lapTimes) return [];
    
    // Find the maximum number of laps
    const maxLaps = Math.max(...lapTimes.map(driver => 
      driver.laps.length
    ), 0);
    
    // Create an array of lap numbers
    const lapsArray = Array.from({ length: maxLaps }, (_, i) => ({ lapNumber: i + 1 }));
    
    // Add lap times for each driver
    lapTimes.forEach(driver => {
      const driverInfo = raceResults?.Results?.find(
        (result: any) => result.Driver.driverId === driver.driverId
      );
      const driverCode = driverInfo?.Driver.code || driver.driverId;
      
      driver.laps.forEach(lap => {
        const lapIndex = parseInt(lap.number, 10) - 1;
        if (lapIndex >= 0 && lapIndex < lapsArray.length) {
          lapsArray[lapIndex][driverCode] = lapTimeToSeconds(lap.Timings?.[0]?.time || "0");
        }
      });
    });
    
    return lapsArray;
  }, [lapTimes, raceResults]);

  // Handle driver selection toggle
  const toggleDriverSelection = (driverId: string) => {
    setSelectedDrivers(prev => 
      prev.includes(driverId)
        ? prev.filter(id => id !== driverId)
        : [...prev, driverId]
    );
  };

  // Get driver colors for the chart
  const getDriverColor = (driverCode: string) => {
    const colorMap: Record<string, string> = {
      VER: "#0600EF",
      PER: "#0600EF",
      LEC: "#F91536",
      SAI: "#F91536",
      HAM: "#00D2BE",
      RUS: "#00D2BE",
      NOR: "#FF8700",
      PIA: "#FF8700",
      ALO: "#006F62",
      STR: "#006F62",
    };
    
    return colorMap[driverCode] || `#${Math.floor(Math.random()*16777215).toString(16)}`;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold">Lap Time Comparison</h1>
          <p className="text-muted-foreground">Compare drivers' lap times throughout a race</p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Season</p>
            <Select 
              value={selectedSeason}
              onValueChange={(value) => {
                setSelectedSeason(value);
                setSelectedRace("");
                setSelectedDrivers([]);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select season" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((season) => (
                  <SelectItem key={season} value={season}>{season}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Race</p>
            <Select 
              value={selectedRace}
              onValueChange={(value) => {
                setSelectedRace(value);
                setSelectedDrivers([]);
              }}
              disabled={racesLoading || !races?.length}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select race" />
              </SelectTrigger>
              <SelectContent>
                {races?.map((race: any) => (
                  <SelectItem key={race.round} value={race.round}>
                    {race.raceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {selectedRace && !driversLoading && raceResults && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Select drivers to compare (max 5)</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {raceResults.Results?.slice(0, 10).map((result: any) => (
                <button
                  key={result.Driver.driverId}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedDrivers.includes(result.Driver.driverId)
                      ? "bg-f1-red text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                  onClick={() => toggleDriverSelection(result.Driver.driverId)}
                  disabled={selectedDrivers.length >= 5 && !selectedDrivers.includes(result.Driver.driverId)}
                >
                  {result.Driver.code || result.Driver.familyName}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <Card className="w-full">
          <CardHeader>
            <CardTitle>
              {raceResults ? `${raceResults.raceName} Lap Times` : "Lap Time Comparison"}
              {raceResults && ` (${raceResults.season})`}
            </CardTitle>
            <CardDescription>
              {raceResults && `${raceResults.Circuit?.circuitName}, ${raceResults.date}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lapTimesLoading || driversLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : !selectedRace ? (
              <div className="text-center py-8 text-muted-foreground">
                Select a race to view lap times
              </div>
            ) : selectedDrivers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Select drivers to compare lap times
              </div>
            ) : processedData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No lap time data available for this race
              </div>
            ) : (
              <div className="h-[500px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={processedData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis 
                      dataKey="lapNumber" 
                      label={{ value: 'Lap Number', position: 'insideBottomRight', offset: -5 }}
                    />
                    <YAxis 
                      label={{ value: 'Lap Time (seconds)', angle: -90, position: 'insideLeft' }}
                      domain={['dataMin - 1', 'dataMax + 1']}
                    />
                    <Tooltip 
                      labelFormatter={(label) => `Lap ${label}`}
                      formatter={(value: any) => {
                        if (typeof value !== 'number') return ['-', ''];
                        const minutes = Math.floor(value / 60);
                        const seconds = (value % 60).toFixed(3);
                        return [`${minutes}:${seconds.padStart(6, '0')}`, 'Time'];
                      }}
                      contentStyle={{ 
                        backgroundColor: '#1a1a1a',
                        borderColor: '#333',
                        borderRadius: '5px',
                        color: 'white'
                      }}
                    />
                    <Legend />
                    {selectedDrivers.map(driverId => {
                      const driverInfo = raceResults.Results?.find(
                        (result: any) => result.Driver.driverId === driverId
                      );
                      if (!driverInfo) return null;
                      
                      const driverCode = driverInfo.Driver.code;
                      const color = getDriverColor(driverCode);
                      
                      return (
                        <Line
                          key={driverId}
                          type="monotone"
                          dataKey={driverCode}
                          name={`${driverInfo.Driver.givenName} ${driverInfo.Driver.familyName}`}
                          stroke={color}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default LapTimes;


import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface RaceStrategyChartProps {
  isLoading: boolean;
}

// Define the race result and constructor interfaces
interface Constructor {
  name: string;
  [key: string]: any;
}

interface RaceResult {
  position: string;
  Driver: {
    code: string;
    [key: string]: any;
  };
  Constructor: Constructor;
  [key: string]: any;
}

interface Race {
  round: string;
  raceName: string;
  Results?: RaceResult[];
  [key: string]: any;
}

const RaceStrategyChart = ({ isLoading }: RaceStrategyChartProps) => {
  const [selectedSeason, setSelectedSeason] = useState("2023");
  const [selectedRace, setSelectedRace] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  
  const { data: races, isLoading: isRacesLoading } = useQuery({
    queryKey: ["strategyRaces", selectedSeason],
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
  
  const { data: raceResults, isLoading: isResultsLoading } = useQuery({
    queryKey: ["raceResults", selectedSeason, selectedRace],
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
  
  // Generate pit stop data
  const generatePitStopData = () => {
    if (!raceResults || !raceResults.Results) return [];
    
    const constructors = Array.from(new Set(
      raceResults.Results.map((result: RaceResult) => result.Constructor.name)
    ));
    
    if (selectedTeams.length === 0) {
      // Default select the top 4 teams - using type assertion to assure TypeScript
      setSelectedTeams(constructors.slice(0, 4) as string[]);
    }
    
    // Generate pit stop strategy simulation
    const totalLaps = 60; // Assuming a standard race
    
    return raceResults.Results
      .filter((result: RaceResult) => selectedTeams.includes(result.Constructor.name))
      .map((result: RaceResult) => {
        const driver = result.Driver.code;
        const team = result.Constructor.name;
        const position = parseInt(result.position, 10);
        
        // Generate simulated pit stops
        const numStops = 1 + Math.floor(Math.random() * 2); // 1 or 2 stops
        const pitStops = [];
        
        if (numStops === 1) {
          // One-stop strategy
          const pitLap = 20 + Math.floor(Math.random() * 15);
          pitStops.push({ lap: pitLap, duration: 2 + Math.random() * 1, tire: "Medium" });
        } else {
          // Two-stop strategy
          const firstStop = 15 + Math.floor(Math.random() * 10);
          const secondStop = 35 + Math.floor(Math.random() * 15);
          pitStops.push({ lap: firstStop, duration: 2 + Math.random() * 1, tire: "Soft" });
          pitStops.push({ lap: secondStop, duration: 2 + Math.random() * 1, tire: "Hard" });
        }
        
        return {
          driver,
          team,
          position,
          pitStops,
        };
      });
  };

  const strategyData = generatePitStopData();
  const seasons = ["2020", "2021", "2022", "2023", "2024", "2025"];
  
  // Get team colors
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

  // Prepare data for visualization
  const prepareVisualizationData = () => {
    if (!strategyData.length) return [];
    
    const visualData: any[] = [];
    
    strategyData.forEach(driver => {
      // Starting point
      visualData.push({
        driver: driver.driver,
        team: driver.team,
        lap: 0,
        position: driver.position,
        size: 100,
        event: 'Race Start'
      });
      
      // Pit stops
      driver.pitStops.forEach((stop, index) => {
        visualData.push({
          driver: driver.driver,
          team: driver.team,
          lap: stop.lap,
          position: driver.position + (stop.duration / 10), // Slight adjustment for visualization
          size: 300,
          event: `Pit Stop ${index + 1}`,
          duration: stop.duration.toFixed(1),
          tire: stop.tire
        });
      });
      
      // Finish point
      visualData.push({
        driver: driver.driver,
        team: driver.team,
        lap: 60, // End of race
        position: driver.position,
        size: 100,
        event: 'Finish'
      });
    });
    
    return visualData;
  };

  const visualizationData = prepareVisualizationData();
  
  // Handle team selection toggle
  const toggleTeamSelection = (team: string) => {
    setSelectedTeams(prev => 
      prev.includes(team)
        ? prev.filter(t => t !== team)
        : [...prev, team]
    );
  };

  // Get available teams with proper typing
  const availableTeams = raceResults?.Results 
    ? Array.from(new Set(raceResults.Results.map((result: RaceResult) => result.Constructor.name)))
    : [];

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Race Strategy Analysis</CardTitle>
            <CardDescription>Pit stop strategies and race positions</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={selectedSeason} onValueChange={(value) => {
              setSelectedSeason(value);
              setSelectedRace("");
              setSelectedTeams([]);
            }}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Season" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((season) => (
                  <SelectItem key={season} value={season}>{season}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select 
              value={selectedRace} 
              onValueChange={(value) => {
                setSelectedRace(value);
                setSelectedTeams([]);
              }}
              disabled={isRacesLoading || !races?.length}
            >
              <SelectTrigger className="w-40 md:w-60">
                <SelectValue placeholder="Select race" />
              </SelectTrigger>
              <SelectContent>
                {races?.map((race: Race) => (
                  <SelectItem key={race.round} value={race.round}>
                    {race.raceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {selectedRace && availableTeams.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-sm text-muted-foreground">Select teams to compare:</p>
            <div className="flex flex-wrap gap-2">
              {availableTeams.map((team: string) => (
                <Button
                  key={team}
                  size="sm"
                  variant={selectedTeams.includes(team) ? "default" : "outline"}
                  className={selectedTeams.includes(team) ? "bg-f1-red text-white" : ""}
                  onClick={() => toggleTeamSelection(team)}
                >
                  {team}
                </Button>
              ))}
            </div>
          </div>
        )}
        
        {isLoading || isResultsLoading || (selectedRace && !visualizationData.length) ? (
          <Skeleton className="h-[400px] w-full" />
        ) : !selectedRace ? (
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            Select a race to view strategy analysis
          </div>
        ) : selectedTeams.length === 0 ? (
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            Select teams to analyze their strategies
          </div>
        ) : (
          <div className="h-[500px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis 
                  type="number" 
                  dataKey="lap" 
                  name="Lap" 
                  domain={[0, 60]}
                  label={{ value: 'Race Lap', position: 'insideBottomRight', offset: -5 }} 
                />
                <YAxis 
                  type="number" 
                  dataKey="position" 
                  name="Position"
                  reversed 
                  domain={[1, 20]}
                  label={{ value: 'Position', angle: -90, position: 'insideLeft' }}
                />
                <ZAxis type="number" dataKey="size" range={[50, 400]} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a',
                    borderColor: '#333',
                    borderRadius: '5px',
                    color: 'white'
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'Position') return [Math.floor(Number(value)), 'Position'];
                    if (name === 'Lap') return [value, 'Lap'];
                    return [value, name];
                  }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-2 bg-gray-900 border border-gray-700 rounded-md shadow-lg">
                          <p className="font-bold">{data.driver} ({data.team})</p>
                          <p>Event: {data.event}</p>
                          <p>Lap: {data.lap}</p>
                          <p>Position: {Math.floor(data.position)}</p>
                          {data.duration && <p>Pit stop time: {data.duration}s</p>}
                          {data.tire && <p>Tire: {data.tire}</p>}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                
                {selectedTeams.map(team => (
                  <Scatter 
                    key={team} 
                    name={team} 
                    data={visualizationData.filter(d => d.team === team)} 
                    fill={teamColors[team] || "#cccccc"}
                    line={{ stroke: teamColors[team] || "#cccccc", strokeWidth: 1 }}
                    lineType="fitting"
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RaceStrategyChart;

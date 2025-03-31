
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine } from 'recharts';
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface QualifyingAnalysisChartProps {
  isLoading: boolean;
}

const QualifyingAnalysisChart = ({ isLoading }: QualifyingAnalysisChartProps) => {
  const [selectedSeason, setSelectedSeason] = useState("2023");
  const [selectedRace, setSelectedRace] = useState("");
  
  const { data: races, isLoading: isRacesLoading } = useQuery({
    queryKey: ["qualifyingRaces", selectedSeason],
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
  
  const { data: qualifyingData, isLoading: isQualifyingLoading } = useQuery({
    queryKey: ["qualifyingResults", selectedSeason, selectedRace],
    queryFn: async () => {
      if (!selectedRace) return null;
      try {
        const response = await fetch(`https://api.jolpi.ca/ergast/f1/${selectedSeason}/${selectedRace}/qualifying.json`);
        if (!response.ok) throw new Error("Failed to fetch qualifying data");
        const data = await response.json();
        return data.MRData?.RaceTable?.Races?.[0]?.QualifyingResults || [];
      } catch (error) {
        toast.error("Error loading qualifying data");
        console.error(error);
        return null;
      }
    },
    enabled: !!selectedRace
  });

  const seasons = ["2020", "2021", "2022", "2023", "2024", "2025"];
  
  // Convert lap time string (e.g., "1:30.456") to seconds (e.g., 90.456)
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

  // Process qualifying data for chart
  const processQualifyingData = () => {
    if (!qualifyingData) return [];
    
    const processed = qualifyingData.map((result: any) => {
      let q1Time = result.Q1 ? lapTimeToSeconds(result.Q1) : null;
      let q2Time = result.Q2 ? lapTimeToSeconds(result.Q2) : null;
      let q3Time = result.Q3 ? lapTimeToSeconds(result.Q3) : null;
      
      const driverName = `${result.Driver.code}`;
      const position = parseInt(result.position, 10);
      const team = result.Constructor.name;
      
      return {
        driver: driverName,
        position,
        team,
        Q1: q1Time,
        Q2: q2Time,
        Q3: q3Time,
        bestTime: Math.min(...[q1Time, q2Time, q3Time].filter(Boolean) as number[]),
      };
    });
    
    // Sort by position
    return processed.sort((a, b) => a.position - b.position);
  };

  const chartData = processQualifyingData();
  
  // Get team colors for the chart
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

  // Calculate the pole position time for reference line
  const poleTime = chartData.length > 0 ? 
    Math.min(...chartData.filter(d => d.Q3 !== null).map(d => d.Q3 || Infinity)) : 
    null;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Qualifying Analysis</CardTitle>
            <CardDescription>Comparison of qualifying session times</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={selectedSeason} onValueChange={(value) => {
              setSelectedSeason(value);
              setSelectedRace("");
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
              onValueChange={setSelectedRace}
              disabled={isRacesLoading || !races?.length}
            >
              <SelectTrigger className="w-40 md:w-60">
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
      </CardHeader>
      <CardContent>
        {isLoading || isQualifyingLoading || (selectedRace && !chartData.length) ? (
          <Skeleton className="h-[400px] w-full" />
        ) : !selectedRace ? (
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            Select a race to view qualifying analysis
          </div>
        ) : (
          <div className="h-[500px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 50, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
                <XAxis 
                  type="number" 
                  label={{ value: 'Time (seconds)', position: 'insideBottom', offset: -5 }}
                  domain={['dataMin - 0.5', 'dataMax + 0.5']}
                />
                <YAxis 
                  dataKey="driver" 
                  type="category" 
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
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
                  itemSorter={(item) => {
                    if (item.dataKey === 'Q3') return -1;
                    if (item.dataKey === 'Q2') return 0;
                    return 1;
                  }}
                />
                <Legend />
                
                {poleTime && (
                  <ReferenceLine 
                    x={poleTime} 
                    stroke="#f1263d" 
                    strokeDasharray="3 3" 
                    label={{ value: 'Pole time', position: 'top', fill: '#f1263d' }} 
                  />
                )}
                
                <Bar dataKey="Q1" name="Q1 Time" fill="#555555" barSize={10}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-Q1-${index}`} fill={teamColors[entry.team] || "#555555"} />
                  ))}
                </Bar>
                <Bar dataKey="Q2" name="Q2 Time" fill="#888888" barSize={10}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-Q2-${index}`} fill={teamColors[entry.team] || "#888888"} />
                  ))}
                </Bar>
                <Bar dataKey="Q3" name="Q3 Time" fill="#cccccc" barSize={10}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-Q3-${index}`} fill={teamColors[entry.team] || "#cccccc"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QualifyingAnalysisChart;

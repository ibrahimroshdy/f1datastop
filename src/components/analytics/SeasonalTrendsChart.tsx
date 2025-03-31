
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface SeasonalTrendsChartProps {
  isLoading: boolean;
}

const SeasonalTrendsChart = ({ isLoading }: SeasonalTrendsChartProps) => {
  const [selectedSeason, setSelectedSeason] = useState("2023");
  
  const { data: seasonData, isLoading: isSeasonLoading } = useQuery({
    queryKey: ["seasonalTrends", selectedSeason],
    queryFn: async () => {
      try {
        const response = await fetch(`https://api.jolpi.ca/ergast/f1/${selectedSeason}.json`);
        if (!response.ok) throw new Error("Failed to fetch season data");
        const data = await response.json();
        return data.MRData?.RaceTable?.Races || [];
      } catch (error) {
        toast.error("Error loading seasonal data");
        console.error(error);
        return [];
      }
    }
  });

  // Generate sample data for seasons
  const generateChartData = () => {
    if (isSeasonLoading || !seasonData.length) return [];
    
    // Normally we would fetch real results for each race, but for this demo we'll generate
    // simulated data for top 3 teams across races
    const raceLabels = seasonData.map((race: any) => race.raceName);
    
    const teams = ["Red Bull", "Ferrari", "Mercedes", "McLaren"];
    const chartData = raceLabels.map((race: string, index: number) => {
      const data: any = { race };
      
      teams.forEach(team => {
        // Add some randomness but with trends
        const basePerformance = Math.random();
        const seasonProgress = index / raceLabels.length; // 0 to 1
        
        let teamTrend = 0;
        if (team === "Red Bull") teamTrend = 0.8 - (seasonProgress * 0.3); // Strong start, slight decline
        if (team === "Ferrari") teamTrend = 0.5 + (seasonProgress * 0.4); // Improves through season
        if (team === "Mercedes") teamTrend = 0.3 + (seasonProgress * 0.6); // Bigger improvement
        if (team === "McLaren") teamTrend = 0.4 + (seasonProgress * 0.5); // Steady improvement
        
        // Performance score (0-100)
        data[team] = Math.round((basePerformance * 0.3 + teamTrend * 0.7) * 100);
      });
      
      return data;
    });
    
    return chartData;
  };

  const chartData = generateChartData();
  const seasons = ["2020", "2021", "2022", "2023", "2024", "2025"];

  // Colors for each team
  const teamColors: Record<string, string> = {
    "Red Bull": "#0600EF",
    "Ferrari": "#F91536",
    "Mercedes": "#00D2BE",
    "McLaren": "#FF8700",
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Seasonal Performance Trends</CardTitle>
            <CardDescription>Team performance evolution throughout the season</CardDescription>
          </div>
          <Select value={selectedSeason} onValueChange={setSelectedSeason}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Season" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((season) => (
                <SelectItem key={season} value={season}>{season}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || isSeasonLoading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : !chartData.length ? (
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            No data available for this season
          </div>
        ) : (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis 
                  dataKey="race" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tick={{ fontSize: 12 }}
                />
                <YAxis label={{ value: 'Performance Index', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a',
                    borderColor: '#333',
                    borderRadius: '5px',
                    color: 'white'
                  }}
                />
                <Legend />
                {Object.keys(teamColors).map(team => (
                  <Line
                    key={team}
                    type="monotone"
                    dataKey={team}
                    name={team}
                    stroke={teamColors[team]}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SeasonalTrendsChart;

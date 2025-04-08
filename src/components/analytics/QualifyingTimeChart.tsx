
import { useState, useEffect, useMemo } from "react";
import { useRaceQualifying } from "@/hooks/useF1Data";
import { 
  LineChart, 
  Line, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis
} from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface QualifyingTimeChartProps {
  year: number;
  round: string;
}

const QualifyingTimeChart = ({ year, round }: QualifyingTimeChartProps) => {
  const [selectedSessions, setSelectedSessions] = useState<string[]>(["Q1", "Q2", "Q3"]);
  const [displayMode, setDisplayMode] = useState<"all" | "top10">("all");
  
  const { data: qualifyingData, isLoading, error } = useRaceQualifying(year, round);
  
  useEffect(() => {
    if (error) {
      toast.error("Failed to load qualifying data", {
        description: "Please try again later or select a different race",
      });
    }
  }, [error]);
  
  const processData = useMemo(() => {
    if (!qualifyingData?.data?.QualifyingResults) return [];

    const results = qualifyingData.data.QualifyingResults;
    
    // Filter top 10 drivers if display mode is "top10"
    const filteredResults = displayMode === "top10" 
      ? results.filter((result: any) => parseInt(result.position) <= 10)
      : results;
      
    // Convert qualifying times to seconds for comparison
    return filteredResults.map((result: any) => {
      const driver = result.Driver;
      const constructor = result.Constructor;
      const team = constructor?.constructorId?.toLowerCase() || "unknown";
      
      // Convert times to seconds
      const q1Time = result.Q1 ? convertLapTimeToSeconds(result.Q1) : null;
      const q2Time = result.Q2 ? convertLapTimeToSeconds(result.Q2) : null;
      const q3Time = result.Q3 ? convertLapTimeToSeconds(result.Q3) : null;
      
      return {
        driver: driver.code || `${driver.familyName.substring(0, 3)}`,
        fullName: `${driver.givenName} ${driver.familyName}`,
        position: parseInt(result.position),
        team,
        Q1: q1Time,
        Q2: q2Time,
        Q3: q3Time,
        color: TEAM_COLORS[team] || TEAM_COLORS.default
      };
    }).sort((a, b) => a.position - b.position);
  }, [qualifyingData, displayMode]);
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-96">
        <Skeleton className="h-[400px] w-full" />
        <div className="flex items-center mt-4">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading qualifying data...</span>
        </div>
      </div>
    );
  }
  
  if (!qualifyingData?.data?.QualifyingResults || qualifyingData.data.QualifyingResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <p className="text-muted-foreground">No qualifying data available for this race</p>
        <p className="text-sm text-muted-foreground mt-2">
          This could be because qualifying hasn't occurred yet or data wasn't recorded.
        </p>
      </div>
    );
  }
  
  const formatTime = (seconds: number) => {
    if (!seconds) return "N/A";
    
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
  };
  
  const handleSessionToggle = (value: string[]) => {
    // Ensure at least one session is always selected
    if (value.length > 0) {
      setSelectedSessions(value);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between gap-4 pb-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Display Sessions</Label>
          <ToggleGroup 
            type="multiple" 
            value={selectedSessions} 
            onValueChange={handleSessionToggle}
            className="justify-start flex-wrap"
          >
            <ToggleGroupItem value="Q1" className="border border-gray-700">Q1</ToggleGroupItem>
            <ToggleGroupItem value="Q2" className="border border-gray-700">Q2</ToggleGroupItem>
            <ToggleGroupItem value="Q3" className="border border-gray-700">Q3</ToggleGroupItem>
          </ToggleGroup>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">Drivers</Label>
          <RadioGroup 
            value={displayMode} 
            onValueChange={(value) => setDisplayMode(value as "all" | "top10")}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all">All Drivers</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="top10" id="top10" />
              <Label htmlFor="top10">Top 10</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
      
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={processData}
            margin={{ top: 10, right: 30, left: 10, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
            <RechartsXAxis 
              dataKey="driver" 
              interval={0} 
              tick={{ fill: '#fff', fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={70}
              xAxisId="qualifying"
            />
            <RechartsYAxis 
              tickFormatter={(value) => formatTime(value)} 
              domain={['dataMin - 0.5', 'dataMax + 0.5']}
              tickCount={8}
              tick={{ fill: '#fff', fontSize: 12 }}
              yAxisId="qualifying"
            />
            <Tooltip 
              formatter={(value, name) => [formatTime(value as number), name]}
              contentStyle={{ 
                backgroundColor: '#1a1a1a', 
                border: '1px solid #333',
                borderRadius: '4px'
              }}
              labelStyle={{ color: '#fff' }}
            />
            <Legend />
            {selectedSessions.includes("Q1") && (
              <Line 
                type="monotone" 
                dataKey="Q1" 
                name="Q1" 
                stroke="#8884d8" 
                activeDot={{ r: 8 }}
                strokeWidth={2}
                connectNulls
                dot={{ r: 4 }}
                xAxisId="qualifying"
                yAxisId="qualifying"
              />
            )}
            {selectedSessions.includes("Q2") && (
              <Line 
                type="monotone" 
                dataKey="Q2" 
                name="Q2" 
                stroke="#82ca9d" 
                activeDot={{ r: 8 }}
                strokeWidth={2}
                connectNulls
                dot={{ r: 4 }}
                xAxisId="qualifying"
                yAxisId="qualifying"
              />
            )}
            {selectedSessions.includes("Q3") && (
              <Line 
                type="monotone" 
                dataKey="Q3" 
                name="Q3" 
                stroke="#ffc658" 
                activeDot={{ r: 8 }}
                strokeWidth={2}
                connectNulls
                dot={{ r: 4 }}
                xAxisId="qualifying"
                yAxisId="qualifying"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Helper function to convert lap time format (e.g. "1:30.123") to seconds (90.123)
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

export default QualifyingTimeChart;

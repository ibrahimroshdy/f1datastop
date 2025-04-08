
import React, { useState } from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, Tooltip, Legend } from "recharts";
import { XAxis, YAxis, ReferenceLine } from "@/utils/rechartsWrapper";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useLapTimeData } from "@/hooks/useLapTimeData";
import DriverSelector from "./DriverSelector";
import DisplayModeToggle from "./DisplayModeToggle";
import DataLoadingProgress from "./DataLoadingProgress";

interface LapTimeChartProps {
  year: number;
  round: string;
}

const LapTimeChart: React.FC<LapTimeChartProps> = ({ year, round }) => {
  const [displayMode, setDisplayMode] = useState<'absolute' | 'gap'>('absolute');
  
  const {
    chartData,
    availableDrivers,
    selectedDrivers,
    visibleDrivers,
    hoveredDriver,
    isLoading,
    isError,
    loadingProgress,
    errorMessage,
    retryCount,
    maxLap,
    fastestLapTime,
    handleDriverToggle,
    handleDriverHover,
    getAverageTime,
  } = useLapTimeData(year, round, displayMode);

  const toggleDisplayMode = () => {
    setDisplayMode(prev => prev === 'absolute' ? 'gap' : 'absolute');
  };

  // Render loading state with progress indicator
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <DataLoadingProgress 
          isLoading={true}
          progress={loadingProgress}
          message={errorMessage}
          isError={isError}
          retryCount={retryCount}
          maxRetries={15}
        />
        <div className="pt-6 text-center">
          <p className="text-muted-foreground">
            {loadingProgress < 50 ? "Loading lap time data..." : "Processing race data..."}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            The F1 API has rate limits. Automatic retries are in progress if needed.
          </p>
        </div>
      </div>
    );
  }

  // Handle error state
  if (isError) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <Alert className="bg-red-50 border-red-200 text-red-900 mb-4">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription>
            Unable to load lap time data due to API rate limits.
            Please try again in a few minutes or select a different race.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Handle no data state
  if (chartData.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <p className="text-muted-foreground">
          No lap time data available for this race
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          This could be because the race hasn't occurred yet or lap time data wasn't recorded
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col md:flex-row gap-4 justify-between mb-4">
        <DisplayModeToggle displayMode={displayMode} onToggle={toggleDisplayMode} />
      </div>
      
      {/* Driver selection grid */}
      <DriverSelector 
        availableDrivers={availableDrivers}
        selectedDrivers={selectedDrivers}
        onDriverToggle={handleDriverToggle}
        onDriverHover={handleDriverHover}
        displayMode={displayMode}
        fastestLapTime={fastestLapTime}
        getAverageTime={getAverageTime}
      />
      
      <div className="h-[450px] mt-4 flex-grow">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" opacity={0.3} />
            <XAxis
              dataKey="lap"
              type="number"
              domain={[1, maxLap]}
              label={{ value: 'Lap Number', position: 'insideBottomRight', offset: -10 }}
            />
            <YAxis
              domain={['auto', 'auto']}
              label={{ value: 'Lap Time (seconds)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={(value, name) => {
                const driverCode = String(name);
                
                if (typeof value === 'number') {
                  return [`${value.toFixed(3)}s`, driverCode];
                }
                return [value, driverCode];
              }}
              labelFormatter={(label) => `Lap ${label}`}
              contentStyle={{ 
                backgroundColor: '#1a1a1a',
                borderColor: '#333',
                borderRadius: '5px',
                color: 'white'
              }}
            />
            <Legend
              formatter={(value) => {
                const driver = availableDrivers.find(d => d.code === value);
                return driver ? `${value} (${driver.name.split(' ').pop()})` : value;
              }}
            />
            {fastestLapTime && (
              <ReferenceLine 
                y={fastestLapTime.time} 
                stroke="#c026d3" 
                strokeDasharray="3 3" 
                label={{ value: `Fastest Lap: ${fastestLapTime.time.toFixed(3)}s (${fastestLapTime.driver})`, position: 'right', fill: '#c026d3' }} 
              />
            )}
            {availableDrivers
              .filter(driver => visibleDrivers.includes(driver.code))
              .map(driver => (
                <Line
                  key={driver.code}
                  type="monotone"
                  dataKey={driver.code}
                  name={driver.code}
                  stroke={TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666"}
                  strokeWidth={hoveredDriver === driver.code ? 3 : 2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 8 }}
                  connectNulls
                  isAnimationActive={false}
                  opacity={hoveredDriver ? (hoveredDriver === driver.code ? 1 : 0.3) : 1}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default LapTimeChart;

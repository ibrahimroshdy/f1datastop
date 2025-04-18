import React, { useState } from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, Tooltip, Legend } from "recharts";
import { XAxis, YAxis, ReferenceLine } from '@/utils/rechartsWrapper';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useLapTimeData } from "@/hooks/useLapTimeData";
import DriverSelector from "./DriverSelector";
import DisplayModeToggle from "./DisplayModeToggle";

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
    maxLap,
    fastestLapTime,
    handleDriverToggle,
    handleDriverHover,
    getAverageTime,
    retryCount,
  } = useLapTimeData(year, round, displayMode);

  const toggleDisplayMode = () => {
    setDisplayMode(prev => prev === 'absolute' ? 'gap' : 'absolute');
  };

  // Render loading state with progress indicator
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <Skeleton className="h-full w-full opacity-30" />
        <div className="absolute flex flex-col items-center justify-center space-y-6 w-3/4 max-w-md">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="w-full space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Loading lap times...</span>
              <span>{loadingProgress}%</span>
            </div>
            <Progress 
              value={loadingProgress} 
              className="h-2 w-full" 
              indicatorClassName={isError ? "bg-yellow-500" : "bg-blue-500"}
            />
            <div className="mt-2 text-center text-sm">
              {errorMessage ? (
                <div className="text-amber-600 font-medium">{errorMessage}</div>
              ) : (
                <div className="text-muted-foreground">Loading lap time data for all drivers...</div>
              )}
              
              {retryCount > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Rate limits encountered. Retry attempt {retryCount}/15.
                </div>
              )}
              
              {loadingProgress > 0 && loadingProgress < 100 && (
                <div className="mt-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 rounded-md text-xs text-blue-700 dark:text-blue-300 animate-pulse-red">
                  This may take a moment. F1 data is being fetched in batches to avoid rate limits.
                </div>
              )}
            </div>
            
            {isError && (
              <Alert className="mt-4 bg-yellow-50 border-yellow-200 text-yellow-900">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-xs">
                  System is automatically retrying with exponential backoff...
                  <div className="mt-1 font-medium">The F1 API has strict rate limits.</div>
                </AlertDescription>
              </Alert>
            )}
          </div>
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
              xAxisId="lap"
            />
            <YAxis
              domain={displayMode === 'absolute' ? ['auto', 'auto'] : [0, 'auto']}
              label={{ value: displayMode === 'absolute' ? 'Lap Time (seconds)' : 'Gap to Fastest (seconds)', angle: -90, position: 'insideLeft', dx: -35 }}
              yAxisId="time"
              tickFormatter={(value) => {
                if (displayMode === 'absolute') {
                  // Format as MM:SS.sss
                  const mins = Math.floor(value / 60);
                  const secs = (value % 60).toFixed(3);
                  return `${mins}:${secs.padStart(6, '0')}`;
                } else {
                  // Format as +X.XXXs
                  return `+${value.toFixed(3)}s`;
                }
              }}
            />
            <Tooltip
              formatter={(value, name) => {
                const driverCode = String(name);
                if (displayMode === 'absolute') {
                  // Format as MM:SS.sss
                  if (typeof value !== 'number') return [`${value}`, driverCode];
                  const mins = Math.floor(value / 60);
                  const secs = (value % 60).toFixed(3);
                  return [`${mins}:${secs.padStart(6, '0')}`, driverCode];
                } else {
                  // Make sure value is a number before calling toFixed
                  return [typeof value === 'number' ? `+${value.toFixed(3)}s` : `+${value}`, driverCode];
                }
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
            {fastestLapTime && displayMode === 'absolute' && (
              <ReferenceLine 
                y={fastestLapTime.time} 
                stroke="#c026d3" 
                strokeDasharray="3 3" 
                label={{ 
                  value: `Fastest Lap: ${(() => {
                    const mins = Math.floor(fastestLapTime.time / 60);
                    const secs = (fastestLapTime.time % 60).toFixed(3);
                    return `${mins}:${secs.padStart(6, '0')}`;
                  })()} (${fastestLapTime.driver})`, 
                  position: 'right', 
                  fill: '#c026d3' 
                }} 
                yAxisId="time"
                xAxisId="lap"
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
                  xAxisId="lap"
                  yAxisId="time"
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

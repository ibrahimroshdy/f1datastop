import React, { useState } from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, Tooltip, Legend } from "recharts";
import { XAxis, YAxis, ReferenceLine } from '@/utils/rechartsWrapper';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useLapTimeData, Driver } from "@/hooks/useLapTimeData";
import DriverSelector from "./DriverSelector";
import DisplayModeToggle from "./DisplayModeToggle";

interface LapTimeChartProps {
  year: number;
  round: string;
}

const LapTimeChart: React.FC<LapTimeChartProps> = ({ year, round }) => {
  const [displayMode, setDisplayMode] = useState<'absolute' | 'gap'>('absolute');
  
  // Helper function to generate visual line pattern for tooltips
  const getVisualLinePattern = (strokeDasharray?: string) => {
    if (strokeDasharray === "5 5") {
      return '− − − −'; // Dashed
    } else if (strokeDasharray === "10 5 5 5") {
      return '−· −· −·'; // Dash-dot
    } else if (strokeDasharray === "15 5 5 5 5 5") {
      return '−·· −·· −··'; // Dash-dot-dot
    } else if (strokeDasharray === "3 3") {
      return '· · · ·'; // Dotted
    } else {
      return '————'; // Solid
    }
  };

  // Helper function to generate visual dot pattern
  const getVisualDotPattern = (dot?: any) => {
    if (dot?.fill === "transparent") {
      return '○'; // Hollow circle
    } else if (dot?.r === 4) {
      return '●'; // Larger circle
    } else {
      return '●'; // Regular circle
    }
  };

  // Helper function to get line style for drivers from the same team
  const getLineStyle = (currentDriver: Driver, allVisibleDrivers: Driver[]): { strokeDasharray?: string, dot?: any } => {
    // Find all drivers from the same team that are currently visible
    const sameTeamDrivers = allVisibleDrivers.filter(d => d.team === currentDriver.team);
    
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
      
      <div className="h-[350px] sm:h-[450px] mt-2 sm:mt-4 flex-grow">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ 
              top: 5, 
              right: window.innerWidth < 640 ? 15 : 30, 
              left: window.innerWidth < 640 ? 15 : 20, 
              bottom: 5 
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" opacity={0.3} />
            <XAxis
              dataKey="lap"
              type="number"
              domain={[1, maxLap]}
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
              domain={displayMode === 'absolute' ? ['auto', 'auto'] : [0, 'auto']}
              label={{ 
                value: displayMode === 'absolute' ? 'Time (s)' : 'Gap (s)', 
                angle: -90, 
                position: 'insideLeft', 
                dx: window.innerWidth < 640 ? -25 : -35,
                style: { fontSize: window.innerWidth < 640 ? '11px' : '12px' }
              }}
              tick={{ fontSize: window.innerWidth < 640 ? 10 : 12 }}
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
                const driver = availableDrivers.find(d => d.code === driverCode);
                
                let formattedValue;
                if (displayMode === 'absolute') {
                  // Format as MM:SS.sss
                  if (typeof value !== 'number') {
                    formattedValue = `${value}`;
                  } else {
                    const mins = Math.floor(value / 60);
                    const secs = (value % 60).toFixed(3);
                    formattedValue = `${mins}:${secs.padStart(6, '0')}`;
                  }
                } else {
                  // Make sure value is a number before calling toFixed
                  formattedValue = typeof value === 'number' ? `+${value.toFixed(3)}s` : `+${value}`;
                }
                
                // Add line style info if driver is found
                if (driver) {
                  const visibleDriversData = availableDrivers.filter(d => visibleDrivers.includes(d.code));
                  const lineStyle = getLineStyle(driver, visibleDriversData);
                  
                  const linePattern = getVisualLinePattern(lineStyle.strokeDasharray);
                  const dotPattern = getVisualDotPattern(lineStyle.dot);
                  
                  return [formattedValue, `${driverCode} ${linePattern} ${dotPattern}`];
                }
                
                return [formattedValue, driverCode];
              }}
              labelFormatter={(label) => `Lap ${label}`}
              contentStyle={{ 
                backgroundColor: '#1a1a1a',
                borderColor: '#333',
                borderRadius: '5px',
                color: 'white',
                fontSize: window.innerWidth < 640 ? '11px' : '12px',
                padding: window.innerWidth < 640 ? '6px' : '8px'
              }}
            />
            <Legend
              formatter={(value) => {
                const driver = availableDrivers.find(d => d.code === value);
                if (!driver) return value;
                
                const visibleDriversData = availableDrivers.filter(d => visibleDrivers.includes(d.code));
                const lineStyle = getLineStyle(driver, visibleDriversData);
                
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
              .map(driver => {
                const visibleDriversData = availableDrivers.filter(d => visibleDrivers.includes(d.code));
                const lineStyle = getLineStyle(driver, visibleDriversData);
                
                return (
                  <Line
                    key={driver.code}
                    type="monotone"
                    dataKey={driver.code}
                    name={driver.code}
                    stroke={TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666"}
                    strokeWidth={hoveredDriver === driver.code ? 3 : 2}
                    strokeDasharray={lineStyle.strokeDasharray}
                    dot={lineStyle.dot}
                    activeDot={{ r: 8 }}
                    connectNulls
                    isAnimationActive={false}
                    xAxisId="lap"
                    yAxisId="time"
                    opacity={hoveredDriver ? (hoveredDriver === driver.code ? 1 : 0.3) : 1}
                  />
                );
              })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default LapTimeChart;

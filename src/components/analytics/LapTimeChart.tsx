import React, { useState, useEffect } from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, Tooltip, Legend } from "recharts";
import { XAxis, YAxis, ReferenceLine } from '@/utils/rechartsWrapper';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clock, TrendingUp } from "lucide-react";
import { useLapTimeData, Driver } from "@/hooks/useLapTimeData";
import DriverSelector from "./DriverSelector";
import DisplayModeToggle from "./DisplayModeToggle";
import { F1ChartLoading } from "@/components/charts/F1ChartLoading";
import { F1ChartEmpty } from "@/components/charts/F1ChartEmpty";
import { F1ErrorState } from "@/components/f1/F1ErrorState";

interface LapTimeChartProps {
  year: number;
  round: string;
}

const LapTimeChart: React.FC<LapTimeChartProps> = ({ year, round }) => {
  const [displayMode, setDisplayMode] = useState<'absolute' | 'gap'>('absolute');
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
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
      <div className="h-full flex flex-col items-center justify-center space-y-4 relative">
        <F1ChartLoading chartType="line" height={350} />
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center space-y-4 w-3/4 max-w-md p-6 rounded-lg bg-card border shadow-lg">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <div className="relative p-3 bg-primary/10 rounded-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            </div>
            
            <div className="w-full space-y-3">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span className="font-medium">Loading lap times...</span>
                <span className="font-mono tabular-nums">{loadingProgress}%</span>
            </div>
            <Progress 
              value={loadingProgress} 
              className="h-2 w-full" 
            />
              
              {errorMessage ? (
                <p className="text-amber-600 text-sm font-medium text-center">{errorMessage}</p>
              ) : (
                <p className="text-muted-foreground text-sm text-center">
                  Fetching lap data for all drivers...
                </p>
              )}
              
              {retryCount > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Rate limit reached. Retry {retryCount}/15
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (isError && chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <F1ErrorState
          type="rate-limit"
          title="Unable to Load Lap Times"
          message="The F1 API rate limit was reached. Please wait a moment and try again."
          variant="card"
        />
      </div>
    );
  }

  // Handle no data state
  if (chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <F1ChartEmpty
          chartType="line"
          title="No Lap Time Data"
          message="Lap time data is not available for this race. This may be because the race hasn't occurred yet."
          icon={<Clock className="h-12 w-12 text-muted-foreground" />}
        />
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
      
      <div className="h-[300px] sm:h-[350px] lg:h-[450px] mt-2 sm:mt-4 flex-grow touch-pan-x touch-pan-y">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ 
              top: 5, 
              right: isMobile ? 10 : 30, 
              left: isMobile ? 5 : 20, 
              bottom: 5 
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" opacity={0.3} />
            <XAxis
              dataKey="lap"
              type="number"
              domain={[1, maxLap]}
              label={!isMobile ? { 
                value: 'Lap Number', 
                position: 'insideBottomRight', 
                offset: -10,
                style: { fontSize: '12px', fill: 'hsl(var(--muted-foreground))' }
              } : undefined}
              tick={{ fontSize: isMobile ? 9 : 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              xAxisId="lap"
            />
            <YAxis
              domain={displayMode === 'absolute' ? ['auto', 'auto'] : [0, 'auto']}
              label={!isMobile ? { 
                value: displayMode === 'absolute' ? 'Time (s)' : 'Gap (s)', 
                angle: -90, 
                position: 'insideLeft', 
                dx: -35,
                style: { fontSize: '12px', fill: 'hsl(var(--muted-foreground))' }
              } : undefined}
              tick={{ fontSize: isMobile ? 9 : 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              yAxisId="time"
              width={isMobile ? 45 : 60}
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
                  if (typeof value !== 'number') {
                    formattedValue = `${value}`;
                  } else {
                    const mins = Math.floor(value / 60);
                    const secs = (value % 60).toFixed(3);
                    formattedValue = `${mins}:${secs.padStart(6, '0')}`;
                  }
                } else {
                  formattedValue = typeof value === 'number' ? `+${value.toFixed(3)}s` : `+${value}`;
                }
                
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
                backgroundColor: 'hsl(240 12% 10%)',
                borderColor: 'hsl(240 10% 20%)',
                borderRadius: '8px',
                color: 'hsl(0 0% 98%)',
                fontSize: isMobile ? '11px' : '12px',
                padding: isMobile ? '8px' : '10px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
              wrapperStyle={{ zIndex: 100 }}
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

import React from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, Tooltip, Legend, ReferenceLine, Label } from "recharts";
import { XAxis, YAxis } from "@/utils/rechartsWrapper";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useQualifyingData, QualifyingSession } from "@/hooks/useQualifyingData";
import DriverSelector from "./DriverSelector";
import SessionToggle from "./SessionToggle";

// Extend the interface to be compatible with the DriverSelector component
interface CompatibleDriver {
  driverId: string;
  code: string;
  name: string;
  team: string;
  finishPosition: number; // Added to match existing DriverSelector component
  position: number; // Keep the original qualifying position
  q1Time?: number;
  q2Time?: number;
  q3Time?: number;
}

interface QualifyingChartProps {
  year: number;
  round: string;
}

const QualifyingChart: React.FC<QualifyingChartProps> = ({ year, round }) => {
  const {
    availableDrivers,
    selectedDrivers,
    activeSessions,
    hoveredDriver,
    visibleDrivers,
    chartData,
    fastestLapTime,
    isLoading,
    isProcessingData,
    isError,
    error,
    errorMessage,
    handleDriverToggle,
    handleDriverHover,
    handleSessionToggle,
    convertLapTimeToSeconds,
  } = useQualifyingData(year, round);

  // Convert available drivers to be compatible with DriverSelector
  const compatibleDrivers: CompatibleDriver[] = availableDrivers.map(driver => ({
    ...driver,
    finishPosition: driver.position // Map position to finishPosition for compatibility
  }));

  // Create a standard format for display (position => time)
  const formatChartData = () => {
    const { q1Data, q2Data, q3Data } = chartData;
    const positions = Array.from({ length: 20 }, (_, i) => i + 1);
    const formattedData = positions.map(pos => ({ position: pos }));
    
    // Add driver times to the corresponding positions
    const addSessionData = (data: any[], sessionKey: string) => {
      data.forEach(item => {
        const idx = item.position - 1;
        if (idx >= 0 && idx < formattedData.length) {
          formattedData[idx][`${item.driver}_${sessionKey}`] = item.time;
        }
      });
    };
    
    if (activeSessions.includes('all') || activeSessions.includes('Q1')) {
      addSessionData(q1Data, 'Q1');
    }
    
    if (activeSessions.includes('all') || activeSessions.includes('Q2')) {
      addSessionData(q2Data, 'Q2');
    }
    
    if (activeSessions.includes('all') || activeSessions.includes('Q3')) {
      addSessionData(q3Data, 'Q3');
    }
    
    return formattedData.filter(d => {
      // Only return positions that have data for any of the selected drivers and sessions
      return Object.keys(d).some(key => key !== 'position');
    });
  };
  
  const qualifyingChartData = formatChartData();

  // Render loading state with progress indicator
  if (isLoading || isProcessingData) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <Skeleton className="h-full w-full opacity-30" />
        <div className="absolute flex flex-col items-center justify-center space-y-6 w-3/4 max-w-md">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="w-full space-y-2">
            <Progress 
              value={100} 
              className="h-2 w-full" 
              indicatorClassName={isError ? "bg-yellow-500" : "bg-blue-500"}
            />
            <p className="text-center text-muted-foreground text-sm">
              {errorMessage || "Loading qualifying data..."}
            </p>
            {isError && (
              <Alert className="mt-4 bg-yellow-50 border-yellow-200 text-yellow-900">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-xs">
                  Error loading qualifying data.
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
            Unable to load qualifying data.
            Please try again in a few minutes or select a different race.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Handle no data state
  if (!availableDrivers.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <p className="text-muted-foreground">
          No qualifying data available for this race
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          This could be because qualifying hasn't occurred yet or qualifying data wasn't recorded
        </p>
      </div>
    );
  }

  const getSessionColor = (session: QualifyingSession) => {
    switch (session) {
      case 'Q1': return '#a855f7'; // Purple
      case 'Q2': return '#3b82f6'; // Blue
      case 'Q3': return '#22c55e'; // Green
      default: return '#6b7280'; // Gray
    }
  };

  const getDriverAverageTime = (driverCode: string) => {
    let totalTime = 0;
    let timeCount = 0;

    // Find all times for the driver across qualifying sessions
    availableDrivers.forEach(driver => {
      if (driver.code === driverCode) {
        if (driver.q1Time) {
          totalTime += driver.q1Time;
          timeCount++;
        }
        if (driver.q2Time) {
          totalTime += driver.q2Time;
          timeCount++;
        }
        if (driver.q3Time) {
          totalTime += driver.q3Time;
          timeCount++;
        }
      }
    });

    return timeCount > 0 ? totalTime / timeCount : null;
  };

  // Tooltip formatting for numbers
  const formatTooltipValue = (value: any, session: string) => {
    if (typeof value !== 'number') return `${value}`;
    return `${value.toFixed(3)}s (${session})`;
  };
  
  // Format legend text
  const formatLegendText = (value: string) => {
    if (!value || !value.includes('_')) return value;
    
    const [driverCode, session] = value.split('_');
    const driver = availableDrivers.find(d => d.code === driverCode);
    if (!driver) return driverCode;
    
    const lastName = driver.name.split(' ').pop() || '';
    return `${driverCode} (${session}) - ${lastName}`;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col md:flex-row gap-4 justify-between mb-4">
        <SessionToggle 
          activeSessions={activeSessions} 
          onSessionToggle={handleSessionToggle} 
        />
      </div>
      
      <DriverSelector 
        availableDrivers={compatibleDrivers}
        selectedDrivers={selectedDrivers}
        onDriverToggle={handleDriverToggle}
        onDriverHover={handleDriverHover}
        displayMode="absolute"
        fastestLapTime={fastestLapTime ? { time: fastestLapTime.time, driver: fastestLapTime.driver } : null}
        getAverageTime={getDriverAverageTime}
      />
      
      <div className="h-[450px] mt-4 flex-grow">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={qualifyingChartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" opacity={0.3} />
            <XAxis
              dataKey="position"
              type="number"
              domain={[1, 20]}
              label={{ value: 'Grid Position', position: 'insideBottomRight', offset: -10 }}
              xAxisId="position"
            />
            <YAxis
              domain={['auto', 'auto']}
              label={{ value: 'Lap Time (seconds)', angle: -90, position: 'insideLeft' }}
              yAxisId="time"
            />
            <Tooltip
              formatter={(value: any, name: any) => {
                // Safely extract driver code and session from the name
                if (typeof name !== 'string') return [value, name];
                
                const parts = name.toString().split('_');
                if (parts.length !== 2) return [value, name];
                
                const [driverCode, session] = parts;
                return [formatTooltipValue(value, session), driverCode];
              }}
              labelFormatter={(label) => `Position ${label}`}
              contentStyle={{ 
                backgroundColor: '#1a1a1a',
                borderColor: '#333',
                borderRadius: '5px',
                color: 'white'
              }}
            />
            <Legend 
              formatter={formatLegendText}
              iconSize={10}
              wrapperStyle={{ 
                opacity: 1,
                padding: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '5px'
              }}
            />
            
            {fastestLapTime && (
              <ReferenceLine 
                y={fastestLapTime.time} 
                stroke="#c026d3" 
                strokeDasharray="3 3" 
                label={{ 
                  value: `Fastest Lap: ${fastestLapTime.time.toFixed(3)}s (${fastestLapTime.driver} - ${fastestLapTime.session})`, 
                  position: 'right', 
                  fill: '#c026d3' 
                }} 
                yAxisId="time"
                xAxisId="position"
              />
            )}
            
            {/* Create lines for each driver and session */}
            {availableDrivers
              .filter(driver => visibleDrivers.includes(driver.code))
              .map(driver => {
                const lines = [];
                
                if ((activeSessions.includes('all') || activeSessions.includes('Q1')) && driver.q1Time) {
                  lines.push(
                    <Line
                      key={`${driver.code}_Q1`}
                      type="monotone"
                      dataKey={`${driver.code}_Q1`}
                      name={`${driver.code}_Q1`}
                      stroke={getSessionColor('Q1')}
                      strokeWidth={hoveredDriver === driver.code ? 3 : 2}
                      dot={{ r: 4, strokeWidth: 2, fill: 'white', stroke: getSessionColor('Q1') }}
                      activeDot={{ r: 8 }}
                      connectNulls
                      isAnimationActive={false}
                      xAxisId="position"
                      yAxisId="time"
                      opacity={hoveredDriver ? (hoveredDriver === driver.code ? 1 : 0.3) : 1}
                    />
                  );
                }
                
                if ((activeSessions.includes('all') || activeSessions.includes('Q2')) && driver.q2Time) {
                  lines.push(
                    <Line
                      key={`${driver.code}_Q2`}
                      type="monotone"
                      dataKey={`${driver.code}_Q2`}
                      name={`${driver.code}_Q2`}
                      stroke={getSessionColor('Q2')}
                      strokeWidth={hoveredDriver === driver.code ? 3 : 2}
                      dot={{ r: 4, strokeWidth: 2, fill: 'white', stroke: getSessionColor('Q2') }}
                      activeDot={{ r: 8 }}
                      connectNulls
                      isAnimationActive={false}
                      xAxisId="position"
                      yAxisId="time"
                      opacity={hoveredDriver ? (hoveredDriver === driver.code ? 1 : 0.3) : 1}
                    />
                  );
                }
                
                if ((activeSessions.includes('all') || activeSessions.includes('Q3')) && driver.q3Time) {
                  lines.push(
                    <Line
                      key={`${driver.code}_Q3`}
                      type="monotone"
                      dataKey={`${driver.code}_Q3`}
                      name={`${driver.code}_Q3`}
                      stroke={getSessionColor('Q3')}
                      strokeWidth={hoveredDriver === driver.code ? 3 : 2}
                      dot={{ r: 4, strokeWidth: 2, fill: 'white', stroke: getSessionColor('Q3') }}
                      activeDot={{ r: 8 }}
                      connectNulls
                      isAnimationActive={false}
                      xAxisId="position"
                      yAxisId="time"
                      opacity={hoveredDriver ? (hoveredDriver === driver.code ? 1 : 0.3) : 1}
                    />
                  );
                }
                
                return lines;
              })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default QualifyingChart; 
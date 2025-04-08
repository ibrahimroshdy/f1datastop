import React from "react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Tooltip, Legend, ReferenceLine, Label } from "recharts";
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

  // Format data for a bar chart - group by driver rather than position
  const formatBarChartData = () => {
    // We'll create an array of objects, each representing a driver
    return visibleDrivers.map(driverCode => {
      const driver = availableDrivers.find(d => d.code === driverCode);
      if (!driver) return null;
      
      // Create a data object for this driver with their qualifying times
      const driverData: any = {
        name: driverCode,
        position: driver.position,
        driverName: driver.name.split(' ').pop() || driver.name, // Last name
        team: driver.team
      };
      
      // Add session times if they should be visible
      if (activeSessions.includes('all') || activeSessions.includes('Q1')) {
        driverData.Q1 = driver.q1Time;
      }
      
      if (activeSessions.includes('all') || activeSessions.includes('Q2')) {
        driverData.Q2 = driver.q2Time;
      }
      
      if (activeSessions.includes('all') || activeSessions.includes('Q3')) {
        driverData.Q3 = driver.q3Time;
      }
      
      return driverData;
    }).filter(Boolean).sort((a, b) => a.position - b.position); // Sort by qualifying position
  };
  
  const qualifyingBarData = formatBarChartData();

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
          <BarChart
            data={qualifyingBarData}
            margin={{ top: 20, right: 40, left: 20, bottom: 20 }}
            barCategoryGap="20%"
            barSize={24}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" opacity={0.3} horizontal={true} vertical={false} />
            <XAxis 
              type="number"
              domain={['auto', 'auto']}
              label={{ value: 'Lap Time (seconds)', position: 'insideBottom', dy: 10 }}
              xAxisId="primary"
            />
            <YAxis
              dataKey="name"
              type="category"
              tickFormatter={(value) => `${value} (P${qualifyingBarData.find(d => d.name === value)?.position || '?'})`}
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={80}
              yAxisId="primary"
            />
            <Tooltip
              formatter={(value: any, name: any) => {
                if (typeof value !== 'number') return [value, name];
                return [formatTooltipValue(value, name), name];
              }}
              labelFormatter={(label) => {
                const driver = availableDrivers.find(d => d.code === label);
                return driver ? `${driver.name}` : label;
              }}
              contentStyle={{ 
                backgroundColor: '#1a1a1a',
                borderColor: '#333',
                borderRadius: '5px',
                color: 'white'
              }}
            />
            <Legend 
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
                x={fastestLapTime.time} 
                stroke="#c026d3" 
                strokeDasharray="3 3" 
                label={{ 
                  value: `Fastest: ${fastestLapTime.time.toFixed(3)}s (${fastestLapTime.driver} - ${fastestLapTime.session})`, 
                  position: 'top', 
                  fill: '#c026d3',
                  fontSize: 12
                }}
                xAxisId="primary"
                yAxisId="primary"
              />
            )}
            
            {/* Create bars for each qualifying session */}
            {activeSessions.includes('all') || activeSessions.includes('Q1') ? (
              <Bar 
                dataKey="Q1" 
                name="Q1" 
                fill={getSessionColor('Q1')} 
                opacity={hoveredDriver ? 0.7 : 1} 
                radius={[0, 4, 4, 0]}
                xAxisId="primary"
                yAxisId="primary"
              />
            ) : null}
            
            {activeSessions.includes('all') || activeSessions.includes('Q2') ? (
              <Bar 
                dataKey="Q2" 
                name="Q2" 
                fill={getSessionColor('Q2')} 
                opacity={hoveredDriver ? 0.7 : 1}
                radius={[0, 4, 4, 0]}
                xAxisId="primary"
                yAxisId="primary"
              />
            ) : null}
            
            {activeSessions.includes('all') || activeSessions.includes('Q3') ? (
              <Bar 
                dataKey="Q3" 
                name="Q3" 
                fill={getSessionColor('Q3')} 
                opacity={hoveredDriver ? 0.7 : 1}
                radius={[0, 4, 4, 0]}
                xAxisId="primary"
                yAxisId="primary"
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default QualifyingChart; 
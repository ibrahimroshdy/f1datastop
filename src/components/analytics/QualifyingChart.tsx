import React from "react";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Loader2, Check } from "lucide-react";
import { useQualifyingData, QualifyingSession } from "@/hooks/useQualifyingData";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
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

  // Format time for display
  const formatTimeDisplay = (seconds?: number): string => {
    if (!seconds) return "-";
    
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
  };

  // Get visible drivers sorted by position
  const getVisibleDrivers = () => {
    // If no drivers are explicitly selected, show all drivers
    if (selectedDrivers.length === 0) {
      return availableDrivers.sort((a, b) => a.position - b.position);
    }
    
    return availableDrivers
      .filter(driver => selectedDrivers.includes(driver.code))
      .sort((a, b) => a.position - b.position);
  };

  // Highlight the fastest time in each session
  const isFastestTime = (session: 'q1Time' | 'q2Time' | 'q3Time', time?: number): boolean => {
    if (!time) return false;
    
    // Get all times for this session from drivers who participated
    const times = availableDrivers
      .map(driver => driver[session])
      .filter(t => t !== undefined && t > 0) as number[];
    
    if (times.length === 0) return false;
    
    const fastestTime = Math.min(...times);
    return time === fastestTime;
  };

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

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col md:flex-row gap-4 justify-between mb-4">
        <SessionToggle 
          activeSessions={activeSessions} 
          onSessionToggle={handleSessionToggle} 
        />
      </div>
      
      {/* Driver Selection Legend */}
      <div className="mb-4">
        <h3 className="text-sm font-medium mb-2">Drivers</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          {availableDrivers.map(driver => (
            <button
              key={driver.code}
              onClick={() => handleDriverToggle(driver.code)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                selectedDrivers.includes(driver.code)
                  ? 'bg-gray-800 text-white'
                  : selectedDrivers.length > 0
                    ? 'bg-gray-200 text-gray-800'
                    : 'bg-gray-700 text-white'
              }`}
              style={{
                borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666'}`
              }}
            >
              {selectedDrivers.includes(driver.code) && <Check className="h-3 w-3" />}
              <span>{driver.code}</span>
            </button>
          ))}
        </div>
        {selectedDrivers.length > 0 && (
          <button 
            onClick={() => availableDrivers.forEach(d => {
              if (selectedDrivers.includes(d.code)) {
                handleDriverToggle(d.code);
              }
            })}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
          >
            Clear selection (show all)
          </button>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">Pos</TableHead>
              <TableHead className="w-20">Driver</TableHead>
              <TableHead className="w-32">Team</TableHead>
              {(activeSessions.includes('all') || activeSessions.includes('Q1')) && (
                <TableHead className="text-right">Q1 Time</TableHead>
              )}
              {(activeSessions.includes('all') || activeSessions.includes('Q2')) && (
                <TableHead className="text-right">Q2 Time</TableHead>
              )}
              {(activeSessions.includes('all') || activeSessions.includes('Q3')) && (
                <TableHead className="text-right">Q3 Time</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {getVisibleDrivers().map(driver => (
              <TableRow 
                key={driver.code}
                className={hoveredDriver === driver.code ? "bg-muted/50" : ""}
                onMouseEnter={() => handleDriverHover?.(driver.code)}
                onMouseLeave={() => handleDriverHover?.(null)}
                onClick={() => handleDriverToggle(driver.code)}
                style={{ cursor: "pointer" }}
              >
                <TableCell className="text-center font-medium">
                  {driver.position}
                </TableCell>
                <TableCell>
                  <div 
                    className="flex items-center gap-2"
                    style={{ borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666'}` }}
                  >
                    <span className="pl-2 font-medium">{driver.code}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground capitalize">
                    {driver.team.replace('_', ' ')}
                  </span>
                </TableCell>
                {(activeSessions.includes('all') || activeSessions.includes('Q1')) && (
                  <TableCell 
                    className={`text-right font-mono ${isFastestTime('q1Time', driver.q1Time) ? 'text-purple-500 font-bold' : ''}`}
                  >
                    {formatTimeDisplay(driver.q1Time)}
                  </TableCell>
                )}
                {(activeSessions.includes('all') || activeSessions.includes('Q2')) && (
                  <TableCell 
                    className={`text-right font-mono ${isFastestTime('q2Time', driver.q2Time) ? 'text-blue-500 font-bold' : ''}`}
                  >
                    {formatTimeDisplay(driver.q2Time)}
                  </TableCell>
                )}
                {(activeSessions.includes('all') || activeSessions.includes('Q3')) && (
                  <TableCell 
                    className={`text-right font-mono ${isFastestTime('q3Time', driver.q3Time) ? 'text-green-500 font-bold' : ''}`}
                  >
                    {formatTimeDisplay(driver.q3Time)}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {fastestLapTime && (
        <div className="mt-4 bg-slate-100 dark:bg-slate-800 p-2 rounded-md text-sm">
          <span className="font-medium">Fastest time: </span>
          <span className="font-mono font-medium text-purple-600 dark:text-purple-400">
            {formatTimeDisplay(fastestLapTime.time)}
          </span>
          <span className="ml-2">by {fastestLapTime.driver} in {fastestLapTime.session}</span>
        </div>
      )}
    </div>
  );
};

export default QualifyingChart; 
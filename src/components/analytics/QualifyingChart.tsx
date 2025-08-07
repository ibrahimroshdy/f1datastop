import React from "react";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Loader2, Check, ArrowUpDown, ArrowUpIcon, ArrowDownIcon } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import TeamLogo from "@/components/common/TeamLogo";

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

// Add the sort type to the component
interface QualifyingChartProps {
  year: number;
  round: string;
}

// Define sort keys type
type SortKey = 'position' | 'driver' | 'team' | 'q1Time' | 'q2Time' | 'q3Time';

const QualifyingChart: React.FC<QualifyingChartProps> = ({ year, round }) => {
  // Add sorting state
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'position',
    direction: 'asc'
  });

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

  // Get visible drivers sorted by the current sort config
  const getVisibleDrivers = () => {
    let driversToShow = selectedDrivers.length === 0 
      ? [...availableDrivers]
      : availableDrivers.filter(driver => selectedDrivers.includes(driver.code));
    
    // Sort drivers based on sortConfig
    return driversToShow.sort((a, b) => {
      let aValue: string | number | undefined;
      let bValue: string | number | undefined;

      switch (sortConfig.key) {
        case 'position':
          aValue = a.position;
          bValue = b.position;
          break;
        case 'driver':
          aValue = a.code;
          bValue = b.code;
          break;
        case 'team':
          aValue = a.team;
          bValue = b.team;
          break;
        case 'q1Time':
          aValue = a.q1Time && a.q1Time > 0 ? a.q1Time : undefined;
          bValue = b.q1Time && b.q1Time > 0 ? b.q1Time : undefined;
          break;
        case 'q2Time':
          aValue = a.q2Time && a.q2Time > 0 ? a.q2Time : undefined;
          bValue = b.q2Time && b.q2Time > 0 ? b.q2Time : undefined;
          break;
        case 'q3Time':
          aValue = a.q3Time && a.q3Time > 0 ? a.q3Time : undefined;
          bValue = b.q3Time && b.q3Time > 0 ? b.q3Time : undefined;
          break;
        default:
          aValue = a.position;
          bValue = b.position;
      }

      // Handle undefined values (put them at the end)
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      // Sort based on direction
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      } else {
        const numA = typeof aValue === 'number' ? aValue : 0;
        const numB = typeof bValue === 'number' ? bValue : 0;
        return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
      }
    });
  };

  // Handle column header click for sorting
  const handleSort = (key: SortKey) => {
    setSortConfig(current => {
      // If clicking the same column, toggle direction
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      // If clicking a new column, sort ascending by default
      return { key, direction: 'asc' };
    });
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
      <div className="mb-3 sm:mb-4">
        <h3 className="text-xs sm:text-sm font-medium mb-1 sm:mb-2">Drivers</h3>
        <div className="flex flex-wrap gap-1 sm:gap-2 mb-1 sm:mb-2 max-h-16 sm:max-h-none overflow-y-auto">
          {availableDrivers.map(driver => (
            <button
              key={driver.code}
              onClick={() => handleDriverToggle(driver.code)}
              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 flex-shrink-0 ${
                selectedDrivers.includes(driver.code)
                  ? 'bg-gray-800 text-white'
                  : selectedDrivers.length > 0
                    ? 'bg-gray-200 text-gray-800'
                    : 'bg-gray-700 text-white'
              }`}
              style={{
                borderLeft: `2px solid ${TEAM_COLORS[driver.team] || '#666'}`
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
      
      <div className="overflow-auto flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="w-10 sm:w-16 text-center sticky top-0 bg-background cursor-pointer hover:bg-accent/50 text-xs sm:text-sm px-1 sm:px-4"
                onClick={() => handleSort('position')}
              >
                <div className="flex items-center justify-center">
                  Pos
                  {sortConfig.key === 'position' ? (
                    sortConfig.direction === 'asc' ? (
                      <ArrowUpIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    ) : (
                      <ArrowDownIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1 opacity-50" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="w-14 sm:w-20 sticky top-0 bg-background cursor-pointer hover:bg-accent/50 text-xs sm:text-sm px-1 sm:px-4"
                onClick={() => handleSort('driver')}
              >
                <div className="flex items-center">
                  Driver
                  {sortConfig.key === 'driver' ? (
                    sortConfig.direction === 'asc' ? (
                      <ArrowUpIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    ) : (
                      <ArrowDownIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1 opacity-50" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="w-16 sm:w-32 sticky top-0 bg-background cursor-pointer hover:bg-accent/50 text-center text-xs sm:text-sm px-1 sm:px-4"
                onClick={() => handleSort('team')}
              >
                <div className="flex items-center justify-center">
                  Team
                  {sortConfig.key === 'team' ? (
                    sortConfig.direction === 'asc' ? (
                      <ArrowUpIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    ) : (
                      <ArrowDownIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1 opacity-50" />
                  )}
                </div>
              </TableHead>
              {(activeSessions.includes('all') || activeSessions.includes('Q1')) && (
                <TableHead 
                  className="text-right sticky top-0 bg-background cursor-pointer hover:bg-accent/50 text-xs sm:text-sm px-1 sm:px-4"
                  onClick={() => handleSort('q1Time')}
                >
                  <div className="flex items-center justify-end">
                    <span className="hidden sm:inline">Q1 Time</span>
                    <span className="sm:hidden">Q1</span>
                    {sortConfig.key === 'q1Time' ? (
                      sortConfig.direction === 'asc' ? (
                        <ArrowUpIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                      ) : (
                        <ArrowDownIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1 opacity-50" />
                    )}
                  </div>
                </TableHead>
              )}
              {(activeSessions.includes('all') || activeSessions.includes('Q2')) && (
                <TableHead 
                  className="text-right sticky top-0 bg-background cursor-pointer hover:bg-accent/50 text-xs sm:text-sm px-1 sm:px-4"
                  onClick={() => handleSort('q2Time')}
                >
                  <div className="flex items-center justify-end">
                    <span className="hidden sm:inline">Q2 Time</span>
                    <span className="sm:hidden">Q2</span>
                    {sortConfig.key === 'q2Time' ? (
                      sortConfig.direction === 'asc' ? (
                        <ArrowUpIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                      ) : (
                        <ArrowDownIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1 opacity-50" />
                    )}
                  </div>
                </TableHead>
              )}
              {(activeSessions.includes('all') || activeSessions.includes('Q3')) && (
                <TableHead 
                  className="text-right sticky top-0 bg-background cursor-pointer hover:bg-accent/50 text-xs sm:text-sm px-1 sm:px-4"
                  onClick={() => handleSort('q3Time')}
                >
                  <div className="flex items-center justify-end">
                    <span className="hidden sm:inline">Q3 Time</span>
                    <span className="sm:hidden">Q3</span>
                    {sortConfig.key === 'q3Time' ? (
                      sortConfig.direction === 'asc' ? (
                        <ArrowUpIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                      ) : (
                        <ArrowDownIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1 opacity-50" />
                    )}
                  </div>
                </TableHead>
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
                <TableCell className="text-center font-medium px-1 sm:px-4 py-2 text-xs sm:text-sm">
                  {driver.position}
                </TableCell>
                <TableCell className="px-1 sm:px-4 py-2">
                  <div 
                    className="flex items-center gap-1 sm:gap-2"
                    style={{ borderLeft: `2px solid ${TEAM_COLORS[driver.team] || '#666'}` }}
                  >
                    <span className="pl-1 sm:pl-2 font-medium text-xs sm:text-sm">{driver.code}</span>
                  </div>
                </TableCell>
                <TableCell className="px-1 sm:px-4 py-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-center w-full">
                          <TeamLogo constructorId={driver.team} size="sm" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="capitalize">{driver.team.replace('_', ' ')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                {(activeSessions.includes('all') || activeSessions.includes('Q1')) && (
                  <TableCell 
                    className={`text-right font-mono px-1 sm:px-4 py-2 text-xs sm:text-sm ${isFastestTime('q1Time', driver.q1Time) ? 'text-purple-500 font-bold' : ''}`}
                  >
                    {formatTimeDisplay(driver.q1Time)}
                  </TableCell>
                )}
                {(activeSessions.includes('all') || activeSessions.includes('Q2')) && (
                  <TableCell 
                    className={`text-right font-mono px-1 sm:px-4 py-2 text-xs sm:text-sm ${isFastestTime('q2Time', driver.q2Time) ? 'text-blue-500 font-bold' : ''}`}
                  >
                    {formatTimeDisplay(driver.q2Time)}
                  </TableCell>
                )}
                {(activeSessions.includes('all') || activeSessions.includes('Q3')) && (
                  <TableCell 
                    className={`text-right font-mono px-1 sm:px-4 py-2 text-xs sm:text-sm ${isFastestTime('q3Time', driver.q3Time) ? 'text-green-500 font-bold' : ''}`}
                  >
                    {formatTimeDisplay(driver.q3Time)}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default QualifyingChart; 
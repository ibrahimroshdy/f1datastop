
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Driver {
  driverId: string;
  code: string;
  name: string;
  team: string;
  finishPosition: number;
  hasFastestLap?: boolean;
}

interface DriverSelectorProps {
  availableDrivers: Driver[];
  selectedDrivers: string[];
  onDriverToggle: (driverCode: string) => void;
  onDriverHover?: (driverCode: string | null) => void;
  displayMode: 'absolute' | 'gap';
  fastestLapTime: { time: number, driver: string } | null;
  getAverageTime: (driverCode: string) => number | null;
}

const DriverSelector: React.FC<DriverSelectorProps> = ({
  availableDrivers,
  selectedDrivers,
  onDriverToggle,
  onDriverHover,
  displayMode,
  fastestLapTime,
  getAverageTime
}) => {
  return (
    <div className="flex flex-col gap-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <span className="font-medium">Fastest Lap:</span>
        <Badge className="flex items-center gap-1 bg-purple-600 text-white">
          FL
        </Badge>
      </div>
      
      {/* Scrollable driver grid */}
      <ScrollArea className="h-auto max-h-[180px] border rounded-md border-gray-200 dark:border-gray-800 p-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {availableDrivers.map(driver => {
            const isSelected = selectedDrivers.includes(driver.code);
            const averageTime = getAverageTime(driver.code);
            const hasFastestLap = fastestLapTime && driver.code === fastestLapTime.driver;
            const teamColor = TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666";
            
            return (
              <button
                key={driver.code}
                className={`p-2 rounded text-xs flex flex-col transition-all duration-200 ${
                  isSelected
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
                onClick={() => onDriverToggle(driver.code)}
                onMouseEnter={() => onDriverHover && onDriverHover(driver.code)}
                onMouseLeave={() => onDriverHover && onDriverHover(null)}
                style={{
                  borderLeft: `4px solid ${teamColor}`,
                  opacity: isSelected || !onDriverHover ? 1 : 0.7,
                }}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">{driver.code}</span>
                  <div className="flex items-center">
                    <span className="text-[10px] opacity-70 mr-1">P{driver.finishPosition}</span>
                    {hasFastestLap && (
                      <Badge className="bg-purple-600 text-[0.65rem] px-1.5 py-0 h-4">
                        FL
                      </Badge>
                    )}
                  </div>
                </div>
                
                {averageTime !== null && (
                  <div className="grid grid-cols-2 gap-1 w-full text-[10px]">
                    <div className="flex items-center justify-between border-r pr-1">
                      <span className="opacity-70">Avg:</span>
                      <span className="font-medium">
                        {displayMode === 'absolute' ? formatTime(averageTime) : `+${(averageTime - (fastestLapTime?.time || 0)).toFixed(3)}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pl-1">
                      <span className="opacity-70">Gap:</span>
                      <span className="font-medium">
                        {fastestLapTime ? `+${((averageTime || 0) - fastestLapTime.time > 0 ? ((averageTime || 0) - fastestLapTime.time).toFixed(3) : 0)}s` : 'N/A'}
                      </span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

// Format time function
const formatTime = (seconds: number): string => {
  if (!seconds) return "N/A";
  
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, '0')}`;
};

export default DriverSelector;

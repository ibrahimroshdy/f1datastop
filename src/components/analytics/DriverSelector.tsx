
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { formatTime } from "@/utils/lapTimeUtils";

interface DriverSelectorProps {
  availableDrivers: any[];
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
    <div className="flex flex-wrap gap-2 py-1">
      {availableDrivers.map(driver => {
        const isSelected = selectedDrivers.includes(driver.code);
        const averageTime = getAverageTime(driver.code);
        const hasFastestLap = fastestLapTime && driver.code === fastestLapTime.driver;
        
        return (
          <button
            key={driver.code}
            className={`
              px-3 py-1.5 rounded-md text-sm font-medium flex flex-col items-start
              transition-all duration-200 ease-in-out
              ${isSelected 
                ? 'bg-gray-800 text-white ring-2 ring-offset-2 ring-offset-background ring-gray-800' 
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}
              ${onDriverHover ? 'cursor-pointer' : ''}
            `}
            onClick={() => onDriverToggle(driver.code)}
            onMouseEnter={() => onDriverHover && onDriverHover(driver.code)}
            onMouseLeave={() => onDriverHover && onDriverHover(null)}
            style={{
              borderLeft: `4px solid ${TEAM_COLORS[driver.team] || '#666'}`,
              transform: isSelected ? 'translateY(-2px)' : 'none',
              boxShadow: isSelected ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none'
            }}
          >
            <div className="flex items-center gap-1.5">
              <span className="font-bold">{driver.code}</span>
              <span className="text-xs opacity-70">P{driver.finishPosition}</span>
              {hasFastestLap && (
                <Badge className="ml-1 bg-purple-600 text-[0.65rem] px-1.5 py-0 h-4">
                  FL
                </Badge>
              )}
            </div>
            
            {averageTime !== null && isSelected && (
              <span className="text-xs opacity-80">
                {displayMode === 'absolute' 
                  ? formatTime(averageTime) 
                  : `+${(averageTime - (fastestLapTime?.time || 0)).toFixed(3)}s`}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default DriverSelector;

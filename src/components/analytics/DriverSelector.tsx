
import React from 'react';
import { TEAM_COLORS } from "@/constants/f1Colors";
import { formatTime } from "@/utils/lapTimeUtils";

interface Driver {
  driverId: string;
  code: string;
  name: string;
  team: string;
  hasFastestLap?: boolean;
  fastestLapTime?: string | null;
  finishPosition?: number;
}

interface DriverSelectorProps {
  availableDrivers: Driver[];
  selectedDrivers: string[];
  onDriverToggle: (driverCode: string) => void;
  displayMode: 'absolute' | 'gap';
  fastestLapTime: {time: number, driver: string} | null;
  getAverageTime: (driverCode: string) => { avg: string, laps: number } | null;
}

const DriverSelector: React.FC<DriverSelectorProps> = ({
  availableDrivers,
  selectedDrivers,
  onDriverToggle,
  displayMode,
  fastestLapTime,
  getAverageTime
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      {availableDrivers.map(driver => {
        const avgData = getAverageTime(driver.code);
        return (
          <button
            key={driver.code}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
              selectedDrivers.includes(driver.code)
                ? 'bg-gray-800 text-white'
                : 'bg-gray-200 text-gray-800'
            }`}
            onClick={() => onDriverToggle(driver.code)}
            style={{
              borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666'}`
            }}
          >
            <span>{driver.code}</span>
            {avgData && (
              <span className="text-xs opacity-75 ml-1">
                {displayMode === 'absolute' ? formatTime(Number(avgData.avg)) : ''}
              </span>
            )}
            {fastestLapTime?.driver === driver.code && (
              <span className="text-purple-500 ml-1">⚡</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default DriverSelector;

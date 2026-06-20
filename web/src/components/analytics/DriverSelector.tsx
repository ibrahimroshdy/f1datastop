import React from 'react';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";

interface Driver {
  driverId: string;
  code: string;
  name: string;
  lastName?: string;
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

// Format time function removed — display uses parent formatters

const DriverSelector: React.FC<DriverSelectorProps> = ({
  availableDrivers,
  selectedDrivers,
  onDriverToggle,
  fastestLapTime,
}) => {
  const { baseTheme } = useTheme();
  const isDark = baseTheme === 'dark';

  // Track teammates for line indicator
  const teamDriverCounts: { [team: string]: number } = {};

  return (
    <div className="flex flex-col gap-1">
      {/* Compact grid of driver chips */}
      <div className={cn(
        "grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-0.5 p-1 rounded border",
        isDark ? "bg-zinc-900/30 border-zinc-800" : "bg-zinc-50/50 border-zinc-200"
      )}>
        {availableDrivers.map(driver => {
          const isSelected = selectedDrivers.includes(driver.code);
          const hasFastestLap = fastestLapTime && driver.code === fastestLapTime.driver;
          const teamColor = TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666";
          
          // Track which teammate this is
          const currentCount = teamDriverCounts[driver.team] || 0;
          teamDriverCounts[driver.team] = currentCount + 1;
          const isSecondTeammate = currentCount > 0;
          
          return (
            <button
              key={driver.code}
              className={cn(
                "flex items-center justify-between gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium transition-all",
                isSelected
                  ? isDark
                    ? "bg-zinc-800 text-white"
                    : "bg-white text-zinc-900 shadow-sm"
                  : isDark
                    ? "bg-transparent text-zinc-500 hover:bg-zinc-800/50"
                    : "bg-transparent text-zinc-400 hover:bg-zinc-100",
                hasFastestLap && isSelected && "ring-1 ring-purple-500/30"
              )}
              onClick={() => onDriverToggle(driver.code)}
              style={{ 
                opacity: isSelected ? 1 : 0.6,
                borderLeft: `2px solid ${teamColor}`,
              }}
            >
              {/* Left: Team dot + Code */}
              <div className="flex items-center gap-0.5">
                <div 
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    isSecondTeammate && "ring-1 ring-offset-0",
                    isSecondTeammate && (isDark ? "ring-zinc-400" : "ring-zinc-500")
                  )}
                  style={{ backgroundColor: teamColor }}
                />
                <span className={cn("font-bold", hasFastestLap && "text-purple-400")}>
                  {driver.code}
                </span>
                {hasFastestLap && <Zap className="h-2 w-2 text-purple-400" fill="currentColor" />}
              </div>
              
              {/* Right: Position or time */}
              <span className="text-[8px] font-mono text-muted-foreground">
                P{driver.finishPosition}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Inline legend */}
      <div className="flex items-center gap-2 text-[8px] text-muted-foreground px-0.5">
        <span className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />1st
        </span>
        <span className="flex items-center gap-0.5">
          <div className={cn("w-1.5 h-1.5 rounded-full bg-zinc-500 ring-1", isDark ? "ring-zinc-400" : "ring-zinc-500")} />2nd
        </span>
        {fastestLapTime && (
          <span className="flex items-center gap-0.5 text-purple-500">
            <Zap className="h-2 w-2" fill="currentColor" />FL
          </span>
        )}
      </div>
    </div>
  );
};

export default DriverSelector;

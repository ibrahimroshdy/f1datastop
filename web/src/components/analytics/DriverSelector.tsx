import React from 'react';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
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
  // Track teammates for line indicator
  const teamDriverCounts: { [team: string]: number } = {};

  return (
    <div className="flex flex-col gap-1">
      {/* Compact grid of driver chips */}
      <div className={cn(
        "grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1 p-1 rounded border",
        "bg-muted/30 border-border"
      )}>
        {availableDrivers.map(driver => {
          const isSelected = selectedDrivers.includes(driver.code);
          const hasFastestLap = fastestLapTime && driver.code === fastestLapTime.driver;
          const teamColor = TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || TEAM_COLORS.default;
          
          // Track which teammate this is
          const currentCount = teamDriverCounts[driver.team] || 0;
          teamDriverCounts[driver.team] = currentCount + 1;
          const isSecondTeammate = currentCount > 0;
          
          return (
            <button
              key={driver.code}
              className={cn(
                "flex min-h-9 items-center justify-between gap-0.5 rounded px-1.5 py-1.5 text-xs font-medium transition-all",
                isSelected
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "bg-transparent text-muted-foreground hover:bg-muted/50",
                hasFastestLap && isSelected && "ring-1 ring-primary/30"
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
                    isSecondTeammate && "ring-muted-foreground"
                  )}
                  style={{ backgroundColor: teamColor }}
                />
                <span className={cn("font-bold", hasFastestLap && "text-primary")}>
                  {driver.code}
                </span>
                {hasFastestLap && <Zap className="h-2 w-2 text-primary" fill="currentColor" />}
              </div>

              {/* Right: Position or time */}
              <span className="text-xs font-mono tabular-nums text-muted-foreground">
                P{driver.finishPosition}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Inline legend */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-0.5">
        <span className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />1st
        </span>
        <span className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground ring-1 ring-muted-foreground" />2nd
        </span>
        {fastestLapTime && (
          <span className="flex items-center gap-0.5 text-primary">
            <Zap className="h-2 w-2" fill="currentColor" />FL
          </span>
        )}
      </div>
    </div>
  );
};

export default DriverSelector;

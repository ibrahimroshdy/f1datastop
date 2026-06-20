import React from "react";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

// Define types for the driver and position summary
interface Driver {
  driverId: string;
  code: string;
  name: string;
  team: string;
  finishPosition: number;
  grid: number;
}

interface PositionChangeSummary {
  start: number;
  end: number;
  change: number;
  improved: boolean;
  isDNF?: boolean;
  status?: string;
}

interface DriverSelectionGridProps {
  availableDrivers: Driver[];
  selectedDrivers: string[];
  onDriverToggle: (driverCode: string) => void;
  onDriverHover: (driverCode: string | null) => void;
  getPositionChangeSummary: (driverCode: string) => PositionChangeSummary | null;
}

const DriverSelectionGrid: React.FC<DriverSelectionGridProps> = ({
  availableDrivers,
  selectedDrivers,
  onDriverToggle,
  getPositionChangeSummary
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
          const summary = getPositionChangeSummary(driver.code);
          const teamColor = TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666";
          const isSelected = selectedDrivers.includes(driver.code);
          
          // Track which teammate this is
          const currentCount = teamDriverCounts[driver.team] || 0;
          teamDriverCounts[driver.team] = currentCount + 1;
          const isSecondTeammate = currentCount > 0;

          const isDNF = summary?.isDNF || false;
          
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
                isDNF && isSelected && "ring-1 ring-red-500/30"
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
                <span className={cn("font-bold", isDNF && "text-red-400")}>
                  {driver.code}
                </span>
              </div>
              
              {/* Right: Change indicator */}
              {summary && !isDNF ? (
                <span className={cn(
                  "text-[8px] font-mono",
                  summary.improved ? "text-emerald-500" : summary.change < 0 ? "text-red-500" : "text-zinc-500"
                )}>
                  {summary.improved ? `+${summary.change}` : summary.change < 0 ? summary.change : "="}
                </span>
              ) : isDNF ? (
                <span className="text-[7px] text-red-500 font-bold">DNF</span>
              ) : null}
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
        <span className="text-emerald-500">+Gain</span>
        <span className="text-red-500">-Loss</span>
      </div>
    </div>
  );
};

export default DriverSelectionGrid;

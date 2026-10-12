import React from "react";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
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
  // Track teammates for line indicator
  const teamDriverCounts: { [team: string]: number } = {};

  return (
    <div className="flex flex-col gap-1">
      {/* Compact grid of driver chips */}
      <div className={cn(
        "grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-0.5 p-1 rounded border border-border",
        "bg-muted/30"
      )}>
        {availableDrivers.map(driver => {
          const summary = getPositionChangeSummary(driver.code);
          const teamColor = TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "hsl(var(--muted-foreground))";
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
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "bg-transparent text-muted-foreground hover:bg-muted/50",
                isDNF && isSelected && "ring-1 ring-loss/30"
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
                <span className={cn("font-bold", isDNF && "text-loss")}>
                  {driver.code}
                </span>
              </div>
              
              {/* Right: Change indicator */}
              {summary && !isDNF ? (
                <span className={cn(
                  "text-[8px] font-mono",
                  summary.improved ? "text-gain" : summary.change < 0 ? "text-loss" : "text-muted-foreground"
                )}>
                  {summary.improved ? `+${summary.change}` : summary.change < 0 ? summary.change : "="}
                </span>
              ) : isDNF ? (
                <span className="text-[7px] text-loss font-bold">DNF</span>
              ) : null}
            </button>
          );
        })}
      </div>
      
      {/* Inline legend */}
      <div className="flex items-center gap-2 text-[8px] text-muted-foreground px-0.5">
        <span className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />1st
        </span>
        <span className="flex items-center gap-0.5">
          <div className={cn("w-1.5 h-1.5 rounded-full bg-muted-foreground ring-1", "ring-muted-foreground")} />2nd
        </span>
        <span className="text-gain">+Gain</span>
        <span className="text-loss">-Loss</span>
      </div>
    </div>
  );
};

export default DriverSelectionGrid;

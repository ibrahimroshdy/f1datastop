
import React from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  onDriverHover,
  getPositionChangeSummary
}) => {
  return (
    <div className="flex flex-col gap-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <span className="font-medium">Position Change:</span>
        <Badge className="flex items-center gap-1 bg-green-100 text-green-800">
          <ArrowUp size={12} /> Improved
        </Badge>
        <Badge className="flex items-center gap-1 bg-red-100 text-red-800">
          <ArrowDown size={12} /> Lost positions
        </Badge>
        <Badge className="flex items-center gap-1 bg-gray-100 text-gray-800">
          <Minus size={12} /> No change
        </Badge>
      </div>
      
      {/* Scrollable driver grid */}
      <ScrollArea className="h-auto max-h-[180px] border rounded-md border-gray-200 dark:border-gray-800 p-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {availableDrivers.map(driver => {
            const summary = getPositionChangeSummary(driver.code);
            const teamColor = TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666";
            
            return (
              <button
                key={driver.code}
                className={`p-2 rounded text-xs flex flex-col transition-all duration-200 ${
                  selectedDrivers.includes(driver.code)
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
                onClick={() => onDriverToggle(driver.code)}
                onMouseEnter={() => onDriverHover(driver.code)}
                onMouseLeave={() => onDriverHover(null)}
                style={{
                  borderLeft: `4px solid ${teamColor}`,
                  opacity: 1,
                }}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">{driver.code}</span>
                  {summary && (
                    <span 
                      className={`flex items-center ${
                        summary.improved 
                          ? 'text-green-500' 
                          : summary.change < 0 
                            ? 'text-red-500' 
                            : 'text-gray-500'
                      }`}
                    >
                      {summary.improved ? (
                        <ArrowUp size={12} className="mr-0.5" />
                      ) : summary.change < 0 ? (
                        <ArrowDown size={12} className="mr-0.5" />
                      ) : (
                        <Minus size={12} className="mr-0.5" />
                      )}
                      {Math.abs(summary.change)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1 w-full text-[10px]">
                  <div className="flex items-center justify-between border-r pr-1">
                    <span className="opacity-70">Start:</span>
                    <span className="font-medium">{driver.grid || 'P?'}</span>
                  </div>
                  <div className="flex items-center justify-between pl-1">
                    <span className="opacity-70">End:</span>
                    <span className="font-medium">{summary?.end || 'DNF'}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default DriverSelectionGrid;

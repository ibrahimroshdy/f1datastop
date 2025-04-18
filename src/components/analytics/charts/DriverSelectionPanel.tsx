import React from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";

interface DriverSelectionPanelProps {
  availableDrivers: any[];
  selectedDrivers: string[];
  onDriverToggle: (driverCode: string) => void;
  onDriverHover: (driverCode: string | null) => void;
}

interface PositionChangeSummary {
  start: number;
  end: number;
  change: number;
  improved: boolean;
}

const DriverSelectionPanel: React.FC<DriverSelectionPanelProps & {
  getPositionChangeSummary: (driverCode: string) => PositionChangeSummary | null;
}> = ({
  availableDrivers,
  selectedDrivers,
  onDriverToggle,
  onDriverHover,
  getPositionChangeSummary
}) => {
  return (
    <div className="mb-4 flex flex-wrap justify-start items-center gap-2 max-h-28 overflow-y-auto">
      {availableDrivers.map(driver => {
        const summary = getPositionChangeSummary(driver.code);
        return (
          <button
            key={driver.code}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all duration-200 ${
              selectedDrivers.includes(driver.code)
                ? 'bg-gray-800 text-white outline outline-2 outline-gray-400'
                : 'bg-gray-200 text-gray-800'
            }`}
            onClick={() => onDriverToggle(driver.code)}
            onMouseEnter={() => onDriverHover(driver.code)}
            onMouseLeave={() => onDriverHover(null)}
            style={{
              borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666'}`
            }}
          >
            <span>{driver.code}</span>
            {summary && (
              <span className={`text-xs ml-1 flex items-center ${
                summary.improved 
                  ? 'text-green-500' 
                  : summary.change === 0 
                    ? 'text-gray-500' 
                    : 'text-red-500'
              }`}>
                {summary.improved ? (
                  <><ArrowUp size={10} /> {summary.change}</>
                ) : summary.change === 0 ? (
                  <><Minus size={10} /> 0</>
                ) : (
                  <><ArrowDown size={10} /> {Math.abs(summary.change)}</>
                )}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default DriverSelectionPanel;

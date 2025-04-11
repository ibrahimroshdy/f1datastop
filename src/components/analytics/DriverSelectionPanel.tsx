import React from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { Driver } from "@/hooks/useTelemetryData";

interface DriverSelectionPanelProps {
  drivers: Driver[];
  selectedDrivers: number[];
  onToggleDriver: (driverNumber: number) => void;
  multiSelect?: boolean;
  className?: string;
}

const DriverSelectionPanel: React.FC<DriverSelectionPanelProps> = ({
  drivers,
  selectedDrivers,
  onToggleDriver,
  multiSelect = true,
  className = ""
}) => {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {drivers.map((driver) => (
        <Button
          key={driver.driver_number}
          className={`px-3 py-1 h-auto rounded-md font-semibold text-sm leading-tight flex items-center gap-1.5 ${
            selectedDrivers.includes(driver.driver_number)
              ? "bg-white text-gray-900"
              : driver.hasError
              ? "bg-red-800/50 hover:bg-red-800/70 text-white"
              : "bg-gray-800 hover:bg-gray-700 text-white"
          }`}
          onClick={() => onToggleDriver(driver.driver_number)}
          style={{}}
        >
          <div 
            className="w-2.5 h-2.5 rounded-full" 
            style={{ backgroundColor: driver.team_color }}
          ></div>
          <span className="font-mono mr-1">{driver.driver_number}</span>
          {driver.name_acronym}
          {driver.isLoading && (
            <Loader2 className="h-3 w-3 animate-spin ml-1" />
          )}
          {driver.hasError && (
            <AlertCircle className="h-3 w-3 text-red-400 ml-1" />
          )}
        </Button>
      ))}
    </div>
  );
};

export default DriverSelectionPanel; 
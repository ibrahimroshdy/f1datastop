import React from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Driver } from "@/hooks/useTelemetryData";

interface DriverSelectionPanelProps {
  drivers: Driver[];
  selectedDrivers: number[];
  onToggleDriver: (driverNumber: number) => void;
  multiSelect?: boolean;
  className?: string;
  driverData?: {[key: number]: any[]};
}

const DriverSelectionPanel: React.FC<DriverSelectionPanelProps> = ({
  drivers,
  selectedDrivers,
  onToggleDriver,
  multiSelect = true,
  className = "",
  driverData = {}
}) => {
  // Function to check if a driver has data
  const hasData = (driverNumber: number) => {
    return driverData[driverNumber] && driverData[driverNumber].length > 0;
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {drivers.map((driver) => (
        <Button
          key={driver.driver_number}
          className={`px-3 py-1 h-auto rounded-md font-semibold text-sm leading-tight flex items-center gap-1.5 ${
            selectedDrivers.includes(driver.driver_number)
              ? "bg-white text-gray-900 outline outline-2 outline-gray-400"
              : driver.hasError
              ? "bg-red-800/50 hover:bg-red-800/70 text-white"
              : hasData(driver.driver_number) 
              ? "bg-gray-800 hover:bg-gray-700 text-white border-green-500 border-opacity-50"
              : "bg-gray-800 hover:bg-gray-700 text-white"
          }`}
          onClick={() => onToggleDriver(driver.driver_number)}
          style={{}}
          title={driver.hasError ? "Failed to load data" : hasData(driver.driver_number) ? "Data available" : "No data loaded yet"}
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
          {!driver.isLoading && !driver.hasError && hasData(driver.driver_number) && (
            <CheckCircle2 className="h-3 w-3 text-green-400 ml-1" />
          )}
        </Button>
      ))}
    </div>
  );
};

export default DriverSelectionPanel; 
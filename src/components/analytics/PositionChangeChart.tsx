
import React from "react";
import { usePositionChangeData } from "@/hooks/usePositionChangeData";
import PositionChart from "./charts/PositionChart";
import DriverSelectionPanel from "./charts/DriverSelectionPanel";
import ChartLoadingState from "./charts/ChartLoadingState";
import { TEAM_COLORS } from "@/constants/f1Colors";

interface PositionChangeChartProps {
  year: number;
  round: string;
}

const PositionChangeChart: React.FC<PositionChangeChartProps> = ({ year, round }) => {
  const {
    chartData,
    availableDrivers,
    selectedDrivers,
    hoveredDriver,
    visibleDrivers,
    isLoading,
    isProcessingData,
    isError,
    error,
    retryCount,
    totalLaps,
    maxLap,
    handleDriverToggle,
    handleDriverHover,
    getPositionChangeSummary,
  } = usePositionChangeData(year, round);

  // Show loading or error states
  if (isLoading || isError) {
    return (
      <ChartLoadingState
        isLoading={isLoading}
        isProcessingData={isProcessingData}
        isError={isError}
        retryCount={retryCount}
        totalLaps={totalLaps}
      />
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-muted-foreground">
          No position data available for this race
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          This could be because the race hasn't occurred yet or position data wasn't recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <DriverSelectionPanel
        availableDrivers={availableDrivers}
        selectedDrivers={selectedDrivers}
        onDriverToggle={handleDriverToggle}
        onDriverHover={handleDriverHover}
        getPositionChangeSummary={getPositionChangeSummary}
      />
      
      <PositionChart
        chartData={chartData}
        availableDrivers={availableDrivers}
        visibleDrivers={visibleDrivers}
        hoveredDriver={hoveredDriver}
        maxLap={maxLap}
      />
      
      <div className="flex justify-between items-center mt-2">
        <p className="text-xs text-muted-foreground">
          Total Laps: {maxLap}
        </p>
      </div>
    </div>
  );
};

export default PositionChangeChart;

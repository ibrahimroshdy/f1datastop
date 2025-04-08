
import React, { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { usePositionChangeData } from "@/hooks/usePositionChangeData";
import DriverSelectionGrid from "./charts/DriverSelectionGrid";
import DataLoadingProgress from "./DataLoadingProgress";
import PositionVisxChart from "./charts/PositionVisxChart";

interface PositionChangeChartProps {
  year: number;
  round: string;
}

const PositionChangeChart: React.FC<PositionChangeChartProps> = ({ year, round }) => {
  const {
    chartData,
    availableDrivers,
    selectedDrivers,
    visibleDrivers,
    hoveredDriver,
    isLoading,
    isError,
    loadingProgress,
    errorMessage,
    maxLap,
    retryCount,
    handleDriverToggle,
    handleDriverHover,
    getPositionChangeSummary,
  } = usePositionChangeData(year, round);

  // Render loading state with progress indicator
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <DataLoadingProgress 
          isLoading={true}
          progress={loadingProgress}
          message={errorMessage}
          isError={isError}
          retryCount={retryCount}
          maxRetries={15}
        />
        <div className="pt-6 text-center">
          <p className="text-muted-foreground">
            {loadingProgress < 50 ? "Loading position data..." : "Processing race data..."}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            The F1 API has rate limits. Automatic retries are in progress if needed.
          </p>
        </div>
      </div>
    );
  }

  // Handle error state
  if (isError) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <Alert className="bg-red-50 border-red-200 text-red-900 mb-4">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription>
            Unable to load position data due to API rate limits.
            Please try again in a few minutes or select a different race.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Handle no data state
  if (chartData.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <p className="text-muted-foreground">
          No position data available for this race
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          This could be because the race hasn't occurred yet or position data wasn't recorded
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Driver selection grid */}
      <DriverSelectionGrid 
        availableDrivers={availableDrivers}
        selectedDrivers={selectedDrivers}
        onDriverToggle={handleDriverToggle}
        onDriverHover={handleDriverHover}
        getPositionChangeSummary={getPositionChangeSummary}
      />
      
      {/* Use the new visx chart instead of Recharts */}
      <PositionVisxChart
        chartData={chartData}
        availableDrivers={availableDrivers}
        visibleDrivers={visibleDrivers}
        hoveredDriver={hoveredDriver}
        maxLap={maxLap}
      />
    </div>
  );
};

export default PositionChangeChart;

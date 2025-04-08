
import React, { useState } from "react";
import { ResponsiveContainer, LineChart, CartesianGrid, Tooltip, Legend } from "recharts";
import { XAxis, YAxis, Line } from "@/utils/rechartsWrapper";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { usePositionChangeData } from "@/hooks/usePositionChangeData";
import DriverSelectionGrid from "./charts/DriverSelectionGrid";
import DataLoadingProgress from "./DataLoadingProgress";

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
      
      <div className="h-[450px] mt-4 flex-grow">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" opacity={0.3} />
            <XAxis
              dataKey="lap"
              type="number"
              domain={[1, maxLap]}
              label={{ value: 'Lap Number', position: 'insideBottomRight', offset: -10 }}
            />
            <YAxis
              reversed
              domain={[1, 20]}
              label={{ value: 'Position', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={(value) => [`Position: ${value}`, '']}
              labelFormatter={(label) => `Lap ${label}`}
              contentStyle={{ 
                backgroundColor: '#1a1a1a',
                borderColor: '#333',
                borderRadius: '5px',
                color: 'white'
              }}
            />
            <Legend
              formatter={(value) => {
                const driver = availableDrivers.find(d => d.code === value);
                return driver ? `${value} (${driver.name.split(' ').pop()})` : value;
              }}
            />
            {availableDrivers
              .filter(driver => visibleDrivers.includes(driver.code))
              .map(driver => (
                <Line
                  key={driver.code}
                  type="monotone"
                  dataKey={driver.code}
                  name={driver.code}
                  stroke={TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666"}
                  strokeWidth={hoveredDriver === driver.code ? 3 : 2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 8 }}
                  connectNulls
                  isAnimationActive={false}
                  opacity={hoveredDriver ? (hoveredDriver === driver.code ? 1 : 0.3) : 1}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PositionChangeChart;

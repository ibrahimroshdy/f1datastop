import React, { useMemo, useState, useEffect } from 'react';
import { LineChart, Line, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { XAxis, YAxis, ReferenceLine } from '@/utils/rechartsWrapper';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { formatTime } from "@/utils/lapTimeUtils";

interface Driver {
  driverId: string;
  code: string;
  name: string;
  team: string;
}

interface LapTimeLineChartProps {
  chartData: any[];
  availableDrivers: Driver[];
  selectedDrivers: string[];
  displayMode: 'absolute' | 'gap';
  fastestLapTime: { time: number, driver: string } | null;
  hoveredDriver: string | null;
}

const LapTimeLineChart: React.FC<LapTimeLineChartProps> = ({
  chartData,
  availableDrivers,
  selectedDrivers,
  displayMode,
  fastestLapTime,
  hoveredDriver
}) => {
  // Skip rendering if no data available
  if (chartData.length === 0 || selectedDrivers.length === 0) {
    return (
      <div className="flex items-center justify-center h-[450px] border border-dashed border-gray-300 rounded-lg">
        <p className="text-muted-foreground">Select drivers to view lap time data</p>
      </div>
    );
  }

  // Detect outliers for each driver
  const detectOutliers = (driverCode: string, data: any[]): { outlierLaps: number[], pitStopLaps: number[] } => {
    const lapTimes = data
      .filter(lap => lap && typeof lap[driverCode] === 'number')
      .map(lap => lap[driverCode]);
    
    if (lapTimes.length < 4) return { outlierLaps: [], pitStopLaps: [] }; // Not enough data
    
    // Calculate mean and standard deviation
    const mean = lapTimes.reduce((sum, val) => sum + val, 0) / lapTimes.length;
    const stdDev = Math.sqrt(
      lapTimes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / lapTimes.length
    );
    
    // Identify potential outliers (significantly faster or slower)
    const outlierThreshold = 1.5; // More sensitive threshold for outliers
    const pitStopThreshold = 2.0; // Lower threshold to catch more pit stops
    
    // Find lap numbers with outlier values
    const outlierLaps: number[] = [];
    const pitStopLaps: number[] = [];
    
    data.forEach(lap => {
      if (!lap || typeof lap[driverCode] !== 'number' || !lap.lap) return;
      
      const lapTime = lap[driverCode];
      const zScore = (lapTime - mean) / stdDev;
      
      // If much slower than average, likely a pit stop
      if (zScore > pitStopThreshold) {
        pitStopLaps.push(lap.lap);
      } 
      // Abnormally fast laps or slightly slow laps are also outliers
      else if (zScore < -outlierThreshold || (zScore > outlierThreshold && zScore <= pitStopThreshold)) {
        outlierLaps.push(lap.lap);
      }
    });
    
    return { outlierLaps, pitStopLaps };
  };

  // Initialize outliers map for each driver
  const [outlierLapsMap, setOutlierLapsMap] = useState<Record<string, { outlierLaps: number[], pitStopLaps: number[] }>>({});

  // Process outliers when data changes
  useEffect(() => {
    if (!chartData.length || !selectedDrivers.length) return;
    
    const newOutlierMap: Record<string, { outlierLaps: number[], pitStopLaps: number[] }> = {};
    
    selectedDrivers.forEach(driver => {
      newOutlierMap[driver] = detectOutliers(driver, chartData);
    });
    
    setOutlierLapsMap(newOutlierMap);
  }, [chartData, selectedDrivers]);

  // Calculate min and max for domain to keep the chart smooth
  const calculateYDomain = () => {
    if (displayMode === 'absolute') {
      let minTime = Number.MAX_VALUE;
      let maxTime = 0;
      
      chartData.forEach(lap => {
        selectedDrivers.forEach(driver => {
          if (lap[driver] && typeof lap[driver] === 'number') {
            minTime = Math.min(minTime, lap[driver]);
            maxTime = Math.max(maxTime, lap[driver]);
          }
        });
      });

      // Add some padding to the domain
      const padding = (maxTime - minTime) * 0.05;
      return [minTime - padding, maxTime + padding];
    } else {
      // For gap mode, start at 0 and find the max gap
      let maxGap = 0;
      
      chartData.forEach(lap => {
        selectedDrivers.forEach(driver => {
          if (lap[driver] && typeof lap[driver] === 'number') {
            maxGap = Math.max(maxGap, lap[driver]);
          }
        });
      });
      
      return [0, maxGap * 1.1]; // Add 10% padding at the top
    }
  };

  const yDomain = calculateYDomain();
  const maxLap = chartData.length > 0 ? Math.max(...chartData.map(lap => lap.lap)) : 0;
  
  return (
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
            xAxisId="lap"
          />
          <YAxis 
            label={{ 
              value: displayMode === 'absolute' ? 'Lap Time (seconds)' : 'Gap to Fastest (seconds)', 
              angle: -90, 
              position: 'insideLeft',
            }} 
            domain={yDomain}
            tickFormatter={(value) => displayMode === 'absolute' ? formatTime(value) : `+${value.toFixed(1)}`}
            yAxisId="time"
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1a1a1a',
              borderColor: '#333',
              borderRadius: '5px',
              color: 'white'
            }}
            formatter={(value, name, props) => {
              if (typeof value !== 'number') return [value, name];
              
              const driverCode = String(name).split(' ')[0];
              const originalTime = props.payload[`${driverCode}_raw`];
              const lapNumber = props.payload.lap;
              
              // Check if this is an outlier or pit stop
              const isOutlier = outlierLapsMap[driverCode]?.outlierLaps.includes(lapNumber);
              const isPitStop = outlierLapsMap[driverCode]?.pitStopLaps.includes(lapNumber);
              
              let labelText = '';
              if (isPitStop) {
                labelText = ' 🔄 Pit Stop';
              } else if (isOutlier) {
                labelText = ' ⚠️ Outlier';
              }
              
              if (displayMode === 'absolute') {
                return [`${formatTime(value)}${labelText}`, driverCode];
              } else {
                // Gap mode
                return [
                  `+${value.toFixed(3)}s${labelText} (${originalTime || formatTime(value)})`,
                  driverCode
                ];
              }
            }}
            labelFormatter={(label) => `Lap ${label}`}
          />
          <Legend 
            formatter={(value) => {
              const driverCode = value.split(' ')[0];
              const driver = availableDrivers.find(d => d.code === driverCode);
              return driver ? `${driverCode} (${driver.name.split(' ').pop()})` : driverCode;
            }}
          />
          
          {fastestLapTime && displayMode === 'absolute' && (
            <ReferenceLine 
              y={fastestLapTime.time} 
              stroke="#c026d3" // Purple color
              strokeDasharray="3 3" 
              label={{ 
                value: `Fastest Lap: ${formatTime(fastestLapTime.time)} (${fastestLapTime.driver})`, 
                position: 'right', 
                fill: '#c026d3' 
              }} 
              yAxisId="time"
              xAxisId="lap"
            />
          )}
          
          {availableDrivers
            .filter(driver => selectedDrivers.includes(driver.code))
            .map(driver => (
              <Line
                key={driver.code}
                type="monotone"
                dataKey={driver.code}
                name={`${driver.code} (${driver.name.split(' ').pop()})`}
                stroke={TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666"}
                strokeWidth={hoveredDriver === driver.code ? 3 : 2}
                dot={(props) => {
                  // Skip rendering if cx or cy are not valid numbers
                  if (!props.cx || !props.cy || isNaN(props.cx) || isNaN(props.cy)) {
                    return null;
                  }
                  
                  // Only show dot if the value exists
                  if (!props.payload[driver.code]) {
                    return null;
                  }
                  
                  const isPitStop = outlierLapsMap[driver.code]?.pitStopLaps.includes(props.payload.lap);
                  const isOutlier = outlierLapsMap[driver.code]?.outlierLaps.includes(props.payload.lap);
                  const teamColor = TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666";
                  
                  if (isPitStop) {
                    // Pit stop marker - larger triangle pointing down
                    return (
                      <path 
                        d={`M${props.cx-6},${props.cy-4} L${props.cx+6},${props.cy-4} L${props.cx},${props.cy+6} Z`} 
                        fill={teamColor}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                    );
                  } else if (isOutlier) {
                    // Outlier marker - diamond shape
                    return (
                      <path
                        d={`M${props.cx},${props.cy-5} L${props.cx+5},${props.cy} L${props.cx},${props.cy+5} L${props.cx-5},${props.cy} Z`}
                        fill={teamColor}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                    );
                  }
                  
                  // Regular dot
                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={3}
                      fill={teamColor}
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                  );
                }}
                activeDot={{ 
                  r: 6,
                  stroke: "#ffffff",
                  strokeWidth: 2
                }}
                connectNulls
                isAnimationActive={false}
                xAxisId="lap"
                yAxisId="time"
                opacity={hoveredDriver ? (hoveredDriver === driver.code ? 1 : 0.3) : 1}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LapTimeLineChart;

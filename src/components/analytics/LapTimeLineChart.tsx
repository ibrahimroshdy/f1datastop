import React from 'react';
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
            xAxisId="lapTime"
          />
          <YAxis 
            label={{ 
              value: displayMode === 'absolute' ? 'Lap Time (seconds)' : 'Gap to Fastest (seconds)', 
              angle: -90, 
              position: 'insideLeft',
            }} 
            domain={yDomain}
            yAxisId="lapTime"
            tickFormatter={(value) => displayMode === 'absolute' ? formatTime(value) : `+${value.toFixed(1)}`}
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
              
              if (displayMode === 'absolute') {
                return [formatTime(value), name];
              } else {
                // Gap mode
                return [
                  `+${value.toFixed(3)}s (${originalTime})`,
                  name
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
              xAxisId="lapTime"
              yAxisId="lapTime"
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
                dot={{ r: 3 }}
                activeDot={{ r: 8 }}
                connectNulls
                xAxisId="lapTime"
                yAxisId="lapTime"
                isAnimationActive={false}
                opacity={hoveredDriver ? (hoveredDriver === driver.code ? 1 : 0.3) : 1}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LapTimeLineChart;

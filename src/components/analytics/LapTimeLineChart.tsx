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
      <div className="flex items-center justify-center h-[500px] border border-dashed border-gray-300 rounded-lg">
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
  
  return (
    <div className="h-[500px] w-full bg-gray-950 rounded-lg p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 30, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis 
            dataKey="lap" 
            label={{ value: 'Lap Number', position: 'insideBottomRight', offset: -10, fill: "#999" }} 
            xAxisId="lapTime"
            domain={['dataMin', 'dataMax']}
            type="number"
            allowDecimals={false}
            ticks={
              chartData.length > 50
                ? Array.from({length: 10}, (_, i) => Math.round(i * chartData.length / 10) || 1)
                : undefined
            }
            tick={{ fill: '#999' }}
          />
          <YAxis 
            label={{ 
              value: displayMode === 'absolute' ? 'Lap Time (seconds)' : 'Gap to Fastest (seconds)', 
              angle: -90, 
              position: 'insideLeft',
              fill: "#999"
            }} 
            domain={yDomain}
            yAxisId="lapTime"
            tickFormatter={(value) => displayMode === 'absolute' ? formatTime(value) : `+${value.toFixed(1)}`}
            tick={{ fill: '#999' }}
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
            wrapperStyle={{ color: '#ddd' }}
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
              yAxisId="lapTime"
              xAxisId="lapTime"
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
                dot={{ r: 2 }}
                activeDot={{ r: 6 }}
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

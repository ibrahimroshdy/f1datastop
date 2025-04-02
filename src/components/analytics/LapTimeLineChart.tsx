
import React from 'react';
import { LineChart, Line, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { XAxis, YAxis, ReferenceLine } from '@/utils/rechartsWrapper';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { formatTime } from "@/utils/lapTimeUtils";

interface LapTimeLineChartProps {
  chartData: any[];
  availableDrivers: any[];
  selectedDrivers: string[];
  displayMode: 'absolute' | 'gap';
  fastestLapTime: { time: number, driver: string } | null;
}

const LapTimeLineChart: React.FC<LapTimeLineChartProps> = ({
  chartData,
  availableDrivers,
  selectedDrivers,
  displayMode,
  fastestLapTime
}) => {
  return (
    <div className="h-[500px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 30, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis 
            dataKey="lap" 
            label={{ value: 'Lap Number', position: 'insideBottomRight', offset: -10 }} 
            xAxisId="lapTime"
            domain={['dataMin', 'dataMax']}
            type="number"
            allowDecimals={false}
            ticks={
              chartData.length > 50
                ? Array.from({length: 10}, (_, i) => Math.round(i * chartData.length / 10) || 1)
                : undefined
            }
          />
          <YAxis 
            label={{ 
              value: displayMode === 'absolute' ? 'Lap Time (seconds)' : 'Gap to Fastest (seconds)', 
              angle: -90, 
              position: 'insideLeft' 
            }} 
            domain={displayMode === 'absolute' ? ['dataMin - 1', 'dataMax + 1'] : [0, 'dataMax + 0.5']}
            yAxisId="lapTime"
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
          <Legend formatter={(value) => {
            const driverCode = value.split(' ')[0];
            const driver = availableDrivers.find(d => d.code === driverCode);
            return driver ? `${driverCode} (${driver.name.split(' ').pop()})` : driverCode;
          }} />
          
          {fastestLapTime && displayMode === 'absolute' && (
            <ReferenceLine 
              y={fastestLapTime.time} 
              stroke="purple" 
              strokeDasharray="3 3" 
              label={{ 
                value: `Fastest Lap: ${formatTime(fastestLapTime.time)} (${fastestLapTime.driver})`, 
                position: 'right', 
                fill: 'purple' 
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
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 8 }}
                connectNulls
                xAxisId="lapTime"
                yAxisId="lapTime"
                isAnimationActive={true}
                animationDuration={500}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LapTimeLineChart;

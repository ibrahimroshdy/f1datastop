
import React from "react";
import { LineChart, Line, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { XAxis, YAxis } from '@/utils/rechartsWrapper';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";

interface PositionChartProps {
  chartData: any[];
  availableDrivers: any[];
  visibleDrivers: string[];
  hoveredDriver: string | null;
  maxLap: number;
}

const PositionChart: React.FC<PositionChartProps> = ({
  chartData,
  availableDrivers,
  visibleDrivers,
  hoveredDriver,
  maxLap,
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
            // Explicitly set domain to show all laps
            domain={[1, maxLap]}
            type="number"
            allowDecimals={false}
            // Add more ticks to show lap numbers more clearly
            ticks={
              maxLap > 50
                ? Array.from({length: 10}, (_, i) => Math.round(i * maxLap / 10) || 1)
                : Array.from({length: Math.min(maxLap, 20)}, (_, i) => i + 1)
            }
          />
          <YAxis 
            reversed 
            domain={[1, 20]} 
            label={{ value: 'Position', angle: -90, position: 'insideLeft' }} 
            ticks={[1, 5, 10, 15, 20]}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1a1a1a',
              borderColor: '#333',
              borderRadius: '5px',
              color: 'white'
            }}
            formatter={(value, name, props) => {
              const driverCode = String(name).split(' ')[0];
              const driver = availableDrivers.find(d => d.code === driverCode);
              
              return [
                `Position: ${value}`,
                driver ? `${driverCode} (${driver.name.split(' ').pop()})` : driverCode
              ];
            }}
            labelFormatter={(label) => `Lap ${label}`}
          />
          <Legend formatter={(value) => {
            const driverCode = value.split(' ')[0];
            const driver = availableDrivers.find(d => d.code === driverCode);
            return driver ? `${driverCode} (${driver.name.split(' ').pop()})` : driverCode;
          }} />
          
          {availableDrivers
            .filter(driver => visibleDrivers.includes(driver.code))
            .map(driver => (
              <Line
                key={driver.code}
                type="monotone"
                dataKey={driver.code}
                name={`${driver.code} (${driver.name.split(' ').pop()})`}
                stroke={TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666"}
                strokeWidth={hoveredDriver === driver.code ? 3 : 2}
                dot={{ r: 1 }}
                activeDot={{ r: 6 }}
                connectNulls
                isAnimationActive={false}
                opacity={hoveredDriver ? (hoveredDriver === driver.code ? 1 : 0.3) : 1}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PositionChart;


import React, { useMemo } from 'react';
import { scaleLinear } from '@visx/scale';
import { Group } from '@visx/group';
import { LinePath } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { withTooltip, Tooltip } from '@visx/tooltip';
import { ResponsiveChartContainer, tooltipStyles } from '@/utils/visxChartWrapper';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";

interface PositionVisxChartProps {
  chartData: any[];
  availableDrivers: any[];
  visibleDrivers: string[];
  hoveredDriver: string | null;
  maxLap: number;
  tooltipOpen?: boolean;
  tooltipLeft?: number;
  tooltipTop?: number;
  showTooltip?: any;
  hideTooltip?: any;
}

const PositionVisxChart = withTooltip<PositionVisxChartProps>(({
  chartData,
  availableDrivers,
  visibleDrivers,
  hoveredDriver,
  maxLap,
  tooltipOpen,
  tooltipLeft,
  tooltipTop,
  showTooltip,
  hideTooltip,
}) => {
  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[500px] border border-dashed border-gray-300 rounded-lg">
        <p className="text-muted-foreground">No position data available</p>
      </div>
    );
  }

  return (
    <div className="h-[500px] w-full">
      <ResponsiveChartContainer margin={{ top: 20, right: 30, bottom: 50, left: 60 }}>
        {({ width, height }) => {
          // Scales
          const xScale = scaleLinear({
            domain: [1, maxLap],
            range: [0, width - 90]
          });
          
          const yScale = scaleLinear({
            domain: [1, 20],
            range: [0, height - 70],  // Reversed for position (1 is top, 20 is bottom)
          });
          
          // X-axis ticks
          const xTicks = maxLap > 50
            ? Array.from({length: 10}, (_, i) => Math.round(i * maxLap / 10) || 1)
            : Array.from({length: Math.min(maxLap, 20)}, (_, i) => i + 1);
            
          // Y-axis ticks
          const yTicks = [1, 5, 10, 15, 20];

          return (
            <Group>
              {/* Grid */}
              <GridRows
                scale={yScale}
                width={width - 90}
                numTicks={5}
                stroke="#e0e0e0"
                strokeOpacity={0.2}
              />
              <GridColumns
                scale={xScale}
                height={height - 70}
                numTicks={10}
                stroke="#e0e0e0"
                strokeOpacity={0.2}
              />
              
              {/* X-axis */}
              <AxisBottom
                scale={xScale}
                top={height - 70}
                tickValues={xTicks}
                label="Lap Number"
                labelProps={{
                  fontSize: 12,
                  textAnchor: 'middle',
                  fill: '#888',
                }}
                stroke="#888"
                tickStroke="#888"
              />
              
              {/* Y-axis */}
              <AxisLeft
                scale={yScale}
                tickValues={yTicks}
                label="Position"
                labelProps={{
                  fontSize: 12,
                  textAnchor: 'middle',
                  fill: '#888',
                  dx: -45
                }}
                stroke="#888"
                tickStroke="#888"
              />
              
              {/* Draw lines for each driver */}
              {availableDrivers
                .filter(driver => visibleDrivers.includes(driver.code))
                .map(driver => {
                  // Filter and prepare data for this specific driver
                  const driverData = chartData
                    .filter(lap => lap[driver.code] !== undefined && lap[driver.code] !== null)
                    .map(lap => ({
                      lap: lap.lap,
                      position: lap[driver.code]
                    }));
                    
                  const strokeColor = TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666";
                  const strokeWidth = hoveredDriver === driver.code ? 3 : 2;
                  const opacity = hoveredDriver ? (hoveredDriver === driver.code ? 1 : 0.3) : 1;

                  return (
                    <Group key={driver.code} opacity={opacity}>
                      <LinePath
                        data={driverData}
                        x={d => xScale(d.lap)}
                        y={d => yScale(d.position)}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        curve={curveMonotoneX}
                        onMouseMove={(event) => {
                          const { x, y } = event;
                          
                          // Find the closest point
                          let closestPoint = null;
                          let minDistance = Infinity;
                          
                          driverData.forEach((d) => {
                            const pointX = xScale(d.lap);
                            const pointY = yScale(d.position);
                            const distance = Math.sqrt(Math.pow(pointX - x, 2) + Math.pow(pointY - y, 2));
                            
                            if (distance < minDistance) {
                              minDistance = distance;
                              closestPoint = d;
                            }
                          });
                          
                          if (closestPoint && minDistance < 30) {
                            showTooltip({
                              tooltipLeft: xScale(closestPoint.lap),
                              tooltipTop: yScale(closestPoint.position),
                              tooltipData: {
                                lap: closestPoint.lap,
                                driver: driver.code,
                                name: driver.name,
                                position: closestPoint.position,
                              }
                            });
                          }
                        }}
                        onMouseLeave={() => hideTooltip()}
                      />
                      
                      {/* Draw small dots at each data point */}
                      {driverData.map((d, i) => (
                        <circle
                          key={`${driver.code}-point-${i}`}
                          cx={xScale(d.lap)}
                          cy={yScale(d.position)}
                          r={1}
                          fill={strokeColor}
                          onMouseMove={() => {
                            showTooltip({
                              tooltipLeft: xScale(d.lap),
                              tooltipTop: yScale(d.position),
                              tooltipData: {
                                lap: d.lap,
                                driver: driver.code,
                                name: driver.name,
                                position: d.position,
                              }
                            });
                          }}
                          onMouseLeave={() => hideTooltip()}
                        />
                      ))}
                    </Group>
                  );
                })}
                
              {/* Legend */}
              <Group top={height - 40}>
                <text x={0} y={20} fontSize={12} fill="#888">Drivers:</text>
                {availableDrivers
                  .filter(driver => visibleDrivers.includes(driver.code))
                  .map((driver, i) => {
                    const color = TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666";
                    return (
                      <Group key={driver.code} left={80 + i * 80}>
                        <line x1={0} y1={15} x2={15} y2={15} stroke={color} strokeWidth={2} />
                        <text x={20} y={20} fontSize={12} fill="#888">
                          {`${driver.code} (${driver.name.split(' ').pop()})`}
                        </text>
                      </Group>
                    );
                  })}
              </Group>
            </Group>
          );
        }}
      </ResponsiveChartContainer>
      
      {/* Tooltip */}
      {tooltipOpen && (
        <Tooltip
          top={tooltipTop}
          left={tooltipLeft}
          style={tooltipStyles}
        >
          <div className="text-xs">
            <div>Lap {tooltipData?.lap}</div>
            <div>{tooltipData?.driver} ({tooltipData?.name?.split(' ').pop()})</div>
            <div className="font-bold mt-1">Position: {tooltipData?.position}</div>
          </div>
        </Tooltip>
      )}
    </div>
  );
});

export default PositionVisxChart;

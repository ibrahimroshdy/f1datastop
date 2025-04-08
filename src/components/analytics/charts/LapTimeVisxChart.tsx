
import React, { useState, useMemo } from 'react';
import { scaleLinear } from '@visx/scale';
import { Group } from '@visx/group';
import { Brush } from '@visx/brush';
import { PatternLines } from '@visx/pattern';
import { LinePath } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { withTooltip, Tooltip } from '@visx/tooltip';
import { ResponsiveChartContainer, tooltipStyles, Grid } from '@/utils/visxChartWrapper';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Skeleton } from "@/components/ui/skeleton";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { formatTimeValue } from '@/utils/visxChartWrapper';
import { Driver, FastestLapTime } from "@/types/lapTimeTypes";

interface LapTimeVisxChartProps {
  chartData: any[];
  availableDrivers: Driver[];
  selectedDrivers: string[];
  displayMode: 'absolute' | 'gap';
  fastestLapTime: FastestLapTime | null;
  hoveredDriver: string | null;
  tooltipOpen?: boolean;
  tooltipLeft?: number;
  tooltipTop?: number;
  showTooltip?: any;
  hideTooltip?: any;
}

const LapTimeVisxChart = withTooltip<LapTimeVisxChartProps>(({
  chartData,
  availableDrivers,
  selectedDrivers,
  displayMode,
  fastestLapTime,
  hoveredDriver,
  tooltipOpen,
  tooltipLeft,
  tooltipTop,
  showTooltip,
  hideTooltip,
}) => {
  // Skip rendering if no data available
  if (chartData.length === 0 || selectedDrivers.length === 0) {
    return (
      <div className="flex items-center justify-center h-[450px] border border-dashed border-gray-300 rounded-lg">
        <p className="text-muted-foreground">Select drivers to view lap time data</p>
      </div>
    );
  }

  // Fetch the visible drivers
  const visibleDrivers = useMemo(() => {
    if (hoveredDriver) {
      return selectedDrivers.includes(hoveredDriver) ? [hoveredDriver] : selectedDrivers;
    }
    return selectedDrivers;
  }, [hoveredDriver, selectedDrivers]);

  // Set up scales and accessors
  const xDomain = [1, Math.max(...chartData.map(d => d.lap))];
  
  // Calculate y domain based on data
  const getYDomain = () => {
    if (chartData.length === 0) return [0, 100];
    
    let min = Infinity;
    let max = -Infinity;
    
    chartData.forEach(lap => {
      visibleDrivers.forEach(driverId => {
        if (lap[driverId] && typeof lap[driverId] === 'number') {
          min = Math.min(min, lap[driverId]);
          max = Math.max(max, lap[driverId]);
        }
      });
    });
    
    // Add padding to the domain
    const padding = (max - min) * 0.05;
    return [min - padding, max + padding];
  };
  
  const yDomain = getYDomain();

  return (
    <div className="h-[450px] mt-4 flex-grow">
      <ResponsiveChartContainer margin={{ top: 20, right: 30, bottom: 50, left: 60 }}>
        {({ width, height }) => {
          // Scales
          const xScale = scaleLinear({
            domain: xDomain,
            range: [0, width - 90]
          });
          
          const yScale = scaleLinear({
            domain: yDomain,
            range: [height - 70, 0]
          });

          return (
            <Group>
              {/* Grid */}
              <Grid 
                xScale={xScale} 
                yScale={yScale} 
                width={width - 90} 
                height={height - 70}
              />
              
              {/* X-axis */}
              <AxisBottom
                scale={xScale}
                top={height - 70}
                label="Lap Number"
                labelProps={{
                  fontSize: 12,
                  textAnchor: 'middle',
                  fill: '#888',
                }}
                stroke="#888"
                tickStroke="#888"
                numTicks={10}
              />
              
              {/* Y-axis */}
              <AxisLeft
                scale={yScale}
                left={0}
                label={displayMode === 'absolute' ? 'Lap Time (seconds)' : 'Gap to Fastest (seconds)'}
                labelProps={{
                  fontSize: 12,
                  textAnchor: 'middle',
                  fill: '#888',
                  dx: -45
                }}
                stroke="#888"
                tickStroke="#888"
                tickFormat={(value) => formatTimeValue(value as number)}
              />
              
              {/* Fastest lap reference line */}
              {fastestLapTime && displayMode === 'absolute' && (
                <Group>
                  <LinePath
                    data={[
                      { x: xScale(xDomain[0]), y: yScale(fastestLapTime.time) },
                      { x: xScale(xDomain[1]), y: yScale(fastestLapTime.time) }
                    ]}
                    x={d => d.x}
                    y={d => d.y}
                    stroke="red"
                    strokeWidth={1.5}
                    strokeDasharray="4,4"
                  />
                  <text
                    x={xScale(xDomain[1])}
                    y={yScale(fastestLapTime.time) - 5}
                    fontSize={10}
                    textAnchor="end"
                    fill="red"
                  >
                    {`Fastest: ${formatTimeValue(fastestLapTime.time)} (${fastestLapTime.driver})`}
                  </text>
                </Group>
              )}
              
              {/* Draw lines for each driver */}
              {availableDrivers
                .filter(driver => visibleDrivers.includes(driver.code))
                .map(driver => {
                  // Filter out data points for this specific driver
                  const driverData = chartData
                    .filter(lap => lap[driver.code] !== undefined && lap[driver.code] !== null)
                    .map(lap => ({
                      lap: lap.lap,
                      value: lap[driver.code]
                    }));
                    
                  const strokeColor = TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666";
                  const strokeWidth = hoveredDriver === driver.code ? 3 : 2;
                  const opacity = hoveredDriver ? (hoveredDriver === driver.code ? 1 : 0.3) : 1;

                  return (
                    <Group key={driver.code} opacity={opacity}>
                      <LinePath
                        data={driverData}
                        x={d => xScale(d.lap)}
                        y={d => yScale(d.value)}
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
                            const pointY = yScale(d.value);
                            const distance = Math.sqrt(Math.pow(pointX - x, 2) + Math.pow(pointY - y, 2));
                            
                            if (distance < minDistance) {
                              minDistance = distance;
                              closestPoint = d;
                            }
                          });
                          
                          if (closestPoint && minDistance < 30) {
                            showTooltip({
                              tooltipLeft: xScale(closestPoint.lap),
                              tooltipTop: yScale(closestPoint.value),
                              tooltipData: {
                                lap: closestPoint.lap,
                                driver: driver.code,
                                name: driver.name,
                                value: closestPoint.value,
                              }
                            });
                          }
                        }}
                        onMouseLeave={() => hideTooltip()}
                      />
                      
                      {/* Draw points at each data point */}
                      {driverData.map((d, i) => (
                        <circle
                          key={`${driver.code}-point-${i}`}
                          cx={xScale(d.lap)}
                          cy={yScale(d.value)}
                          r={3}
                          fill={strokeColor}
                          stroke="white"
                          strokeWidth={1}
                          onMouseMove={() => {
                            showTooltip({
                              tooltipLeft: xScale(d.lap),
                              tooltipTop: yScale(d.value),
                              tooltipData: {
                                lap: d.lap,
                                driver: driver.code,
                                name: driver.name,
                                value: d.value,
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
                  .filter(driver => selectedDrivers.includes(driver.code))
                  .map((driver, i) => {
                    const color = TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666";
                    return (
                      <Group key={driver.code} left={80 + i * 80}>
                        <line x1={0} y1={15} x2={15} y2={15} stroke={color} strokeWidth={2} />
                        <text x={20} y={20} fontSize={12} fill="#888">
                          {`${driver.code}`}
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
            <div className="font-bold mt-1">{formatTimeValue(tooltipData?.value)}</div>
          </div>
        </Tooltip>
      )}
    </div>
  );
});

export default LapTimeVisxChart;

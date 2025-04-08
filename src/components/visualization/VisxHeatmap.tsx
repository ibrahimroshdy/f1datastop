
import React, { useState } from 'react';
import { Group } from '@visx/group';
import { scaleLinear } from '@visx/scale';
import { HeatmapRect } from '@visx/heatmap';
import { ParentSize } from '@visx/responsive';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { useToast } from "@/components/ui/use-toast";
import { interpolateInferno } from 'd3-scale-chromatic';
import { LegendLinear } from '@visx/legend';

// Define the data structure
interface BinDatum {
  bin: number;
  count: number;
}

interface HeatmapDatum {
  bin: number;
  bins: BinDatum[];
}

// Generate mock data
const generateHeatmapData = (binCount: number, width: number) => {
  const data: HeatmapDatum[] = [];
  const days = ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  days.forEach((_, i) => {
    const bins: BinDatum[] = [];
    hours.forEach((hour) => {
      // Higher values during working hours (9-17) on weekdays (0-4)
      let value = Math.random() * 50;
      if (i < 5 && hour >= 9 && hour <= 17) {
        value += 50;
      }
      // Lower values at night
      if (hour < 6 || hour > 21) {
        value *= 0.3;
      }
      
      bins.push({
        bin: hour,
        count: value,
      });
    });
    
    data.push({
      bin: i,
      bins,
    });
  });
  
  return data;
};

// Define margins
const margin = { top: 40, left: 70, right: 30, bottom: 80 };

// Component for visualization
const VisxHeatmap = () => {
  const { toast } = useToast();
  const binCount = 24; // 24 hours
  
  // Create color scale
  const colorScale = scaleLinear({
    domain: [0, 100],
    range: [0, 1],
  });

  const handleCellClick = (x: number, y: number, value: number) => {
    toast({
      title: "Cell Selected",
      description: `Day: ${y}, Hour: ${x}, Value: ${Math.round(value)}`,
    });
  };

  return (
    <ParentSize>
      {({ width, height }) => {
        const data = generateHeatmapData(binCount, width);
        const xMax = width - margin.left - margin.right;
        const yMax = height - margin.top - margin.bottom;
        const binWidth = xMax / binCount;
        const binHeight = yMax / data.length;
        
        // Get all counts to determine min/max values
        const allCounts = data.flatMap(d => d.bins.map(b => b.count));
        const maxValue = Math.max(...allCounts);
        
        return (
          <div>
            <svg width={width} height={height}>
              <rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill="#2d3748"
                rx={14}
              />
              
              <Group top={margin.top} left={margin.left}>
                <HeatmapRect
                  data={data}
                  xScale={(d) => d.bin * binWidth}
                  yScale={(d) => d.bin * binHeight}
                  colorScale={(d) => interpolateInferno(colorScale(d))}
                  binWidth={binWidth}
                  binHeight={binHeight}
                  gap={2}
                >
                  {heatmap => 
                    heatmap.map(heatmapBins => 
                      heatmapBins.map(bin => (
                        <rect
                          key={`heatmap-rect-${bin.row}-${bin.column}`}
                          className="cursor-pointer transition-colors duration-300"
                          width={bin.width}
                          height={bin.height}
                          x={bin.x}
                          y={bin.y}
                          fill={bin.color}
                          onClick={() => handleCellClick(bin.column, bin.row, bin.count)}
                          opacity={1}
                          stroke="#2d3748"
                          strokeWidth={0.5}
                        />
                      ))
                    )
                  }
                </HeatmapRect>
                
                {/* X-axis representing hours */}
                <AxisBottom
                  scale={scaleLinear({
                    domain: [0, 23],
                    range: [0, xMax],
                  })}
                  top={yMax}
                  stroke="#fff"
                  tickStroke="#fff"
                  tickValues={[0, 6, 12, 18, 23]}
                  tickFormat={(value) => `${value}:00`}
                  tickLabelProps={() => ({
                    fill: '#fff',
                    fontSize: 10,
                    textAnchor: 'middle',
                  })}
                  label="Hour of Day"
                  labelProps={{
                    fill: '#fff',
                    fontSize: 14,
                    textAnchor: 'middle',
                    y: 40,
                  }}
                />
                
                {/* Y-axis representing days */}
                <AxisLeft
                  scale={scaleLinear({
                    domain: [0, 6],
                    range: [0, yMax],
                  })}
                  stroke="#fff"
                  tickStroke="#fff"
                  tickValues={[0, 1, 2, 3, 4, 5, 6]}
                  tickFormat={(value) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][value]}
                  tickLabelProps={() => ({
                    fill: '#fff',
                    fontSize: 10,
                    textAnchor: 'end',
                    dx: '-0.25em',
                    dy: '0.25em',
                  })}
                  label="Day of Week"
                  labelProps={{
                    fill: '#fff',
                    fontSize: 14,
                    textAnchor: 'middle',
                    transform: 'rotate(-90)',
                    x: -60,
                  }}
                />
              </Group>
            </svg>
            
            {/* Color Legend */}
            <div className="mt-4 flex justify-center">
              <LegendLinear
                scale={scaleLinear({
                  domain: [0, maxValue],
                  range: [0, 200],
                  // Fixed the property name from 'interpolator' to 'interpolate'
                  interpolate: interpolateInferno,
                })}
                steps={5}
                labelFormat={(d) => Math.round(Number(d)).toString()}
                shape="rect"
                style={{
                  display: 'flex',
                  color: 'white',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: '10px',
                }}
              />
            </div>
          </div>
        );
      }}
    </ParentSize>
  );
};

export default VisxHeatmap;

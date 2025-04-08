
import React, { useState } from 'react';
import { Group } from '@visx/group';
import { BarGroup } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { scaleBand, scaleLinear, scaleOrdinal } from '@visx/scale';
import { useToast } from "@/components/ui/use-toast";
import { ParentSize } from '@visx/responsive';
import { LegendOrdinal } from '@visx/legend';
import { schemeSet3 } from 'd3-scale-chromatic';
import { GridRows } from '@visx/grid';

// Define data types
type BarGroupData = {
  date: string;
  [key: string]: any;
};

// Generate some mock data
const generateBarData = () => {
  const years = ['2020', '2021', '2022', '2023', '2024'];
  const categories = ['Red Bull', 'Ferrari', 'Mercedes', 'McLaren'];
  
  return years.map(year => {
    const item: BarGroupData = { date: year };
    categories.forEach(category => {
      item[category] = Math.floor(Math.random() * 100);
    });
    return item;
  });
};

// Define margin
const margin = { top: 40, right: 40, bottom: 50, left: 60 };

const VisxBarChart = () => {
  const { toast } = useToast();
  const [data] = useState(generateBarData());
  const [hovered, setHovered] = useState<string | null>(null);
  
  // Extract the keys (team names) from the data
  const keys = Object.keys(data[0]).filter(d => d !== 'date');

  // Define a color scale for the bars
  const colorScale = scaleOrdinal({
    domain: keys,
    range: schemeSet3,
  });

  // Define tooltip handler
  const handleBarClick = (key: string, value: number) => {
    toast({
      title: `${key} Selected`,
      description: `Value: ${value}`,
    });
  };

  return (
    <ParentSize>
      {({ width, height }) => {
        // Define scales
        const xScale = scaleBand<string>({
          domain: data.map(d => d.date),
          padding: 0.2,
          range: [margin.left, width - margin.right],
        });
        
        const barGroupScale = scaleBand<string>({
          domain: keys,
          padding: 0.1,
          range: [0, xScale.bandwidth()],
        });
        
        // Find the maximum value in the data for setting y scale domain
        const maxValue = Math.max(
          ...data.flatMap(d => keys.map(key => Number(d[key])))
        );
        
        const yScale = scaleLinear<number>({
          domain: [0, maxValue * 1.1], // Add 10% padding
          range: [height - margin.bottom, margin.top],
        });
        
        return (
          <>
            <svg width={width} height={height}>
              <rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill="#2d3748"
                rx={14}
              />
              
              {/* Add grid lines */}
              <GridRows
                scale={yScale}
                width={width - margin.left - margin.right}
                left={margin.left}
                stroke="#495057"
                strokeOpacity={0.2}
                strokeDasharray="1,5"
              />
              
              <Group>
                <BarGroup
                  data={data}
                  keys={keys}
                  height={height}
                  x0={d => d.date}
                  x0Scale={xScale}
                  x1Scale={barGroupScale}
                  yScale={yScale}
                  color={colorScale}
                >
                  {barGroups => 
                    barGroups.map(barGroup => (
                      <Group 
                        key={`bar-group-${barGroup.index}-${barGroup.x0}`}
                        left={barGroup.x0}
                      >
                        {barGroup.bars.map(bar => {
                          const key = bar.key;
                          const isHovered = hovered === key;
                          return (
                            <rect
                              key={`bar-${barGroup.index}-${bar.index}-${bar.key}`}
                              x={bar.x}
                              y={bar.y}
                              width={bar.width}
                              height={bar.height}
                              fill={bar.color}
                              opacity={isHovered || !hovered ? 1 : 0.5}
                              onMouseEnter={() => setHovered(bar.key)}
                              onMouseLeave={() => setHovered(null)}
                              onClick={() => handleBarClick(bar.key, bar.value)}
                              className="cursor-pointer"
                              rx={4}
                            />
                          );
                        })}
                      </Group>
                    ))
                  }
                </BarGroup>
              </Group>
              
              {/* X axis */}
              <AxisBottom
                top={height - margin.bottom}
                scale={xScale}
                stroke="#fff"
                tickStroke="#fff"
                tickLabelProps={() => ({
                  fill: '#fff',
                  fontSize: 12,
                  textAnchor: 'middle',
                })}
                label="Year"
                labelProps={{
                  fill: '#fff',
                  fontSize: 14,
                  textAnchor: 'middle',
                }}
              />
              
              {/* Y axis */}
              <AxisLeft
                left={margin.left}
                scale={yScale}
                stroke="#fff"
                tickStroke="#fff"
                tickLabelProps={() => ({
                  fill: '#fff',
                  fontSize: 12,
                  textAnchor: 'end',
                  dy: '0.33em',
                  dx: '-0.25em',
                })}
                label="Points"
                labelProps={{
                  fill: '#fff',
                  fontSize: 14,
                  textAnchor: 'middle',
                  transform: 'rotate(-90 -30 10)',
                }}
              />
            </svg>
            
            {/* Legend */}
            <div className="mt-4 flex justify-center">
              <LegendOrdinal
                scale={colorScale}
                direction="row"
                labelMargin="0 15px 0 0"
                shape="circle"
                className="text-xs flex flex-wrap justify-center gap-4"
                style={{
                  display: 'flex',
                  color: 'white',
                }}
              />
            </div>
          </>
        );
      }}
    </ParentSize>
  );
};

export default VisxBarChart;


import React, { useMemo } from 'react';
import { Group } from '@visx/group';
import { curveBasis, curveMonotoneX, curveNatural, curveStep } from '@visx/curve';
import { LinePath } from '@visx/shape';
import { scaleTime, scaleLinear } from '@visx/scale';
import { extent, max } from 'd3-array';
import { GridRows, GridColumns } from '@visx/grid';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { ParentSize } from '@visx/responsive';
import { useToast } from "@/components/ui/use-toast";

// Generate some random data
const generateData = (numPoints = 30) => {
  const data = [];
  const startDate = new Date(2023, 0, 1);
  
  for (let i = 0; i < numPoints; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i * 3);
    
    data.push({
      date,
      value: Math.random() * 100
    });
  }
  
  return data;
};

const randomData = generateData();

// Define margin
const margin = { top: 40, right: 30, bottom: 50, left: 60 };

// Define curve types
const curves = [
  { type: 'basis', curve: curveBasis, color: '#f6ad55' },
  { type: 'monotoneX', curve: curveMonotoneX, color: '#63b3ed' },
  { type: 'natural', curve: curveNatural, color: '#68d391' },
  { type: 'step', curve: curveStep, color: '#fc8181' },
];

// Component for the visualization
const VisxCurveDemo = () => {
  const { toast } = useToast();
  
  const handleCurveClick = (curveType: string) => {
    toast({
      title: "Curve Selected",
      description: `You clicked on the ${curveType} curve`,
    });
  };
  
  return (
    <ParentSize>
      {({ width, height }) => {
        // Define scales
        const xScale = useMemo(() => 
          scaleTime({
            domain: extent(randomData, d => d.date) as [Date, Date],
            range: [margin.left, width - margin.right]
          }),
          [width]
        );
        
        const yScale = useMemo(() => 
          scaleLinear({
            domain: [0, max(randomData, d => d.value) as number],
            range: [height - margin.bottom, margin.top]
          }),
          [height]
        );
        
        return (
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
            <GridColumns
              scale={xScale}
              height={height - margin.top - margin.bottom}
              top={margin.top}
              stroke="#495057"
              strokeOpacity={0.2}
              strokeDasharray="1,5"
            />
            
            {/* Add axes */}
            <AxisLeft
              scale={yScale}
              left={margin.left}
              stroke="#fff"
              tickStroke="#fff"
              tickLabelProps={() => ({
                fill: '#fff',
                fontSize: 12,
                textAnchor: 'end',
                dx: '-0.25em',
                dy: '0.25em',
              })}
            />
            <AxisBottom
              scale={xScale}
              top={height - margin.bottom}
              stroke="#fff"
              tickStroke="#fff"
              tickLabelProps={() => ({
                fill: '#fff',
                fontSize: 12,
                textAnchor: 'middle',
              })}
              numTicks={5}
            />
            
            {/* Draw curves */}
            <Group>
              {curves.map((curveInfo, i) => (
                <LinePath
                  key={`line-${curveInfo.type}`}
                  curve={curveInfo.curve}
                  data={randomData}
                  x={d => xScale(d.date)}
                  y={d => yScale(d.value)}
                  stroke={curveInfo.color}
                  strokeWidth={3}
                  strokeOpacity={0.8}
                  onClick={() => handleCurveClick(curveInfo.type)}
                  className="cursor-pointer"
                />
              ))}
            </Group>
            
            {/* Add curve labels */}
            <Group top={margin.top + 10} left={width - margin.right - 120}>
              {curves.map((curveInfo, i) => (
                <Group key={`label-${curveInfo.type}`} top={i * 20}>
                  <line x1={0} y1={0} x2={20} y2={0} stroke={curveInfo.color} strokeWidth={3} />
                  <text x={25} y={5} fill="#fff" fontSize={12}>
                    {curveInfo.type}
                  </text>
                </Group>
              ))}
            </Group>
          </svg>
        );
      }}
    </ParentSize>
  );
};

export default VisxCurveDemo;

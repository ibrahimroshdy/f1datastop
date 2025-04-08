
import React from 'react';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { Group } from '@visx/group';
import { LinePath } from '@visx/shape';
import { scaleLinear } from '@visx/scale';
import { curveMonotoneX } from '@visx/curve';
import { LegendOrdinal } from '@visx/legend';
import { ParentSize } from '@visx/responsive';
import { withTooltip, Tooltip, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';

// Common components and types for visx charts
export interface VisxChartProps {
  width: number;
  height: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  children?: React.ReactNode;
}

export interface DataPoint {
  [key: string]: any;
}

export interface LineSeriesProps {
  data: DataPoint[];
  x: (d: DataPoint) => number;
  y: (d: DataPoint) => number;
  xScale: any;
  yScale: any;
  stroke: string;
  strokeWidth?: number;
  seriesKey: string;
}

export interface AxisConfig {
  label?: string;
  tickFormat?: (value: any) => string;
  numTicks?: number;
  tickValues?: number[];
}

// Line series component
export const LineSeries = ({ 
  data, 
  x, 
  y, 
  xScale, 
  yScale, 
  stroke, 
  strokeWidth = 2,
  seriesKey
}: LineSeriesProps) => {
  return (
    <LinePath
      key={seriesKey}
      data={data}
      x={d => xScale(x(d)) || 0}
      y={d => yScale(y(d)) || 0}
      stroke={stroke}
      strokeWidth={strokeWidth}
      curve={curveMonotoneX}
    />
  );
};

// Chart container component
export const ChartContainer: React.FC<VisxChartProps> = ({ 
  width, 
  height,
  margin = { top: 20, right: 30, bottom: 50, left: 50 },
  children 
}) => {
  // Calculate inner dimensions
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, {
              width: innerWidth,
              height: innerHeight
            });
          }
          return child;
        })}
      </Group>
    </svg>
  );
};

// Responsive chart container
export const ResponsiveChartContainer: React.FC<Omit<VisxChartProps, 'width' | 'height'> & { 
  children: (props: { width: number; height: number }) => React.ReactNode 
}> = ({ children, ...rest }) => {
  return (
    <ParentSize>
      {({ width, height }) => (
        <ChartContainer width={width} height={height} {...rest}>
          {children({ width, height })}
        </ChartContainer>
      )}
    </ParentSize>
  );
};

// Tooltip styles
export const tooltipStyles = {
  ...defaultStyles,
  background: '#1a1a1a',
  border: '1px solid #333',
  color: 'white',
  fontFamily: 'sans-serif',
  fontSize: '12px',
  lineHeight: '1.4',
  padding: '12px',
  borderRadius: '5px'
};

// Higher-order component to add tooltip functionality to a chart
export const withChartTooltip = (ChartComponent: any) => {
  return withTooltip((props) => {
    const { tooltipData, tooltipLeft, tooltipTop, hideTooltip, showTooltip } = props;
    return (
      <>
        <ChartComponent
          {...props}
          handleTooltip={(event: React.TouchEvent<SVGElement> | React.MouseEvent<SVGElement>, data: any) => {
            const coords = localPoint(event);
            showTooltip({
              tooltipData: data,
              tooltipLeft: coords?.x,
              tooltipTop: coords?.y
            });
          }}
          hideTooltip={hideTooltip}
        />
        {tooltipData && (
          <Tooltip
            left={tooltipLeft}
            top={tooltipTop}
            style={tooltipStyles}
          >
            {props.renderTooltip && props.renderTooltip(tooltipData)}
          </Tooltip>
        )}
      </>
    );
  });
};

// Axis components with simplified API
export const XAxis = ({ 
  scale, 
  top, 
  height,
  label, 
  tickFormat, 
  numTicks, 
  tickValues 
}: { 
  scale: any; 
  top: number; 
  height: number; 
  label?: string;
  tickFormat?: (value: any) => string;
  numTicks?: number;
  tickValues?: number[];
}) => {
  return (
    <AxisBottom 
      scale={scale}
      top={top}
      label={label}
      tickFormat={tickFormat}
      numTicks={numTicks}
      tickValues={tickValues}
    />
  );
};

export const YAxis = ({ 
  scale, 
  left, 
  label, 
  tickFormat, 
  numTicks, 
  tickValues 
}: { 
  scale: any; 
  left: number; 
  label?: string;
  tickFormat?: (value: any) => string;
  numTicks?: number;
  tickValues?: number[];
}) => {
  return (
    <AxisLeft 
      scale={scale} 
      left={left}
      label={label}
      tickFormat={tickFormat}
      numTicks={numTicks}
      tickValues={tickValues}
    />
  );
};

// Grid components
export const Grid = ({ 
  xScale, 
  yScale, 
  width, 
  height, 
  numTicksRows = 10,
  numTicksColumns = 10
}: { 
  xScale: any; 
  yScale: any; 
  width: number; 
  height: number;
  numTicksRows?: number;
  numTicksColumns?: number;
}) => {
  return (
    <>
      <GridRows 
        scale={yScale} 
        width={width} 
        numTicks={numTicksRows}
        stroke="#e0e0e0"
        strokeOpacity={0.2}
      />
      <GridColumns 
        scale={xScale} 
        height={height} 
        numTicks={numTicksColumns}
        stroke="#e0e0e0"
        strokeOpacity={0.2}
      />
    </>
  );
};

// Utility function to create a line chart data generator
export const createLineDataAccessor = (
  xKey: string,
  yKeys: string[],
  formatters?: {
    x?: (value: any) => any;
    y?: (value: any) => any;
  }
) => {
  return {
    x: (d: DataPoint) => formatters?.x ? formatters.x(d[xKey]) : d[xKey],
    getY: (key: string) => (d: DataPoint) => formatters?.y ? formatters.y(d[key]) : d[key],
    keys: yKeys
  };
};

// Helper function to format time values
export const formatTimeValue = (seconds: number): string => {
  if (!seconds && seconds !== 0) return "N/A";
  
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, '0')}`;
};

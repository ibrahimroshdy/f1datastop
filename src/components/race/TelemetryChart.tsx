
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Group } from '@visx/group';
import { LinePath } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { withTooltip, Tooltip } from '@visx/tooltip';
import { ParentSize } from '@visx/responsive';

const TelemetryChartWithTooltip = withTooltip(({ 
  width, 
  height, 
  data, 
  selectedDriver,
  tooltipOpen,
  tooltipData,
  tooltipLeft,
  tooltipTop,
  showTooltip,
  hideTooltip 
}) => {
  // Margins
  const margin = { top: 20, right: 30, bottom: 50, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  // Scales
  const xScale = scaleLinear({
    domain: [0, 2000], // Distance range
    range: [0, innerWidth]
  });
  
  const yScale = scaleLinear({
    domain: [0, 350], // Speed range
    range: [innerHeight, 0]
  });
  
  const yScaleThrottle = scaleLinear({
    domain: [0, 100], // Throttle/brake range
    range: [innerHeight, 0]
  });
  
  // Tooltip styles
  const tooltipStyles = {
    background: '#15151e',
    border: '1px solid #333',
    color: 'white',
    fontFamily: 'sans-serif',
    fontSize: '12px',
    padding: '8px',
    borderRadius: '3px',
  };

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        {/* Grid */}
        <GridRows
          scale={yScale}
          width={innerWidth}
          stroke="#333"
          strokeOpacity={0.2}
          numTicks={5}
        />
        <GridColumns
          scale={xScale}
          height={innerHeight}
          stroke="#333"
          strokeOpacity={0.2}
          numTicks={5}
        />
        
        {/* Axes */}
        <AxisBottom 
          scale={xScale} 
          top={innerHeight}
          stroke="#888"
          tickStroke="#888"
          label="Distance (m)"
          labelProps={{
            fontSize: 12,
            fill: '#888',
            textAnchor: 'middle',
            dy: 30
          }}
        />
        <AxisLeft 
          scale={yScale}
          stroke="#888"
          tickStroke="#888"
          label="Speed (km/h)"
          labelProps={{
            fontSize: 12,
            fill: '#888',
            textAnchor: 'middle',
            dy: -35
          }}
        />
        
        {/* Lines */}
        {/* Speed line */}
        <LinePath
          data={data}
          x={d => xScale(d.distance)}
          y={d => yScale(d.speed)}
          stroke={getDriverColor(selectedDriver)}
          strokeWidth={2}
          curve={curveMonotoneX}
          onMouseMove={(event) => {
            const { x, y } = event;
            // Find closest data point
            const closest = findClosestDataPoint(data, xScale, d => d.distance, x);
            showTooltip({
              tooltipData: closest,
              tooltipLeft: xScale(closest.distance),
              tooltipTop: yScale(closest.speed)
            });
          }}
          onMouseLeave={() => hideTooltip()}
        />
        
        {/* Throttle line */}
        <LinePath
          data={data}
          x={d => xScale(d.distance)}
          y={d => yScaleThrottle(d.throttle)}
          stroke="#4CAF50"
          strokeWidth={1.5}
          curve={curveMonotoneX}
        />
        
        {/* Brake line */}
        <LinePath
          data={data}
          x={d => xScale(d.distance)}
          y={d => yScaleThrottle(d.brake)}
          stroke="#F44336"
          strokeWidth={1.5}
          curve={curveMonotoneX}
        />
        
        {/* Legend */}
        <Group top={innerHeight + 30}>
          <text x={0} y={0} fontSize={10} fill="#888">Legend:</text>
          
          <Group left={60}>
            <line x1={0} y1={-5} x2={20} y2={-5} stroke={getDriverColor(selectedDriver)} strokeWidth={2} />
            <text x={25} y={0} fontSize={10} fill="#888">Speed</text>
          </Group>
          
          <Group left={130}>
            <line x1={0} y1={-5} x2={20} y2={-5} stroke="#4CAF50" strokeWidth={1.5} />
            <text x={25} y={0} fontSize={10} fill="#888">Throttle</text>
          </Group>
          
          <Group left={200}>
            <line x1={0} y1={-5} x2={20} y2={-5} stroke="#F44336" strokeWidth={1.5} />
            <text x={25} y={0} fontSize={10} fill="#888">Brake</text>
          </Group>
        </Group>
      </Group>
      
      {/* Tooltip markers - show points at tooltip position */}
      {tooltipOpen && tooltipData && (
        <Group left={margin.left} top={margin.top}>
          <circle
            cx={xScale(tooltipData.distance)}
            cy={yScale(tooltipData.speed)}
            r={4}
            fill={getDriverColor(selectedDriver)}
            stroke="white"
            strokeWidth={1}
          />
          <circle
            cx={xScale(tooltipData.distance)}
            cy={yScaleThrottle(tooltipData.throttle)}
            r={3}
            fill="#4CAF50"
            stroke="white"
            strokeWidth={1}
          />
          <circle
            cx={xScale(tooltipData.distance)}
            cy={yScaleThrottle(tooltipData.brake)}
            r={3}
            fill="#F44336"
            stroke="white"
            strokeWidth={1}
          />
        </Group>
      )}
    </svg>
  );
});

// Helper function to find closest data point
const findClosestDataPoint = (data, scale, accessor, position) => {
  let minDistance = Infinity;
  let closestPoint = null;
  
  data.forEach(d => {
    const distance = Math.abs(scale(accessor(d)) - position);
    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = d;
    }
  });
  
  return closestPoint;
};

// Get driver color based on driver ID
const getDriverColor = (driverId) => {
  const driverColors = {
    "1": "#0600EF",   // Verstappen
    "16": "#DC0000",  // Leclerc
    "4": "#FF8700",   // Norris
    "44": "#00D2BE",  // Hamilton
    "11": "#0600EF",  // Perez
    "55": "#DC0000"   // Sainz
  };
  
  return driverColors[driverId] || "#FFFFFF";
};

const TelemetryChart = () => {
  const [selectedDriver, setSelectedDriver] = useState("1");

  // Mock telemetry data for a single lap - minimal data points, no DRS for simplification
  const telemetryData = [
    { distance: "0", speed: 84, throttle: 30, brake: 70, gear: 1 },
    { distance: "500", speed: 280, throttle: 100, brake: 0, gear: 6 },
    { distance: "1000", speed: 335, throttle: 100, brake: 0, gear: 8 },
    { distance: "1500", speed: 120, throttle: 40, brake: 0, gear: 3 },
    { distance: "2000", speed: 310, throttle: 100, brake: 0, gear: 8 },
  ];

  const drivers = [
    { value: "1", label: "Verstappen", color: "#0600EF" },
    { value: "16", label: "Leclerc", color: "#DC0000" },
    { value: "4", label: "Norris", color: "#FF8700" },
    { value: "44", label: "Hamilton", color: "#00D2BE" },
    { value: "11", label: "Perez", color: "#0600EF" },
    { value: "55", label: "Sainz", color: "#DC0000" },
  ];

  return (
    <Card className="race-card p-4">
      <CardContent className="p-0">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold">Telemetry Data</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Driver:</span>
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger className="w-[180px] bg-f1-dark border-gray-800">
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent className="bg-f1-dark border-gray-800">
                {drivers.map((driver) => (
                  <SelectItem key={driver.value} value={driver.value}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: driver.color }}></div>
                      <span>
                        {driver.label} (#{driver.value})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="h-[400px] w-full">
          <ParentSize>
            {({ width, height }) => (
              <TelemetryChartWithTooltip
                width={width}
                height={height}
                data={telemetryData.map(d => ({
                  ...d,
                  distance: parseInt(d.distance)
                }))}
                selectedDriver={selectedDriver}
              />
            )}
          </ParentSize>
        </div>
      </CardContent>
    </Card>
  );
};

export default TelemetryChart;


import React, { useState } from 'react';
import { Group } from '@visx/group';
import { Pie } from '@visx/shape';
import { scaleOrdinal } from '@visx/scale';
import { localPoint } from '@visx/event';
import { ParentSize } from '@visx/responsive';
import { useToast } from "@/components/ui/use-toast";
import { LegendOrdinal } from '@visx/legend';
import { schemeCategory10 } from 'd3-scale-chromatic';

// Define data structure
interface PieData {
  label: string;
  value: number;
  color: string;
}

// Generate mock data
const generatePieData = (): PieData[] => {
  const teams = [
    { label: "Red Bull", value: 335, color: "#0600EF" },
    { label: "Ferrari", value: 283, color: "#DC0000" },
    { label: "Mercedes", value: 247, color: "#00D2BE" },
    { label: "McLaren", value: 212, color: "#FF8700" },
    { label: "Aston Martin", value: 86, color: "#006F62" },
    { label: "Alpine", value: 35, color: "#0090FF" },
    { label: "Williams", value: 28, color: "#005AFF" },
    { label: "Racing Bulls", value: 23, color: "#1E41FF" },
    { label: "Haas", value: 5, color: "#FFFFFF" },
    { label: "Sauber", value: 0, color: "#900000" },
  ];
  
  return teams;
};

// Define margin
const margin = { top: 20, right: 20, bottom: 60, left: 20 };
const defaultMargin = 40;

// Component for visualization
const VisxPieChart = () => {
  const { toast } = useToast();
  const [data] = useState<PieData[]>(generatePieData());
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  
  // Create color scale
  const colorScale = scaleOrdinal({
    domain: data.map((d) => d.label),
    range: data.map((d) => d.color),
  });
  
  const handleMouseOver = (label: string) => {
    setHovered(label);
  };
  
  const handleMouseOut = () => {
    setHovered(null);
  };
  
  const handleClick = (label: string, value: number) => {
    setSelectedTeam(selectedTeam === label ? null : label);
    toast({
      title: `${label}`,
      description: `Constructor Points: ${value}`,
    });
  };
  
  return (
    <ParentSize>
      {({ width, height }) => {
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        const radius = Math.min(innerWidth, innerHeight) / 2;
        const centerX = innerWidth / 2 + margin.left;
        const centerY = innerHeight / 2 + margin.top;
        
        const total = data.reduce((acc, d) => acc + d.value, 0);
        const getPercentage = (value: number) => ((value / total) * 100).toFixed(1) + '%';
        
        return (
          <>
            <svg width={width} height={height}>
              <rect
                width={width}
                height={height}
                fill="#2d3748"
                rx={14}
              />
              <Group top={centerY} left={centerX}>
                <Pie
                  data={data}
                  pieValue={(d) => d.value}
                  outerRadius={radius - defaultMargin}
                  innerRadius={radius / 2}
                  cornerRadius={3}
                  padAngle={0.02}
                >
                  {(pie) => {
                    return pie.arcs.map((arc) => {
                      const arcData = arc.data as PieData;
                      const [centroidX, centroidY] = pie.path.centroid(arc);
                      const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.1;
                      const isSelected = selectedTeam === arcData.label;
                      const isHovered = hovered === arcData.label;
                      const arcFill = arcData.color;
                      const arcPath = pie.path(arc) || '';
                      
                      return (
                        <g
                          key={`arc-${arcData.label}`}
                          onMouseEnter={() => handleMouseOver(arcData.label)}
                          onMouseLeave={handleMouseOut}
                          onClick={() => handleClick(arcData.label, arcData.value)}
                          className="cursor-pointer"
                        >
                          <path
                            d={arcPath}
                            fill={arcFill}
                            opacity={isHovered || !hovered ? 1 : 0.7}
                            stroke="white"
                            strokeWidth={isSelected || isHovered ? 2 : 0}
                            transform={isSelected || isHovered ? `scale(1.03)` : undefined}
                          />
                          
                          {hasSpaceForLabel && (
                            <g
                              opacity={isHovered ? 1 : 0.9}
                              transform={`translate(${centroidX * 0.75}, ${centroidY * 0.75})`}
                            >
                              <text
                                fill="white"
                                fontSize={10}
                                textAnchor="middle"
                                fontWeight={isHovered ? "bold" : "normal"}
                              >
                                {getPercentage(arcData.value)}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    });
                  }}
                </Pie>
              </Group>
            </svg>
            
            {/* Legend */}
            <div className="mt-4">
              <div className="flex justify-center flex-wrap gap-4 max-w-md mx-auto">
                {data.map((item, i) => (
                  <div 
                    key={`legend-${i}`} 
                    className="flex items-center gap-2 cursor-pointer" 
                    onClick={() => handleClick(item.label, item.value)}
                    onMouseEnter={() => handleMouseOver(item.label)}
                    onMouseLeave={handleMouseOut}
                  >
                    <div 
                      className="w-3 h-3 rounded-sm" 
                      style={{ backgroundColor: item.color, 
                        opacity: hovered === item.label || !hovered ? 1 : 0.7,
                        transform: hovered === item.label ? 'scale(1.2)' : 'scale(1)',
                        transition: 'all 0.2s ease'
                      }} 
                    />
                    <span 
                      className="text-xs text-white"
                      style={{ 
                        fontWeight: hovered === item.label ? 'bold' : 'normal',
                      }}
                    >
                      {item.label} ({item.value})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      }}
    </ParentSize>
  );
};

export default VisxPieChart;

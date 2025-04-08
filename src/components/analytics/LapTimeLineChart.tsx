
import React from 'react';
import { Driver, FastestLapTime } from "@/types/lapTimeTypes";
import LapTimeVisxChart from './charts/LapTimeVisxChart';

interface LapTimeLineChartProps {
  chartData: any[];
  availableDrivers: Driver[];
  selectedDrivers: string[];
  displayMode: 'absolute' | 'gap';
  fastestLapTime: FastestLapTime | null;
  hoveredDriver: string | null;
}

// This is now just a wrapper around the VisX chart to maintain backwards compatibility
const LapTimeLineChart: React.FC<LapTimeLineChartProps> = (props) => {
  return <LapTimeVisxChart {...props} />;
};

export default LapTimeLineChart;

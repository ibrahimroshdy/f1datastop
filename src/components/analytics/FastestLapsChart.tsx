
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, 
  Bar, 
  CartesianGrid, 
  Tooltip, 
  Cell, 
  ResponsiveContainer 
} from "recharts";
import { XAxis, YAxis } from "@/utils/rechartsWrapper";
import { DRIVER_COLORS } from "@/constants/f1Colors";

interface FastestLapsChartProps {
  data: any[] | undefined;
  isLoading: boolean;
}

const FastestLapsChart = ({ data, isLoading }: FastestLapsChartProps) => {
  // Helper to format time in seconds to MM:SS.sss
  const formatTime = (seconds: number | string) => {
    if (typeof seconds === 'string') return seconds;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
  };
  
  // Current year for display
  const currentYear = new Date().getFullYear();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fastest Laps of {currentYear}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-[300px] w-full" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={data?.slice(0, 10)}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                domain={['dataMin - 0.5', 'dataMax + 0.5']} 
                xAxisId="lapTime"
              />
              <YAxis 
                dataKey="driver" 
                type="category" 
                tick={{ fontSize: 12 }} 
                width={40}
                yAxisId="driver" 
              />
              <Tooltip 
                formatter={(value: any) => {
                  return typeof value === 'number' 
                    ? [`${formatTime(value)}`, 'Lap Time'] 
                    : [value, ''];
                }}
              />
              <Bar 
                dataKey="fastestLap" 
                name="Lap Time (seconds)" 
                fill="#f1453d"
                xAxisId="lapTime"
                yAxisId="driver"
              >
                {data?.slice(0, 10).map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={DRIVER_COLORS[entry.driver] || `#${Math.floor(Math.random()*16777215).toString(16)}`} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default FastestLapsChart;

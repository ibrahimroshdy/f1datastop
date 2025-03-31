
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, 
  Bar, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  Cell, 
  ResponsiveContainer 
} from "recharts";
import { XAxis, YAxis } from "@/utils/rechartsWrapper";
import { DRIVER_COLORS } from "@/constants/f1Colors";

interface TopSpeedsChartProps {
  data: any[] | undefined;
  isLoading: boolean;
}

const TopSpeedsChart = ({ data, isLoading }: TopSpeedsChartProps) => {
  // Current year for display
  const currentYear = new Date().getFullYear();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Speeds of {currentYear}</CardTitle>
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
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="driver" xAxisId="driver" />
              <YAxis domain={['auto', 'auto']} yAxisId="speed" />
              <Tooltip formatter={(value) => [`${String(value)} km/h`, 'Top Speed']} />
              <Legend />
              <Bar 
                dataKey="topSpeed" 
                name="Speed (km/h)" 
                fill="#3498db"
                xAxisId="driver"
                yAxisId="speed"
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

export default TopSpeedsChart;

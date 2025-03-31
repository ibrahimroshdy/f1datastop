
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface PointsProgressChartProps {
  driverData: any[];
  isLoading: boolean;
}

const PointsProgressChart = ({ driverData, isLoading }: PointsProgressChartProps) => {
  // Process data for the chart
  const chartData = !isLoading && driverData
    ? driverData.slice(0, 10).map((driver) => ({
        name: driver.Driver.code,
        points: parseFloat(driver.points),
        team: driver.Constructors[0].name,
      }))
    : [];

  // Get colors for each team
  const teamColors: Record<string, string> = {
    "Red Bull Racing": "#0600EF",
    "Ferrari": "#F91536",
    "Mercedes": "#00D2BE",
    "McLaren": "#FF8700",
    "Aston Martin": "#006F62",
    "Racing Bulls": "#2B4562",
    "Alpine": "#0090FF",
    "Williams": "#005AFF",
    "Kick Sauber": "#900000",
    "Haas F1 Team": "#FFFFFF",
  };

  const getColor = (teamName: string) => {
    return teamColors[teamName] || "#cccccc";
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Driver Points Progress</CardTitle>
        <CardDescription>Points distribution among top 10 drivers</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[350px] w-full" />
        ) : (
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a',
                    borderColor: '#333',
                    borderRadius: '5px',
                    color: 'white'
                  }} 
                  formatter={(value, name, props) => [
                    `${value} points`, 
                    "Points"
                  ]}
                  labelFormatter={(value) => {
                    const driver = chartData.find(item => item.name === value);
                    return `${value} (${driver?.team})`;
                  }}
                />
                <Bar 
                  dataKey="points" 
                  name="Points" 
                  fill="#f1263d"
                  radius={[4, 4, 0, 0]}
                  fillOpacity={0.8}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PointsProgressChart;

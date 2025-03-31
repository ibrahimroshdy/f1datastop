
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TEAM_COLORS } from "@/constants/f1Colors";

export interface PointsProgressChartProps {
  driverData: any[];
  isLoading: boolean;
}

const PointsProgressChart = ({ driverData, isLoading }: PointsProgressChartProps) => {
  // Process data for the chart
  const chartData = !isLoading && driverData && driverData.length > 0
    ? driverData.slice(0, 10).map((driver) => {
        // Handle both the MRData format and direct array format
        const driverInfo = driver.Driver || driver;
        const constructors = driver.Constructors || [];
        const team = constructors.length > 0 ? constructors[0] : { name: "Unknown", constructorId: "default" };
        
        return {
          name: driverInfo.code || driverInfo?.familyName?.substring(0, 3).toUpperCase(),
          points: parseFloat(driver.points),
          team: team.name,
          constructorId: team.constructorId,
        };
      })
    : [];

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

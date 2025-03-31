
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface TeamPerformanceChartProps {
  constructorData: any[];
  isLoading: boolean;
}

const TeamPerformanceChart = ({ constructorData, isLoading }: TeamPerformanceChartProps) => {
  // Process data for the chart
  const chartData = !isLoading && constructorData
    ? constructorData.map((team) => ({
        name: team.Constructor.name,
        value: parseFloat(team.points),
      }))
    : [];

  // Colors for each team
  const COLORS = [
    "#0600EF", // Red Bull
    "#F91536", // Ferrari
    "#00D2BE", // Mercedes
    "#FF8700", // McLaren
    "#006F62", // Aston Martin
    "#2B4562", // Racing Bulls
    "#0090FF", // Alpine
    "#005AFF", // Williams
    "#900000", // Sauber
    "#FFFFFF", // Haas
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Team Points Distribution</CardTitle>
        <CardDescription>Percentage of total points gained by each constructor</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  outerRadius={150}
                  innerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a',
                    borderColor: '#333',
                    borderRadius: '5px',
                    color: 'white'
                  }} 
                  formatter={(value, name, props) => [`${value} points`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamPerformanceChart;

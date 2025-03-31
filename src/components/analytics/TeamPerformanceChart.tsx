
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { TEAM_COLORS } from "@/constants/f1Colors";

export interface TeamPerformanceChartProps {
  constructorData: any[];
  isLoading: boolean;
}

const TeamPerformanceChart = ({ constructorData, isLoading }: TeamPerformanceChartProps) => {
  // Process data for the chart
  const chartData = !isLoading && constructorData && constructorData.length > 0
    ? constructorData.map((team) => {
        // Handle both the MRData format and direct array format
        const constructorInfo = team.Constructor || team;
        
        return {
          name: constructorInfo ? constructorInfo.name : team.name || "Unknown",
          value: parseFloat(team.points),
          constructorId: constructorInfo ? constructorInfo.constructorId : team.constructorId || "default",
        };
      })
    : [];

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
                    <Cell 
                      key={`cell-${index}`} 
                      fill={TEAM_COLORS[entry.constructorId] || `#${Math.floor(Math.random()*16777215).toString(16)}`} 
                    />
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

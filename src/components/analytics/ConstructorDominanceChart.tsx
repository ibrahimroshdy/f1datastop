
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TEAM_COLORS } from "@/constants/f1Colors";

export interface ConstructorDominanceChartProps {
  constructorData: any[];
  isLoading: boolean;
}

const ConstructorDominanceChart = ({ constructorData, isLoading }: ConstructorDominanceChartProps) => {
  // Generate some fake historical data for visualization purposes
  const generateHistoricalData = () => {
    const rounds = Array.from({ length: 10 }, (_, i) => i + 1);
    
    // Process constructor data to handle different API response formats
    const processedConstructors = !isLoading && constructorData && constructorData.length > 0
      ? constructorData.slice(0, 4).map(team => {
          const constructorInfo = team.Constructor || team;
          return {
            name: constructorInfo ? constructorInfo.name : team.name || "Unknown",
            constructorId: constructorInfo ? constructorInfo.constructorId : team.constructorId || "default",
            points: parseFloat(team.points)
          };
        })
      : [
          { name: "Red Bull", constructorId: "red_bull", points: 100 },
          { name: "Ferrari", constructorId: "ferrari", points: 80 },
          { name: "Mercedes", constructorId: "mercedes", points: 75 },
          { name: "McLaren", constructorId: "mclaren", points: 60 }
        ];
      
    return rounds.map(round => {
      const roundData: Record<string, number> = { round };
      
      processedConstructors.forEach(constructor => {
        // Generate some simulated cumulative points data
        const basePoints = constructor.points || Math.random() * 100;
        const roundMultiplier = round / 10; // Increase points with each round
        
        let cumulativePoints = Math.floor(basePoints * roundMultiplier);
        // Add some randomness but ensure points always increase
        cumulativePoints = Math.max(
          roundData[constructor.name] || 0,
          cumulativePoints + Math.floor(Math.random() * 10)
        );
        
        roundData[constructor.name] = cumulativePoints;
      });
      
      return roundData;
    });
  };

  const chartData = generateHistoricalData();

  // Get list of team names for the chart
  const teamNames = !isLoading && constructorData && constructorData.length > 0
    ? constructorData.slice(0, 4).map(team => {
        const constructorInfo = team.Constructor || team;
        return constructorInfo ? constructorInfo.name : team.name || "Unknown";
      })
    : ["Red Bull", "Ferrari", "Mercedes", "McLaren"];
    
  // Get list of team constructor IDs for colors
  const teamIds = !isLoading && constructorData && constructorData.length > 0
    ? constructorData.slice(0, 4).map(team => {
        const constructorInfo = team.Constructor || team;
        return constructorInfo ? constructorInfo.constructorId : team.constructorId || "default";
      })
    : ["red_bull", "ferrari", "mercedes", "mclaren"];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Constructor Points Progression</CardTitle>
        <CardDescription>Cumulative points scored by top constructors across rounds</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="round" label={{ value: 'Race Round', position: 'insideBottomRight', offset: -10 }} />
                <YAxis label={{ value: 'Points', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a',
                    borderColor: '#333',
                    borderRadius: '5px',
                    color: 'white'
                  }}
                  formatter={(value, name) => [`${value} points`, name]}
                  labelFormatter={(value) => `Round ${value}`}
                />
                <Legend />
                
                {teamNames.map((teamName, index) => (
                  <Area
                    key={teamName}
                    type="monotone"
                    dataKey={teamName}
                    stackId="1"
                    stroke={TEAM_COLORS[teamIds[index]] || `#${Math.floor(Math.random()*16777215).toString(16)}`}
                    fill={TEAM_COLORS[teamIds[index]] || `#${Math.floor(Math.random()*16777215).toString(16)}`}
                    fillOpacity={0.5}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConstructorDominanceChart;

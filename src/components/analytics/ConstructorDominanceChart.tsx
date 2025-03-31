
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export interface ConstructorDominanceChartProps {
  constructorData: any[];
  isLoading: boolean;
}

const ConstructorDominanceChart = ({ constructorData, isLoading }: ConstructorDominanceChartProps) => {
  // Generate some fake historical data for visualization purposes
  const generateHistoricalData = () => {
    const rounds = Array.from({ length: 10 }, (_, i) => i + 1);
    const constructors = !isLoading && constructorData && constructorData.length > 0
      ? constructorData.slice(0, 4).map(team => team.Constructor.name)
      : ["Red Bull Racing", "Ferrari", "Mercedes", "McLaren"];
      
    return rounds.map(round => {
      const roundData: Record<string, number> = { round };
      
      constructors.forEach(constructor => {
        // Generate some simulated cumulative points data
        const basePoints = constructorData?.find(c => c.Constructor.name === constructor)?.points || Math.random() * 100;
        const roundMultiplier = round / 10; // Increase points with each round
        
        let cumulativePoints = Math.floor(basePoints * roundMultiplier);
        // Add some randomness but ensure points always increase
        cumulativePoints = Math.max(
          roundData[constructor] || 0,
          cumulativePoints + Math.floor(Math.random() * 10)
        );
        
        roundData[constructor] = cumulativePoints;
      });
      
      return roundData;
    });
  };

  const chartData = generateHistoricalData();

  // Colors for each team
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
                
                {!isLoading && constructorData && constructorData.length > 0 && constructorData.slice(0, 4).map((team, index) => (
                  <Area
                    key={team.Constructor.name}
                    type="monotone"
                    dataKey={team.Constructor.name}
                    stackId="1"
                    stroke={teamColors[team.Constructor.name] || `#${Math.floor(Math.random()*16777215).toString(16)}`}
                    fill={teamColors[team.Constructor.name] || `#${Math.floor(Math.random()*16777215).toString(16)}`}
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

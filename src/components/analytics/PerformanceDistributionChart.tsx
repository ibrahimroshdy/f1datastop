
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  ZAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { TEAM_COLORS } from "@/constants/f1Colors";

const PerformanceDistributionChart = () => {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Performance Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart
            margin={{ top: 20, right: 20, bottom: 10, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="qualifying" name="Qualifying" unit="s" />
            <YAxis dataKey="race" name="Race Pace" unit="s" />
            <ZAxis dataKey="results" name="Results" range={[30, 200]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value) => {
              return typeof value === 'number' ? [value.toFixed(3), ''] : [value, ''];
            }} />
            <Legend />
            <Scatter name="Red Bull" data={[
              { qualifying: 92.1, race: 97.2, results: 150, driver: 'VER' },
              { qualifying: 92.7, race: 98.1, results: 120, driver: 'PER' },
            ]} fill={TEAM_COLORS.red_bull} />
            <Scatter name="Ferrari" data={[
              { qualifying: 92.2, race: 97.6, results: 140, driver: 'LEC' },
              { qualifying: 92.4, race: 97.8, results: 130, driver: 'SAI' },
            ]} fill={TEAM_COLORS.ferrari} />
            <Scatter name="Mercedes" data={[
              { qualifying: 92.3, race: 97.5, results: 120, driver: 'HAM' },
              { qualifying: 92.6, race: 97.9, results: 110, driver: 'RUS' },
            ]} fill={TEAM_COLORS.mercedes} />
            <Scatter name="McLaren" data={[
              { qualifying: 92.4, race: 97.7, results: 110, driver: 'NOR' },
              { qualifying: 92.9, race: 98.2, results: 90, driver: 'PIA' },
            ]} fill={TEAM_COLORS.mclaren} />
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default PerformanceDistributionChart;

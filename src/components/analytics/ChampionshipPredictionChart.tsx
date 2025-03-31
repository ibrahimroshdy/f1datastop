
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  ResponsiveContainer 
} from "recharts";

const ChampionshipPredictionChart = () => {
  const data = [
    { subject: 'Verstappen', A: 120, fullMark: 150 },
    { subject: 'Perez', A: 98, fullMark: 150 },
    { subject: 'Hamilton', A: 86, fullMark: 150 },
    { subject: 'Leclerc', A: 99, fullMark: 150 },
    { subject: 'Sainz', A: 85, fullMark: 150 },
    { subject: 'Norris', A: 105, fullMark: 150 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Championship Prediction</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart outerRadius={90} width={730} height={250} data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" />
            <PolarRadiusAxis angle={90} domain={[0, 150]} />
            <Radar 
              name="Championship Points" 
              dataKey="A" 
              stroke="#f1453d" 
              fill="#f1453d" 
              fillOpacity={0.6} 
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ChampionshipPredictionChart;

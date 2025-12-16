import { useMemo } from "react";
import { PieChart } from "@mui/x-charts/PieChart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useDriverStandings, useConstructorStandings } from "@/hooks/useF1Data";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Users } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { MuiThemeWrapper } from "@/components/analytics/MuiThemeWrapper";

interface SeasonChartsProps {
  year: number;
}

const SeasonCharts = ({ year }: SeasonChartsProps) => {
  const { data: driverStandings, isLoading: driversLoading } = useDriverStandings(year);
  const { data: constructorStandings, isLoading: constructorsLoading } = useConstructorStandings(year);
  const { isGlass } = useTheme();

  const glassStyle = isGlass ? {
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    boxShadow: 'var(--glass-shadow), var(--glass-inner-shadow)'
  } : undefined;

  // Driver wins data for pie chart
  const driverWinsData = useMemo(() => {
    if (!driverStandings?.data) return [];
    
    const driversWithWins = driverStandings.data
      .filter((entry: any) => parseInt(entry.wins || 0) > 0)
      .map((entry: any) => ({
        id: entry.Driver.driverId,
        label: entry.Driver.code || entry.Driver.familyName.substring(0, 3).toUpperCase(),
        value: parseInt(entry.wins || 0),
        color: TEAM_COLORS[entry.Constructors?.[0]?.constructorId?.toLowerCase() || ''] || '#666',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 drivers by wins
    
    return driversWithWins;
  }, [driverStandings]);

  // Constructor points distribution for donut chart
  const constructorPointsData = useMemo(() => {
    if (!constructorStandings?.data) return [];
    
    return constructorStandings.data.map((entry: any) => ({
      id: entry.Constructor.constructorId,
      label: entry.Constructor.name,
      value: parseFloat(entry.points || 0),
      color: TEAM_COLORS[entry.Constructor.constructorId?.toLowerCase() || ''] || '#666',
    }));
  }, [constructorStandings]);


  if (driversLoading || constructorsLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className={cn(isGlass && "border-white/10")} style={glassStyle}>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
        <Card className={cn(isGlass && "border-white/10")} style={glassStyle}>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Driver Wins Pie Chart */}
      <Card className={cn(isGlass && "border-white/10")} style={glassStyle}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-primary" />
            Driver Wins Distribution
          </CardTitle>
          <CardDescription className="text-xs">
            Top drivers by race wins
          </CardDescription>
        </CardHeader>
        <CardContent>
          {driverWinsData.length > 0 ? (
            <div className="h-[200px]">
              <PieChart
                series={[{
                  data: driverWinsData,
                  innerRadius: 40,
                  outerRadius: 80,
                  paddingAngle: 2,
                  cornerRadius: 4,
                }]}
                slotProps={{
                  legend: { hidden: true },
                }}
                colors={driverWinsData.map(d => d.color)}
                sx={{
                  '& .MuiChartsLegend-root': {
                    display: 'none',
                  },
                }}
                height={200}
              />
              <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
                {driverWinsData.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center gap-1 text-xs">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground">{item.label}:</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              No wins data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Constructor Points Donut Chart */}
      <Card className={cn(isGlass && "border-white/10")} style={glassStyle}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-primary" />
            Constructor Points
          </CardTitle>
          <CardDescription className="text-xs">
            Points distribution by team
          </CardDescription>
        </CardHeader>
        <CardContent>
          {constructorPointsData.length > 0 ? (
            <div className="h-[200px]">
              <PieChart
                series={[{
                  data: constructorPointsData,
                  innerRadius: 50,
                  outerRadius: 80,
                  paddingAngle: 2,
                  cornerRadius: 4,
                }]}
                slotProps={{
                  legend: { hidden: true },
                }}
                colors={constructorPointsData.map(d => d.color)}
                sx={{
                  '& .MuiChartsLegend-root': {
                    display: 'none',
                  },
                }}
                height={200}
              />
              <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
                {constructorPointsData.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center gap-1 text-xs">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground truncate max-w-[60px]">{item.label}:</span>
                    <span className="font-medium">{Math.round(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              No constructor data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SeasonCharts;


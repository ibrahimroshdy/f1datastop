import { useMemo } from "react";
import { PieChart } from "@mui/x-charts/PieChart";
import MuiThemeWrapper from "@/components/analytics/MuiThemeWrapper";
import { F1Card, F1CardContent, F1CardDescription, F1CardHeader, F1CardTitle } from "@/components/f1";
import { useDriverStandings, useConstructorStandings } from "@/hooks/useF1Data";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Users } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";

interface SeasonChartsProps {
  year: number;
}

const SeasonCharts = ({ year }: SeasonChartsProps) => {
  const { data: driverStandings, isLoading: driversLoading } = useDriverStandings(year);
  const { data: constructorStandings, isLoading: constructorsLoading } = useConstructorStandings(year);
  const { isGlass } = useTheme();
  const surfaceVariant = isGlass ? ("glass" as const) : ("default" as const);
  const surfaceGlass = isGlass ? ("panel" as const) : ("default" as const);
  const cardClass = cn("overflow-hidden p-0", isGlass && "border-white/10");

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
      .slice(0, 10);
    
    return driversWithWins;
  }, [driverStandings]);

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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={cardClass}>
          <F1CardHeader>
            <Skeleton className="h-6 w-32" />
          </F1CardHeader>
          <F1CardContent>
            <Skeleton className="h-[200px] w-full" />
          </F1CardContent>
        </F1Card>
        <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={cardClass}>
          <F1CardHeader>
            <Skeleton className="h-6 w-32" />
          </F1CardHeader>
          <F1CardContent>
            <Skeleton className="h-[200px] w-full" />
          </F1CardContent>
        </F1Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={cardClass}>
        <F1CardHeader className="pb-2">
          <F1CardTitle icon={<Trophy className="h-4 w-4" />} className="text-sm font-semibold">
            Driver Wins Distribution
          </F1CardTitle>
          <F1CardDescription className="text-xs">
            Top drivers by race wins
          </F1CardDescription>
        </F1CardHeader>
        <F1CardContent>
          {driverWinsData.length > 0 ? (
            <div className="h-[200px]">
              <MuiThemeWrapper>
                <PieChart
                  series={[{
                    data: driverWinsData,
                    innerRadius: 40,
                    outerRadius: 80,
                    paddingAngle: 2,
                    cornerRadius: 4,
                  }]}
                  slotProps={({
                    legend: { hidden: true },
                  } as any)}
                  colors={driverWinsData.map(d => d.color)}
                  sx={{
                    '& .MuiChartsLegend-root': {
                      display: 'none',
                    },
                  }}
                  height={200}
                />
              </MuiThemeWrapper>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {driverWinsData.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center gap-1 text-xs">
                    <div 
                      className="h-2 w-2 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground">{item.label}:</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              No wins data available
            </div>
          )}
        </F1CardContent>
      </F1Card>

      <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={cardClass}>
        <F1CardHeader className="pb-2">
          <F1CardTitle icon={<Users className="h-4 w-4" />} className="text-sm font-semibold">
            Constructor Points
          </F1CardTitle>
          <F1CardDescription className="text-xs">
            Points distribution by team
          </F1CardDescription>
        </F1CardHeader>
        <F1CardContent>
          {constructorPointsData.length > 0 ? (
            <div className="h-[200px]">
              <MuiThemeWrapper>
                <PieChart
                  series={[{
                    data: constructorPointsData,
                    innerRadius: 50,
                    outerRadius: 80,
                    paddingAngle: 2,
                    cornerRadius: 4,
                  }]}
                  slotProps={({
                    legend: { hidden: true },
                  } as any)}
                  colors={constructorPointsData.map(d => d.color)}
                  sx={{
                    '& .MuiChartsLegend-root': {
                      display: 'none',
                    },
                  }}
                  height={200}
                />
              </MuiThemeWrapper>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {constructorPointsData.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center gap-1 text-xs">
                    <div 
                      className="h-2 w-2 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="max-w-[60px] truncate text-muted-foreground">{item.label}:</span>
                    <span className="font-medium">{Math.round(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              No constructor data available
            </div>
          )}
        </F1CardContent>
      </F1Card>
    </div>
  );
};

export default SeasonCharts;

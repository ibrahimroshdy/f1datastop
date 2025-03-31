
import { useState, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDriverStandings, useConstructorStandings } from "@/hooks/useF1Data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import YearSelector from "@/components/common/YearSelector";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { toast } from "sonner";

const Analytics = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Fetch data using react-query hooks
  const { data: driverStandingsData, isLoading: isDriverStandingsLoading, error: driverError } = useDriverStandings(selectedYear);
  const { data: constructorStandingsData, isLoading: isConstructorStandingsLoading, error: constructorError } = useConstructorStandings(selectedYear);
  
  // Show toast when errors occur
  useEffect(() => {
    if (driverError) {
      toast.error("Failed to load driver standings data");
    }
    if (constructorError) {
      toast.error("Failed to load constructor standings data");
    }
  }, [driverError, constructorError]);
  
  // Find team color based on constructor ID
  const getTeamColor = (constructorId: string) => {
    const colors: Record<string, string> = {
      'red_bull': '#0600EF',
      'ferrari': '#DC0000',
      'mercedes': '#00D2BE',
      'mclaren': '#FF8700',
      'aston_martin': '#006F62',
      'williams': '#005AFF',
      'alphatauri': '#2B4562',
      'rb': '#2B4562',
      'alfa': '#900000',
      'sauber': '#900000',
      'haas': '#FFFFFF',
      'alpine': '#0090FF',
      'racing_point': '#F596C8',
      'renault': '#FFF500',
      'default': '#CCCCCC'
    };
    
    return colors[constructorId] || colors.default;
  };
  
  // Handler for year changes
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  // Process driver standings data for chart display
  const driverChartData = !isDriverStandingsLoading && driverStandingsData?.data
    ? driverStandingsData.data.slice(0, 10).map((driver: any) => {
        const driverInfo = driver.Driver || driver;
        const constructors = driver.Constructors || [];
        const team = constructors.length > 0 ? constructors[0] : { constructorId: "default" };
        
        return {
          name: driverInfo.code || `${driverInfo.familyName?.substring(0, 3).toUpperCase()}`,
          fullName: `${driverInfo.givenName} ${driverInfo.familyName}`,
          points: parseFloat(driver.points),
          constructorId: team.constructorId,
          position: driver.position
        };
      })
    : [];
    
  // Process constructor standings data for chart display
  const constructorChartData = !isConstructorStandingsLoading && constructorStandingsData?.data
    ? constructorStandingsData.data.map((team: any) => {
        const constructorInfo = team.Constructor || team;
        
        return {
          name: constructorInfo ? constructorInfo.name : "Unknown",
          value: parseFloat(team.points),
          constructorId: constructorInfo ? constructorInfo.constructorId : "default",
        };
      })
    : [];
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <h1 className="text-3xl font-bold">F1 Analytics</h1>
          <YearSelector selectedYear={selectedYear} onYearChange={handleYearChange} />
        </div>
        
        <Tabs defaultValue="standings">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="standings">Standings</TabsTrigger>
            <TabsTrigger value="performance">Team Performance</TabsTrigger>
          </TabsList>
          
          {/* Standings Tab */}
          <TabsContent value="standings" className="space-y-6">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Driver Standings {selectedYear}</CardTitle>
              </CardHeader>
              <CardContent>
                {isDriverStandingsLoading ? (
                  <Skeleton className="h-[350px] w-full" />
                ) : driverChartData.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">No driver standings data available for {selectedYear}</p>
                  </div>
                ) : (
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={driverChartData}
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
                          labelFormatter={(value, item) => {
                            const driver = driverChartData.find(d => d.name === value);
                            return driver ? `${driver.fullName} (P${driver.position})` : value;
                          }}
                        />
                        <Bar 
                          dataKey="points" 
                          name="Points"
                          radius={[4, 4, 0, 0]}
                          fillOpacity={0.8}
                        >
                          {driverChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getTeamColor(entry.constructorId)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Team Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Constructor Standings {selectedYear}</CardTitle>
              </CardHeader>
              <CardContent>
                {isConstructorStandingsLoading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : constructorChartData.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">No constructor standings data available for {selectedYear}</p>
                  </div>
                ) : (
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={constructorChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          outerRadius={150}
                          innerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value, percent }) => `${name} (${value} pts, ${(percent * 100).toFixed(1)}%)`}
                        >
                          {constructorChartData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={getTeamColor(entry.constructorId)} 
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
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Analytics;

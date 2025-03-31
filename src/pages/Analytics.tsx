
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDriverStandings, useConstructorStandings, useRaceSchedule, useRaceResults, useRaceQualifying } from "@/hooks/useF1Data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import YearSelector from "@/components/common/YearSelector";
import PointsProgressChart from "@/components/analytics/PointsProgressChart";
import TeamPerformanceChart from "@/components/analytics/TeamPerformanceChart";
import PitStopAnalysis from "@/components/analytics/PitStopAnalysis";
import RaceResultsAnalysis from "@/components/analytics/RaceResultsAnalysis";
import { toast } from "sonner";

const Analytics = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedSection, setSelectedSection] = useState<string>("overview");
  
  // Fetch data using react-query hooks
  const { data: driverStandingsData, isLoading: isDriverStandingsLoading, error: driverError } = useDriverStandings(selectedYear);
  const { data: constructorStandingsData, isLoading: isConstructorStandingsLoading, error: constructorError } = useConstructorStandings(selectedYear);
  const { data: raceScheduleData, isLoading: isRaceScheduleLoading } = useRaceSchedule(selectedYear);
  
  // Show toast when errors occur
  if (driverError) {
    toast.error("Failed to load driver standings data");
  }
  if (constructorError) {
    toast.error("Failed to load constructor standings data");
  }
  
  // Handler for year changes
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <h1 className="text-3xl font-bold">F1 Analytics</h1>
          <div className="flex items-center gap-2">
            <YearSelector selectedYear={selectedYear} onYearChange={handleYearChange} />
            <div className="flex space-x-2">
              <Button 
                variant={selectedSection === "overview" ? "default" : "outline"}
                onClick={() => setSelectedSection("overview")}
                size="sm"
              >
                Season Overview
              </Button>
              <Button 
                variant={selectedSection === "detailed" ? "default" : "outline"}
                onClick={() => setSelectedSection("detailed")}
                size="sm"
              >
                Detailed Analysis
              </Button>
            </div>
          </div>
        </div>
        
        {selectedSection === "overview" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PointsProgressChart 
                driverData={driverStandingsData?.data || []} 
                isLoading={isDriverStandingsLoading} 
              />
              <TeamPerformanceChart 
                constructorData={constructorStandingsData?.data || []} 
                isLoading={isConstructorStandingsLoading} 
              />
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Season Summary {selectedYear}</CardTitle>
                <CardDescription>Overview of the current season statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Total Races</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isRaceScheduleLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        <p className="text-2xl font-bold">{raceScheduleData?.data?.length || 0}</p>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Drivers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isDriverStandingsLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        <p className="text-2xl font-bold">{driverStandingsData?.data?.length || 0}</p>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Teams</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isConstructorStandingsLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        <p className="text-2xl font-bold">{constructorStandingsData?.data?.length || 0}</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <PitStopAnalysis year={selectedYear} />
            <RaceResultsAnalysis year={selectedYear} />
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Analytics;

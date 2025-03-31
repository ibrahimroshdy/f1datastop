
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFastestLaps, useTopSpeeds, useLapTimes, useTireStrategies } from "@/hooks/useFastF1Data";
import { useDriverStandings, useConstructorStandings } from "@/hooks/useF1Data";

// Import analytics components
import PointsProgressChart from "@/components/analytics/PointsProgressChart";
import TeamPerformanceChart from "@/components/analytics/TeamPerformanceChart";
import DriverComparisonChart from "@/components/analytics/DriverComparisonChart";
import ConstructorDominanceChart from "@/components/analytics/ConstructorDominanceChart";
import FastestLapsChart from "@/components/analytics/FastestLapsChart";
import TopSpeedsChart from "@/components/analytics/TopSpeedsChart";
import DriverComparisonPanel from "@/components/analytics/DriverComparisonPanel";
import ChampionshipPredictionChart from "@/components/analytics/ChampionshipPredictionChart";
import PerformanceDistributionChart from "@/components/analytics/PerformanceDistributionChart";

const Analytics = () => {
  const [selectedRace, setSelectedRace] = useState("monaco"); // Default race
  
  // Fetch data using react-query hooks
  const { data: fastestLapsData, isLoading: isLapsLoading } = useFastestLaps();
  const { data: topSpeedsData, isLoading: isSpeedsLoading } = useTopSpeeds();
  const { data: lapTimesData, isLoading: isLapTimesLoading } = useLapTimes(selectedRace);
  const { data: tireStrategyData, isLoading: isTireDataLoading } = useTireStrategies(selectedRace);
  const { data: driverStandingsData, isLoading: isDriverStandingsLoading } = useDriverStandings();
  const { data: constructorStandingsData, isLoading: isConstructorStandingsLoading } = useConstructorStandings();

  // Get current year for the UI
  const currentYear = new Date().getFullYear();
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">F1 Analytics</h1>
          <p className="text-muted-foreground">
            Analyze Formula 1 performance data for the {currentYear} season
          </p>
        </div>
        
        <Tabs defaultValue="performance">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="comparison">Driver Comparison</TabsTrigger>
            <TabsTrigger value="simulation">Season Simulation</TabsTrigger>
          </TabsList>
          
          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Fastest Laps Chart */}
              <FastestLapsChart 
                data={fastestLapsData?.data}
                isLoading={isLapsLoading}
              />
              
              {/* Top Speeds Chart */}
              <TopSpeedsChart 
                data={topSpeedsData?.data}
                isLoading={isSpeedsLoading}
              />
            </div>
            
            {/* Points Progress Chart */}
            <PointsProgressChart 
              driverData={driverStandingsData?.data || []}
              isLoading={isDriverStandingsLoading}
            />
            
            {/* Constructor Performance Chart */}
            <TeamPerformanceChart 
              constructorData={constructorStandingsData?.data || []}
              isLoading={isConstructorStandingsLoading}
            />
          </TabsContent>
          
          {/* Comparison Tab */}
          <TabsContent value="comparison" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Driver Comparison Panel */}
              <DriverComparisonPanel 
                lapTimesData={lapTimesData}
                tireStrategyData={tireStrategyData}
                isLapTimesLoading={isLapTimesLoading}
                isTireDataLoading={isTireDataLoading}
                selectedRace={selectedRace}
                setSelectedRace={setSelectedRace}
              />
              
              {/* Side-by-Side Performance */}
              <DriverComparisonChart 
                driverData={driverStandingsData?.data || []}
                isLoading={isDriverStandingsLoading}
              />
            </div>
          </TabsContent>
          
          {/* Simulation Tab */}
          <TabsContent value="simulation" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Constructor Win Probability */}
              <ConstructorDominanceChart 
                constructorData={constructorStandingsData?.data || []}
                isLoading={isConstructorStandingsLoading}
              />
              
              {/* Championship Prediction */}
              <ChampionshipPredictionChart />
              
              {/* Performance Distribution */}
              <PerformanceDistributionChart />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Analytics;


import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useDriverStandings, useConstructorStandings } from "@/hooks/useF1Data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PointsProgressChart from "@/components/analytics/PointsProgressChart";
import TeamPerformanceChart from "@/components/analytics/TeamPerformanceChart";
import DriverComparisonChart from "@/components/analytics/DriverComparisonChart";
import ConstructorDominanceChart from "@/components/analytics/ConstructorDominanceChart";
import HistoricalPerformanceChart from "@/components/analytics/HistoricalPerformanceChart";
import CircuitPerformanceChart from "@/components/analytics/CircuitPerformanceChart";
import SeasonalTrendsChart from "@/components/analytics/SeasonalTrendsChart";
import QualifyingAnalysisChart from "@/components/analytics/QualifyingAnalysisChart";
import RaceStrategyChart from "@/components/analytics/RaceStrategyChart";
import DriverFormChart from "@/components/analytics/DriverFormChart";

const Analytics = () => {
  const { data: driverStandings, isLoading: isDriversLoading } = useDriverStandings();
  const { data: constructorStandings, isLoading: isConstructorsLoading } = useConstructorStandings();
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold">F1 Analytics</h1>
          <p className="text-muted-foreground">Comprehensive visualizations and analytics for Formula 1 data</p>
        </div>

        <Tabs defaultValue="points" className="w-full">
          <TabsList className="grid w-full lg:w-[800px] grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 overflow-x-auto">
            <TabsTrigger value="points">Points</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
            <TabsTrigger value="constructors">Constructors</TabsTrigger>
            <TabsTrigger value="historical">Historical</TabsTrigger>
            <TabsTrigger value="circuits">Circuits</TabsTrigger>
            <TabsTrigger value="seasonal">Seasonal</TabsTrigger>
            <TabsTrigger value="qualifying">Qualifying</TabsTrigger>
            <TabsTrigger value="strategy">Strategy</TabsTrigger>
            <TabsTrigger value="form">Driver Form</TabsTrigger>
          </TabsList>
          
          <TabsContent value="points" className="mt-6">
            <PointsProgressChart 
              driverData={driverStandings?.data} 
              isLoading={isDriversLoading} 
            />
          </TabsContent>
          
          <TabsContent value="teams" className="mt-6">
            <TeamPerformanceChart 
              constructorData={constructorStandings?.data} 
              isLoading={isConstructorsLoading} 
            />
          </TabsContent>
          
          <TabsContent value="drivers" className="mt-6">
            <DriverComparisonChart 
              driverData={driverStandings?.data} 
              isLoading={isDriversLoading} 
            />
          </TabsContent>
          
          <TabsContent value="constructors" className="mt-6">
            <ConstructorDominanceChart 
              constructorData={constructorStandings?.data} 
              isLoading={isConstructorsLoading} 
            />
          </TabsContent>
          
          <TabsContent value="historical" className="mt-6">
            <HistoricalPerformanceChart 
              isLoading={isDriversLoading} 
            />
          </TabsContent>
          
          <TabsContent value="circuits" className="mt-6">
            <CircuitPerformanceChart 
              isLoading={isConstructorsLoading} 
            />
          </TabsContent>

          <TabsContent value="seasonal" className="mt-6">
            <SeasonalTrendsChart 
              isLoading={isDriversLoading} 
            />
          </TabsContent>

          <TabsContent value="qualifying" className="mt-6">
            <QualifyingAnalysisChart 
              isLoading={isDriversLoading} 
            />
          </TabsContent>

          <TabsContent value="strategy" className="mt-6">
            <RaceStrategyChart 
              isLoading={isConstructorsLoading} 
            />
          </TabsContent>

          <TabsContent value="form" className="mt-6">
            <DriverFormChart 
              driverData={driverStandings?.data}
              isLoading={isDriversLoading} 
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Analytics;


import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useDriverStandings, useConstructorStandings } from "@/hooks/useF1Data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PointsProgressChart from "@/components/analytics/PointsProgressChart";
import TeamPerformanceChart from "@/components/analytics/TeamPerformanceChart";
import DriverComparisonChart from "@/components/analytics/DriverComparisonChart";
import ConstructorDominanceChart from "@/components/analytics/ConstructorDominanceChart";

const Analytics = () => {
  const { data: driverStandings, isLoading: isDriversLoading } = useDriverStandings();
  const { data: constructorStandings, isLoading: isConstructorsLoading } = useConstructorStandings();
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold">F1 Analytics</h1>
          <p className="text-muted-foreground">Visualizations and analytics for Formula 1 data</p>
        </div>

        <Tabs defaultValue="points" className="w-full">
          <TabsList className="grid w-full md:w-[600px] grid-cols-4">
            <TabsTrigger value="points">Points Analysis</TabsTrigger>
            <TabsTrigger value="teams">Team Performance</TabsTrigger>
            <TabsTrigger value="drivers">Driver Comparison</TabsTrigger>
            <TabsTrigger value="constructors">Constructor Analysis</TabsTrigger>
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
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Analytics;

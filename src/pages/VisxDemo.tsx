
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VisxCurveDemo from "@/components/visualization/VisxCurveDemo";
import VisxBarChart from "@/components/visualization/VisxBarChart";
import VisxHeatmap from "@/components/visualization/VisxHeatmap";
import VisxPieChart from "@/components/visualization/VisxPieChart";

const VisxDemo = () => {
  const [activeTab, setActiveTab] = useState("curves");

  return (
    <MainLayout>
      <div className="container mx-auto">
        <div className="flex flex-col gap-6">
          <h1 className="text-3xl font-bold mt-4">Visx Visualization Gallery</h1>
          <p className="text-gray-400">
            A showcase of visualizations using Airbnb's visx library
          </p>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-4 mb-8">
              <TabsTrigger value="curves">Curve Types</TabsTrigger>
              <TabsTrigger value="bars">Bar Chart</TabsTrigger>
              <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
              <TabsTrigger value="pie">Pie Chart</TabsTrigger>
            </TabsList>
            
            <TabsContent value="curves">
              <Card>
                <CardHeader>
                  <CardTitle>Different Curve Types</CardTitle>
                  <CardDescription>
                    Visualizing data with different curve interpolation types
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-[500px] w-full">
                    <VisxCurveDemo />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="bars">
              <Card>
                <CardHeader>
                  <CardTitle>Interactive Bar Chart</CardTitle>
                  <CardDescription>
                    Interactive bar chart with tooltips and animations
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-[500px] w-full">
                    <VisxBarChart />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="heatmap">
              <Card>
                <CardHeader>
                  <CardTitle>Heatmap Visualization</CardTitle>
                  <CardDescription>
                    A heatmap showing intensity of data across two dimensions
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-[500px] w-full">
                    <VisxHeatmap />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="pie">
              <Card>
                <CardHeader>
                  <CardTitle>Interactive Pie Chart</CardTitle>
                  <CardDescription>
                    Animated pie chart with interactive segments
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-[500px] w-full">
                    <VisxPieChart />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
};

export default VisxDemo;

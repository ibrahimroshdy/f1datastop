
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import VisxCurveDemo from "@/components/visualization/VisxCurveDemo";

const VisxDemo = () => {
  return (
    <MainLayout>
      <div className="container mx-auto">
        <div className="flex flex-col gap-6">
          <h1 className="text-3xl font-bold mt-4">Visx Visualization Demo</h1>
          <p className="text-gray-400">
            A simple demonstration of Airbnb's visx library for data visualization
          </p>
          
          <Card>
            <CardHeader>
              <CardTitle>Different Curve Types</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[500px] w-full">
                <VisxCurveDemo />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default VisxDemo;


import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import YearComparisonAnalytics from "@/components/seasonComparison/YearComparisonAnalytics";

const SeasonComparison = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">F1 Season Comparison</h1>
        <YearComparisonAnalytics />
      </div>
    </MainLayout>
  );
};

export default SeasonComparison;

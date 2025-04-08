
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import YearComparisonAnalytics from "@/components/analytics/YearComparisonAnalytics";
import { Link } from "react-router-dom";

const SeasonComparison = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Season Comparison</h1>
          <Link
            to="/analytics"
            className="bg-f1-red hover:bg-red-700 text-white py-2 px-4 rounded flex items-center gap-2"
          >
            Back to Race Analytics
          </Link>
        </div>
        
        <YearComparisonAnalytics />
      </div>
    </MainLayout>
  );
};

export default SeasonComparison;

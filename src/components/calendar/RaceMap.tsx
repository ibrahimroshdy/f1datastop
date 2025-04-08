import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import YearSelector from "@/components/common/YearSelector";
import F1MapContainer from "@/components/calendar/map/F1MapContainer";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const RaceMap = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const { isLoading, error } = useRaceSchedule(selectedYear);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    toast.info(`Loading race data for ${year}`);
  };

  // Show error toast if the API request fails
  useEffect(() => {
    if (error) {
      toast.error("Failed to load race data. Please try again.");
      console.error("Race data loading error:", error);
    }
  }, [error]);

  return (
    <div className="flex flex-col space-y-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-6 w-6" />
          Race Calendar
        </CardTitle>
        <YearSelector selectedYear={selectedYear} onYearChange={setSelectedYear} />
      </CardHeader>

      <div className="bg-gray-900/30 rounded-xl p-0.5 backdrop-blur-sm border border-gray-800">
        <F1MapContainer selectedYear={selectedYear} onYearChange={handleYearChange} />
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-md" />
          ))}
        </div>
      )}
    </div>
  );
};

export default RaceMap;

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import YearSelector from "@/components/common/YearSelector";
import F1MapContainer from "@/components/calendar/map/F1MapContainer";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { Globe } from "lucide-react";
import { toast } from "sonner";
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
      <div className="flex flex-row items-center justify-between space-y-0 px-0 pb-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Globe className="h-5 w-5 text-muted-foreground" aria-hidden />
          Race Calendar
        </h2>
        <YearSelector selectedYear={selectedYear} onYearChange={setSelectedYear} />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
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

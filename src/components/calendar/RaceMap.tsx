
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import YearSelector from "@/components/common/YearSelector";
import F1GlobeContainer from "@/components/calendar/map/F1GlobeContainer";
import { useRaceSchedule } from "@/hooks/useF1Data";

const RaceMap = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const { isLoading } = useRaceSchedule(selectedYear);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h2 className="text-xl font-bold">F1 Race Globe</h2>
        <YearSelector selectedYear={selectedYear} onYearChange={handleYearChange} />
      </div>

      <F1GlobeContainer selectedYear={selectedYear} />

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

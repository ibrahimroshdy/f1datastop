
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface YearSelectorProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
  className?: string; // Added className as optional prop
}

const YearSelector = ({ selectedYear, onYearChange, className }: YearSelectorProps) => {
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  
  useEffect(() => {
    // Generate available years (from 2010 to current year)
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= 2010; year--) {
      years.push(year);
    }
    setAvailableYears(years);
  }, []);
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Season:</span>
      <Select
        value={selectedYear.toString()}
        onValueChange={(value) => onYearChange(parseInt(value))}
      >
        <SelectTrigger className={`w-full sm:w-[100px] ${className || ''}`}>
          <SelectValue placeholder={selectedYear.toString()} />
        </SelectTrigger>
        <SelectContent>
          {availableYears.map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default YearSelector;

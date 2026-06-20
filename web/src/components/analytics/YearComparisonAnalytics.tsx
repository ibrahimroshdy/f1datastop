import { useState } from "react";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { F1Card, F1CardContent, F1CardDescription, F1CardHeader, F1CardTitle } from "@/components/f1";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BarChart3, Clock, TrendingUp, Flag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import MuiYearComparisonLapChart from "./MuiYearComparisonLapChart";
import MuiYearComparisonPositionChart from "./MuiYearComparisonPositionChart";
import MuiYearComparisonQualifyingChart from "./MuiYearComparisonQualifyingChart";
import DataSourceBadge from "./DataSourceBadge";

// Function to determine the most appropriate default years
const getDefaultYears = () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-based (0 = January)
  
  // If we're in the early months of the year (before April), 
  // use previous years as default as current season might have too few races
  const latestCompleteYear = (currentMonth < 3) ? currentYear - 2 : currentYear - 1;
  const comparisonYear = (currentMonth < 3) ? currentYear - 1 : currentYear;
  
  return { baseYear: latestCompleteYear, comparisonYear };
};

const YearComparisonAnalytics = () => {
  const { baseYear: defaultBaseYear, comparisonYear: defaultComparisonYear } = getDefaultYears();
  const [baseYear, setBaseYear] = useState<number>(defaultBaseYear);
  const [comparisonYear, setComparisonYear] = useState<number>(defaultComparisonYear);
  const [selectedRaceBase, setSelectedRaceBase] = useState<string>("1");
  const [selectedRaceComparison, setSelectedRaceComparison] = useState<string>("1");
  const [selectedTab, setSelectedTab] = useState<string>("lapTimes");
  const { isGlass } = useTheme();
  const surfaceVariant = isGlass ? ("glass" as const) : ("default" as const);
  const surfaceGlass = isGlass ? ("panel" as const) : ("default" as const);
  
  const { 
    data: baseRaceSchedule, 
    isLoading: isBaseScheduleLoading 
  } = useRaceSchedule(baseYear);
  
  const { 
    data: comparisonRaceSchedule, 
    isLoading: isComparisonScheduleLoading 
  } = useRaceSchedule(comparisonYear);
  
  const handleBaseYearChange = (value: string) => {
    const year = parseInt(value);
    setBaseYear(year);
    setSelectedRaceBase("1");
  };

  const handleComparisonYearChange = (value: string) => {
    const year = parseInt(value);
    setComparisonYear(year);
    setSelectedRaceComparison("1");
  };

  const handleBaseRaceChange = (value: string) => {
    setSelectedRaceBase(value);
  };

  const handleComparisonRaceChange = (value: string) => {
    setSelectedRaceComparison(value);
  };

  const cleanRaceName = (raceName: string) => {
    if (!raceName) return "";
    
    if (raceName && raceName.length > 3 && raceName.indexOf(' ') > 0) {
      return raceName.substring(raceName.indexOf(' ') + 1);
    }
    
    if (raceName.includes("Grand Prix")) {
      const parts = raceName.split("Grand Prix");
      if (parts.length > 1) {
        return `${parts[0]}Grand Prix`;
      }
    }
    
    return raceName;
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= 2010; year--) {
      years.push(year);
    }
    return years;
  };

  const yearOptions = generateYearOptions();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={cn("p-0", isGlass && "border-white/10")}>
          <F1CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <F1CardTitle className="text-lg">Base Year</F1CardTitle>
              <DataSourceBadge source="ergast" />
            </div>
            <F1CardDescription>Select the reference season and race</F1CardDescription>
          </F1CardHeader>
          <F1CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="w-full xs:w-auto">
                  <label className="text-sm font-medium mb-1 block">Year</label>
                  <Select 
                    value={baseYear.toString()} 
                    onValueChange={handleBaseYearChange}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map(year => (
                        <SelectItem key={`base-${year}`} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="w-full xs:w-auto flex-1">
                  <label className="text-sm font-medium mb-1 block">Race</label>
                  {isBaseScheduleLoading ? (
                    <div className="flex items-center space-x-2">
                      <Skeleton className="h-10 w-full" />
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Select value={selectedRaceBase} onValueChange={handleBaseRaceChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select race" />
                      </SelectTrigger>
                      <SelectContent>
                        {baseRaceSchedule?.data?.map((race: any) => (
                          <SelectItem key={`base-race-${race.round}`} value={race.round}>
                            {race.Circuit?.circuitName || cleanRaceName(race.raceName)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
          </F1CardContent>
        </F1Card>

        <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={cn("p-0", isGlass && "border-white/10")}>
          <F1CardHeader className="pb-2">
            <F1CardTitle className="text-lg">Comparison Year</F1CardTitle>
            <F1CardDescription>Select the season and race to compare against</F1CardDescription>
          </F1CardHeader>
          <F1CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="w-full xs:w-auto">
                  <label className="text-sm font-medium mb-1 block">Year</label>
                  <Select 
                    value={comparisonYear.toString()} 
                    onValueChange={handleComparisonYearChange}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map(year => (
                        <SelectItem key={`comparison-${year}`} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="w-full xs:w-auto flex-1">
                  <label className="text-sm font-medium mb-1 block">Race</label>
                  {isComparisonScheduleLoading ? (
                    <div className="flex items-center space-x-2">
                      <Skeleton className="h-10 w-full" />
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Select value={selectedRaceComparison} onValueChange={handleComparisonRaceChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select race" />
                      </SelectTrigger>
                      <SelectContent>
                        {comparisonRaceSchedule?.data?.map((race: any) => (
                          <SelectItem key={`comp-race-${race.round}`} value={race.round}>
                            {race.Circuit?.circuitName || cleanRaceName(race.raceName)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
          </F1CardContent>
        </F1Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        {/* Tabs for medium and large screens, hidden on small screens */}
        <div className="hidden sm:block">
        <TabsList className={cn(
          "grid w-full grid-cols-3",
          isGlass && "bg-white/5 border border-white/10"
        )}>
          <TabsTrigger value="lapTimes" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Lap Times
          </TabsTrigger>
          <TabsTrigger value="positions" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Positions
          </TabsTrigger>
          <TabsTrigger value="qualifying" className="gap-1.5">
            <Flag className="h-3.5 w-3.5" />
            Qualifying
          </TabsTrigger>
        </TabsList>
        </div>
        
        {/* Dropdown for mobile screens only */}
        <div className="sm:hidden mb-4">
          <Select value={selectedTab} onValueChange={setSelectedTab}>
            <SelectTrigger className={cn(isGlass && "bg-white/5 border-white/10")}>
              <SelectValue placeholder="Select comparison view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lapTimes">Lap Time Comparison</SelectItem>
              <SelectItem value="positions">Position Change Comparison</SelectItem>
              <SelectItem value="qualifying">Qualifying Comparison</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <TabsContent value="lapTimes" className="space-y-4 mt-4">
          <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={cn("p-0", isGlass && "border-white/10")}>
            <F1CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <F1CardTitle className="text-base">Lap Time Comparison</F1CardTitle>
                <DataSourceBadge source="ergast" />
              </div>
              <F1CardDescription className="text-xs">
                Compare lap times between two different seasons
              </F1CardDescription>
            </F1CardHeader>
            <F1CardContent className="min-h-[500px]">
              <MuiYearComparisonLapChart 
                baseYear={baseYear}
                baseRound={selectedRaceBase}
                comparisonYear={comparisonYear}
                comparisonRound={selectedRaceComparison}
              />
            </F1CardContent>
          </F1Card>
        </TabsContent>
        
        <TabsContent value="positions" className="space-y-4 mt-4">
          <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={cn("p-0", isGlass && "border-white/10")}>
            <F1CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <F1CardTitle className="text-base">Position Change Comparison</F1CardTitle>
                <DataSourceBadge source="ergast" />
              </div>
              <F1CardDescription className="text-xs">
                Compare how positions changed throughout races
              </F1CardDescription>
            </F1CardHeader>
            <F1CardContent className="min-h-[500px]">
              <MuiYearComparisonPositionChart 
                baseYear={baseYear}
                baseRound={selectedRaceBase}
                comparisonYear={comparisonYear}
                comparisonRound={selectedRaceComparison}
              />
            </F1CardContent>
          </F1Card>
        </TabsContent>
        
        <TabsContent value="qualifying" className="space-y-4 mt-4">
          <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={cn("p-0", isGlass && "border-white/10")}>
            <F1CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <F1CardTitle className="text-base">Qualifying Comparison</F1CardTitle>
                <DataSourceBadge source="ergast" />
              </div>
              <F1CardDescription className="text-xs">
                Compare qualifying times (Q1, Q2, Q3) between seasons
              </F1CardDescription>
            </F1CardHeader>
            <F1CardContent className="min-h-[500px]">
              <MuiYearComparisonQualifyingChart 
                baseYear={baseYear}
                baseRound={selectedRaceBase}
                comparisonYear={comparisonYear}
                comparisonRound={selectedRaceComparison}
              />
            </F1CardContent>
          </F1Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default YearComparisonAnalytics;

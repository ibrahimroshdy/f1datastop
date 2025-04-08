
import { useState } from "react";
import { useRaceSchedule, useRaceResults, useLapTimes } from "@/hooks/useF1Data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ArrowLeftRight, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import YearComparisonLapChart from "./YearComparisonLapChart";
import YearComparisonPositionChart from "./YearComparisonPositionChart";
import DisplayModeToggle from "./DisplayModeToggle";

const YearComparisonAnalytics = () => {
  const [baseYear, setBaseYear] = useState<number>(new Date().getFullYear() - 1);
  const [comparisonYear, setComparisonYear] = useState<number>(new Date().getFullYear());
  const [selectedRaceBase, setSelectedRaceBase] = useState<string>("1");
  const [selectedRaceComparison, setSelectedRaceComparison] = useState<string>("1");
  const [selectedTab, setSelectedTab] = useState<string>("lapTimes");
  const [displayMode, setDisplayMode] = useState<'absolute' | 'gap'>('absolute');
  
  // Fetch race schedules for both years
  const { 
    data: baseRaceSchedule, 
    isLoading: isBaseScheduleLoading 
  } = useRaceSchedule(baseYear);
  
  const { 
    data: comparisonRaceSchedule, 
    isLoading: isComparisonScheduleLoading 
  } = useRaceSchedule(comparisonYear);

  // Handler for display mode toggle
  const handleDisplayModeToggle = () => {
    setDisplayMode(displayMode === 'absolute' ? 'gap' : 'absolute');
  };

  // Handler for year changes
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

  // Handler for race selection
  const handleBaseRaceChange = (value: string) => {
    setSelectedRaceBase(value);
  };

  const handleComparisonRaceChange = (value: string) => {
    setSelectedRaceComparison(value);
  };

  // Remove emoji flags from race names
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

  // Generate year options
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
      <Alert className="bg-amber-50 text-amber-800 border-amber-200">
        <ArrowLeftRight className="h-4 w-4" />
        <AlertDescription>
          Compare lap times and position changes from races in different seasons. 
          Select a base year and a comparison year to see how performance has evolved.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Base Year Selection */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Base Year</CardTitle>
            <CardDescription>Select the reference season and race</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Comparison Year Selection */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Comparison Year</CardTitle>
            <CardDescription>Select the season and race to compare against</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end mb-4">
        <DisplayModeToggle 
          displayMode={displayMode} 
          onToggle={handleDisplayModeToggle} 
        />
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="lapTimes">Lap Time Comparison</TabsTrigger>
          <TabsTrigger value="positions">Position Change Comparison</TabsTrigger>
        </TabsList>
        
        <TabsContent value="lapTimes" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Lap Time Comparison</CardTitle>
              <CardDescription>
                Compare lap times between two different seasons at the same track or different tracks.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[600px]">
              <YearComparisonLapChart 
                baseYear={baseYear}
                baseRound={selectedRaceBase}
                comparisonYear={comparisonYear}
                comparisonRound={selectedRaceComparison}
                displayMode={displayMode}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="positions" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Position Change Comparison</CardTitle>
              <CardDescription>
                Compare how positions changed throughout races in different seasons.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[600px]">
              <YearComparisonPositionChart 
                baseYear={baseYear}
                baseRound={selectedRaceBase}
                comparisonYear={comparisonYear}
                comparisonRound={selectedRaceComparison}
                displayMode={displayMode}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default YearComparisonAnalytics;

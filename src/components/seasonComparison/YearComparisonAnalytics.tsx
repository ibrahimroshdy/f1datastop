import { useState } from "react";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ArrowLeftRight, Loader2, BarChart3, Table2, Clock, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import YearComparisonLapChart from "./YearComparisonLapChart";
import YearComparisonPositionChart from "./YearComparisonPositionChart";
import YearComparisonQualifyingChart from "@/components/seasonComparison/YearComparisonQualifyingChart";
import DisplayModeToggle from "./DisplayModeToggle";

const YearComparisonAnalytics = () => {
  const [baseYear, setBaseYear] = useState<number>(new Date().getFullYear() - 1);
  const [comparisonYear, setComparisonYear] = useState<number>(new Date().getFullYear());
  const [selectedRaceBase, setSelectedRaceBase] = useState<string>("1");
  const [selectedRaceComparison, setSelectedRaceComparison] = useState<string>("1");
  const [selectedTab, setSelectedTab] = useState<string>("lapTimes");
  const [displayMode, setDisplayMode] = useState<'absolute' | 'gap'>('absolute');
  const [sessionType, setSessionType] = useState<'race' | 'qualifying'>('race');
  
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

  const toggleDisplayMode = () => {
    setDisplayMode(prev => prev === 'absolute' ? 'gap' : 'absolute');
  };

  const handleSessionTypeChange = (value: string) => {
    setSessionType(value as 'race' | 'qualifying');
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

  // Check if the selected race name contains "Unknown" which indicates data might not be available
  const getCircuitName = (scheduleData: any, round: string) => {
    if (!scheduleData?.data) return "";
    const race = scheduleData.data.find((r: any) => r.round === round);
    return race?.Circuit?.circuitName || cleanRaceName(race?.raceName || "");
  };

  const baseCircuitName = getCircuitName(baseRaceSchedule, selectedRaceBase);
  const comparisonCircuitName = getCircuitName(comparisonRaceSchedule, selectedRaceComparison);
  const hasUnknownCircuit = baseCircuitName.includes("Unknown") || comparisonCircuitName.includes("Unknown");

  return (
    <div className="space-y-6">
      <Alert className="bg-amber-50 text-amber-800 border-amber-200">
        <ArrowLeftRight className="h-4 w-4" />
        <AlertDescription>
          Compare lap times, position changes, and qualifying data from different seasons. 
          Select a base year and a comparison year to see how performance has evolved.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

      {hasUnknownCircuit && (
        <Alert className="mb-4 bg-yellow-50 text-yellow-800 border-yellow-200">
          <Info className="h-4 w-4" />
          <AlertDescription>
            One or more of your selected races appears to be upcoming. Some data might not be available yet.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap justify-between mb-4 gap-4">
        <div className="w-full md:w-auto">
          <Select value={sessionType} onValueChange={handleSessionTypeChange}>
            <SelectTrigger className="min-w-[180px]">
              <SelectValue placeholder="Session Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="race">Race Data</SelectItem>
              <SelectItem value="qualifying">Qualifying Data</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DisplayModeToggle displayMode={displayMode} onToggle={toggleDisplayMode} />
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="lapTimes">
            <Clock className="h-4 w-4 mr-2" />
            {sessionType === 'race' ? 'Lap Times' : 'Qualifying Times'}
          </TabsTrigger>
          <TabsTrigger value="positions">
            <TrendingUp className="h-4 w-4 mr-2" />
            {sessionType === 'race' ? 'Position Changes' : 'Grid Positions'}
          </TabsTrigger>
          <TabsTrigger value="qualifyingTable">
            <Table2 className="h-4 w-4 mr-2" />
            Qualifying Table
          </TabsTrigger>
          <TabsTrigger value="qualifyingChart">
            <BarChart3 className="h-4 w-4 mr-2" />
            Qualifying Chart
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="lapTimes" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {sessionType === 'race' ? 'Lap Time Comparison' : 'Qualifying Time Comparison'}
              </CardTitle>
              <CardDescription>
                {sessionType === 'race' 
                  ? 'Compare lap times between two different seasons at the same track or different tracks.'
                  : 'Compare qualifying times (Q1, Q2, Q3) between drivers across different seasons.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[600px]">
              {sessionType === 'race' ? (
                <YearComparisonLapChart 
                  baseYear={baseYear}
                  baseRound={selectedRaceBase}
                  comparisonYear={comparisonYear}
                  comparisonRound={selectedRaceComparison}
                  displayMode={displayMode}
                />
              ) : (
                <YearComparisonQualifyingChart 
                  baseYear={baseYear}
                  baseRound={selectedRaceBase}
                  comparisonYear={comparisonYear}
                  comparisonRound={selectedRaceComparison}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="positions" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {sessionType === 'race' ? 'Position Change Comparison' : 'Grid Position Comparison'}
              </CardTitle>
              <CardDescription>
                {sessionType === 'race'
                  ? 'Compare how positions changed throughout races in different seasons.'
                  : 'Compare qualifying grid positions between drivers across different seasons.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[600px]">
              {sessionType === 'race' ? (
                <YearComparisonPositionChart 
                  baseYear={baseYear}
                  baseRound={selectedRaceBase}
                  comparisonYear={comparisonYear}
                  comparisonRound={selectedRaceComparison}
                  displayMode={displayMode}
                />
              ) : (
                <YearComparisonQualifyingChart 
                  baseYear={baseYear}
                  baseRound={selectedRaceBase}
                  comparisonYear={comparisonYear}
                  comparisonRound={selectedRaceComparison}
                  positionView={true}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qualifyingTable" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Qualifying Time Comparison</CardTitle>
              <CardDescription>
                Compare qualifying times (Q1, Q2, Q3) between drivers across different seasons in a detailed table format.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[600px]">
              <YearComparisonQualifyingChart 
                baseYear={baseYear}
                baseRound={selectedRaceBase}
                comparisonYear={comparisonYear}
                comparisonRound={selectedRaceComparison}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qualifyingChart" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Qualifying Chart Comparison</CardTitle>
              <CardDescription>
                Compare qualifying performance between two seasons with interactive bar charts showing Q1, Q2, and Q3 times.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[600px]">
              <YearComparisonQualifyingChart 
                baseYear={baseYear}
                baseRound={selectedRaceBase}
                comparisonYear={comparisonYear}
                comparisonRound={selectedRaceComparison}
                chartView={true}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default YearComparisonAnalytics;

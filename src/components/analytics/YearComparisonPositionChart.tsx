import { useState, useEffect } from "react";
import { LineChart, Line, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { XAxis, YAxis } from "@/utils/rechartsWrapper";
import { useLapTimes, useRaceResults } from "@/hooks/useF1Data";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import DataLoadingProgress from "./DataLoadingProgress";
import { useTheme } from "@/context/ThemeContext";

interface YearComparisonPositionChartProps {
  baseYear: number;
  baseRound: string;
  comparisonYear: number;
  comparisonRound: string;
}

const YearComparisonPositionChart: React.FC<YearComparisonPositionChartProps> = ({
  baseYear,
  baseRound,
  comparisonYear,
  comparisonRound
}) => {
  // Helper function to get line style for drivers from the same team
  const getTeamLineStyle = (driverCode: string, year: number, allSelectedDrivers: { base: any[], comparison: any[] }): { strokeDasharray?: string, dot?: any } => {
    const isBaseYear = year === baseYear;
    const currentYearDrivers = isBaseYear ? allSelectedDrivers.base : allSelectedDrivers.comparison;
    const currentDriver = currentYearDrivers.find(d => d.code === driverCode);
    
    if (!currentDriver) return { strokeDasharray: undefined, dot: { r: 3 } };
    
    // Find all drivers from the same team in the current year that are selected
    const sameTeamDrivers = currentYearDrivers.filter(d => d.team === currentDriver.team);
    
    // If only one driver from this team in this year, check if same driver exists in other year
    if (sameTeamDrivers.length <= 1) {
      const otherYearDrivers = isBaseYear ? allSelectedDrivers.comparison : allSelectedDrivers.base;
      const sameDriverOtherYear = otherYearDrivers.find(d => d.code === driverCode);
      
      // If same driver in both years, use different patterns for different years
      if (sameDriverOtherYear) {
        return isBaseYear 
          ? { strokeDasharray: undefined, dot: { r: 4 } } // Solid line, larger dots for base year
          : { strokeDasharray: "5 5", dot: { r: 3, fill: "transparent", strokeWidth: 2 } }; // Dashed line, hollow dots for comparison year
      }
      return { strokeDasharray: undefined, dot: { r: 3 } }; // Solid line if no conflicts
    }
    
    // Multiple drivers from same team in same year - use different patterns
    const sortedSameTeamDrivers = sameTeamDrivers.sort((a, b) => a.code.localeCompare(b.code));
    const driverIndex = sortedSameTeamDrivers.findIndex(d => d.code === driverCode);
    
    const lineStyles = [
      { strokeDasharray: undefined, dot: { r: 3 } },                    // Solid line with circles
      { strokeDasharray: "5 5", dot: { r: 3, fill: "transparent", strokeWidth: 2 } }, // Dashed line with hollow circles
      { strokeDasharray: "10 5 5 5", dot: { r: 4, symbol: "square" } }, // Dash-dot line with squares
      { strokeDasharray: "15 5 5 5 5 5", dot: { r: 3, symbol: "triangle" } }, // Dash-dot-dot with triangles
    ];
    
    return lineStyles[driverIndex] || { strokeDasharray: "3 3", dot: { r: 2 } };
  };

  // Helper function to generate visual line pattern for tooltips
  const getVisualLinePattern = (strokeDasharray?: string) => {
    if (strokeDasharray === "5 5") {
      return '− − − −'; // Dashed
    } else if (strokeDasharray === "10 5 5 5") {
      return '−· −· −·'; // Dash-dot
    } else if (strokeDasharray === "15 5 5 5 5 5") {
      return '−·· −·· −··'; // Dash-dot-dot
    } else if (strokeDasharray === "3 3") {
      return '· · · ·'; // Dotted
    } else {
      return '————'; // Solid
    }
  };

  // Helper function to generate visual dot pattern
  const getVisualDotPattern = (dot?: any) => {
    if (dot?.fill === "transparent") {
      return '○'; // Hollow circle
    } else if (dot?.r === 4) {
      return '●+'; // Larger circle
    } else {
      return '●'; // Regular circle
    }
  };

  const [baseDrivers, setBaseDrivers] = useState<any[]>([]);
  const [comparisonDrivers, setComparisonDrivers] = useState<any[]>([]);
  const [selectedBaseDrivers, setSelectedBaseDrivers] = useState<string[]>([]);
  const [selectedComparisonDrivers, setSelectedComparisonDrivers] = useState<string[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isProcessingData, setIsProcessingData] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { theme } = useTheme();
  
  // Fetch results and lap times for base year
  const { 
    data: baseResults,
    isLoading: isBaseResultsLoading,
    error: baseResultsError
  } = useRaceResults(baseYear, baseRound);
  
  const {
    data: baseLapTimes,
    isLoading: isBaseLapTimesLoading,
    error: baseLapTimesError,
    isError: isBaseLapTimesError,
    failureCount: baseLapTimesFailureCount
  } = useLapTimes(baseYear, baseRound);
  
  // Fetch results and lap times for comparison year
  const { 
    data: comparisonResults,
    isLoading: isComparisonResultsLoading,
    error: comparisonResultsError
  } = useRaceResults(comparisonYear, comparisonRound);
  
  const {
    data: comparisonLapTimes,
    isLoading: isComparisonLapTimesLoading,
    error: comparisonLapTimesError,
    isError: isComparisonLapTimesError,
    failureCount: comparisonLapTimesFailureCount
  } = useLapTimes(comparisonYear, comparisonRound);
  
  const isLoading = 
    isBaseResultsLoading || 
    isBaseLapTimesLoading || 
    isComparisonResultsLoading || 
    isComparisonLapTimesLoading ||
    isProcessingData;

  const isError = isBaseLapTimesError || isComparisonLapTimesError;
  const totalFailureCount = baseLapTimesFailureCount + comparisonLapTimesFailureCount;
  
  // Update retryCount when failureCount changes
  useEffect(() => {
    if (totalFailureCount > retryCount) {
      setRetryCount(totalFailureCount);
    }
  }, [totalFailureCount, retryCount]);

  // Update loading progress
  useEffect(() => {
    if (isLoading) {
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          // If we already have some data but are still loading, start from a higher base %
          const baseProgress = (chartData.length > 0) ? 50 : 0;
          const newProgress = Math.min(baseProgress + Math.random() * 5 + prev/10, 95);
          return newProgress;
        });
      }, 500);
      
      return () => clearInterval(progressInterval);
    } else {
      setLoadingProgress(100);
    }
  }, [isLoading, chartData.length]);

  // Set error message when errors occur
  useEffect(() => {
    if (baseLapTimesError || comparisonLapTimesError) {
      const errorMsg = (baseLapTimesError || comparisonLapTimesError)?.toString();
      if (errorMsg?.includes('429')) {
        setErrorMessage(`Rate limit exceeded. System will retry automatically (attempt ${retryCount}/15)`);
      } else {
        setErrorMessage(errorMsg || "Error loading position data");
      }
    } else {
      setErrorMessage(null);
    }
  }, [baseLapTimesError, comparisonLapTimesError, retryCount]);

  // Process base year results to get drivers
  useEffect(() => {
    if (baseResults?.data?.Results) {
      const drivers = baseResults.data.Results.map((result: any) => ({
        driverId: result.Driver.driverId,
        code: result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase(),
        name: `${result.Driver.givenName} ${result.Driver.familyName}`,
        team: result.Constructor?.constructorId || "unknown",
        finishPosition: parseInt(result.position) || 0,
        year: baseYear
      }));
      
      setBaseDrivers(drivers);
      
      // Auto-select winner by default
      if (drivers.length > 0) {
        const winner = drivers.find(d => d.finishPosition === 1);
        if (winner) {
          setSelectedBaseDrivers([winner.code]);
        } else if (drivers[0]) {
          setSelectedBaseDrivers([drivers[0].code]);
        }
      }
    }
  }, [baseResults, baseYear]);

  // Process comparison year results to get drivers
  useEffect(() => {
    if (comparisonResults?.data?.Results) {
      const drivers = comparisonResults.data.Results.map((result: any) => ({
        driverId: result.Driver.driverId,
        code: result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase(),
        name: `${result.Driver.givenName} ${result.Driver.familyName}`,
        team: result.Constructor?.constructorId || "unknown",
        finishPosition: parseInt(result.position) || 0,
        year: comparisonYear
      }));
      
      setComparisonDrivers(drivers);
      
      // Auto-select winner by default
      if (drivers.length > 0) {
        const winner = drivers.find(d => d.finishPosition === 1);
        if (winner) {
          setSelectedComparisonDrivers([winner.code]);
        } else if (drivers[0]) {
          setSelectedComparisonDrivers([drivers[0].code]);
        }
      }
    }
  }, [comparisonResults, comparisonYear]);

  // Process position data for both years
  useEffect(() => {
    if (baseLapTimes?.data?.Races && comparisonLapTimes?.data?.Races && 
        baseDrivers.length > 0 && comparisonDrivers.length > 0) {
      setIsProcessingData(true);
      
      try {
        const baseRace = baseLapTimes.data.Races[0];
        const compRace = comparisonLapTimes.data.Races[0];
        
        if (!baseRace?.Laps || !compRace?.Laps) {
          setChartData([]);
          setIsProcessingData(false);
          return;
        }
        
        // Find max number of laps between both races
        // Fix: Use the actual highest lap number, not the array length
        const maxBaseLaps = baseRace.Laps.length > 0 
          ? Math.max(...baseRace.Laps.map((lap: any) => parseInt(lap.number) || 0))
          : 0;
        const maxCompLaps = compRace.Laps.length > 0 
          ? Math.max(...compRace.Laps.map((lap: any) => parseInt(lap.number) || 0))
          : 0;
        const maxLaps = Math.max(maxBaseLaps, maxCompLaps);
        
        // Process position data
        const processedData = [];
        
        for (let lapNumber = 1; lapNumber <= maxLaps; lapNumber++) {
          const lapData: any = { lap: lapNumber };
          
          // Process base year position data
          const baseLap = baseRace.Laps.find((lap: any) => parseInt(lap.number) === lapNumber);
          if (baseLap) {
            baseLap.Timings.forEach((timing: any) => {
              const driver = baseDrivers.find(d => d.driverId === timing.driverId);
              if (driver) {
                const position = parseInt(timing.position);
                lapData[`${driver.code}_${baseYear}`] = position;
              }
            });
          }
          
          // Process comparison year position data
          const compLap = compRace.Laps.find((lap: any) => parseInt(lap.number) === lapNumber);
          if (compLap) {
            compLap.Timings.forEach((timing: any) => {
              const driver = comparisonDrivers.find(d => d.driverId === timing.driverId);
              if (driver) {
                const position = parseInt(timing.position);
                lapData[`${driver.code}_${comparisonYear}`] = position;
              }
            });
          }
          
          processedData.push(lapData);
        }
        
        // Check if we have partial data from either year
        if ((baseRace.isPartialData || baseRace.incomplete) && 
            (compRace.isPartialData || compRace.incomplete)) {
          toast.warning("Partial position data loaded for both years", {
            description: "API rate limits prevented loading all laps. Some data may be missing.",
            id: "partial-pos-data-warning",
            duration: 5000,
          });
        } else if (baseRace.isPartialData || baseRace.incomplete) {
          toast.warning(`Partial position data loaded for ${baseYear}`, {
            description: "API rate limits prevented loading all laps. Some data may be missing.",
            id: "partial-base-pos-warning",
            duration: 5000,
          });
        } else if (compRace.isPartialData || compRace.incomplete) {
          toast.warning(`Partial position data loaded for ${comparisonYear}`, {
            description: "API rate limits prevented loading all laps. Some data may be missing.",
            id: "partial-comp-pos-warning",
            duration: 5000,
          });
        }
        
        setChartData(processedData);
      } catch (error) {
        console.error("Error processing position data:", error);
        toast.error("Error processing position data");
      } finally {
        setIsProcessingData(false);
      }
    }
  }, [baseLapTimes, comparisonLapTimes, baseDrivers, comparisonDrivers, baseYear, comparisonYear]);

  const toggleBaseDriver = (driverCode: string) => {
    setSelectedBaseDrivers(prev => 
      prev.includes(driverCode)
        ? prev.filter(d => d !== driverCode)
        : [...prev, driverCode]
    );
  };

  const toggleComparisonDriver = (driverCode: string) => {
    setSelectedComparisonDrivers(prev => 
      prev.includes(driverCode)
        ? prev.filter(d => d !== driverCode)
        : [...prev, driverCode]
    );
  };

  const getRaceCircuitName = (results: any) => {
    if (!results?.data?.Circuit) return "Unknown Circuit";
    return results.data.Circuit.circuitName || results.data.raceName || "Unknown Circuit";
  };

  const baseCircuit = getRaceCircuitName(baseResults);
  const comparisonCircuit = getRaceCircuitName(comparisonResults);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <DataLoadingProgress 
          isLoading={true}
          progress={loadingProgress}
          message={errorMessage}
          isError={isError}
          retryCount={retryCount}
          maxRetries={15}
        />
        <div className="pt-6 text-center">
          <p className="text-muted-foreground">
            {loadingProgress < 50 ? "Loading position data..." : "Processing comparison data..."}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            The F1 API has rate limits. Automatic retries are in progress if needed.
          </p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <AlertCircle className="h-8 w-8 mb-4" />
        <p className="font-medium mb-1">No position data available</p>
        <p className="text-sm text-muted-foreground">Try selecting different races or seasons.</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <Badge variant="outline" className="border-amber-500 py-1">
            {baseYear} - {baseCircuit}
          </Badge>
          <span className="hidden md:inline">vs</span>
          <Badge variant="outline" className="border-blue-500 py-1">
            {comparisonYear} - {comparisonCircuit}
          </Badge>
        </div>
      </div>
      
      {/* Show partial data warning if applicable */}
      {(baseLapTimes?.data?.Races?.[0]?.isPartialData || 
        baseLapTimes?.data?.Races?.[0]?.incomplete ||
        comparisonLapTimes?.data?.Races?.[0]?.isPartialData ||
        comparisonLapTimes?.data?.Races?.[0]?.incomplete) && (
        <DataLoadingProgress
          isLoading={false}
          message="Some position data couldn't be loaded due to API rate limits. Charts may show gaps or inconsistencies."
          isError={false}
        />
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="min-w-0">
          <h4 className="text-xs sm:text-sm font-semibold mb-1 sm:mb-2 text-amber-600">{baseYear} Drivers</h4>
          <div className="flex flex-wrap gap-1 sm:gap-2 max-h-20 sm:max-h-none overflow-y-auto">
            {baseDrivers.map(driver => (
              <button
                key={`base-${driver.code}`}
                onClick={() => toggleBaseDriver(driver.code)}
                className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                  selectedBaseDrivers.includes(driver.code)
                    ? 'bg-amber-700 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
                style={{
                  borderLeft: `2px solid ${TEAM_COLORS[driver.team] || '#666'}`
                }}
              >
                {driver.code}
              </button>
            ))}
          </div>
        </div>
        
        <div className="min-w-0">
          <h4 className="text-xs sm:text-sm font-semibold mb-1 sm:mb-2 text-blue-600">{comparisonYear} Drivers</h4>
          <div className="flex flex-wrap gap-1 sm:gap-2 max-h-20 sm:max-h-none overflow-y-auto">
            {comparisonDrivers.map(driver => (
              <button
                key={`comp-${driver.code}`}
                onClick={() => toggleComparisonDriver(driver.code)}
                className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                  selectedComparisonDrivers.includes(driver.code)
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
                style={{
                  borderLeft: `2px solid ${TEAM_COLORS[driver.team] || '#666'}`
                }}
              >
                {driver.code}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="h-[350px] sm:h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ 
              top: window.innerWidth < 640 ? 15 : 20, 
              right: window.innerWidth < 640 ? 15 : 30, 
              left: window.innerWidth < 640 ? 15 : 20, 
              bottom: 5 
            }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis 
              dataKey="lap" 
              label={{ 
                value: 'Lap Number', 
                position: 'insideBottomRight', 
                offset: -10,
                style: { fontSize: window.innerWidth < 640 ? '11px' : '12px' }
              }} 
              tick={{ fontSize: window.innerWidth < 640 ? 10 : 12 }}
              xAxisId="primary"
            />
            <YAxis 
              reversed 
              domain={[1, 20]} 
              label={{ 
                value: 'Position', 
                angle: -90, 
                position: 'insideLeft',
                style: { fontSize: window.innerWidth < 640 ? '11px' : '12px' }
              }} 
              tick={{ fontSize: window.innerWidth < 640 ? 10 : 12 }}
              ticks={[1, 5, 10, 15, 20]}
              yAxisId="primary"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff',
                borderColor: theme === 'dark' ? '#333' : '#e2e8f0',
                color: theme === 'dark' ? '#ffffff' : '#1a202c',
                borderRadius: '5px',
                fontSize: window.innerWidth < 640 ? '11px' : '12px',
                padding: window.innerWidth < 640 ? '6px' : '8px'
              }}
              formatter={(value, name) => {
                // Add line style info to the tooltip
                const driverKey = String(name);
                const [code, year] = driverKey.split('_');
                const isBaseYear = year === baseYear.toString();
                const allSelectedDrivers = {
                  base: baseDrivers.filter(d => selectedBaseDrivers.includes(d.code)),
                  comparison: comparisonDrivers.filter(d => selectedComparisonDrivers.includes(d.code))
                };
                const lineStyle = getTeamLineStyle(code, parseInt(year), allSelectedDrivers);
                const linePattern = getVisualLinePattern(lineStyle.strokeDasharray);
                const dotPattern = getVisualDotPattern(lineStyle.dot);
                
                return [`P${value}`, `${name} ${linePattern} ${dotPattern}`];
              }}
              labelFormatter={(label) => `Lap ${label}`}
            />
            <Legend 
              formatter={(value) => {
                const [code, year] = value.split('_');
                const isBaseYear = year === baseYear.toString();
                let driver, allSelectedDrivers;
                
                if (isBaseYear) {
                  driver = baseDrivers.find(d => d.code === code);
                  allSelectedDrivers = {
                    base: baseDrivers.filter(d => selectedBaseDrivers.includes(d.code)),
                    comparison: comparisonDrivers.filter(d => selectedComparisonDrivers.includes(d.code))
                  };
                } else {
                  driver = comparisonDrivers.find(d => d.code === code);
                  allSelectedDrivers = {
                    base: baseDrivers.filter(d => selectedBaseDrivers.includes(d.code)),
                    comparison: comparisonDrivers.filter(d => selectedComparisonDrivers.includes(d.code))
                  };
                }
                
                if (!driver) return code;
                
                const lineStyle = getTeamLineStyle(code, parseInt(year), allSelectedDrivers);
                
                // For mobile, use shorter format
                if (window.innerWidth < 640) {
                  let styleIndicator = '';
                  if (lineStyle.strokeDasharray === "5 5") {
                    styleIndicator = '---'; // Dashed
                  } else if (lineStyle.strokeDasharray === "10 5 5 5") {
                    styleIndicator = '-·-'; // Dash-dot
                  } else if (lineStyle.strokeDasharray === "15 5 5 5 5 5") {
                    styleIndicator = '-··-'; // Dash-dot-dot
                  } else if (lineStyle.strokeDasharray === "3 3") {
                    styleIndicator = '···'; // Dotted
                  } else {
                    styleIndicator = '—'; // Solid
                  }
                  
                  let dotIndicator = '';
                  if (lineStyle.dot?.fill === "transparent") {
                    dotIndicator = '○'; // Hollow circle
                  } else if (lineStyle.dot?.r === 4) {
                    dotIndicator = '●+'; // Larger circle
                  } else {
                    dotIndicator = '●'; // Regular circle
                  }
                  
                  return `${code} ${styleIndicator}${dotIndicator} (${year})`;
                }
                
                // Desktop format - full
                let styleIndicator = '';
                if (lineStyle.strokeDasharray === "5 5") {
                  styleIndicator = ' (---)'; // Dashed
                } else if (lineStyle.strokeDasharray === "10 5 5 5") {
                  styleIndicator = ' (-·-)'; // Dash-dot
                } else if (lineStyle.strokeDasharray === "15 5 5 5 5 5") {
                  styleIndicator = ' (-··-)'; // Dash-dot-dot
                } else if (lineStyle.strokeDasharray === "3 3") {
                  styleIndicator = ' (···)'; // Dotted
                } else {
                  styleIndicator = ' (—)'; // Solid
                }
                
                let dotIndicator = '';
                if (lineStyle.dot?.fill === "transparent") {
                  dotIndicator = ' ○'; // Hollow circle
                } else if (lineStyle.dot?.r === 4) {
                  dotIndicator = ' ●+'; // Larger filled circle
                } else {
                  dotIndicator = ' ●'; // Regular filled circle
                }
                
                return `${code}${styleIndicator}${dotIndicator} (${year})`;
              }}
              wrapperStyle={{ 
                opacity: 1,
                padding: window.innerWidth < 640 ? '3px' : '10px',
                backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                borderRadius: '5px',
                fontSize: window.innerWidth < 640 ? '9px' : '12px',
                maxHeight: window.innerWidth < 640 ? '80px' : 'auto',
                overflowX: window.innerWidth < 640 ? 'auto' : 'visible',
                overflowY: window.innerWidth < 640 ? 'hidden' : 'visible',
                whiteSpace: window.innerWidth < 640 ? 'nowrap' : 'normal'
              }}
            />
            
            {/* Base year lines */}
                          {baseDrivers
                .filter(driver => selectedBaseDrivers.includes(driver.code))
                .map(driver => {
                  const selectedDriversData = {
                    base: baseDrivers.filter(d => selectedBaseDrivers.includes(d.code)),
                    comparison: comparisonDrivers.filter(d => selectedComparisonDrivers.includes(d.code))
                  };
                  const lineStyle = getTeamLineStyle(driver.code, baseYear, selectedDriversData);
                  
                  return (
                    <Line
                      key={`base-line-${driver.code}`}
                      type="monotone"
                      dataKey={`${driver.code}_${baseYear}`}
                      name={`${driver.code}_${baseYear}`}
                      stroke={`#f59e0b`} // Amber color for base year
                      strokeWidth={driver.finishPosition === 1 ? 3 : 2}
                      strokeDasharray={lineStyle.strokeDasharray}
                  dot={(props) => {
                    // Skip rendering if cx or cy are not valid numbers or if value doesn't exist
                    if (!props.cx || !props.cy || isNaN(props.cx) || isNaN(props.cy) || 
                        !props.payload[`${driver.code}_${baseYear}`]) {
                      return null;
                    }
                    return (
                      <circle
                        key={`dot-${driver.code}-${baseYear}-${props.index}`}
                        cx={props.cx}
                        cy={props.cy}
                        r={lineStyle.dot.r || 3}
                        fill={lineStyle.dot.fill === "transparent" ? "transparent" : '#f59e0b'}
                        stroke={lineStyle.dot.fill === "transparent" ? "#f59e0b" : "transparent"}
                        strokeWidth={lineStyle.dot.strokeWidth || 0}
                        opacity={0.8}
                      />
                    );
                  }}
                  activeDot={{ r: 6 }}
                  connectNulls={true}
                  xAxisId="primary"
                  yAxisId="primary"
                />
              );
            })}
            
            {/* Comparison year lines */}
            {comparisonDrivers
              .filter(driver => selectedComparisonDrivers.includes(driver.code))
              .map(driver => {
                const selectedDriversData = {
                  base: baseDrivers.filter(d => selectedBaseDrivers.includes(d.code)),
                  comparison: comparisonDrivers.filter(d => selectedComparisonDrivers.includes(d.code))
                };
                const lineStyle = getTeamLineStyle(driver.code, comparisonYear, selectedDriversData);
                
                return (
                  <Line
                    key={`comp-line-${driver.code}`}
                    type="monotone"
                    dataKey={`${driver.code}_${comparisonYear}`}
                    name={`${driver.code}_${comparisonYear}`}
                    stroke={`#3b82f6`} // Blue color for comparison year
                    strokeWidth={driver.finishPosition === 1 ? 3 : 2}
                    strokeDasharray={lineStyle.strokeDasharray}
                  dot={(props) => {
                    // Skip rendering if cx or cy are not valid numbers or if value doesn't exist
                    if (!props.cx || !props.cy || isNaN(props.cx) || isNaN(props.cy) || 
                        !props.payload[`${driver.code}_${comparisonYear}`]) {
                      return null;
                    }
                    return (
                      <circle
                        key={`dot-${driver.code}-${comparisonYear}-${props.index}`}
                        cx={props.cx}
                        cy={props.cy}
                        r={lineStyle.dot.r || 3}
                        fill={lineStyle.dot.fill === "transparent" ? "transparent" : '#3b82f6'}
                        stroke={lineStyle.dot.fill === "transparent" ? "#3b82f6" : "transparent"}
                        strokeWidth={lineStyle.dot.strokeWidth || 0}
                        opacity={0.8}
                      />
                    );
                  }}
                  activeDot={{ r: 6 }}
                  connectNulls={true}
                  xAxisId="primary"
                  yAxisId="primary"
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default YearComparisonPositionChart;

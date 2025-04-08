import { useState, useEffect } from "react";
import { LineChart, Line, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { XAxis, YAxis, ReferenceLine } from "@/utils/rechartsWrapper";
import { useLapTimes, useRaceResults } from "@/hooks/useF1Data";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { convertLapTimeToSeconds, formatTime } from "@/utils/lapTimeUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import DataLoadingProgress from "./DataLoadingProgress";

interface YearComparisonLapChartProps {
  baseYear: number;
  baseRound: string;
  comparisonYear: number;
  comparisonRound: string;
}

const YearComparisonLapChart: React.FC<YearComparisonLapChartProps> = ({
  baseYear,
  baseRound,
  comparisonYear,
  comparisonRound
}) => {
  const [baseDrivers, setBaseDrivers] = useState<any[]>([]);
  const [comparisonDrivers, setComparisonDrivers] = useState<any[]>([]);
  const [selectedBaseDrivers, setSelectedBaseDrivers] = useState<string[]>([]);
  const [selectedComparisonDrivers, setSelectedComparisonDrivers] = useState<string[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isProcessingData, setIsProcessingData] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [outlierLaps, setOutlierLaps] = useState<{[key: string]: number[]}>({});
  
  // Fetch results and lap times for base year
  const { 
    data: baseResults,
    isLoading: isBaseResultsLoading,
    error: baseResultsError,
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
        setErrorMessage(errorMsg || "Error loading lap time data");
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

  // Process lap time data for both years
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
        const maxBaseLaps = baseRace.Laps.length;
        const maxCompLaps = compRace.Laps.length;
        const maxLaps = Math.max(maxBaseLaps, maxCompLaps);
        
        // Process lap time data
        const processedData = [];
        const tempOutliers: {[key: string]: number[]} = {};
        
        for (let i = 0; i < maxLaps; i++) {
          const lapData: any = { lap: i + 1 };
          
          // Process base year lap data
          if (i < maxBaseLaps) {
            const lap = baseRace.Laps[i];
            lap.Timings.forEach((timing: any) => {
              const driver = baseDrivers.find(d => d.driverId === timing.driverId);
              if (driver) {
                const lapTime = convertLapTimeToSeconds(timing.time);
                lapData[`${driver.code}_${baseYear}`] = lapTime;
                lapData[`${driver.code}_${baseYear}_raw`] = timing.time;
              }
            });
          }
          
          // Process comparison year lap data
          if (i < maxCompLaps) {
            const lap = compRace.Laps[i];
            lap.Timings.forEach((timing: any) => {
              const driver = comparisonDrivers.find(d => d.driverId === timing.driverId);
              if (driver) {
                const lapTime = convertLapTimeToSeconds(timing.time);
                lapData[`${driver.code}_${comparisonYear}`] = lapTime;
                lapData[`${driver.code}_${comparisonYear}_raw`] = timing.time;
              }
            });
          }
          
          processedData.push(lapData);
        }
        
        // Detect lap time outliers for each driver
        const detectOutliers = (driverKey: string, data: any[]) => {
          const lapTimes = data
            .map(lap => lap[driverKey])
            .filter(time => typeof time === 'number');
          
          if (lapTimes.length < 5) return []; // Not enough data
          
          // Calculate mean and standard deviation
          const mean = lapTimes.reduce((sum, val) => sum + val, 0) / lapTimes.length;
          const stdDev = Math.sqrt(
            lapTimes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / lapTimes.length
          );
          
          // Identify potential pit stop laps (significantly slower than average)
          const pitStopThreshold = 3.0; // Higher threshold for pit stops
          const potentialPitStops: number[] = [];
          
          // Find outliers (laps that are significantly faster or slower)
          const threshold = 2.5; // Increased threshold to reduce false positives
          const outlierLaps: number[] = [];
          
          lapTimes.forEach((time, idx) => {
            const zScore = (time - mean) / stdDev;
            
            // If much slower than average, likely a pit stop, not a regular outlier
            if (zScore > pitStopThreshold) {
              potentialPitStops.push(idx + 1);
            } 
            // Only mark as outlier if not a potential pit stop
            else if (Math.abs(zScore) > threshold) {
              outlierLaps.push(idx + 1);
            }
          });
          
          return outlierLaps;
        };
        
        // Process outliers for selected drivers
        baseDrivers
          .filter(driver => selectedBaseDrivers.includes(driver.code))
          .forEach(driver => {
            const driverKey = `${driver.code}_${baseYear}`;
            tempOutliers[driverKey] = detectOutliers(driverKey, processedData);
          });
        
        comparisonDrivers
          .filter(driver => selectedComparisonDrivers.includes(driver.code))
          .forEach(driver => {
            const driverKey = `${driver.code}_${comparisonYear}`;
            tempOutliers[driverKey] = detectOutliers(driverKey, processedData);
          });
        
        setOutlierLaps(tempOutliers);
        setChartData(processedData);
        
        // Check if we have partial data from either year
        if ((baseRace.isPartialData || baseRace.incomplete) && 
            (compRace.isPartialData || compRace.incomplete)) {
          toast.warning("Partial lap data loaded for both years", {
            description: "API rate limits prevented loading all laps. Some data may be missing.",
            id: "partial-data-warning",
            duration: 5000,
          });
        } else if (baseRace.isPartialData || baseRace.incomplete) {
          toast.warning(`Partial lap data loaded for ${baseYear}`, {
            description: "API rate limits prevented loading all laps. Some data may be missing.",
            id: "partial-base-data-warning",
            duration: 5000,
          });
        } else if (compRace.isPartialData || compRace.incomplete) {
          toast.warning(`Partial lap data loaded for ${comparisonYear}`, {
            description: "API rate limits prevented loading all laps. Some data may be missing.",
            id: "partial-comp-data-warning",
            duration: 5000,
          });
        }
      } catch (error) {
        console.error("Error processing lap time data:", error);
        toast.error("Error processing lap time data");
      } finally {
        setIsProcessingData(false);
      }
    }
  }, [baseLapTimes, comparisonLapTimes, baseDrivers, comparisonDrivers, baseYear, comparisonYear, selectedBaseDrivers, selectedComparisonDrivers]);
  
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
            {loadingProgress < 50 ? "Loading lap time data..." : "Processing comparison data..."}
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
        <p className="font-medium mb-1">No lap time data available</p>
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
          message="Some lap data couldn't be loaded due to API rate limits. Charts may show gaps or inconsistencies."
          isError={false}
        />
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <h4 className="text-sm font-semibold mb-2 text-amber-600">{baseYear} Drivers</h4>
          <div className="flex flex-wrap gap-2">
            {baseDrivers.map(driver => (
              <button
                key={`base-${driver.code}`}
                onClick={() => toggleBaseDriver(driver.code)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  selectedBaseDrivers.includes(driver.code)
                    ? 'bg-amber-700 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
                style={{
                  borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666'}`
                }}
              >
                {driver.code}
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-sm font-semibold mb-2 text-blue-600">{comparisonYear} Drivers</h4>
          <div className="flex flex-wrap gap-2">
            {comparisonDrivers.map(driver => (
              <button
                key={`comp-${driver.code}`}
                onClick={() => toggleComparisonDriver(driver.code)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  selectedComparisonDrivers.includes(driver.code)
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
                style={{
                  borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666'}`
                }}
              >
                {driver.code}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis 
              dataKey="lap" 
              label={{ value: 'Lap Number', position: 'insideBottomRight', offset: -10 }} 
              xAxisId="primary" 
            />
            <YAxis 
              label={{ 
                value: 'Lap Time (seconds)', 
                angle: -90, 
                position: 'insideLeft' 
              }}
              yAxisId="primary"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1a1a1a',
                borderColor: '#333',
                borderRadius: '5px'
              }}
              formatter={(value: any, name: string) => {
                if (typeof value === 'number') {
                  const driverKey = name;
                  const lapNumber = Number(chartData.find(d => d[driverKey] === value)?.lap);
                  const isOutlier = outlierLaps[driverKey]?.includes(lapNumber);
                  
                  // Check for abnormally slow lap (potential pit stop)
                  const driverLapTimes = chartData
                    .map(lap => lap[driverKey])
                    .filter(time => typeof time === 'number');
                  
                  const avg = driverLapTimes.reduce((sum, val) => sum + val, 0) / driverLapTimes.length;
                  const isPotentialPitStop = value > (avg * 1.2); // 20% slower than average
                  
                  const labelText = isOutlier 
                    ? ' ⚠️ Outlier' 
                    : (isPotentialPitStop ? ' 🔄 Possible Pit Stop' : '');
                  
                  return [`${formatTime(value)}${labelText}`, name];
                }
                return value;
              }}
              labelFormatter={(label) => `Lap ${label}`}
            />
            <Legend 
              formatter={(value) => {
                const [code, year] = value.split('_');
                if (year === baseYear.toString()) {
                  const driver = baseDrivers.find(d => d.code === code);
                  return driver ? `${code} (${year})` : code;
                } else {
                  const driver = comparisonDrivers.find(d => d.code === code);
                  return driver ? `${code} (${year})` : code;
                }
              }}
              wrapperStyle={{ 
                opacity: 1,
                padding: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '5px'
              }}
            />
            
            {/* Base year lines */}
            {baseDrivers
              .filter(driver => selectedBaseDrivers.includes(driver.code))
              .map(driver => (
                <Line
                  key={`base-line-${driver.code}`}
                  type="monotone"
                  dataKey={`${driver.code}_${baseYear}`}
                  name={`${driver.code}_${baseYear}`}
                  stroke={`#f59e0b`} // Amber color for base year
                  strokeWidth={driver.finishPosition === 1 ? 3 : 2}
                  dot={(props) => {
                    // Skip rendering if cx or cy are not valid numbers
                    if (!props.cx || !props.cy || isNaN(props.cx) || isNaN(props.cy)) {
                      return null;
                    }
                    
                    const isOutlier = outlierLaps[`${driver.code}_${baseYear}`]?.includes(props.payload.lap);
                    // Only show custom dot if the value exists
                    if (!props.payload[`${driver.code}_${baseYear}`]) {
                      return null;
                    }
                    
                    return (
                      <circle
                        key={`dot-${driver.code}-${baseYear}-${props.payload.lap}`}
                        cx={props.cx}
                        cy={props.cy}
                        r={isOutlier ? 4 : 2}
                        fill={isOutlier ? '#f97316' : '#f59e0b'}
                        stroke={isOutlier ? '#ffffff' : 'none'}
                        strokeWidth={isOutlier ? 1 : 0}
                        opacity={isOutlier ? 1 : 0.8}
                      />
                    );
                  }}
                  activeDot={{ r: 6 }}
                  connectNulls={true}
                  xAxisId="primary"
                  yAxisId="primary"
                />
              ))}
            
            {/* Comparison year lines */}
            {comparisonDrivers
              .filter(driver => selectedComparisonDrivers.includes(driver.code))
              .map(driver => (
                <Line
                  key={`comp-line-${driver.code}`}
                  type="monotone"
                  dataKey={`${driver.code}_${comparisonYear}`}
                  name={`${driver.code}_${comparisonYear}`}
                  stroke={`#3b82f6`} // Blue color for comparison year
                  strokeWidth={driver.finishPosition === 1 ? 3 : 2}
                  dot={(props) => {
                    // Skip rendering if cx or cy are not valid numbers
                    if (!props.cx || !props.cy || isNaN(props.cx) || isNaN(props.cy)) {
                      return null;
                    }
                    
                    const isOutlier = outlierLaps[`${driver.code}_${comparisonYear}`]?.includes(props.payload.lap);
                    // Only show custom dot if the value exists
                    if (!props.payload[`${driver.code}_${comparisonYear}`]) {
                      return null;
                    }
                    
                    return (
                      <circle
                        key={`dot-${driver.code}-${comparisonYear}-${props.payload.lap}`}
                        cx={props.cx}
                        cy={props.cy}
                        r={isOutlier ? 4 : 2}
                        fill={isOutlier ? '#2563eb' : '#3b82f6'}
                        stroke={isOutlier ? '#ffffff' : 'none'}
                        strokeWidth={isOutlier ? 1 : 0}
                        opacity={isOutlier ? 1 : 0.8}
                      />
                    );
                  }}
                  activeDot={{ r: 6 }}
                  connectNulls={true}
                  xAxisId="primary"
                  yAxisId="primary"
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default YearComparisonLapChart;

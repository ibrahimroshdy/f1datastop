import { useState, useEffect } from "react";
import { LineChart, Line, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { XAxis, YAxis, ReferenceLine } from "@/utils/rechartsWrapper";
import { useRaceQualifying, useRaceResults } from "@/hooks/useF1Data";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import DataLoadingProgress from "./DataLoadingProgress";
import { QualifyingSession } from "@/hooks/useQualifyingData";

interface YearComparisonQualifyingChartProps {
  baseYear: number;
  baseRound: string;
  comparisonYear: number;
  comparisonRound: string;
}

const YearComparisonQualifyingChart: React.FC<YearComparisonQualifyingChartProps> = ({
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
  const [activeSessions, setActiveSessions] = useState<QualifyingSession[]>(['all']);
  const [fastestLapTime, setFastestLapTime] = useState<{ time: number, driver: string, session: string, year: number } | null>(null);
  const [isProcessingData, setIsProcessingData] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Fetch results and qualifying data for base year
  const { 
    data: baseResults,
    isLoading: isBaseResultsLoading
  } = useRaceResults(baseYear, baseRound);
  
  const {
    data: baseQualifying,
    isLoading: isBaseQualifyingLoading,
    error: baseQualifyingError
  } = useRaceQualifying(baseYear, baseRound);
  
  // Fetch results and qualifying data for comparison year
  const { 
    data: comparisonResults,
    isLoading: isComparisonResultsLoading
  } = useRaceResults(comparisonYear, comparisonRound);
  
  const {
    data: comparisonQualifying,
    isLoading: isComparisonQualifyingLoading,
    error: comparisonQualifyingError
  } = useRaceQualifying(comparisonYear, comparisonRound);
  
  const isLoading = 
    isBaseResultsLoading || 
    isBaseQualifyingLoading || 
    isComparisonResultsLoading || 
    isComparisonQualifyingLoading ||
    isProcessingData;

  const isError = !!baseQualifyingError || !!comparisonQualifyingError;

  // Set error message when errors occur
  useEffect(() => {
    if (baseQualifyingError || comparisonQualifyingError) {
      setErrorMessage("Error loading qualifying data");
    } else {
      setErrorMessage(null);
    }
  }, [baseQualifyingError, comparisonQualifyingError]);

  // Process qualifying times to seconds
  const convertLapTimeToSeconds = (timeStr: string): number | null => {
    if (!timeStr) return null;
    
    // If string is already in seconds, e.g. '90.123'
    if (!timeStr.includes(':')) {
      return parseFloat(timeStr);
    }
    
    // Handle format 'M:SS.mmm'
    const [minutes, seconds] = timeStr.split(':');
    if (minutes && seconds) {
      return parseFloat(minutes) * 60 + parseFloat(seconds);
    }
    
    return null;
  };

  // Process base year qualifying data
  useEffect(() => {
    if (baseQualifying?.data?.QualifyingResults) {
      const results = baseQualifying.data.QualifyingResults;
      const drivers = results.map((result: any) => {
        const q1Time = convertLapTimeToSeconds(result.Q1);
        const q2Time = convertLapTimeToSeconds(result.Q2);
        const q3Time = convertLapTimeToSeconds(result.Q3);
        
        // Find the team name from results data
        let team = "unknown";
        if (baseResults?.data?.Results) {
          const driverResult = baseResults.data.Results.find((r: any) => 
            r.Driver.driverId === result.Driver.driverId
          );
          if (driverResult?.Constructor?.constructorId) {
            team = driverResult.Constructor.constructorId;
          }
        }
        
        return {
          driverId: result.Driver.driverId,
          code: result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase(),
          name: `${result.Driver.givenName} ${result.Driver.familyName}`,
          position: parseInt(result.position) || 0,
          team,
          q1Time,
          q2Time,
          q3Time,
          year: baseYear
        };
      });
      
      setBaseDrivers(drivers);
      
      // Auto-select pole position driver by default
      if (drivers.length > 0) {
        const poleDriver = drivers.find(d => d.position === 1);
        if (poleDriver) {
          setSelectedBaseDrivers([poleDriver.code]);
        } else if (drivers[0]) {
          setSelectedBaseDrivers([drivers[0].code]);
        }
      }
      
      // Find fastest qualifying time
      let fastestTime = Number.MAX_VALUE;
      let fastestDriver = null;
      let fastestSession = '';
      
      drivers.forEach(driver => {
        if (driver.q3Time && driver.q3Time < fastestTime) {
          fastestTime = driver.q3Time;
          fastestDriver = driver.code;
          fastestSession = 'Q3';
        } else if (driver.q2Time && driver.q2Time < fastestTime) {
          fastestTime = driver.q2Time;
          fastestDriver = driver.code;
          fastestSession = 'Q2';
        } else if (driver.q1Time && driver.q1Time < fastestTime) {
          fastestTime = driver.q1Time;
          fastestDriver = driver.code;
          fastestSession = 'Q1';
        }
      });
      
      if (fastestDriver && fastestTime < Number.MAX_VALUE) {
        // Only set if faster than existing fastest time
        if (!fastestLapTime || fastestTime < fastestLapTime.time) {
          setFastestLapTime({
            time: fastestTime,
            driver: fastestDriver,
            session: fastestSession,
            year: baseYear
          });
        }
      }
    }
  }, [baseQualifying, baseResults, baseYear, fastestLapTime]);

  // Process comparison year qualifying data
  useEffect(() => {
    if (comparisonQualifying?.data?.QualifyingResults) {
      const results = comparisonQualifying.data.QualifyingResults;
      const drivers = results.map((result: any) => {
        const q1Time = convertLapTimeToSeconds(result.Q1);
        const q2Time = convertLapTimeToSeconds(result.Q2);
        const q3Time = convertLapTimeToSeconds(result.Q3);
        
        // Find the team name from results data
        let team = "unknown";
        if (comparisonResults?.data?.Results) {
          const driverResult = comparisonResults.data.Results.find((r: any) => 
            r.Driver.driverId === result.Driver.driverId
          );
          if (driverResult?.Constructor?.constructorId) {
            team = driverResult.Constructor.constructorId;
          }
        }
        
        return {
          driverId: result.Driver.driverId,
          code: result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase(),
          name: `${result.Driver.givenName} ${result.Driver.familyName}`,
          position: parseInt(result.position) || 0,
          team,
          q1Time,
          q2Time,
          q3Time,
          year: comparisonYear
        };
      });
      
      setComparisonDrivers(drivers);
      
      // Auto-select pole position driver by default
      if (drivers.length > 0) {
        const poleDriver = drivers.find(d => d.position === 1);
        if (poleDriver) {
          setSelectedComparisonDrivers([poleDriver.code]);
        } else if (drivers[0]) {
          setSelectedComparisonDrivers([drivers[0].code]);
        }
      }
      
      // Find fastest qualifying time
      let fastestTime = Number.MAX_VALUE;
      let fastestDriver = null;
      let fastestSession = '';
      
      drivers.forEach(driver => {
        if (driver.q3Time && driver.q3Time < fastestTime) {
          fastestTime = driver.q3Time;
          fastestDriver = driver.code;
          fastestSession = 'Q3';
        } else if (driver.q2Time && driver.q2Time < fastestTime) {
          fastestTime = driver.q2Time;
          fastestDriver = driver.code;
          fastestSession = 'Q2';
        } else if (driver.q1Time && driver.q1Time < fastestTime) {
          fastestTime = driver.q1Time;
          fastestDriver = driver.code;
          fastestSession = 'Q1';
        }
      });
      
      if (fastestDriver && fastestTime < Number.MAX_VALUE) {
        // Only set if faster than existing fastest time
        if (!fastestLapTime || fastestTime < fastestLapTime.time) {
          setFastestLapTime({
            time: fastestTime,
            driver: fastestDriver,
            session: fastestSession,
            year: comparisonYear
          });
        }
      }
    }
  }, [comparisonQualifying, comparisonResults, comparisonYear, fastestLapTime]);

  // Process and combine qualifying data
  useEffect(() => {
    if (baseDrivers.length > 0 && comparisonDrivers.length > 0) {
      setIsProcessingData(true);
      
      try {
        const positions = Array.from({ length: 20 }, (_, i) => i + 1);
        const processedData = positions.map(pos => ({ position: pos }));
        
        // Process base year data
        baseDrivers.forEach(driver => {
          if (selectedBaseDrivers.includes(driver.code)) {
            if ((activeSessions.includes('all') || activeSessions.includes('Q1')) && driver.q1Time) {
              processedData[driver.position - 1][`${driver.code}_${baseYear}_Q1`] = driver.q1Time;
            }
            if ((activeSessions.includes('all') || activeSessions.includes('Q2')) && driver.q2Time) {
              processedData[driver.position - 1][`${driver.code}_${baseYear}_Q2`] = driver.q2Time;
            }
            if ((activeSessions.includes('all') || activeSessions.includes('Q3')) && driver.q3Time) {
              processedData[driver.position - 1][`${driver.code}_${baseYear}_Q3`] = driver.q3Time;
            }
          }
        });
        
        // Process comparison year data
        comparisonDrivers.forEach(driver => {
          if (selectedComparisonDrivers.includes(driver.code)) {
            if ((activeSessions.includes('all') || activeSessions.includes('Q1')) && driver.q1Time) {
              processedData[driver.position - 1][`${driver.code}_${comparisonYear}_Q1`] = driver.q1Time;
            }
            if ((activeSessions.includes('all') || activeSessions.includes('Q2')) && driver.q2Time) {
              processedData[driver.position - 1][`${driver.code}_${comparisonYear}_Q2`] = driver.q2Time;
            }
            if ((activeSessions.includes('all') || activeSessions.includes('Q3')) && driver.q3Time) {
              processedData[driver.position - 1][`${driver.code}_${comparisonYear}_Q3`] = driver.q3Time;
            }
          }
        });
        
        // Filter out positions with no data
        const filteredData = processedData.filter(d => 
          Object.keys(d).length > 1 // More than just the position property
        );
        
        setChartData(filteredData);
      } catch (error) {
        console.error("Error processing qualifying data:", error);
        toast.error("Error processing qualifying data");
      } finally {
        setIsProcessingData(false);
      }
    }
  }, [baseDrivers, comparisonDrivers, selectedBaseDrivers, selectedComparisonDrivers, activeSessions, baseYear, comparisonYear]);

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

  const toggleSession = (session: QualifyingSession) => {
    setActiveSessions(prev => {
      if (session === 'all') {
        // Toggle between all sessions and no sessions
        return prev.includes('all') ? [] : ['all'];
      } else {
        // Remove 'all' if it's present and adding individual session
        const withoutAll = prev.filter(s => s !== 'all');
        
        // Toggle individual session
        if (withoutAll.includes(session)) {
          const withoutSession = withoutAll.filter(s => s !== session);
          // If no sessions left, add 'all'
          return withoutSession.length === 0 ? ['all'] : withoutSession;
        } else {
          return [...withoutAll, session];
        }
      }
    });
  };

  const getSessionColor = (session: string) => {
    switch (session) {
      case 'Q1': return '#a855f7'; // Purple
      case 'Q2': return '#3b82f6'; // Blue
      case 'Q3': return '#22c55e'; // Green
      default: return '#6b7280'; // Gray
    }
  };
  
  const getRaceCircuitName = (results: any) => {
    if (!results?.data?.Circuit) return "Unknown Circuit";
    return results.data.Circuit.circuitName || results.data.raceName || "Unknown Circuit";
  };

  const baseCircuit = getRaceCircuitName(baseResults);
  const comparisonCircuit = getRaceCircuitName(comparisonResults);

  // Format legend text with driver name and session
  const formatLegendText = (value: string) => {
    if (!value || !value.includes('_')) return value;
    
    const parts = value.split('_');
    if (parts.length !== 3) return value;
    
    const [driverCode, year, session] = parts;
    let driver;
    
    if (parseInt(year) === baseYear) {
      driver = baseDrivers.find(d => d.code === driverCode);
    } else {
      driver = comparisonDrivers.find(d => d.code === driverCode);
    }
    
    if (!driver) return `${driverCode} (${session})`;
    
    const lastName = driver.name.split(' ').pop() || '';
    return `${driverCode} ${lastName} - ${session} (${year})`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <DataLoadingProgress 
          isLoading={true}
          progress={isProcessingData ? 80 : 40}
          message={errorMessage}
          isError={isError}
        />
        <div className="pt-6 text-center">
          <p className="text-muted-foreground">
            {isProcessingData ? "Processing qualifying data..." : "Loading qualifying data..."}
          </p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <AlertCircle className="h-8 w-8 mb-4" />
        <p className="font-medium mb-1">No qualifying data available</p>
        <p className="text-sm text-muted-foreground">Try selecting different races or seasons.</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg">
          <button
            onClick={() => toggleSession('all')}
            className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              activeSessions.includes('all')
                ? 'bg-gray-700 text-white'
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            All
          </button>
          <button
            onClick={() => toggleSession('Q1')}
            className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              activeSessions.includes('Q1') || activeSessions.includes('all')
                ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800'
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Q1
          </button>
          <button
            onClick={() => toggleSession('Q2')}
            className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              activeSessions.includes('Q2') || activeSessions.includes('all')
                ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Q2
          </button>
          <button
            onClick={() => toggleSession('Q3')}
            className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              activeSessions.includes('Q3') || activeSessions.includes('all')
                ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Q3
          </button>
        </div>
        
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
            margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="position" 
              label={{ value: 'Grid Position', position: 'insideBottomRight', offset: -5 }}
              domain={[0, 'dataMax']}
              type="number"
              xAxisId="position"
            />
            <YAxis 
              label={{ value: 'Lap Time (seconds)', angle: -90, position: 'insideLeft' }}
              domain={['auto', 'auto']}
              yAxisId="time"
            />
            <Tooltip 
              formatter={(value, name) => {
                if (typeof value !== 'number') return [value, name];
                return [`${value.toFixed(2)}s`, formatLegendText(name as string)];
              }}
              labelFormatter={(label) => `Position ${label}`}
              contentStyle={{ 
                backgroundColor: '#1a1a1a',
                borderColor: '#333',
                borderRadius: '5px',
                color: 'white'
              }}
            />
            <Legend 
              formatter={formatLegendText} 
              iconSize={10}
              wrapperStyle={{ 
                opacity: 1,
                padding: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '5px'
              }}
            />
            
            {fastestLapTime && (
              <ReferenceLine 
                y={fastestLapTime.time} 
                stroke="#c026d3" 
                strokeDasharray="3 3" 
                label={{ 
                  value: `Fastest: ${fastestLapTime.time.toFixed(2)}s (${fastestLapTime.driver} ${fastestLapTime.session} ${fastestLapTime.year})`, 
                  position: 'right', 
                  fill: '#c026d3' 
                }}
                yAxisId="time"
                xAxisId="position"
              />
            )}
            
            {/* Base Year Q1 */}
            {(activeSessions.includes('all') || activeSessions.includes('Q1')) && 
              baseDrivers
                .filter(driver => selectedBaseDrivers.includes(driver.code))
                .map(driver => (
                  <Line
                    key={`${driver.code}_${baseYear}_Q1`}
                    type="monotone"
                    dataKey={`${driver.code}_${baseYear}_Q1`}
                    name={`${driver.code}_${baseYear}_Q1`}
                    stroke={getSessionColor('Q1')}
                    strokeWidth={2}
                    dot={{ r: 5, strokeWidth: 1, fill: 'white', stroke: getSessionColor('Q1') }}
                    activeDot={{ r: 8 }}
                    xAxisId="position"
                    yAxisId="time"
                    connectNulls
                  />
                ))
            }
            
            {/* Base Year Q2 */}
            {(activeSessions.includes('all') || activeSessions.includes('Q2')) && 
              baseDrivers
                .filter(driver => selectedBaseDrivers.includes(driver.code))
                .map(driver => (
                  <Line
                    key={`${driver.code}_${baseYear}_Q2`}
                    type="monotone"
                    dataKey={`${driver.code}_${baseYear}_Q2`}
                    name={`${driver.code}_${baseYear}_Q2`}
                    stroke={getSessionColor('Q2')}
                    strokeWidth={2}
                    dot={{ r: 5, strokeWidth: 1, fill: 'white', stroke: getSessionColor('Q2') }}
                    activeDot={{ r: 8 }}
                    xAxisId="position"
                    yAxisId="time"
                    connectNulls
                  />
                ))
            }
            
            {/* Base Year Q3 */}
            {(activeSessions.includes('all') || activeSessions.includes('Q3')) && 
              baseDrivers
                .filter(driver => selectedBaseDrivers.includes(driver.code))
                .map(driver => (
                  <Line
                    key={`${driver.code}_${baseYear}_Q3`}
                    type="monotone"
                    dataKey={`${driver.code}_${baseYear}_Q3`}
                    name={`${driver.code}_${baseYear}_Q3`}
                    stroke={getSessionColor('Q3')}
                    strokeWidth={2}
                    dot={{ r: 5, strokeWidth: 1, fill: 'white', stroke: getSessionColor('Q3') }}
                    activeDot={{ r: 8 }}
                    xAxisId="position"
                    yAxisId="time"
                    connectNulls
                  />
                ))
            }
            
            {/* Comparison Year Q1 */}
            {(activeSessions.includes('all') || activeSessions.includes('Q1')) && 
              comparisonDrivers
                .filter(driver => selectedComparisonDrivers.includes(driver.code))
                .map(driver => (
                  <Line
                    key={`${driver.code}_${comparisonYear}_Q1`}
                    type="monotone"
                    dataKey={`${driver.code}_${comparisonYear}_Q1`}
                    name={`${driver.code}_${comparisonYear}_Q1`}
                    stroke={getSessionColor('Q1')}
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={{ r: 5, strokeWidth: 1, fill: 'white', stroke: getSessionColor('Q1') }}
                    activeDot={{ r: 8 }}
                    xAxisId="position"
                    yAxisId="time"
                    connectNulls
                  />
                ))
            }
            
            {/* Comparison Year Q2 */}
            {(activeSessions.includes('all') || activeSessions.includes('Q2')) && 
              comparisonDrivers
                .filter(driver => selectedComparisonDrivers.includes(driver.code))
                .map(driver => (
                  <Line
                    key={`${driver.code}_${comparisonYear}_Q2`}
                    type="monotone"
                    dataKey={`${driver.code}_${comparisonYear}_Q2`}
                    name={`${driver.code}_${comparisonYear}_Q2`}
                    stroke={getSessionColor('Q2')}
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={{ r: 5, strokeWidth: 1, fill: 'white', stroke: getSessionColor('Q2') }}
                    activeDot={{ r: 8 }}
                    xAxisId="position"
                    yAxisId="time"
                    connectNulls
                  />
                ))
            }
            
            {/* Comparison Year Q3 */}
            {(activeSessions.includes('all') || activeSessions.includes('Q3')) && 
              comparisonDrivers
                .filter(driver => selectedComparisonDrivers.includes(driver.code))
                .map(driver => (
                  <Line
                    key={`${driver.code}_${comparisonYear}_Q3`}
                    type="monotone"
                    dataKey={`${driver.code}_${comparisonYear}_Q3`}
                    name={`${driver.code}_${comparisonYear}_Q3`}
                    stroke={getSessionColor('Q3')}
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={{ r: 5, strokeWidth: 1, fill: 'white', stroke: getSessionColor('Q3') }}
                    activeDot={{ r: 8 }}
                    xAxisId="position"
                    yAxisId="time"
                    connectNulls
                  />
                ))
            }
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default YearComparisonQualifyingChart; 
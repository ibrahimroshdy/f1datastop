import { useState, useEffect } from "react";
import { BarChart, Bar, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
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

  // Format data for a bar chart
  const formatBarChartData = () => {
    // Build an array where each item is one driver that should be shown
    const selectedDriversArray = [
      ...selectedBaseDrivers.map(code => {
        const driver = baseDrivers.find(d => d.code === code);
        return driver ? { ...driver, source: 'base' } : null;
      }),
      ...selectedComparisonDrivers.map(code => {
        const driver = comparisonDrivers.find(d => d.code === code);
        return driver ? { ...driver, source: 'comparison' } : null;
      })
    ].filter(Boolean).sort((a, b) => a.position - b.position);
    
    // Create data points for each selected driver
    return selectedDriversArray.map(driver => {
      const isBase = driver.source === 'base';
      const year = isBase ? baseYear : comparisonYear;
      const yearSuffix = isBase ? 'Base' : 'Comp';
      
      // Create the data point
      const dataPoint: any = {
        name: `${driver.code} (${year})`,
        driverCode: driver.code,
        position: driver.position,
        team: driver.team,
        year,
        yearSuffix
      };
      
      // Add qualifying session times if they're active
      if (activeSessions.includes('all') || activeSessions.includes('Q1')) {
        dataPoint[`Q1_${yearSuffix}`] = driver.q1Time;
      }
      
      if (activeSessions.includes('all') || activeSessions.includes('Q2')) {
        dataPoint[`Q2_${yearSuffix}`] = driver.q2Time;
      }
      
      if (activeSessions.includes('all') || activeSessions.includes('Q3')) {
        dataPoint[`Q3_${yearSuffix}`] = driver.q3Time;
      }
      
      return dataPoint;
    });
  };

  // Process and combine qualifying data
  useEffect(() => {
    if (baseDrivers.length > 0 && comparisonDrivers.length > 0) {
      setIsProcessingData(true);
      
      try {
        setChartData(formatBarChartData());
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

  const getSessionColor = (session: string, isBase: boolean) => {
    let baseColor;
    switch (session) {
      case 'Q1': 
        baseColor = '#a855f7'; // Purple
        break;
      case 'Q2': 
        baseColor = '#3b82f6'; // Blue
        break;
      case 'Q3': 
        baseColor = '#22c55e'; // Green
        break;
      default: 
        baseColor = '#6b7280'; // Gray
    }
    
    // For comparison year, make colors slightly more muted
    return isBase ? baseColor : `${baseColor}99`;
  };
  
  const getRaceCircuitName = (results: any) => {
    if (!results?.data?.Circuit) return "Unknown Circuit";
    return results.data.Circuit.circuitName || results.data.raceName || "Unknown Circuit";
  };

  const baseCircuit = getRaceCircuitName(baseResults);
  const comparisonCircuit = getRaceCircuitName(comparisonResults);

  // Format legend text
  const formatLegendText = (value: string) => {
    if (!value || !value.includes('_')) return value;
    
    const [session, yearType] = value.split('_');
    
    const sessionName = session;
    const year = yearType === 'Base' ? baseYear : comparisonYear;
    const circuit = yearType === 'Base' ? baseCircuit : comparisonCircuit;
    
    return `${sessionName} ${year} (${circuit})`;
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
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 40, left: 20, bottom: 20 }}
            barGap={2}
            barCategoryGap={20}
            layout="vertical"
            barSize={22}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={true} vertical={false} />
            <XAxis 
              type="number"
              domain={['auto', 'auto']}
              label={{ value: 'Lap Time (seconds)', position: 'insideBottom', dy: 10 }}
              xAxisId="primary"
            />
            <YAxis 
              dataKey="name"
              type="category"
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={100}
              yAxisId="primary"
            />
            <Tooltip 
              formatter={(value, name) => {
                if (typeof value !== 'number') return [value, name];
                return [`${value.toFixed(2)}s`, formatLegendText(name as string)];
              }}
              labelFormatter={(label) => {
                const [driverCode, yearInfo] = label.split(' (');
                return `${driverCode} - Position ${chartData.find(d => d.name === label)?.position || '?'}`;
              }}
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
                x={fastestLapTime.time} 
                stroke="#c026d3" 
                strokeDasharray="3 3" 
                label={{ 
                  value: `Fastest: ${fastestLapTime.time.toFixed(2)}s (${fastestLapTime.driver} ${fastestLapTime.session} ${fastestLapTime.year})`, 
                  position: 'top', 
                  fill: '#c026d3',
                  fontSize: 12
                }}
                xAxisId="primary"
                yAxisId="primary"
              />
            )}
            
            {/* Base Year Bars */}
            {activeSessions.includes('all') || activeSessions.includes('Q1') ? (
              <Bar 
                dataKey="Q1_Base" 
                name="Q1_Base" 
                fill={getSessionColor('Q1', true)}
                radius={[0, 4, 4, 0]}
                xAxisId="primary"
                yAxisId="primary"
              />
            ) : null}
            
            {activeSessions.includes('all') || activeSessions.includes('Q2') ? (
              <Bar 
                dataKey="Q2_Base" 
                name="Q2_Base" 
                fill={getSessionColor('Q2', true)}
                radius={[0, 4, 4, 0]}
                xAxisId="primary"
                yAxisId="primary"
              />
            ) : null}
            
            {activeSessions.includes('all') || activeSessions.includes('Q3') ? (
              <Bar 
                dataKey="Q3_Base" 
                name="Q3_Base" 
                fill={getSessionColor('Q3', true)}
                radius={[0, 4, 4, 0]}
                xAxisId="primary"
                yAxisId="primary"
              />
            ) : null}
            
            {/* Comparison Year Bars */}
            {activeSessions.includes('all') || activeSessions.includes('Q1') ? (
              <Bar 
                dataKey="Q1_Comp" 
                name="Q1_Comp" 
                fill={getSessionColor('Q1', false)}
                radius={[0, 4, 4, 0]}
                xAxisId="primary"
                yAxisId="primary"
              />
            ) : null}
            
            {activeSessions.includes('all') || activeSessions.includes('Q2') ? (
              <Bar 
                dataKey="Q2_Comp" 
                name="Q2_Comp" 
                fill={getSessionColor('Q2', false)}
                radius={[0, 4, 4, 0]}
                xAxisId="primary"
                yAxisId="primary"
              />
            ) : null}
            
            {activeSessions.includes('all') || activeSessions.includes('Q3') ? (
              <Bar 
                dataKey="Q3_Comp" 
                name="Q3_Comp" 
                fill={getSessionColor('Q3', false)}
                radius={[0, 4, 4, 0]}
                xAxisId="primary"
                yAxisId="primary"
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default YearComparisonQualifyingChart; 
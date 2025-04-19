import { useState, useEffect } from "react";
import { useRaceQualifying, useRaceResults } from "@/hooks/useF1Data";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Check, Clock, Timer } from "lucide-react";
import { toast } from "sonner";
import DataLoadingProgress from "./DataLoadingProgress";
import { QualifyingSession } from "@/hooks/useQualifyingData";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  Label, 
  Line,
  ReferenceLine
} from "recharts";
import { useTheme } from "@/context/ThemeContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface YearComparisonQualifyingChartProps {
  baseYear: number;
  baseRound: string;
  comparisonYear: number;
  comparisonRound: string;
  positionView?: boolean;
  chartView?: boolean;
}

// New dedicated QualifyingChartView component for better separation of concerns
const QualifyingChartView = ({ 
  baseYear, 
  comparisonYear, 
  baseCircuit, 
  comparisonCircuit,
  chartData,
  selectedChartSession,
  handleChartSessionChange,
  theme,
  toggleBaseDriver,
  toggleComparisonDriver,
  selectedBaseDrivers,
  selectedComparisonDrivers,
  baseDrivers,
  comparisonDrivers,
  formatTimeDisplay
}) => {
  console.log("Rendering QualifyingChartView component with data:", { 
    chartData, 
    baseYear, 
    comparisonYear, 
    selectedChartSession
  });

  const handleBarClick = (data) => {
    const { name, year } = data;
    if (year === baseYear) {
      toggleBaseDriver(name);
    } else if (year === comparisonYear) {
      toggleComparisonDriver(name);
    }
  };

  // Filter and prepare data based on selected drivers
  const filteredChartData = chartData.filter(item => {
    // If no drivers are selected, show all
    if (selectedBaseDrivers.length === 0 && selectedComparisonDrivers.length === 0) {
      return true;
    }
    
    // Keep base year drivers that are selected
    if (item.year === baseYear && selectedBaseDrivers.includes(item.name)) {
      return true;
    }
    
    // Keep comparison year drivers that are selected
    if (item.year === comparisonYear && selectedComparisonDrivers.includes(item.name)) {
      return true;
    }
    
    // By default, if any driver is selected, filter out unselected ones
    return (selectedBaseDrivers.length === 0 && selectedComparisonDrivers.length === 0);
  });

  // Use the original data if no filtered data remains
  const displayData = filteredChartData.length > 0 ? filteredChartData : chartData;

  // Find the fastest time to use as reference
  const fastestTime = Math.min(...displayData.map(item => item.time));
  const fastestDriver = displayData.find(item => item.time === fastestTime);

  // Reorganize data to group by driver instead of by year
  const prepareChartData = () => {
    // Get unique drivers from both years
    const allDriverCodes = new Set([
      ...displayData.filter(d => d.year === baseYear).map(d => d.name),
      ...displayData.filter(d => d.year === comparisonYear).map(d => d.name)
    ]);
    
    // Create new data structure grouped by driver
    const groupedData = [];
    
    allDriverCodes.forEach(driverCode => {
      const baseDriver = displayData.find(d => d.name === driverCode && d.year === baseYear);
      const compDriver = displayData.find(d => d.name === driverCode && d.year === comparisonYear);
      
      if (baseDriver || compDriver) {
        groupedData.push({
          driverCode,
          baseTime: baseDriver?.time || null,
          compTime: compDriver?.time || null,
          baseFormattedTime: baseDriver?.formattedTime || '-',
          compFormattedTime: compDriver?.formattedTime || '-',
          basePosition: baseDriver?.position || null,
          compPosition: compDriver?.position || null,
          baseTeam: baseDriver?.team || null,
          compTeam: compDriver?.team || null,
          // For color coding
          baseYear,
          compYear: comparisonYear
        });
      }
    });
    
    // Sort by base year first, then comparison year positions
    return groupedData.sort((a, b) => {
      if (a.basePosition && b.basePosition) {
        return a.basePosition - b.basePosition;
      } else if (a.basePosition) {
        return -1;
      } else if (b.basePosition) {
        return 1;
      } else if (a.compPosition && b.compPosition) {
        return a.compPosition - b.compPosition;
      }
      return 0;
    });
  };

  const groupedChartData = prepareChartData();

  return (
    <div className="space-y-4">
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
        
        <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg">
          <button
            onClick={() => handleChartSessionChange('q1')}
            className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              selectedChartSession === 'q1'
                ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800'
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Q1
          </button>
          <button
            onClick={() => handleChartSessionChange('q2')}
            className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              selectedChartSession === 'q2'
                ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Q2
          </button>
          <button
            onClick={() => handleChartSessionChange('q3')}
            className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              selectedChartSession === 'q3'
                ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Q3
          </button>
        </div>
      </div>
      
      {/* Driver selection UI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <h4 className="text-sm font-semibold mb-2 text-amber-600">{baseYear} Drivers</h4>
          <div className="flex flex-wrap gap-2 mb-2">
            {baseDrivers.map(driver => (
              <button
                key={`base-${driver.code}`}
                onClick={() => toggleBaseDriver(driver.code)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  selectedBaseDrivers.includes(driver.code)
                    ? 'bg-amber-700 text-white'
                    : selectedBaseDrivers.length > 0
                      ? 'bg-gray-200 text-gray-800'
                      : 'bg-amber-700/80 text-white'
                }`}
                style={{
                  borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666666'}`
                }}
              >
                {driver.code}
              </button>
            ))}
          </div>
          {selectedBaseDrivers.length > 0 && (
            <button 
              onClick={() => baseDrivers.forEach(d => {
                if (selectedBaseDrivers.includes(d.code)) {
                  toggleBaseDriver(d.code);
                }
              })}
              className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 underline"
            >
              Clear selection (show all)
            </button>
          )}
        </div>
        
        <div>
          <h4 className="text-sm font-semibold mb-2 text-blue-600">{comparisonYear} Drivers</h4>
          <div className="flex flex-wrap gap-2 mb-2">
            {comparisonDrivers.map(driver => (
              <button
                key={`comp-${driver.code}`}
                onClick={() => toggleComparisonDriver(driver.code)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  selectedComparisonDrivers.includes(driver.code)
                    ? 'bg-blue-700 text-white'
                    : selectedComparisonDrivers.length > 0
                      ? 'bg-gray-200 text-gray-800'
                      : 'bg-blue-700/80 text-white'
                }`}
                style={{
                  borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666666'}`
                }}
              >
                {driver.code}
              </button>
            ))}
          </div>
          {selectedComparisonDrivers.length > 0 && (
            <button 
              onClick={() => comparisonDrivers.forEach(d => {
                if (selectedComparisonDrivers.includes(d.code)) {
                  toggleComparisonDriver(d.code);
                }
              })}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
            >
              Clear selection (show all)
            </button>
          )}
        </div>
      </div>
      
      {displayData.length === 0 ? (
        <div className="flex items-center justify-center h-[400px] border rounded-lg p-6">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-muted-foreground">No qualifying data available to display chart.</p>
            <p className="text-sm text-muted-foreground mt-2">Try selecting different drivers or qualifying sessions.</p>
          </div>
        </div>
      ) : (
        <div className="h-[500px] border rounded-lg p-4 overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={groupedChartData}
              margin={{ top: 20, right: 50, left: 20, bottom: 80 }}
              barGap={0}
              barCategoryGap={12}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis 
                dataKey="driverCode" 
                label={{ 
                  value: 'Driver', 
                  position: 'insideBottomRight', 
                  offset: -10 
                }}
                tick={(props) => {
                  const { x, y, payload } = props;
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text 
                        x={0} 
                        y={0} 
                        dy={10} 
                        textAnchor="end" 
                        fill="#888888"
                        transform="rotate(-45)"
                        fontSize={12}
                        fontWeight="bold"
                      >
                        {payload.value}
                      </text>
                    </g>
                  );
                }}
                height={60}
              />
              <YAxis 
                domain={['auto', 'auto']}
                tickFormatter={(seconds) => {
                  return formatTimeDisplay(seconds);
                }}
              />
              <Tooltip 
                cursor={{ 
                  fill: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  stroke: theme === 'dark' ? '#444' : '#ddd',
                  strokeWidth: 1,
                  radius: 4
                }}
                formatter={(value, name, props) => {
                  if (!value) return ['-', name];
                  
                  const item = props.payload;
                  const isBaseYear = name === `${baseYear}`;
                  const position = isBaseYear ? item.basePosition : item.compPosition;
                  const formattedTime = isBaseYear ? item.baseFormattedTime : item.compFormattedTime;
                  const team = isBaseYear ? item.baseTeam : item.compTeam;
                  const teamColor = TEAM_COLORS[team] || '#666666';
                  const yearColor = isBaseYear ? '#f59e0b' : '#3b82f6';
                  
                  return [
                    <span style={{ color: yearColor, fontWeight: 'bold' }}>
                      {formattedTime} <span style={{ color: '#a855f7' }}>(P{position})</span>
                    </span>,
                    <span>
                      <span style={{ color: teamColor, fontWeight: 'bold' }}>{item.driverCode}</span> - {isBaseYear ? baseYear : comparisonYear}
                    </span>
                  ];
                }}
                contentStyle={{ 
                  backgroundColor: theme === 'dark' ? '#222' : '#fff',
                  borderColor: theme === 'dark' ? '#444' : '#e2e8f0',
                  color: theme === 'dark' ? '#fff' : '#1a202c',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  padding: '8px 12px'
                }}
                wrapperStyle={{
                  zIndex: 100
                }}
              />
              <Legend 
                formatter={(value) => {
                  return value === `${baseYear}` ? 
                    <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{baseYear} Season</span> : 
                    <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{comparisonYear} Season</span>;
                }}
                wrapperStyle={{ paddingTop: 20 }}
                onClick={(data) => {
                  if (data.value === `${baseYear}`) {
                    if (selectedBaseDrivers.length > 0) {
                      // Clear all selected base drivers
                      selectedBaseDrivers.forEach(driverCode => {
                        toggleBaseDriver(driverCode);
                      });
                    } else {
                      // Select all base drivers
                      baseDrivers.forEach(d => {
                        if (!selectedBaseDrivers.includes(d.code)) {
                          toggleBaseDriver(d.code);
                        }
                      });
                    }
                  } else {
                    if (selectedComparisonDrivers.length > 0) {
                      // Clear all selected comparison drivers
                      selectedComparisonDrivers.forEach(driverCode => {
                        toggleComparisonDriver(driverCode);
                      });
                    } else {
                      // Select all comparison drivers
                      comparisonDrivers.forEach(d => {
                        if (!selectedComparisonDrivers.includes(d.code)) {
                          toggleComparisonDriver(d.code);
                        }
                      });
                    }
                  }
                }}
              />
              
              <Bar 
                dataKey="baseTime" 
                name={`${baseYear}`}
                fill="#f59e0b"
                fillOpacity={0.8}
                stroke="#ed8a00"
                strokeWidth={1}
                minPointSize={3}
                barSize={20}
                activeBar={{ 
                  stroke: '#d97706', 
                  strokeWidth: 2,
                  fill: '#f59e0b'
                }}
              />
              <Bar 
                dataKey="compTime" 
                name={`${comparisonYear}`}
                fill="#3b82f6"
                fillOpacity={0.8}
                stroke="#2563eb"
                strokeWidth={1}
                minPointSize={3}
                barSize={20}
                activeBar={{ 
                  stroke: '#1d4ed8',
                  strokeWidth: 2,
                  fill: '#3b82f6'
                }}
              />
              
              {/* Reference line for fastest time - placed after bars to overlay them */}
              {fastestDriver && (
                <ReferenceLine 
                  y={fastestTime} 
                  stroke="#a855f7" 
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  ifOverflow="extendDomain"
                  label={{
                    value: `Fastest: ${fastestDriver.formattedTime} (P${fastestDriver.position} - ${fastestDriver.name}, ${selectedChartSession.toUpperCase()}, ${fastestDriver.year})`,
                    fill: '#a855f7',
                    fontSize: 12,
                    fontWeight: 'bold',
                    position: 'insideBottomRight'
                  }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      
      <Alert className="mt-4 text-sm bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
        <Timer className="h-4 w-4" />
        <AlertDescription>
          Chart shows {selectedChartSession.toUpperCase()} times for the selected drivers. Fastest time is marked with a purple dotted line.
        </AlertDescription>
      </Alert>
    </div>
  );
};

const YearComparisonQualifyingChart: React.FC<YearComparisonQualifyingChartProps> = ({
  baseYear,
  baseRound,
  comparisonYear,
  comparisonRound,
  positionView = false,
  chartView = false
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
  const [activeSessions, setActiveSessions] = useState<QualifyingSession[]>(['all']);
  const [fastestLapTime, setFastestLapTime] = useState<{ time: number, driver: string, session: string, year: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'base' | 'comparison'>('base');
  const [selectedChartSession, setSelectedChartSession] = useState<'q1' | 'q2' | 'q3'>('q3');
  const { theme } = useTheme();
  
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

  // Format lap time from seconds to MM:SS.sss format
  const formatLapTime = (seconds: number | null): string => {
    if (!seconds) return "No time";
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds.toFixed(3).padStart(6, '0')}`;
  };

  // Process lap time string to seconds
  const convertLapTimeToSeconds = (timeStr: string): number | null => {
    if (!timeStr) return null;
    
    // If the string is already in seconds, e.g., '90.123'
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
        // Properly handle Q1, Q2, Q3 times in format "1:15.912"
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
          year: baseYear,
          // Store original time strings for display purposes
          q1String: result.Q1 || '',
          q2String: result.Q2 || '',
          q3String: result.Q3 || ''
        };
      });
      
      setBaseDrivers(drivers.sort((a, b) => a.position - b.position));
      
      // We need to set chartData to a non-empty value so the component doesn't show "No data available"
      if (drivers.length > 0) {
        setChartData([{ year: baseYear, dataLoaded: true }]);
      }
      
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
        // Properly handle Q1, Q2, Q3 times in format "1:15.912"
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
          year: comparisonYear,
          // Store original time strings for display purposes
          q1String: result.Q1 || '',
          q2String: result.Q2 || '',
          q3String: result.Q3 || ''
        };
      });
      
      setComparisonDrivers(drivers.sort((a, b) => a.position - b.position));
      
      // We need to set chartData to a non-empty value so the component doesn't show "No data available"
      if (drivers.length > 0) {
        setChartData(prevData => {
          return prevData.length > 0 ? prevData : [{ year: comparisonYear, dataLoaded: true }];
        });
      }
      
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

  // Prepare chart data when drivers change or selected session changes
  useEffect(() => {
    if (baseDrivers.length > 0 && comparisonDrivers.length > 0) {
      console.log("Preparing chart data for session:", selectedChartSession);
      
      // Get the session property name based on selected session
      const sessionProp = `${selectedChartSession}Time`;
      
      // Use all drivers instead of just the top 10
      const baseDriversList = baseDrivers;
      const comparisonDriversList = comparisonDrivers;
      
      // Prepare data for chart
      const chartData = [];
      
      // Add base year drivers
      for (const driver of baseDriversList) {
        if (driver[sessionProp]) {
          chartData.push({
            name: driver.code,
            time: driver[sessionProp],
            year: baseYear,
            position: driver.position,
            formattedTime: formatTimeDisplay(driver[sessionProp]),
            color: TEAM_COLORS[driver.team] || '#666666'
          });
        }
      }
      
      // Add comparison year drivers
      for (const driver of comparisonDriversList) {
        if (driver[sessionProp]) {
          chartData.push({
            name: driver.code,
            time: driver[sessionProp],
            year: comparisonYear,
            position: driver.position,
            formattedTime: formatTimeDisplay(driver[sessionProp]),
            color: TEAM_COLORS[driver.team] || '#666666'
          });
        }
      }
      
      // Sort by time
      chartData.sort((a, b) => a.time - b.time);
      
      console.log("Chart data prepared with length:", chartData.length);
      setChartData(chartData);
    }
  }, [baseDrivers, comparisonDrivers, selectedChartSession, baseYear, comparisonYear]);

  // Format time for display
  const formatTimeDisplay = (seconds?: number): string => {
    if (!seconds) return "-";
    
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
  };

  // Get visible drivers sorted by position
  const getVisibleBaseDrivers = () => {
    // If no drivers are explicitly selected, show all drivers
    if (selectedBaseDrivers.length === 0) {
      return baseDrivers.sort((a, b) => a.position - b.position);
    }
    
    return baseDrivers
      .filter(driver => selectedBaseDrivers.includes(driver.code))
      .sort((a, b) => a.position - b.position);
  };

  const getVisibleComparisonDrivers = () => {
    // If no drivers are explicitly selected, show all drivers
    if (selectedComparisonDrivers.length === 0) {
      return comparisonDrivers.sort((a, b) => a.position - b.position);
    }
    
    return comparisonDrivers
      .filter(driver => selectedComparisonDrivers.includes(driver.code))
      .sort((a, b) => a.position - b.position);
  };

  // Highlight the fastest time in each session
  const isFastestTime = (drivers: any[], session: 'q1Time' | 'q2Time' | 'q3Time', time?: number): boolean => {
    if (!time) return false;
    
    // Get all times for this session from drivers who participated
    const times = drivers
      .map(driver => driver[session])
      .filter(t => t !== undefined && t > 0) as number[];
    
    if (times.length === 0) return false;
    
    const fastestTime = Math.min(...times);
    return time === fastestTime;
  };

  const toggleBaseDriver = (driverCode: string) => {
    console.log("Toggling base driver:", driverCode);
    setSelectedBaseDrivers(prev => 
      prev.includes(driverCode)
        ? prev.filter(d => d !== driverCode)
        : [...prev, driverCode]
    );
  };

  const toggleComparisonDriver = (driverCode: string) => {
    console.log("Toggling comparison driver:", driverCode);
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
  
  const getRaceCircuitName = (results: any) => {
    if (!results?.data) return "";
    return results.data.Circuit?.circuitName || results.data.raceName || "";
  };

  const baseCircuit = getRaceCircuitName(baseResults);
  const comparisonCircuit = getRaceCircuitName(comparisonResults);

  const handleChartSessionChange = (session: 'q1' | 'q2' | 'q3') => {
    console.log("Changing chart session to:", session);
    setSelectedChartSession(session);
  };

  // Check if data appears to be for a future race
  const isFutureRace = (data: any): boolean => {
    if (!data?.data) return false;
    const circuitName = data.data.Circuit?.circuitName || data.data.raceName || "";
    return circuitName.includes("Unknown") || !data.data.QualifyingResults || data.data.QualifyingResults.length === 0;
  };

  const baseIsFutureRace = isFutureRace(baseQualifying);
  const comparisonIsFutureRace = isFutureRace(comparisonQualifying);

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

  // Display error message for upcoming races
  if (baseIsFutureRace || comparisonIsFutureRace) {
    return (
      <Alert className="my-4">
        <Clock className="h-4 w-4" />
        <AlertDescription>
          {baseIsFutureRace && comparisonIsFutureRace 
            ? "Qualifying data is not yet available for both selected races. Please select completed races to view this data."
            : baseIsFutureRace 
              ? `Qualifying data is not yet available for the ${baseYear} race. Please select a completed race.`
              : `Qualifying data is not yet available for the ${comparisonYear} race. Please select a completed race.`
          }
        </AlertDescription>
      </Alert>
    );
  }

  // Check for data by looking at the baseDrivers and comparisonDrivers arrays
  if (baseDrivers.length === 0 && comparisonDrivers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <AlertCircle className="h-8 w-8 mb-4" />
        <p className="font-medium mb-1">No qualifying data available</p>
        <p className="text-sm text-muted-foreground">Try selecting different races or seasons.</p>
      </div>
    );
  }

  // Render chart view if chartView is true
  if (chartView) {
    console.log("Rendering chart view with chartData length:", chartData.length);
    return (
      <QualifyingChartView
        baseYear={baseYear}
        comparisonYear={comparisonYear}
        baseCircuit={baseCircuit}
        comparisonCircuit={comparisonCircuit}
        chartData={chartData}
        selectedChartSession={selectedChartSession}
        handleChartSessionChange={handleChartSessionChange}
        theme={theme}
        toggleBaseDriver={toggleBaseDriver}
        toggleComparisonDriver={toggleComparisonDriver}
        selectedBaseDrivers={selectedBaseDrivers}
        selectedComparisonDrivers={selectedComparisonDrivers}
        baseDrivers={baseDrivers}
        comparisonDrivers={comparisonDrivers}
        formatTimeDisplay={formatTimeDisplay}
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
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
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
        {/* Base Year Table */}
        <div className="border rounded-lg overflow-hidden flex flex-col">
          <div className="mb-2 p-4 pb-0 flex-shrink-0">
            <h3 className="text-sm font-medium mb-2 text-amber-600">{baseYear} Drivers</h3>
            <div className="flex flex-wrap gap-2 mb-2">
              {baseDrivers.map(driver => (
                <button
                  key={`base-${driver.code}`}
                  onClick={() => toggleBaseDriver(driver.code)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                    selectedBaseDrivers.includes(driver.code)
                      ? 'bg-amber-700 text-white'
                      : selectedBaseDrivers.length > 0
                        ? 'bg-gray-200 text-gray-800'
                        : 'bg-amber-700/80 text-white'
                  }`}
                  style={{
                    borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666'}`
                  }}
                >
                  {selectedBaseDrivers.includes(driver.code) && <Check className="h-3 w-3" />}
                  <span>{driver.code}</span>
                </button>
              ))}
            </div>
            {selectedBaseDrivers.length > 0 && (
              <button 
                onClick={() => baseDrivers.forEach(d => {
                  if (selectedBaseDrivers.includes(d.code)) {
                    toggleBaseDriver(d.code);
                  }
                })}
                className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 underline"
              >
                Clear selection (show all)
              </button>
            )}
          </div>
          
          <div className="overflow-auto flex-1 min-h-0">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-16 text-center">Pos</TableHead>
                  <TableHead className="w-20">Driver</TableHead>
                  <TableHead className="w-32">Team</TableHead>
                  {!positionView && (
                    <>
                  {(activeSessions.includes('all') || activeSessions.includes('Q1')) && (
                    <TableHead className="text-right">Q1 Time</TableHead>
                  )}
                  {(activeSessions.includes('all') || activeSessions.includes('Q2')) && (
                    <TableHead className="text-right">Q2 Time</TableHead>
                  )}
                  {(activeSessions.includes('all') || activeSessions.includes('Q3')) && (
                    <TableHead className="text-right">Q3 Time</TableHead>
                      )}
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {getVisibleBaseDrivers().map(driver => (
                  <TableRow 
                    key={`base-${driver.code}`}
                    className={`hover:bg-muted/50 ${
                      driver.code === (fastestLapTime?.driver || '') && 
                      driver.year === (fastestLapTime?.year || 0) 
                        ? "bg-amber-500/10 dark:bg-amber-500/10" 
                        : ""
                    }`}
                    onClick={() => toggleBaseDriver(driver.code)}
                    style={{ cursor: "pointer" }}
                  >
                    <TableCell className="text-center font-medium">
                      {driver.position}
                    </TableCell>
                    <TableCell>
                      <div 
                        className="flex items-center gap-2"
                        style={{ borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666'}` }}
                      >
                        <span className="pl-2 font-medium">{driver.code}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground capitalize">
                        {driver.team.replace('_', ' ')}
                      </span>
                    </TableCell>
                    {!positionView && (
                      <>
                    {(activeSessions.includes('all') || activeSessions.includes('Q1')) && (
                      <TableCell 
                        className={`text-right font-mono ${isFastestTime(baseDrivers, 'q1Time', driver.q1Time) ? 'text-purple-500 font-bold' : ''}`}
                      >
                        {formatTimeDisplay(driver.q1Time)}
                      </TableCell>
                    )}
                    {(activeSessions.includes('all') || activeSessions.includes('Q2')) && (
                      <TableCell 
                        className={`text-right font-mono ${isFastestTime(baseDrivers, 'q2Time', driver.q2Time) ? 'text-blue-500 font-bold' : ''}`}
                      >
                        {formatTimeDisplay(driver.q2Time)}
                      </TableCell>
                    )}
                    {(activeSessions.includes('all') || activeSessions.includes('Q3')) && (
                      <TableCell 
                        className={`text-right font-mono ${isFastestTime(baseDrivers, 'q3Time', driver.q3Time) ? 'text-green-500 font-bold' : ''}`}
                      >
                        {formatTimeDisplay(driver.q3Time)}
                      </TableCell>
                        )}
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Comparison Year Table */}
        <div className="border rounded-lg overflow-hidden flex flex-col">
          <div className="mb-2 p-4 pb-0 flex-shrink-0">
            <h3 className="text-sm font-medium mb-2 text-blue-600">{comparisonYear} Drivers</h3>
            <div className="flex flex-wrap gap-2 mb-2">
              {comparisonDrivers.map(driver => (
                <button
                  key={`comp-${driver.code}`}
                  onClick={() => toggleComparisonDriver(driver.code)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                    selectedComparisonDrivers.includes(driver.code)
                      ? 'bg-blue-700 text-white'
                      : selectedComparisonDrivers.length > 0
                        ? 'bg-gray-200 text-gray-800'
                        : 'bg-blue-700/80 text-white'
                  }`}
                  style={{
                    borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666'}`
                  }}
                >
                  {selectedComparisonDrivers.includes(driver.code) && <Check className="h-3 w-3" />}
                  <span>{driver.code}</span>
                </button>
              ))}
            </div>
            {selectedComparisonDrivers.length > 0 && (
              <button 
                onClick={() => comparisonDrivers.forEach(d => {
                  if (selectedComparisonDrivers.includes(d.code)) {
                    toggleComparisonDriver(d.code);
                  }
                })}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
              >
                Clear selection (show all)
              </button>
            )}
          </div>
          
          <div className="overflow-auto flex-1 min-h-0">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-16 text-center">Pos</TableHead>
                  <TableHead className="w-20">Driver</TableHead>
                  <TableHead className="w-32">Team</TableHead>
                  {!positionView && (
                    <>
                  {(activeSessions.includes('all') || activeSessions.includes('Q1')) && (
                    <TableHead className="text-right">Q1 Time</TableHead>
                  )}
                  {(activeSessions.includes('all') || activeSessions.includes('Q2')) && (
                    <TableHead className="text-right">Q2 Time</TableHead>
                  )}
                  {(activeSessions.includes('all') || activeSessions.includes('Q3')) && (
                    <TableHead className="text-right">Q3 Time</TableHead>
                      )}
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {getVisibleComparisonDrivers().map(driver => (
                  <TableRow 
                    key={`comp-${driver.code}`}
                    className={`hover:bg-muted/50 ${
                      driver.code === (fastestLapTime?.driver || '') && 
                      driver.year === (fastestLapTime?.year || 0) 
                        ? "bg-blue-500/10 dark:bg-blue-500/10" 
                        : ""
                    }`}
                    onClick={() => toggleComparisonDriver(driver.code)}
                    style={{ cursor: "pointer" }}
                  >
                    <TableCell className="text-center font-medium">
                      {driver.position}
                    </TableCell>
                    <TableCell>
                      <div 
                        className="flex items-center gap-2"
                        style={{ borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666'}` }}
                      >
                        <span className="pl-2 font-medium">{driver.code}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground capitalize">
                        {driver.team.replace('_', ' ')}
                      </span>
                    </TableCell>
                    {!positionView && (
                      <>
                    {(activeSessions.includes('all') || activeSessions.includes('Q1')) && (
                      <TableCell 
                        className={`text-right font-mono ${isFastestTime(comparisonDrivers, 'q1Time', driver.q1Time) ? 'text-purple-500 font-bold' : ''}`}
                      >
                        {formatTimeDisplay(driver.q1Time)}
                      </TableCell>
                    )}
                    {(activeSessions.includes('all') || activeSessions.includes('Q2')) && (
                      <TableCell 
                        className={`text-right font-mono ${isFastestTime(comparisonDrivers, 'q2Time', driver.q2Time) ? 'text-blue-500 font-bold' : ''}`}
                      >
                        {formatTimeDisplay(driver.q2Time)}
                      </TableCell>
                    )}
                    {(activeSessions.includes('all') || activeSessions.includes('Q3')) && (
                      <TableCell 
                        className={`text-right font-mono ${isFastestTime(comparisonDrivers, 'q3Time', driver.q3Time) ? 'text-green-500 font-bold' : ''}`}
                      >
                        {formatTimeDisplay(driver.q3Time)}
                      </TableCell>
                        )}
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YearComparisonQualifyingChart; 
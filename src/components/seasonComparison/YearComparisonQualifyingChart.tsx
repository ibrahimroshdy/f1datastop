import { useState, useEffect } from "react";
import { useRaceQualifying, useRaceResults } from "@/hooks/useF1Data";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Check, Clock, Timer } from "lucide-react";
import TeamLogo from "@/components/common/TeamLogo";
import { useTheme } from "@/context/ThemeContext";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  ReferenceLine
} from "recharts";

type QualifyingSession = 'q1' | 'q2' | 'q3' | 'Q1' | 'Q2' | 'Q3' | 'all';

interface YearComparisonQualifyingChartProps {
  baseYear: number;
  baseRound: string;
  comparisonYear: number;
  comparisonRound: string;
  positionView?: boolean;
  chartView?: boolean;
}

interface QualifyingTableViewProps {
  baseYear: number;
  comparisonYear: number;
  baseCircuit: string;
  comparisonCircuit: string;
  baseData: QualifyingSession[];
  comparisonData: QualifyingSession[];
  toggleSession: (session: string) => void;
  selectedSession: string;
  formatTimeDisplay: (time: number) => string;
  theme: string;
  isChartTab?: boolean;
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
  clearBaseDrivers,
  clearComparisonDrivers,
  selectAllBaseDrivers,
  selectAllComparisonDrivers,
  formatTimeDisplay
}) => {
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
    <div className="h-full max-w-5xl mx-auto">
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
        
        {/* Updated session selector to match analytics styling */}
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
      
      {/* More compact driver selection UI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <h4 className="text-sm font-semibold mb-2 text-amber-600">{baseYear} Drivers</h4>
          <div className="flex flex-wrap gap-1 mb-1">
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
          <button 
            onClick={() => {
              if (selectedBaseDrivers.length > 0) {
                clearBaseDrivers();
              } else {
                selectAllBaseDrivers();
              }
            }}
            className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 underline"
          >
            {selectedBaseDrivers.length > 0 ? "Clear selection" : "Select all"}
          </button>
        </div>
        
        <div>
          <h4 className="text-sm font-semibold mb-2 text-blue-600">{comparisonYear} Drivers</h4>
          <div className="flex flex-wrap gap-1 mb-1">
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
          <button 
            onClick={() => {
              if (selectedComparisonDrivers.length > 0) {
                clearComparisonDrivers();
              } else {
                selectAllComparisonDrivers();
              }
            }}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
          >
            {selectedComparisonDrivers.length > 0 ? "Clear selection" : "Select all"}
          </button>
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
        <div className="h-[400px] w-full border rounded-lg p-2 overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={groupedChartData}
              margin={{ top: 10, right: 30, left: 10, bottom: 70 }}
              barGap={0}
              barCategoryGap={8}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis 
                dataKey="driverCode" 
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
                        fontSize={10}
                        fontWeight="bold"
                      >
                        {payload.value}
                      </text>
                    </g>
                  );
                }}
                height={50}
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
                wrapperStyle={{ paddingTop: 10 }}
                onClick={(data) => {
                  if (data.value === `${baseYear}`) {
                    if (selectedBaseDrivers.length > 0) {
                      clearBaseDrivers();
                    } else {
                      baseDrivers.forEach(d => toggleBaseDriver(d.code));
                    }
                  } else {
                    if (selectedComparisonDrivers.length > 0) {
                      clearComparisonDrivers();
                    } else {
                      comparisonDrivers.forEach(d => toggleComparisonDriver(d.code));
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
                barSize={16}
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
                barSize={16}
                activeBar={{ 
                  stroke: '#1d4ed8',
                  strokeWidth: 2,
                  fill: '#3b82f6'
                }}
              />
              
              {/* Enhanced fastest time reference line */}
              {fastestDriver && (
                <ReferenceLine 
                  y={fastestTime} 
                  stroke="#a855f7" 
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  ifOverflow="extendDomain"
                  label={{
                    value: `Fastest: ${fastestDriver.formattedTime} (${fastestDriver.name}, P${fastestDriver.position})`,
                    position: 'insideBottomRight',
                    fill: '#a855f7',
                    fontSize: 11,
                    fontWeight: 'bold',
                    offset: 5,
                    style: { 
                      backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)',
                      padding: '2px 4px',
                      borderRadius: '4px'
                    }
                  }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      
      <Alert className="mt-2 text-xs bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
        <Timer className="h-3 w-3" />
        <AlertDescription>
          Chart shows {selectedChartSession.toUpperCase()} times for the selected drivers. Fastest time is marked with a purple dotted line.
        </AlertDescription>
      </Alert>
    </div>
  );
};

const QualifyingTableView: React.FC<QualifyingTableViewProps> = ({
  baseYear,
  comparisonYear,
  baseCircuit,
  comparisonCircuit,
  baseData,
  comparisonData,
  toggleSession,
  selectedSession,
  formatTimeDisplay,
  theme,
  isChartTab = false
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center">
        <h2 className="text-lg font-semibold">Qualifying Comparison</h2>
        <div className="text-sm text-muted-foreground">
          <span>{baseYear} ({baseCircuit})</span> vs <span>{comparisonYear} ({comparisonCircuit})</span>
        </div>
      </div>

      {/* Session selector - updated styling to match analytics version */}
      <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg mb-4">
        {!isChartTab && (
          <button
            onClick={() => toggleSession('all')}
            className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              selectedSession === 'all'
                ? 'bg-gray-700 text-white'
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            All
          </button>
        )}
        <button
          onClick={() => toggleSession('Q1')}
          className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            selectedSession === 'q1' || selectedSession === 'Q1'
              ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800'
              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          Q1
        </button>
        <button
          onClick={() => toggleSession('Q2')}
          className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            selectedSession === 'q2' || selectedSession === 'Q2'
              ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          Q2
        </button>
        <button
          onClick={() => toggleSession('Q3')}
          className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            selectedSession === 'q3' || selectedSession === 'Q3'
              ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          Q3
        </button>
      </div>

      {/* ... rest of the component ... */}
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
  console.log("YearComparisonQualifyingChart rendering with props:", { 
    baseYear, baseRound, comparisonYear, comparisonRound, positionView, chartView 
  });

  const [baseDrivers, setBaseDrivers] = useState<any[]>([]);
  const [comparisonDrivers, setComparisonDrivers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'base' | 'comparison'>('base');
  const [activeSessions, setActiveSessions] = useState<QualifyingSession[]>(['all']);
  const [fastestLapTime, setFastestLapTime] = useState<{ time: number, driver: string, session: string, year: number } | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedChartSession, setSelectedChartSession] = useState<'q1' | 'q2' | 'q3'>('q3');
  const [selectedBaseDrivers, setSelectedBaseDrivers] = useState<string[]>([]);
  const [selectedComparisonDrivers, setSelectedComparisonDrivers] = useState<string[]>([]);
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
    isComparisonQualifyingLoading;

  const isError = !!baseQualifyingError || !!comparisonQualifyingError;

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

  // Format time for display
  const formatTimeDisplay = (seconds?: number): string => {
    if (!seconds) return "-";
    
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
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
    if (chartView && baseDrivers.length > 0 && comparisonDrivers.length > 0) {
      console.log("Preparing chart data for chart view mode...");
      
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
      
      console.log("Chart data prepared:", chartData);
      setChartData(chartData);
    }
  }, [baseDrivers, comparisonDrivers, selectedChartSession, baseYear, comparisonYear, chartView]);

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

  const isFastestTime = (drivers: any[], session: 'q1Time' | 'q2Time' | 'q3Time', time?: number): boolean => {
    if (!time) return false;
    
    const sessionTimes = drivers
      .map(driver => driver[session])
      .filter(t => t !== null && t !== undefined) as number[];
    
    if (sessionTimes.length === 0) return false;
    
    const fastestTime = Math.min(...sessionTimes);
    return time === fastestTime;
  };

  const getRaceCircuitName = (results: any) => {
    if (!results?.data) return "";
    return results.data.Circuit?.circuitName || results.data.raceName || "";
  };

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

  // Toggle driver selection - for chart interaction
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

  // Clear driver selections
  const clearBaseDrivers = () => {
    setSelectedBaseDrivers([]);
  };
  
  const clearComparisonDrivers = () => {
    setSelectedComparisonDrivers([]);
  };

  // Select all drivers functions
  const selectAllBaseDrivers = () => {
    const driverCodes = baseDrivers.map(d => d.code);
    setSelectedBaseDrivers(driverCodes);
  };

  const selectAllComparisonDrivers = () => {
    const driverCodes = comparisonDrivers.map(d => d.code);
    setSelectedComparisonDrivers(driverCodes);
  };

  // Display loading state while data is being fetched
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading qualifying data...</p>
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

  // Display error message if data fetching failed
  if (isError) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load qualifying data. This could be because qualifying data is not available for this race yet.
        </AlertDescription>
      </Alert>
    );
  }

  // If no data is available
  if (
    (!baseQualifying?.data?.QualifyingResults || baseQualifying.data.QualifyingResults.length === 0) &&
    (!comparisonQualifying?.data?.QualifyingResults || comparisonQualifying.data.QualifyingResults.length === 0)
  ) {
    return (
      <Alert className="my-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No qualifying data available for the selected races.
        </AlertDescription>
      </Alert>
    );
  }

  // Render chart view if chartView is true
  if (chartView) {
    console.log("Rendering chart view with chartData length:", chartData.length);
    const baseCircuit = getRaceCircuitName(baseQualifying);
    const comparisonCircuit = getRaceCircuitName(comparisonQualifying);
    
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
        clearBaseDrivers={clearBaseDrivers}
        clearComparisonDrivers={clearComparisonDrivers}
        selectAllBaseDrivers={selectAllBaseDrivers}
        selectAllComparisonDrivers={selectAllComparisonDrivers}
        formatTimeDisplay={formatTimeDisplay}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'base' | 'comparison')}>
        <TabsList className="mb-4">
          <TabsTrigger value="base">
            {baseYear} - {getRaceCircuitName(baseQualifying)}
          </TabsTrigger>
          <TabsTrigger value="comparison">
            {comparisonYear} - {getRaceCircuitName(comparisonQualifying)}
          </TabsTrigger>
        </TabsList>

        {!positionView && (
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge 
              variant={activeSessions.includes('all') ? "default" : "outline"} 
              className="cursor-pointer"
              onClick={() => toggleSession('all')}
            >
              All Sessions
            </Badge>
            <Badge 
              variant={activeSessions.includes('q1') ? "default" : "outline"} 
              className="cursor-pointer"
              onClick={() => toggleSession('q1')}
            >
              Q1
            </Badge>
            <Badge 
              variant={activeSessions.includes('q2') ? "default" : "outline"} 
              className="cursor-pointer"
              onClick={() => toggleSession('q2')}
            >
              Q2
            </Badge>
            <Badge 
              variant={activeSessions.includes('q3') ? "default" : "outline"} 
              className="cursor-pointer"
              onClick={() => toggleSession('q3')}
            >
              Q3
            </Badge>
          </div>
        )}
        
        {fastestLapTime && !positionView && (
          <div className="text-sm mb-4">
            <span className="font-medium">Fastest time: </span>
            <span className="text-amber-500">{formatTimeDisplay(fastestLapTime.time)}</span>
            <span> by {fastestLapTime.driver} ({fastestLapTime.session}, {fastestLapTime.year})</span>
          </div>
        )}

        <TabsContent value="base">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-16">Pos</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Team</TableHead>
                  {!positionView && (
                    <>
                      {(activeSessions.includes('all') || activeSessions.includes('q1')) && (
                        <TableHead>Q1</TableHead>
                      )}
                      {(activeSessions.includes('all') || activeSessions.includes('q2')) && (
                        <TableHead>Q2</TableHead>
                      )}
                      {(activeSessions.includes('all') || activeSessions.includes('q3')) && (
                        <TableHead>Q3</TableHead>
                      )}
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {baseDrivers.map((driver) => (
                  <TableRow key={`base-${driver.driverId}`}>
                    <TableCell className="font-medium">{driver.position}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-1 h-6 rounded-sm mr-1"
                          style={{ backgroundColor: TEAM_COLORS[driver.team] || '#666666' }}
                        ></div>
                        <span>{driver.name}</span>
                        <Badge variant="outline" className="ml-1">{driver.code}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <TeamLogo constructorId={driver.team} size="sm" />
                      </div>
                    </TableCell>
                    {!positionView && (
                      <>
                        {(activeSessions.includes('all') || activeSessions.includes('q1')) && (
                          <TableCell className={
                            isFastestTime(baseDrivers, 'q1Time', driver.q1Time) ? 'text-purple-500 font-bold' : ''
                          }>
                            {driver.q1Time ? formatTimeDisplay(driver.q1Time) : '-'}
                          </TableCell>
                        )}
                        {(activeSessions.includes('all') || activeSessions.includes('q2')) && (
                          <TableCell className={
                            isFastestTime(baseDrivers, 'q2Time', driver.q2Time) ? 'text-purple-500 font-bold' : ''
                          }>
                            {driver.q2Time ? formatTimeDisplay(driver.q2Time) : '-'}
                          </TableCell>
                        )}
                        {(activeSessions.includes('all') || activeSessions.includes('q3')) && (
                          <TableCell className={
                            isFastestTime(baseDrivers, 'q3Time', driver.q3Time) ? 'text-purple-500 font-bold' : ''
                          }>
                            {driver.q3Time ? formatTimeDisplay(driver.q3Time) : '-'}
                          </TableCell>
                        )}
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="comparison">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-16">Pos</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Team</TableHead>
                  {!positionView && (
                    <>
                      {(activeSessions.includes('all') || activeSessions.includes('q1')) && (
                        <TableHead>Q1</TableHead>
                      )}
                      {(activeSessions.includes('all') || activeSessions.includes('q2')) && (
                        <TableHead>Q2</TableHead>
                      )}
                      {(activeSessions.includes('all') || activeSessions.includes('q3')) && (
                        <TableHead>Q3</TableHead>
                      )}
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonDrivers.map((driver) => (
                  <TableRow key={`comparison-${driver.driverId}`}>
                    <TableCell className="font-medium">{driver.position}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-1 h-6 rounded-sm mr-1"
                          style={{ backgroundColor: TEAM_COLORS[driver.team] || '#666666' }}
                        ></div>
                        <span>{driver.name}</span>
                        <Badge variant="outline" className="ml-1">{driver.code}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <TeamLogo constructorId={driver.team} size="sm" />
                      </div>
                    </TableCell>
                    {!positionView && (
                      <>
                        {(activeSessions.includes('all') || activeSessions.includes('q1')) && (
                          <TableCell className={
                            isFastestTime(comparisonDrivers, 'q1Time', driver.q1Time) ? 'text-purple-500 font-bold' : ''
                          }>
                            {driver.q1Time ? formatTimeDisplay(driver.q1Time) : '-'}
                          </TableCell>
                        )}
                        {(activeSessions.includes('all') || activeSessions.includes('q2')) && (
                          <TableCell className={
                            isFastestTime(comparisonDrivers, 'q2Time', driver.q2Time) ? 'text-purple-500 font-bold' : ''
                          }>
                            {driver.q2Time ? formatTimeDisplay(driver.q2Time) : '-'}
                          </TableCell>
                        )}
                        {(activeSessions.includes('all') || activeSessions.includes('q3')) && (
                          <TableCell className={
                            isFastestTime(comparisonDrivers, 'q3Time', driver.q3Time) ? 'text-purple-500 font-bold' : ''
                          }>
                            {driver.q3Time ? formatTimeDisplay(driver.q3Time) : '-'}
                          </TableCell>
                        )}
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default YearComparisonQualifyingChart; 
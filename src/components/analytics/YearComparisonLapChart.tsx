
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
  const [displayMode, setDisplayMode] = useState<'absolute' | 'gap'>('absolute');
  const [isProcessingData, setIsProcessingData] = useState(false);
  
  // Fetch results and lap times for base year
  const { 
    data: baseResults,
    isLoading: isBaseResultsLoading
  } = useRaceResults(baseYear, baseRound);
  
  const {
    data: baseLapTimes,
    isLoading: isBaseLapTimesLoading
  } = useLapTimes(baseYear, baseRound);
  
  // Fetch results and lap times for comparison year
  const { 
    data: comparisonResults,
    isLoading: isComparisonResultsLoading
  } = useRaceResults(comparisonYear, comparisonRound);
  
  const {
    data: comparisonLapTimes,
    isLoading: isComparisonLapTimesLoading
  } = useLapTimes(comparisonYear, comparisonRound);
  
  const isLoading = 
    isBaseResultsLoading || 
    isBaseLapTimesLoading || 
    isComparisonResultsLoading || 
    isComparisonLapTimesLoading ||
    isProcessingData;

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
        
        setChartData(processedData);
      } catch (error) {
        console.error("Error processing lap time data:", error);
        toast.error("Error processing lap time data");
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

  const toggleDisplayMode = () => {
    setDisplayMode(prev => prev === 'absolute' ? 'gap' : 'absolute');
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
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p className="text-muted-foreground">Loading lap time data...</p>
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
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleDisplayMode}
            className="px-3 py-1 text-xs font-medium rounded bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            Show {displayMode === 'absolute' ? 'Gaps' : 'Absolute Times'}
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
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="lap" label={{ value: 'Lap Number', position: 'insideBottomRight', offset: -10 }} />
            <YAxis 
              label={{ 
                value: displayMode === 'absolute' ? 'Lap Time (seconds)' : 'Gap to Fastest (seconds)', 
                angle: -90, 
                position: 'insideLeft' 
              }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1a1a1a',
                borderColor: '#333',
                borderRadius: '5px'
              }}
              formatter={(value: any, name: string) => {
                if (typeof value === 'number') {
                  return formatTime(value);
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
                  strokeDasharray={driver.finishPosition === 1 ? "0" : "5 5"}
                  strokeWidth={driver.finishPosition === 1 ? 3 : 2}
                  dot={{ r: 2, fill: `#f59e0b` }}
                  activeDot={{ r: 6 }}
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
                  strokeDasharray={driver.finishPosition === 1 ? "0" : "5 5"}
                  strokeWidth={driver.finishPosition === 1 ? 3 : 2}
                  dot={{ r: 2, fill: `#3b82f6` }}
                  activeDot={{ r: 6 }}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default YearComparisonLapChart;

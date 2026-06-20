import React, { useMemo } from 'react';
import { Trophy, Loader2, AlertCircle, Medal } from 'lucide-react';
import { useLapData, useDrivers, useOpenF1SessionFromErgast, usePositionData } from "@/hooks/useOpenF1Data";
import { formatTime } from "@/utils/lapTimeUtils";
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";

interface SessionResultsProps {
  year: number;
  round: string;
  sessionType?: string;
  sessionKey?: number;
  sessionName?: string;
}

interface ProcessedResult {
  id: number;
  position: number;
  driver_number: number;
  driver_name: string;
  driver_acronym: string;
  constructor_name: string;
  best_lap_time: number | null;
  gap_to_leader: number;
  total_laps: number;
  team_color: string;
}

// Team colors mapping
const teamColors: { [key: string]: string } = {
  "Red Bull Racing": "#3671C6",
  "Ferrari": "#E8002D",
  "Mercedes": "#27F4D2",
  "McLaren": "#FF8000",
  "Aston Martin": "#229971",
  "Alpine": "#FF87BC",
  "Williams": "#64C4FF",
  "RB": "#6692FF",
  "Haas F1 Team": "#B6BABD",
  "Kick Sauber": "#52E252"
};

const SessionResults: React.FC<SessionResultsProps> = ({
  year,
  round,
  sessionType = "Race",
  sessionKey: externalSessionKey
}) => {
  const { baseTheme } = useTheme();
  const isDark = baseTheme === 'dark';

  const { 
    data: sessionData, 
    isLoading: isSessionLoading 
  } = useOpenF1SessionFromErgast(
    externalSessionKey ? 0 : year, 
    externalSessionKey ? "" : round, 
    externalSessionKey ? "" : sessionType
  );

  const effectiveSessionKey = externalSessionKey || sessionData?.data?.session_key || 0;

  const {
    data: driversData,
    isLoading: isDriversLoading
  } = useDrivers(effectiveSessionKey);

  const {
    data: lapData,
    isLoading: isLapDataLoading,
    error: lapDataError
  } = useLapData(effectiveSessionKey);

  const {
    data: positionData,
    isLoading: isPositionDataLoading,
    error: positionDataError
  } = usePositionData(effectiveSessionKey);

  const processedResults = useMemo<ProcessedResult[]>(() => {
    if (!positionData?.data || !driversData?.data || !lapData?.data) return [];

    const driverResults: { [key: number]: ProcessedResult } = {};
    
    driversData.data.forEach((driver: any) => {
      driverResults[driver.driver_number] = {
        id: driver.driver_number,
        position: 0,
        driver_number: driver.driver_number,
        driver_name: `${driver.first_name} ${driver.last_name}`,
        driver_acronym: driver.name_acronym || `${driver.first_name?.charAt(0)}${driver.last_name?.charAt(0)}`,
        constructor_name: driver.team_name || 'Unknown',
        best_lap_time: null,
        gap_to_leader: 0,
        total_laps: 0,
        team_color: teamColors[driver.team_name] || '#666666'
      };
    });

    lapData.data.forEach((lap: any) => {
      const driverNumber = lap.driver_number;
      if (!driverResults[driverNumber]) return;

      const result = driverResults[driverNumber];
      result.total_laps++;

      if (lap.lap_duration && (result.best_lap_time === null || lap.lap_duration < result.best_lap_time)) {
        result.best_lap_time = lap.lap_duration;
      }
    });

    const finalPositions: { [key: number]: { position: number; date: string } } = {};
    
    positionData.data.forEach((position: any) => {
      const driverNumber = position.driver_number;
      const positionValue = position.position;
      
      if (!finalPositions[driverNumber] || position.date > finalPositions[driverNumber].date) {
        finalPositions[driverNumber] = {
          position: positionValue,
          date: position.date
        };
      }
    });

    Object.keys(driverResults).forEach(driverNumberStr => {
      const driverNumber = parseInt(driverNumberStr);
      const finalPos = finalPositions[driverNumber];
      if (finalPos) {
        driverResults[driverNumber].position = finalPos.position;
      }
    });

    const resultsArray = Object.values(driverResults)
      .filter(result => result.position > 0)
      .sort((a, b) => a.position - b.position);

    const fastestTime = resultsArray[0]?.best_lap_time || 0;
    resultsArray.forEach((result) => {
      if (result.best_lap_time && fastestTime) {
        result.gap_to_leader = result.best_lap_time - fastestTime;
      }
    });

    return resultsArray;
  }, [positionData, lapData, driversData]);

  const isLoading = isSessionLoading || isDriversLoading || isLapDataLoading || isPositionDataLoading;

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
        <p className="text-sm text-muted-foreground">Loading results...</p>
      </div>
    );
  }

  if (lapDataError || positionDataError || !effectiveSessionKey) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">Results unavailable</p>
        <p className="text-sm text-muted-foreground mt-1">
          {lapDataError || positionDataError ? 'Failed to load session results' : 'No session data available'}
        </p>
      </div>
    );
  }

  if (processedResults.length === 0) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center p-4 text-center">
        <Trophy className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No results available for this session</p>
      </div>
    );
  }

  const podiumResults = processedResults.slice(0, 3);
  const otherResults = processedResults.slice(3);

  return (
    <div className="space-y-4">
      {/* Podium Section */}
      <div className="flex items-end justify-center gap-3 h-36">
        {/* P2 */}
        {podiumResults[1] && (
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            <div 
              className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-sm mb-2 shadow-lg"
              style={{ backgroundColor: podiumResults[1].team_color }}
            >
              {podiumResults[1].driver_acronym}
            </div>
            <div className={cn(
              "w-16 h-16 rounded-t-lg flex flex-col items-center justify-center",
              isDark ? "bg-gradient-to-b from-slate-400 to-slate-600" : "bg-gradient-to-b from-slate-300 to-slate-500"
            )}>
              <span className="text-xl font-bold text-white">2</span>
              <span className="text-[9px] text-white/80 font-mono">
                {podiumResults[1].best_lap_time ? formatTime(podiumResults[1].best_lap_time) : '--'}
              </span>
            </div>
          </div>
        )}
        
        {/* P1 */}
        {podiumResults[0] && (
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Trophy className="h-5 w-5 text-yellow-500 mb-1" />
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold mb-2 shadow-lg ring-4 ring-yellow-500"
              style={{ backgroundColor: podiumResults[0].team_color }}
            >
              {podiumResults[0].driver_acronym}
            </div>
            <div className="w-20 h-24 rounded-t-lg flex flex-col items-center justify-center bg-gradient-to-b from-yellow-400 to-yellow-600">
              <span className="text-2xl font-bold text-white">1</span>
              <span className="text-[9px] text-white/90 font-mono font-medium">
                {podiumResults[0].best_lap_time ? formatTime(podiumResults[0].best_lap_time) : '--'}
              </span>
            </div>
          </div>
        )}
        
        {/* P3 */}
        {podiumResults[2] && (
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            <div 
              className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-sm mb-2 shadow-lg"
              style={{ backgroundColor: podiumResults[2].team_color }}
            >
              {podiumResults[2].driver_acronym}
            </div>
            <div className={cn(
              "w-16 h-12 rounded-t-lg flex flex-col items-center justify-center",
              isDark ? "bg-gradient-to-b from-amber-600 to-amber-800" : "bg-gradient-to-b from-amber-500 to-amber-700"
            )}>
              <span className="text-lg font-bold text-white">3</span>
              <span className="text-[9px] text-white/80 font-mono">
                {podiumResults[2].best_lap_time ? formatTime(podiumResults[2].best_lap_time) : '--'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Rest of Results - Grid Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {otherResults.map((result, idx) => (
          <div
            key={result.id}
            className={cn(
              "relative rounded-lg overflow-hidden transition-all animate-in fade-in slide-in-from-bottom-2",
              isDark ? "bg-zinc-900 hover:bg-zinc-800" : "bg-white border border-slate-200 hover:border-slate-300"
            )}
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            {/* Team Color Strip */}
            <div 
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: result.team_color }}
            />
            
            <div className="p-2.5 pl-3.5">
              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-lg font-bold",
                  isDark ? "text-zinc-400" : "text-slate-500"
                )}>
                  {result.position}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {result.best_lap_time ? formatTime(result.best_lap_time) : '--'}
                </span>
              </div>
              <div className="font-bold text-sm mt-0.5">{result.driver_acronym}</div>
              <div className="text-[10px] text-muted-foreground truncate">{result.constructor_name}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Fastest Lap Badge */}
      {processedResults[0]?.best_lap_time && (
        <div className="flex justify-center">
          <Badge variant="outline" className="text-xs px-3 py-1 gap-1.5 bg-purple-500/10 text-purple-500 border-purple-500/30">
            <Medal className="h-3 w-3" />
            Fastest: {processedResults.sort((a, b) => (a.best_lap_time || 999) - (b.best_lap_time || 999))[0]?.driver_acronym} - {formatTime(processedResults.sort((a, b) => (a.best_lap_time || 999) - (b.best_lap_time || 999))[0]?.best_lap_time || 0)}
          </Badge>
        </div>
      )}
    </div>
  );
};

export default SessionResults;

import { useState, useEffect, useMemo } from "react";
import { useRaceQualifying } from "@/hooks/useF1Data";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { toast } from "sonner";

export interface Driver {
  driverId: string;
  code: string;
  name: string;
  team: string;
  position: number;
  q1Time?: number;
  q2Time?: number;
  q3Time?: number;
}

export type QualifyingSession = 'Q1' | 'Q2' | 'Q3' | 'all';

export const useQualifyingData = (year: number, round: string) => {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [activeSessions, setActiveSessions] = useState<QualifyingSession[]>(['all']);
  const [fastestLapTime, setFastestLapTime] = useState<{ time: number, driver: string, session: QualifyingSession } | null>(null);
  const [isProcessingData, setIsProcessingData] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use React Query hook for qualifying data
  const { 
    data: qualifyingData, 
    isLoading,
    error,
    isError
  } = useRaceQualifying(year, round);

  // Process qualifying data
  useEffect(() => {
    if (qualifyingData?.data?.QualifyingResults && qualifyingData.data.QualifyingResults.length > 0) {
      setIsProcessingData(true);
      setTimeout(() => {
        try {
          const drivers = qualifyingData.data.QualifyingResults.map((result: any) => {
            // Parse qualifying times
            const q1Time = result.Q1 ? convertLapTimeToSeconds(result.Q1) : undefined;
            const q2Time = result.Q2 ? convertLapTimeToSeconds(result.Q2) : undefined;
            const q3Time = result.Q3 ? convertLapTimeToSeconds(result.Q3) : undefined;
            
            return {
              driverId: result.Driver.driverId,
              code: result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase(),
              name: `${result.Driver.givenName} ${result.Driver.familyName}`,
              team: result.Constructor?.constructorId || "unknown",
              position: parseInt(result.position) || 0,
              q1Time,
              q2Time,
              q3Time
            };
          });
          
          setAvailableDrivers(drivers);
          
          // Auto-select pole position and P2 by default
          if (drivers.length > 0) {
            const poleDriver = drivers.find(d => d.position === 1);
            const p2Driver = drivers.find(d => d.position === 2);
            
            const defaultSelected = [];
            if (poleDriver) defaultSelected.push(poleDriver.code);
            if (p2Driver) defaultSelected.push(p2Driver.code);
            
            setSelectedDrivers(defaultSelected.length > 0 ? defaultSelected : [drivers[0].code]);
          }

          // Find fastest qualifying time across all sessions
          let fastestDriver = null;
          let fastestTime = Number.MAX_VALUE;
          let fastestSession: QualifyingSession = 'Q3';

          drivers.forEach(driver => {
            if (driver.q3Time && driver.q3Time < fastestTime) {
              fastestTime = driver.q3Time;
              fastestDriver = driver.code;
              fastestSession = 'Q3';
            }
            if (driver.q2Time && driver.q2Time < fastestTime) {
              fastestTime = driver.q2Time;
              fastestDriver = driver.code;
              fastestSession = 'Q2';
            }
            if (driver.q1Time && driver.q1Time < fastestTime) {
              fastestTime = driver.q1Time;
              fastestDriver = driver.code;
              fastestSession = 'Q1';
            }
          });

          if (fastestDriver) {
            setFastestLapTime({ 
              time: fastestTime,
              driver: fastestDriver,
              session: fastestSession
            });
          }
          
          setIsProcessingData(false);
        } catch (err) {
          console.error('Error processing qualifying data:', err);
          setIsProcessingData(false);
          setErrorMessage('Error processing qualifying data');
        }
      }, 0);
    }
  }, [qualifyingData]);

  const handleDriverToggle = (driverCode: string) => {
    setSelectedDrivers(prev => 
      prev.includes(driverCode)
        ? prev.filter(d => d !== driverCode)
        : [...prev, driverCode]
    );
  };

  const handleDriverHover = (driverCode: string | null) => {
    setHoveredDriver(driverCode);
  };

  const handleSessionToggle = (session: QualifyingSession) => {
    if (session === 'all') {
      setActiveSessions(['all']);
    } else {
      setActiveSessions(prev => {
        // Remove 'all' if it was selected and we're selecting a specific session
        const withoutAll = prev.filter(s => s !== 'all');
        
        // Toggle the session
        const isSessionActive = withoutAll.includes(session);
        const updatedSessions = isSessionActive 
          ? withoutAll.filter(s => s !== session)
          : [...withoutAll, session];
        
        // If no sessions selected, default to 'all'
        return updatedSessions.length === 0 ? ['all'] : updatedSessions;
      });
    }
  };

  // Calculate visible drivers (either all selected or just the hovered one)
  const visibleDrivers = useMemo(() => {
    if (hoveredDriver) {
      return selectedDrivers.includes(hoveredDriver) ? [hoveredDriver] : selectedDrivers;
    }
    return selectedDrivers;
  }, [hoveredDriver, selectedDrivers]);

  // Function to convert lap time string (e.g. "1:15.912") to seconds
  const convertLapTimeToSeconds = (timeStr: string): number | null => {
    if (!timeStr) return null;
    
    // Handle format 'M:SS.sss'
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const minutes = parseFloat(parts[0]);
      const seconds = parseFloat(parts[1]);
      return minutes * 60 + seconds;
    }
    
    // If just a number is provided, assume it's seconds
    return parseFloat(timeStr);
  };

  // Generate chart data
  const chartData = useMemo(() => {
    if (!availableDrivers.length || !fastestLapTime) {
      return { q1Data: [], q2Data: [], q3Data: [] };
    }

    const showAll = activeSessions.includes('all');
    const showQ1 = showAll || activeSessions.includes('Q1');
    const showQ2 = showAll || activeSessions.includes('Q2');
    const showQ3 = showAll || activeSessions.includes('Q3');
    
    // Create data points for each qualifying session
    const q1Data = [];
    const q2Data = [];
    const q3Data = [];
    
    for (const driver of availableDrivers) {
      // Only include selected drivers
      if (!selectedDrivers.includes(driver.code)) continue;
      
      // Q1 data
      if (showQ1 && driver.q1Time) {
        q1Data.push({
          driver: driver.code,
          position: driver.position,
          time: driver.q1Time,
          session: 'Q1'
        });
      }
      
      // Q2 data
      if (showQ2 && driver.q2Time) {
        q2Data.push({
          driver: driver.code,
          position: driver.position,
          time: driver.q2Time,
          session: 'Q2'
        });
      }
      
      // Q3 data
      if (showQ3 && driver.q3Time) {
        q3Data.push({
          driver: driver.code,
          position: driver.position,
          time: driver.q3Time,
          session: 'Q3'
        });
      }
    }
    
    return { q1Data, q2Data, q3Data };
  }, [availableDrivers, selectedDrivers, activeSessions, fastestLapTime]);

  return {
    availableDrivers,
    selectedDrivers,
    activeSessions,
    hoveredDriver,
    visibleDrivers,
    chartData,
    fastestLapTime,
    isLoading,
    isProcessingData,
    isError,
    error,
    errorMessage,
    handleDriverToggle,
    handleDriverHover,
    handleSessionToggle,
    convertLapTimeToSeconds,
  };
}; 
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Headphones, Play, Pause, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOpenF1SessionFromErgast, useTeamRadio, useDrivers } from "@/hooks/useOpenF1Data";
import { format } from 'date-fns';
import DriverSelectionPanel from './DriverSelectionPanel';
import { Driver } from '@/hooks/useTelemetryData';

interface TeamRadioProps {
  year: number;
  round: string;
  sessionType?: string;
  sessionKey?: number;
}

const TeamRadio: React.FC<TeamRadioProps> = ({
  year,
  round,
  sessionType = "Race",
  sessionKey: externalSessionKey
}) => {
  const [selectedDrivers, setSelectedDrivers] = useState<number[]>([]);
  const [currentRadio, setCurrentRadio] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // After the useState declarations, add this hook to reset state when session changes
  useEffect(() => {
    // Reset selected drivers and audio playback when session changes
    setSelectedDrivers([]);
    setCurrentRadio(null);
    setIsPlaying(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    console.log("Session changed in TeamRadio to:", externalSessionKey);
  }, [externalSessionKey]);
  
  // Get the OpenF1 session directly only if we don't have an external session key
  const { 
    data: sessionData, 
    isLoading: isSessionLoading 
  } = useOpenF1SessionFromErgast(
    externalSessionKey ? 0 : year, 
    externalSessionKey ? "" : round, 
    externalSessionKey ? "" : sessionType
  );
  
  // Use the external session key if provided, otherwise use the one from the hook
  const effectiveSessionKey = externalSessionKey || sessionData?.data?.session_key || 0;
  
  // Get drivers for the session
  const {
    data: driversData,
    isLoading: isDriversLoading
  } = useDrivers(effectiveSessionKey);
  
  // Get team radio for selected drivers
  const {
    data: radioData,
    isLoading: isRadioLoading,
    error: radioError,
    refetch: refetchRadio
  } = useTeamRadio(
    effectiveSessionKey, 
    selectedDrivers.length === 0 ? undefined : selectedDrivers[0]
  );
  
  // Process available drivers
  useEffect(() => {
    if (driversData?.data && driversData.data.length > 0) {
      // Auto-select first driver if none selected
      if (selectedDrivers.length === 0) {
        setSelectedDrivers([driversData.data[0].driver_number]);
      }
    }
  }, [driversData, selectedDrivers]);
  
  // Handle driver selection
  const toggleDriverSelection = (driverNumber: number) => {
    // Only allow one driver at a time for radio
    setSelectedDrivers([driverNumber]);
    
    // Stop current playback
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setCurrentRadio(null);
    }
  };
  
  // Play team radio
  const playRadio = (url: string) => {
    if (audioRef.current) {
      if (currentRadio === url && isPlaying) {
        // Pause if already playing this radio
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Play new radio or resume paused
        if (currentRadio !== url) {
          audioRef.current.src = url;
          setCurrentRadio(url);
        }
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(err => console.error("Error playing audio:", err));
      }
    }
  };
  
  // Organize radio messages by driver
  const radioMessages = React.useMemo(() => {
    if (!radioData?.data || radioData.data.length === 0) return [];
    
    // Sort messages chronologically
    return [...radioData.data].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [radioData]);
  
  // Get driver info by number
  const getDriverInfo = (driverNumber: number) => {
    if (!driversData?.data) return null;
    return driversData.data.find(d => d.driver_number === driverNumber);
  };
  
  const teamColors: { [key: string]: string } = {
    "Red Bull Racing": "#0600EF",
    "Ferrari": "#DC0000",
    "Mercedes": "#00D2BE",
    "McLaren": "#FF8700",
    "Aston Martin": "#006F62",
    "Alpine": "#0090FF", 
    "Williams": "#005AFF",
    "RB": "#1E41FF",
    "Haas F1 Team": "#FFFFFF",
    "Kick Sauber": "#900000"
  };
  
  // Map API drivers to our Driver interface
  const mappedDrivers = React.useMemo(() => {
    if (!driversData?.data) return [];
    
    return driversData.data.map((driver: any) => ({
      driver_number: driver.driver_number,
      name: `${driver.first_name} ${driver.last_name}`,
      team_name: driver.team_name || "Unknown Team",
      team_color: teamColors[driver.team_name] || "#CCCCCC",
      name_acronym: driver.name_acronym,
      isLoading: false,
      isDataLoaded: false
    })) as Driver[];
  }, [driversData]);
  
  // Create a driverData object to show checkmarks in DriverSelectionPanel
  const driverData = React.useMemo(() => {
    const result: { [key: number]: any } = {};
    
    // Mark selected drivers as having data
    selectedDrivers.forEach(driverNum => {
      result[driverNum] = { length: 1 }; // Minimal data to trigger the checkmark
    });
    
    return result;
  }, [selectedDrivers]);
  
  const isLoading = isSessionLoading || isDriversLoading || isRadioLoading;
  const hasError = !!radioError || (!isLoading && !effectiveSessionKey);
  const hasNoData = !isLoading && (!radioData?.data || radioData.data.length === 0);
  
  return (
    <Card className="flex flex-col" style={{ height: '550px' }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5" />
            Team Radio
          </CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : hasError ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              {radioError?.toString() || "No OpenF1 radio data available for this race."}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {year >= new Date().getFullYear() ? 
                `${new Date().getFullYear()} season data is not yet fully available in the OpenF1 API. Please check back later or select a previous season.` :
                "Team radio data is only available for recent races (2023 onwards)."}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 shrink-0">
              <div className="mb-2 text-sm text-muted-foreground">
                Select a driver to view their team radio:
              </div>
              <DriverSelectionPanel 
                drivers={mappedDrivers}
                selectedDrivers={selectedDrivers}
                onToggleDriver={toggleDriverSelection}
                multiSelect={false}
                driverData={driverData}
              />
            </div>
            
            {hasNoData ? (
              <div className="py-8 text-center flex-1 flex flex-col items-center justify-center">
                <p className="text-muted-foreground">No team radio available for this driver.</p>
                {year >= new Date().getFullYear() && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {new Date().getFullYear()} season data is still being collected and may not be complete.
                  </p>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => refetchRadio()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            ) : (
              <>
                <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />
                
                <ScrollArea className="flex-1 h-[320px] rounded-md border">
                  <div className="space-y-3 p-4">
                    {radioMessages.map((message, idx) => {
                      const driver = getDriverInfo(message.driver_number);
                      const messageDate = new Date(message.date);
                      const formattedTime = format(messageDate, 'HH:mm:ss');
                      
                      return (
                        <div 
                          key={idx} 
                          className={`
                            p-3 rounded-md border flex items-start justify-between
                            ${currentRadio === message.recording_url ? 'bg-primary/5 border-primary' : 'bg-card'}
                          `}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-primary/10 px-2 py-0.5 rounded font-mono">
                                {formattedTime}
                              </span>
                              <span className="text-xs font-medium">
                                {driver?.name_acronym || `Driver ${message.driver_number}`}
                              </span>
                            </div>
                          </div>
                          
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => playRadio(message.recording_url)}
                          >
                            {currentRadio === message.recording_url && isPlaying ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                
                <div className="text-xs text-muted-foreground mt-4 text-center shrink-0">
                  Click the play button to listen to team radio messages
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Helper to determine if a color is light or dark for text contrast
const isColorLight = (color: string): boolean => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
};

export default TeamRadio; 
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Headphones, Play, Pause, RefreshCw, Volume2, Loader2, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOpenF1SessionFromErgast, useTeamRadio, useDrivers } from "@/hooks/useOpenF1Data";
import { format } from 'date-fns';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

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
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);
  const [currentRadio, setCurrentRadio] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isGlass } = useTheme();
  
  // Reset state when session changes
  useEffect(() => {
    setSelectedDriver(null);
    setCurrentRadio(null);
    setIsPlaying(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
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
  
  // Get team radio for selected driver
  const {
    data: radioData,
    isLoading: isRadioLoading,
    error: radioError,
    refetch: refetchRadio
  } = useTeamRadio(effectiveSessionKey, selectedDriver || undefined);
  
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
  
  // Process available drivers
  const drivers = useMemo(() => {
    if (!driversData?.data) return [];
    return driversData.data.map((driver: any) => ({
      number: driver.driver_number,
      code: driver.name_acronym || `${driver.first_name?.charAt(0)}${driver.last_name?.charAt(0)}`,
      name: `${driver.first_name} ${driver.last_name}`,
      team: driver.team_name || "Unknown",
      color: teamColors[driver.team_name] || "#666666"
    }));
  }, [driversData]);
  
  // Auto-select first driver if none selected
  useEffect(() => {
    if (drivers.length > 0 && !selectedDriver) {
      setSelectedDriver(drivers[0].number);
    }
  }, [drivers, selectedDriver]);
  
  // Sort radio messages chronologically
  const radioMessages = useMemo(() => {
    if (!radioData?.data || radioData.data.length === 0) return [];
    return [...radioData.data].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [radioData]);
  
  // Get current driver info
  const currentDriverInfo = useMemo(() => {
    return drivers.find(d => d.number === selectedDriver);
  }, [drivers, selectedDriver]);
  
  // Play team radio
  const playRadio = (url: string) => {
    if (audioRef.current) {
      if (currentRadio === url && isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
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
  
  const isLoading = isSessionLoading || isDriversLoading;
  const hasError = !!radioError || (!isLoading && !effectiveSessionKey);
  const hasNoData = !isLoading && !isRadioLoading && (!radioData?.data || radioData.data.length === 0);

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
        <p className="text-sm text-muted-foreground">Loading team radio...</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center p-4 text-center">
        <Radio className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">Team radio unavailable</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {year >= new Date().getFullYear() 
            ? "Current season data may not be available yet"
            : "Team radio is only available for races from 2023 onwards"}
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Driver Selection Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
        {drivers.map((driver) => (
          <button
            key={driver.number}
            onClick={() => {
              setSelectedDriver(driver.number);
              if (audioRef.current) {
                audioRef.current.pause();
                setIsPlaying(false);
                setCurrentRadio(null);
              }
            }}
            className={cn(
              "relative flex flex-col items-center justify-center p-1.5 rounded-md transition-all",
              "border text-xs font-medium",
              selectedDriver === driver.number
                ? "border-primary/50 bg-primary/10"
                : isGlass 
                  ? "border-white/10 bg-white/5 hover:bg-white/10"
                  : "border-border bg-muted/30 hover:bg-muted/50"
            )}
          >
            <div 
              className="w-2.5 h-2.5 rounded-full mb-0.5"
              style={{ backgroundColor: driver.color }}
            />
            <span className="font-mono text-[10px]">{driver.code}</span>
          </button>
        ))}
      </div>
      
      {/* Selected Driver Header */}
      {currentDriverInfo && (
        <div className={cn(
          "flex items-center justify-between p-3 rounded-lg",
          isGlass ? "bg-white/5 border border-white/10" : "bg-muted/50"
        )}>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ 
                backgroundColor: currentDriverInfo.color,
                color: ['#27F4D2', '#B6BABD', '#64C4FF', '#52E252'].includes(currentDriverInfo.color) ? '#000' : '#fff'
              }}
            >
              {currentDriverInfo.number}
            </div>
            <div>
              <p className="font-semibold">{currentDriverInfo.name}</p>
              <p className="text-xs text-muted-foreground">{currentDriverInfo.team}</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            {radioMessages.length} message{radioMessages.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      )}
      
      {/* Radio Messages List */}
      {isRadioLoading ? (
        <div className="min-h-[200px] flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : hasNoData ? (
        <div className="min-h-[200px] flex flex-col items-center justify-center text-center">
          <Volume2 className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">No team radio for this driver</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3 h-7 text-xs"
            onClick={() => refetchRadio()}
          >
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Retry
          </Button>
        </div>
      ) : (
        <>
          <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />
          
          <ScrollArea className="h-[280px] rounded-md border">
            <div className="p-2 space-y-1.5">
              {radioMessages.map((message, idx) => {
                const messageDate = new Date(message.date);
                const formattedTime = format(messageDate, 'HH:mm:ss');
                const isActive = currentRadio === message.recording_url;
                
                return (
                  <button 
                    key={idx}
                    onClick={() => playRadio(message.recording_url)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2.5 rounded-md transition-all",
                      "hover:bg-muted/50 text-left",
                      isActive && "bg-primary/10 border border-primary/30"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      isActive && isPlaying 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted"
                    )}>
                      {isActive && isPlaying ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5 ml-0.5" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {formattedTime}
                        </span>
                        {isActive && isPlaying && (
                          <span className="flex gap-0.5">
                            <span className="w-0.5 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                            <span className="w-0.5 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                            <span className="w-0.5 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <Headphones className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )} />
                  </button>
                );
              })}
            </div>
          </ScrollArea>
          
          <p className="text-[10px] text-muted-foreground text-center">
            Click to play/pause • Audio provided by OpenF1
          </p>
        </>
      )}
    </div>
  );
};

export default TeamRadio;

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Headphones, Radio } from "lucide-react";
import { useOpenF1SessionFromErgast, useTeamRadio, useDrivers } from "@/hooks/useOpenF1Data";
import { format } from 'date-fns';
import { useThemeVariant } from '@/hooks/useThemeVariant';
import { cn } from '@/lib/utils';
import { getTeamColorById } from '@/constants/f1Colors';
import {
  F1Card,
  F1CardContent,
  F1CardHeader,
  F1CardTitle,
  F1EmptyState,
  F1ErrorState,
  F1Skeleton,
  DriverAvatar,
} from "@/components/f1";

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
  const { cardVariant, glassVariant } = useThemeVariant();

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

  // Process available drivers
  const drivers = useMemo(() => {
    if (!driversData?.data) return [];
    return driversData.data.map((driver: any) => ({
      number: driver.driver_number,
      code: driver.name_acronym || `${driver.first_name?.charAt(0)}${driver.last_name?.charAt(0)}`,
      name: `${driver.first_name} ${driver.last_name}`,
      team: driver.team_name || "Unknown",
      color: getTeamColorById(driver.team_name)
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
    return drivers.find((d: (typeof drivers)[number]) => d.number === selectedDriver);
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
      <F1Card variant={cardVariant} glassVariant={glassVariant} size="sm">
        <F1CardContent>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
              {Array.from({ length: 10 }).map((_, i) => (
                <F1Skeleton key={i} className="h-10 rounded-md" />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <F1Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          </div>
        </F1CardContent>
      </F1Card>
    );
  }

  if (hasError) {
    return (
      <F1Card variant={cardVariant} glassVariant={glassVariant} size="sm">
        <F1CardContent>
          <F1ErrorState
            type="not-found"
            variant="inline"
            title="Team radio unavailable"
            message={year >= new Date().getFullYear()
              ? "Current season data may not be available yet."
              : "Team radio is only available for races from 2023 onwards."}
            className="py-8"
          />
        </F1CardContent>
      </F1Card>
    );
  }

  return (
    <F1Card variant={cardVariant} glassVariant={glassVariant} size="sm">
      <F1CardHeader>
        <F1CardTitle icon={<Radio className="h-4 w-4 text-primary" />}>
          Team Radio
        </F1CardTitle>
      </F1CardHeader>
      <F1CardContent>
        <div className="flex flex-col gap-3">
          {/* Driver selector */}
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
            {drivers.map((driver: (typeof drivers)[number]) => {
              const active = selectedDriver === driver.number;
              return (
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
                  style={{ borderLeft: `2px solid ${driver.color}` }}
                  className={cn(
                    "flex items-center justify-center rounded-md border px-1.5 py-1.5 text-xs font-mono tabular-nums transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {driver.code}
                </button>
              );
            })}
          </div>

          {/* Selected driver row */}
          {currentDriverInfo && (
            <div
              className="flex items-center justify-between gap-3 border-l-2 bg-muted/40 px-3 py-2"
              style={{ borderColor: currentDriverInfo.color }}
            >
              <div className="flex items-center gap-2.5">
                <DriverAvatar
                  size="xs"
                  driverCode={currentDriverInfo.code}
                  driverName={currentDriverInfo.name}
                  teamColor={currentDriverInfo.color}
                  driverNumber={currentDriverInfo.number}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight">{currentDriverInfo.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{currentDriverInfo.team}</p>
                </div>
              </div>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {radioMessages.length} MSG
              </span>
            </div>
          )}

          {/* Transcript */}
          {isRadioLoading ? (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <F1Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : hasNoData ? (
            <F1EmptyState
              type="no-data"
              size="sm"
              title="No radio for this driver"
              description="No transmissions recorded for this session."
              actionText="Retry"
              onAction={() => refetchRadio()}
              showDecoration={false}
              className="py-8"
            />
          ) : (
            <>
              <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />

              <div className="max-h-[280px] overflow-y-auto rounded-md border border-border">
                <ul className="divide-y divide-border">
                  {radioMessages.map((message, idx) => {
                    const formattedTime = format(new Date(message.date), 'HH:mm:ss');
                    const isActive = currentRadio === message.recording_url;
                    const playing = isActive && isPlaying;
                    return (
                      <li key={idx}>
                        <button
                          onClick={() => playRadio(message.recording_url)}
                          style={{ borderLeft: `2px solid ${currentDriverInfo?.color ?? 'transparent'}` }}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors",
                            isActive ? "bg-primary/10" : "hover:bg-accent"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                              playing ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {playing ? <Pause className="h-3 w-3" /> : <Play className="ml-0.5 h-3 w-3" />}
                          </span>

                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formattedTime}
                          </span>

                          {playing && (
                            <span className="flex items-end gap-0.5">
                              <span className="h-3 w-0.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: '0ms' }} />
                              <span className="h-3 w-0.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: '150ms' }} />
                              <span className="h-3 w-0.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: '300ms' }} />
                            </span>
                          )}

                          <Headphones
                            className={cn(
                              "ml-auto h-3.5 w-3.5 shrink-0",
                              isActive ? "text-primary" : "text-muted-foreground"
                            )}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Tap a transmission to play
              </p>
            </>
          )}
        </div>
      </F1CardContent>
    </F1Card>
  );
};

export default TeamRadio;

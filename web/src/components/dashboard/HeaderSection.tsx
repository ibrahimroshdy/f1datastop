import { useEffect, useState, useMemo, useCallback } from "react";
import { formatDistance } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Clock, MapPin, Calendar, ChevronRight, Zap } from "lucide-react";
import PageSelector from "@/components/navigation/PageSelector";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import CountryFlag from "@/components/common/CountryFlag";
import BuyMeCoffeeWidget from "@/components/common/BuyMeCoffeeWidget";
import { getNextSession } from "@/utils/nextSessionUtils";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { GlassBadge } from "@/components/glass";
import { F1Card } from "@/components/f1";

interface HeaderSectionProps {
  nextRace: any;
  isOffline: boolean;
}

const HeaderSection = ({ nextRace, isOffline }: HeaderSectionProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const { isGlass, baseTheme } = useTheme();
  
  // Get the next session instead of just the race
  const { session: nextSession, raceName, country } = useMemo(() => getNextSession(nextRace), [nextRace]);
  
  // Memoize the session date
  const sessionDate = useMemo(() => {
    if (!nextSession) return null;
    return new Date(nextSession.date + "T" + (nextSession.time || "00:00:00Z"));
  }, [nextSession]);
  
  // Calculate time left
  const calculateTimeLeft = useCallback(() => {
    if (!sessionDate) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    
    const now = new Date();
    const difference = sessionDate.getTime() - now.getTime();
    
    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / (1000 * 60)) % 60),
      seconds: Math.floor((difference / 1000) % 60)
    };
  }, [sessionDate]);
  
  useEffect(() => {
    if (!sessionDate) return;
    
    setCountdown(calculateTimeLeft());
    
    const timer = setInterval(() => {
      setCountdown(calculateTimeLeft());
    }, 1000);
    
    return () => clearInterval(timer);
  }, [sessionDate, calculateTimeLeft]);

  const removeFlag = (raceName: string) => {
    if (raceName && raceName.length > 3 && raceName.indexOf(' ') > 0) {
      return raceName.substring(raceName.indexOf(' ') + 1);
    }
    return raceName;
  };

  const isUrgent = countdown.days < 3;
  const isImminent = countdown.days === 0 && countdown.hours < 6;

  return (
    <header className="mb-4 md:mb-6 space-y-3 md:space-y-4">
      {/* Main Header Row - Shadcn style */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Title Section - Cleaner, more minimal */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Formula 1 
              <span className="text-primary ml-1.5">{new Date().getFullYear()}</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time race data, standings, and analytics
          </p>
        </div>

        {/* Next Race Card - More compact */}
        {nextRace && nextSession && (
          <F1Card
            variant="glass"
            glassVariant={isGlass ? "glow" : "default"}
            size="sm"
            hover="lift"
            className={cn(
              "w-full md:w-auto md:min-w-[280px] cursor-pointer group",
              isUrgent && "ring-1 ring-primary/50",
              isImminent && "animate-pulse-glow"
            )}
            onClick={() => setIsDialogOpen(true)}
            aria-label={nextSession && sessionDate ? `Next session: ${removeFlag(raceName)} on ${sessionDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at ${sessionDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}. Countdown: ${countdown.days}d ${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s. Click to view race details.` : undefined}
          >
            <div className="flex items-center justify-between gap-3 md:gap-4">
              {/* Race Info */}
              <div className="flex items-center gap-2.5 md:gap-3 min-w-0 flex-1">
                <div className={cn(
                  "relative p-1.5 md:p-2 rounded-lg shrink-0",
                  isGlass ? "glass" : "bg-muted"
                )}>
                  <CountryFlag country={country} size={20} svg={true} />
                  {isImminent && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full animate-live-pulse" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                    <span className="font-semibold text-xs md:text-sm truncate">
                      {removeFlag(raceName)}
                    </span>
                    <GlassBadge 
                      variant={isImminent ? "live" : isUrgent ? "warning" : "secondary"} 
                      size="sm"
                      className="shrink-0"
                    >
                      {nextSession.shortName}
                    </GlassBadge>
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs text-muted-foreground mt-0.5">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {sessionDate?.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    <Clock className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {sessionDate?.toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Countdown */}
              <div className="flex items-center gap-2 md:gap-3 shrink-0">
                <div className="flex items-center gap-0.5 md:gap-1 font-mono text-[10px] md:text-xs">
                  <CountdownUnit value={countdown.days} label="d" urgent={isUrgent} />
                  <span className="text-muted-foreground">:</span>
                  <CountdownUnit value={countdown.hours} label="h" urgent={isUrgent} />
                  <span className="text-muted-foreground">:</span>
                  <CountdownUnit value={countdown.minutes} label="m" urgent={isUrgent} />
                  <span className="text-muted-foreground hidden sm:inline">:</span>
                  <CountdownUnit value={countdown.seconds} label="s" urgent={isUrgent} className="hidden sm:flex" />
                </div>
                <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </div>
          </F1Card>
        )}
      </div>
      
      {/* Page Selector - Only on tablet and mobile */}
      <div className="pt-0.5">
        <PageSelector />
      </div>
      
      {/* Offline Alert */}
      {isOffline && (
        <Alert className={cn(
          "border-yellow-500/50",
          isGlass 
            ? "glass bg-yellow-500/10" 
            : "bg-yellow-500/10"
        )}>
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-500">API Connection Issue</AlertTitle>
          <AlertDescription className="text-yellow-500/80">
            Unable to connect to the F1 API. Showing cached data. Some information might not be up to date.
          </AlertDescription>
        </Alert>
      )}
        
      {/* Race Detail Dialog */}
      {nextRace && (
        <RaceDetailDialog 
          isOpen={isDialogOpen} 
          onClose={() => setIsDialogOpen(false)} 
          race={nextRace} 
        />
      )}
    </header>
  );
};

// Countdown Unit Component
const CountdownUnit = ({ 
  value, 
  label, 
  urgent,
  className 
}: { 
  value: number; 
  label: string; 
  urgent?: boolean;
  className?: string;
}) => {
  const { isGlass } = useTheme();
  
  return (
    <div className={cn(
      "flex items-baseline gap-0.5",
      className
    )}>
      <span className={cn(
        "font-bold tabular-nums",
        urgent ? "text-primary" : isGlass ? "text-foreground" : "text-foreground"
      )}>
        {String(value).padStart(2, '0')}
      </span>
      <span className={cn(
        "text-[10px]",
        urgent ? "text-primary/70" : "text-muted-foreground"
      )}>
        {label}
      </span>
    </div>
  );
};

export default HeaderSection;

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
import { GlassCard } from "@/components/glass";
import { GlassBadge } from "@/components/glass";

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
    <header className="mb-6 space-y-4">
      {/* Main Header Row */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Title Section */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Formula 1 
              <span className="text-primary ml-2">{new Date().getFullYear()}</span>
          </h1>
            <GlassBadge variant="primary" size="sm" className="hidden sm:flex">
              <Zap className="h-3 w-3 mr-1" />
              Live Data
            </GlassBadge>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-muted-foreground text-sm">
              Real-time race data, standings, and analytics
            </p>
            <BuyMeCoffeeWidget size="small" className="hidden md:flex" />
          </div>
        </div>

        {/* Next Race Card */}
        {nextRace && nextSession && (
          <GlassCard
            variant={isGlass ? "glow" : "default"}
            size="sm"
            hover="lift"
            className={cn(
              "w-full lg:w-auto min-w-[280px] cursor-pointer group",
              isUrgent && "ring-1 ring-primary/50",
              isImminent && "animate-pulse-glow"
            )}
            onClick={() => setIsDialogOpen(true)}
          >
            <div className="flex items-center justify-between gap-4">
              {/* Race Info */}
              <div className="flex items-center gap-3">
                <div className={cn(
                  "relative p-2 rounded-xl",
                  isGlass ? "glass" : "bg-muted"
                )}>
                  <CountryFlag country={country} size={24} svg={true} />
                  {isImminent && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-live-pulse" />
                  )}
                </div>
                <div>
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {removeFlag(raceName)}
                    </span>
                    <GlassBadge 
                      variant={isImminent ? "live" : isUrgent ? "warning" : "secondary"} 
                      size="sm"
                    >
                      {nextSession.shortName}
                    </GlassBadge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {sessionDate?.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    <Clock className="h-3 w-3 ml-1" />
                    <span>
                      {sessionDate?.toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                  </span>
                  </div>
                </div>
              </div>

              {/* Countdown */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 font-mono text-xs">
                  <CountdownUnit value={countdown.days} label="d" urgent={isUrgent} />
                  <span className="text-muted-foreground">:</span>
                  <CountdownUnit value={countdown.hours} label="h" urgent={isUrgent} />
                  <span className="text-muted-foreground">:</span>
                  <CountdownUnit value={countdown.minutes} label="m" urgent={isUrgent} />
                  <span className="text-muted-foreground hidden sm:inline">:</span>
                  <CountdownUnit value={countdown.seconds} label="s" urgent={isUrgent} className="hidden sm:flex" />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </GlassCard>
        )}
      </div>
      
      {/* Page Selector */}
      <div className="pt-2">
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

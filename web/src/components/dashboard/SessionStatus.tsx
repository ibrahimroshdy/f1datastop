
import { format } from "date-fns";
import { useNextRace } from "@/hooks/useF1Data";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle } from "@/components/f1";
import { useTheme } from "@/context/ThemeContext";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from 'lucide-react';
import { getRaceNameWithoutEmoji } from '@/utils/countryUtils';
import CountryFlag from "@/components/common/CountryFlag";

interface SessionStatusProps {
  year?: number;
}

const SessionStatus = ({ year }: SessionStatusProps) => {
  const currentYear = new Date().getFullYear();
  const { data: nextRace, isLoading } = useNextRace(year || currentYear);
  const { isGlass } = useTheme();
  const surfaceVariant = isGlass ? ("glass" as const) : ("default" as const);
  const surfaceGlass = isGlass ? ("panel" as const) : ("default" as const);
  const sessionCardClass = "border-border bg-card p-0";
  
  if (isLoading) {
    return (
      <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={sessionCardClass}>
        <F1CardHeader className="pb-3">
          <F1CardTitle icon={<Clock className="h-5 w-5" />} className="text-base font-semibold">
            Next Session
          </F1CardTitle>
        </F1CardHeader>
        <F1CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </div>
        </F1CardContent>
      </F1Card>
    );
  }
  
  if (!nextRace?.data) {
    return (
      <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={sessionCardClass}>
        <F1CardHeader className="pb-3">
          <F1CardTitle icon={<Clock className="h-5 w-5" />} className="text-base font-semibold">
            Next Session
          </F1CardTitle>
        </F1CardHeader>
        <F1CardContent>
          <div className="text-center py-4">
            <div className="w-2 h-2 rounded-full bg-purple-500/50 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Season Complete</p>
          </div>
        </F1CardContent>
      </F1Card>
    );
  }
  
  const race = nextRace.data;
  const now = new Date();
  
  // Find the next session
  const sessions = [
    { name: "Practice 1", shortName: "FP1", date: race.FirstPractice?.date, time: race.FirstPractice?.time },
    { name: "Practice 2", shortName: "FP2", date: race.SecondPractice?.date, time: race.SecondPractice?.time },
    { name: "Practice 3", shortName: "FP3", date: race.ThirdPractice?.date, time: race.ThirdPractice?.time },
    { name: "Qualifying", shortName: "Q", date: race.Qualifying?.date, time: race.Qualifying?.time },
    { name: "Race", shortName: "R", date: race.date, time: race.time },
  ].filter(session => session.date && session.time);

  const nextSession = sessions.find(session => {
    const sessionDateTime = new Date(`${session.date}T${session.time}`);
    return sessionDateTime > now;
  });

  if (!nextSession) {
    return (
      <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={sessionCardClass}>
        <F1CardHeader className="pb-3">
          <F1CardTitle icon={<Clock className="h-5 w-5" />} className="text-base font-semibold">
            Next Session
          </F1CardTitle>
        </F1CardHeader>
        <F1CardContent>
          <div className="text-center py-4">
            <div className="w-2 h-2 rounded-full bg-purple-500/50 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No upcoming sessions</p>
          </div>
        </F1CardContent>
      </F1Card>
    );
  }

  const sessionDateTime = new Date(`${nextSession.date}T${nextSession.time}`);
  const raceName = getRaceNameWithoutEmoji(race.raceName);
  const country = race.Circuit?.Location?.country || "";

  return (
    <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={sessionCardClass}>
      <F1CardHeader className="pb-3">
        <F1CardTitle icon={<Clock className="h-5 w-5" />} className="text-base font-semibold">
          Next Session
        </F1CardTitle>
      </F1CardHeader>
      <F1CardContent>
        <div className="space-y-4">
          {/* Race Info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-purple-500/5 to-transparent border border-purple-500/20">
            <CountryFlag country={country} size={20} svg={true} />
            <div className="flex-1">
              <p className="font-medium text-sm text-foreground">{raceName}</p>
              <p className="text-xs text-muted-foreground">{race.Circuit?.circuitName}</p>
            </div>
            <Badge variant="outline" className="text-xs">
              R{race.round}
            </Badge>
          </div>
          
          {/* Session Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge 
                variant="outline" 
                className="border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/5"
              >
                {nextSession.name}
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">
                {format(sessionDateTime, "MMM d")}
              </span>
            </div>
            
            <div className="text-center py-2">
              <div className="text-lg font-mono font-bold text-foreground">
                {format(sessionDateTime, "HH:mm")}
              </div>
              <div className="text-xs text-muted-foreground">UTC</div>
            </div>
          </div>
          
          {/* Purple dotted accent */}
          <div className="flex items-center justify-center gap-2 pt-2 border-t border-dashed border-purple-500/30">
            <div className="w-2 h-2 rounded-full bg-purple-500/50" />
            <span className="text-xs text-muted-foreground">
              {nextSession.shortName} Session
            </span>
            <div className="w-2 h-2 rounded-full bg-purple-500/50" />
          </div>
        </div>
      </F1CardContent>
    </F1Card>
  );
};

export default SessionStatus;

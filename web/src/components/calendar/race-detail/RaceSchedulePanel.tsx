import { Suspense, lazy } from "react";
import { Calendar, LineChart, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getSessionDate, isSessionPast } from "./raceDetailUtils";

const MuiSankeyChart = lazy(() => import("@/components/analytics/MuiSankeyChart"));

type SessionBlock = { date: string; time?: string };

type RaceSchedulePanelProps = {
  race: {
    season: string;
    round: string;
    date?: string;
    time?: string;
    FirstPractice?: SessionBlock;
    SecondPractice?: SessionBlock;
    ThirdPractice?: SessionBlock;
    SprintQualifying?: SessionBlock;
    Sprint?: SessionBlock;
    Qualifying?: SessionBlock;
  };
  isGlass: boolean;
  onViewAnalysis: () => void;
};

function SessionStatusBadge({ date, time }: { date: string; time?: string }) {
  return isSessionPast(date, time) ? (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 sm:px-2 sm:py-0.5">
      Completed
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 sm:px-2 sm:py-0.5">
      Upcoming
    </Badge>
  );
}

function SessionRow({
  label,
  session,
  icon,
}: {
  label: string;
  session: SessionBlock;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center py-1">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium flex items-center gap-1">
          {icon}
          {label}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{getSessionDate(session)}</p>
      </div>
      <div className="ml-2 shrink-0">
        <SessionStatusBadge date={session.date} time={session.time} />
      </div>
    </div>
  );
}

export function RaceSchedulePanel({ race, isGlass, onViewAnalysis }: RaceSchedulePanelProps) {
  return (
    <div className="space-y-2 h-full mt-0">
      <div
        className={cn(
          "rounded-md p-2.5 space-y-1.5",
          isGlass ? "bg-white/5 border border-white/10" : "bg-muted/50 border",
        )}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <h3 className="text-xs font-semibold">Weekend Schedule</h3>
        </div>
        <div className="space-y-1.5">
          {race.FirstPractice && <SessionRow label="Practice 1" session={race.FirstPractice} />}
          {race.SecondPractice && <SessionRow label="Practice 2" session={race.SecondPractice} />}
          {race.ThirdPractice && <SessionRow label="Practice 3" session={race.ThirdPractice} />}
          {race.SprintQualifying && (
            <SessionRow
              label="Sprint Qualifying"
              session={race.SprintQualifying}
              icon={<Zap className="h-2.5 w-2.5" />}
            />
          )}
          {race.Sprint && (
            <SessionRow
              label="Sprint Race"
              session={race.Sprint}
              icon={<Zap className="h-2.5 w-2.5" />}
            />
          )}
          {race.Qualifying && <SessionRow label="Qualifying" session={race.Qualifying} />}
          <div className="flex justify-between items-center py-1 border-t pt-1.5 mt-1">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium flex items-center gap-1">
                <Trophy className="h-2.5 w-2.5" />
                Race
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {getSessionDate({ date: race.date || "", time: race.time })}
              </p>
            </div>
            <div className="ml-2 shrink-0">
              {race.date && <SessionStatusBadge date={race.date} time={race.time} />}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button
          size="sm"
          className="bg-f1-red hover:bg-f1-red/90 text-[10px] h-7 px-2"
          onClick={onViewAnalysis}
        >
          <LineChart className="h-2.5 w-2.5 mr-1" />
          View Analysis
        </Button>
      </div>
    </div>
  );
}

export function RaceInfographicEmbed({
  season,
  round,
  isGlass,
}: {
  season: number;
  round: string;
  isGlass: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md overflow-hidden",
        isGlass ? "bg-white/5 border border-white/10" : "bg-muted/50 border",
      )}
    >
      <div className="p-2 border-b">
        <h3 className="text-xs font-semibold">Position Progression</h3>
        <p className="text-[10px] text-muted-foreground">Qualifying → Grid → Race Result</p>
      </div>
      <div className="h-[500px] sm:h-[600px] w-full">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-primary mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground">Loading chart...</p>
              </div>
            </div>
          }
        >
          <MuiSankeyChart year={season} round={round} />
        </Suspense>
      </div>
    </div>
  );
}

import { Suspense, lazy } from "react";
import { Calendar, LineChart, Trophy, Zap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { F1Skeleton } from "@/components/f1";
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

// Left-rail colour per session type — practice neutral, quali gold, sprint purple,
// race the primary red (the main event).
const RAIL: Record<string, string> = {
  practice: "bg-muted-foreground/30",
  quali: "bg-position-gold",
  sprint: "bg-fastest-lap",
  race: "bg-primary",
};

function SessionStatus({ date, time }: { date: string; time?: string }) {
  return isSessionPast(date, time) ? (
    <span className="inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-gain">
      <Check className="h-3 w-3" strokeWidth={3} />
      Done
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
      Upcoming
    </span>
  );
}

function SessionRow({
  label,
  session,
  type,
  icon,
  emphasized,
}: {
  label: string;
  session: SessionBlock;
  type: keyof typeof RAIL;
  icon?: React.ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5", emphasized && "bg-primary/[0.05]")}>
      <span className={cn("h-8 w-1 shrink-0 rounded-full", RAIL[type])} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          {icon}
          {label}
        </p>
        <p className="timing mt-0.5 truncate text-[11px] text-muted-foreground">{getSessionDate(session)}</p>
      </div>
      <div className="ml-2 shrink-0">
        <SessionStatus date={session.date} time={session.time} />
      </div>
    </div>
  );
}

export function RaceSchedulePanel({ race, isGlass, onViewAnalysis }: RaceSchedulePanelProps) {
  const surface = isGlass ? "bg-white/[0.04]" : "bg-card/50";
  return (
    <div className="mt-0 space-y-3">
      <div className={cn("overflow-hidden rounded-xl border border-border", surface)}>
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="instrument-label text-[11px]">Weekend Schedule</h3>
        </div>
        <div className="divide-y divide-border/60">
          {race.FirstPractice && <SessionRow label="Practice 1" session={race.FirstPractice} type="practice" />}
          {race.SecondPractice && <SessionRow label="Practice 2" session={race.SecondPractice} type="practice" />}
          {race.ThirdPractice && <SessionRow label="Practice 3" session={race.ThirdPractice} type="practice" />}
          {race.SprintQualifying && (
            <SessionRow
              label="Sprint Qualifying"
              session={race.SprintQualifying}
              type="sprint"
              icon={<Zap className="h-3 w-3 text-fastest-lap" />}
            />
          )}
          {race.Sprint && (
            <SessionRow
              label="Sprint Race"
              session={race.Sprint}
              type="sprint"
              icon={<Zap className="h-3 w-3 text-fastest-lap" />}
            />
          )}
          {race.Qualifying && <SessionRow label="Qualifying" session={race.Qualifying} type="quali" />}
          {race.date && (
            <SessionRow
              label="Race"
              session={{ date: race.date, time: race.time }}
              type="race"
              emphasized
              icon={<Trophy className="h-3 w-3 text-primary" />}
            />
          )}
        </div>
      </div>

      <Button
        className="h-10 w-full gap-1.5 bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        onClick={onViewAnalysis}
      >
        <LineChart className="h-4 w-4" />
        View Full Analysis
      </Button>
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
        "overflow-hidden rounded-lg border",
        isGlass ? "border-white/10 bg-white/5" : "border-border",
      )}
    >
      <div className="border-b border-border px-3 py-2">
        <h3 className="instrument-label">Position Progression</h3>
        <p className="mt-0.5 text-[10px] text-muted-foreground">Qualifying → Grid → Race Result</p>
      </div>
      <div className="h-[500px] sm:h-[600px] w-full">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center p-4">
              <F1Skeleton className="h-full w-full" />
            </div>
          }
        >
          <MuiSankeyChart year={season} round={round} />
        </Suspense>
      </div>
    </div>
  );
}

import { Suspense, lazy } from "react";
import { Check } from "lucide-react";
import { F1Skeleton } from "@/components/f1";
import { userTzLabel } from "@/lib/time";
import { cn } from "@/lib/utils";
import { getSessionDate, isSessionPast } from "./raceDetailUtils";

const MuiSankeyChart = lazy(() => import("@/components/analytics/MuiSankeyChart"));

type SessionBlock = { date: string; time?: string };

type RaceSchedulePanelProps = {
  race: {
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
};

function SessionRow({ label, session, main }: { label: string; session: SessionBlock; main?: boolean }) {
  const past = isSessionPast(session.date, session.time);
  return (
    <li className={cn("flex items-center gap-3 px-3 py-2.5", main && "bg-primary/5")}>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className={cn("text-sm", main ? "font-semibold text-heading" : "font-medium text-foreground")}>{label}</span>
        <span className="font-mono text-[13px] tabular-nums text-ink-2">{getSessionDate(session)}</span>
      </span>
      <span className="w-14 shrink-0 text-right text-xs font-medium text-muted-foreground">
        {past ? (
          <span className="inline-flex items-center gap-1 text-gain">
            <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
            Done
          </span>
        ) : null}
      </span>
    </li>
  );
}

/** The weekend's sessions with their start times in the user's time zone. */
export function RaceSchedulePanel({ race, isGlass }: RaceSchedulePanelProps) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border", isGlass ? "bg-raised/60" : "bg-raised")}>
      <p className="border-b border-border px-3 py-2 text-[13px] text-muted-foreground">
        Times in your time zone, {userTzLabel()}
      </p>
      <ul className="m-0 list-none divide-y divide-border p-0">
        {race.FirstPractice && <SessionRow label="Practice 1" session={race.FirstPractice} />}
        {race.SecondPractice && <SessionRow label="Practice 2" session={race.SecondPractice} />}
        {race.ThirdPractice && <SessionRow label="Practice 3" session={race.ThirdPractice} />}
        {race.SprintQualifying && <SessionRow label="Sprint qualifying" session={race.SprintQualifying} />}
        {race.Sprint && <SessionRow label="Sprint" session={race.Sprint} />}
        {race.Qualifying && <SessionRow label="Qualifying" session={race.Qualifying} />}
        {race.date && <SessionRow label="Race" session={{ date: race.date, time: race.time }} main />}
      </ul>
    </div>
  );
}

/** Qualifying to grid to finish, as a Sankey. */
export function RaceInfographicEmbed({ season, round, isGlass }: { season: number; round: string; isGlass: boolean }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border", isGlass && "bg-raised/60")}>
      <p className="border-b border-border px-3 py-2 text-sm font-semibold text-heading">Quali, grid, race</p>
      <div className="h-[500px] w-full sm:h-[600px]">
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

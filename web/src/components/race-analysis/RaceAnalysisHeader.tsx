import { Activity } from "lucide-react";

export type RaceContext = {
  round: string;
  raceName: string;
  Circuit?: { circuitName?: string; Location?: { country?: string } };
  /** Present on sprint weekends (Ergast/Jolpica). Either key may appear. */
  Sprint?: unknown;
  SprintQualifying?: unknown;
};

interface RaceAnalysisHeaderProps {
  selectedYear: number;
  currentRace: RaceContext | null;
}

export function RaceAnalysisHeader({
  selectedYear,
  currentRace,
}: RaceAnalysisHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <div className="instrument-label flex items-center gap-1.5 text-primary">
          <Activity className="h-3 w-3" />
          <span>
            Telemetry · Season <span className="timing">{selectedYear}</span>
          </span>
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
          Race<span className="text-primary"> Analysis</span>
        </h1>
      </div>

      <div className="flex w-fit flex-wrap items-center gap-1.5">
        {currentRace ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-primary">
            Round <span className="timing">{currentRace.round}</span>
          </span>
        ) : null}
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-secondary-foreground">
          <span className="timing">{selectedYear}</span>
        </span>
      </div>
    </div>
  );
}

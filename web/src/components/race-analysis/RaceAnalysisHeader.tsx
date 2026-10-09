import { PageHeader } from "@/components/f1";

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
    <PageHeader
      eyebrow={`Telemetry · Season ${selectedYear}`}
      title="Race Analysis"
      actions={
        <>
          {currentRace ? (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-primary">
              Round <span className="timing">{currentRace.round}</span>
            </span>
          ) : null}
          <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-secondary-foreground">
            <span className="timing">{selectedYear}</span>
          </span>
        </>
      }
    />
  );
}

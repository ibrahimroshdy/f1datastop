import { F1Card, F1Skeleton } from "@/components/f1";
import CountryFlag from "@/components/common/CountryFlag";
import { cn } from "@/lib/utils";
import { CircuitThumb, RaceOutcome, SprintChip } from "./RaceRowParts";
import type { RaceRow } from "./raceRows";

interface Group {
  month: string;
  rows: RaceRow[];
}

/** The same races as cards, grouped by month. A card opens the quick look. */
export default function RaceCalendarGridView({
  season,
  groups,
  onOpen,
}: {
  season: number;
  groups: Group[];
  onOpen: (row: RaceRow) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.month} aria-label={g.month} className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-ink-2">{g.month}</p>
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {g.rows.map((row) => (
              <li key={row.race.round}>
                <F1Card
                  onClick={() => onOpen(row)}
                  className={cn(
                    "flex h-full cursor-pointer flex-col gap-3 p-4 transition-colors hover:bg-muted/30",
                    row.status === "next" && "ring-1 ring-primary",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <CountryFlag country={row.country} size={24} className="mt-1 shrink-0" />
                    <CircuitThumb row={row} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] leading-tight">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(row);
                        }}
                        className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {row.name}
                      </button>
                    </h3>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                      <span>{row.circuitName}</span>
                      {row.sprint ? <SprintChip /> : null}
                    </p>
                  </div>
                  <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[13px] tabular-nums text-ink-2">{row.dates}</span>
                    <RaceOutcome row={row} season={season} showName={false} />
                  </div>
                </F1Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function RaceCalendarGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <F1Skeleton key={i} variant="card" className="h-40" />
      ))}
    </div>
  );
}

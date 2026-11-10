import { F1Card, F1Skeleton } from "@/components/f1";
import CountryFlag from "@/components/common/CountryFlag";
import { cn } from "@/lib/utils";
import { CircuitThumb, RaceOutcome, SprintChip } from "./RaceRowParts";
import type { RaceRow } from "./raceRows";

interface Group {
  month: string;
  rows: RaceRow[];
}

/**
 * The season as rows grouped by month (docs/design/screens "races"): flag, Grand Prix name and
 * circuit, the weekend's dates, and the winner's face or "Next". A row opens the quick look.
 */
export default function RaceCalendarListView({
  season,
  groups,
  onOpen,
}: {
  season: number;
  groups: Group[];
  onOpen: (row: RaceRow) => void;
}) {
  return (
    <F1Card className="overflow-hidden p-0">
      {groups.map((g) => (
        <section key={g.month} aria-label={g.month}>
          <p className="border-b border-border bg-muted/30 px-4 py-2 text-[13px] font-semibold text-ink-2">{g.month}</p>
          <ul className="m-0 list-none divide-y divide-border p-0">
            {g.rows.map((row) => (
              <li
                key={row.race.round}
                onClick={() => onOpen(row)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
                  row.status === "next" && "bg-primary/5",
                )}
              >
                <CountryFlag country={row.country} size={21} className="shrink-0" />
                <div className="min-w-0 flex-1">
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
                  <p className="mt-0.5 font-mono text-[13px] tabular-nums text-ink-2 sm:hidden">{row.dates}</p>
                </div>
                <span className="hidden shrink-0 font-mono text-[13px] tabular-nums text-ink-2 sm:inline">{row.dates}</span>
                <span className="flex shrink-0 items-center sm:min-w-32">
                  <RaceOutcome row={row} season={season} />
                </span>
                <CircuitThumb row={row} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </F1Card>
  );
}

export function RaceCalendarListSkeleton() {
  return (
    <F1Card className="overflow-hidden p-0">
      <ul className="divide-y divide-border">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="flex min-h-[64px] items-center gap-3 px-4 py-3">
            <F1Skeleton className="h-4 w-6 shrink-0" />
            <div className="flex flex-1 flex-col gap-1.5">
              <F1Skeleton className="h-4 w-2/3" />
              <F1Skeleton className="h-3 w-1/3" />
            </div>
            <F1Skeleton className="h-3 w-16 shrink-0" />
          </li>
        ))}
      </ul>
    </F1Card>
  );
}

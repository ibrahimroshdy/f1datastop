import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RACE_FILTERS, RACE_FILTER_LABEL, type RaceFilter } from "./raceRows";

/** Search box and filter chips for the Races page; the page keeps both in the address. */
export function RaceListTools({
  query,
  onQuery,
  filter,
  onFilter,
  counts,
}: {
  query: string;
  onQuery: (q: string) => void;
  filter: RaceFilter;
  onFilter: (f: RaceFilter) => void;
  counts: Record<RaceFilter, number>;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative sm:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search Grands Prix"
          aria-label="Search by Grand Prix, circuit or country"
          className="h-11 rounded-full pl-9 pr-10"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQuery("")}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Show races">
        {RACE_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => onFilter(f)}
            className={cn(
              "press inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              filter === f ? "border-transparent bg-act text-on-act" : "border-border bg-raised text-ink-2 hover:text-foreground",
            )}
          >
            {RACE_FILTER_LABEL[f]}
            <span className="font-mono tabular-nums opacity-80">{counts[f]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

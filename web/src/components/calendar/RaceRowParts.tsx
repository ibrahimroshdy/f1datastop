import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { CircuitTrackMap, getCircuitTrack } from "./CircuitTrackMap";
import { DriverFace } from "./DriverFace";
import { circuitHref } from "@/lib/links";
import { cn } from "@/lib/utils";
import type { RaceRow } from "./raceRows";

/** The circuit's outline, linked to the circuit page. */
export function CircuitThumb({ row, className }: { row: RaceRow; className?: string }) {
  const track = getCircuitTrack(row.circuitName, row.locality);
  const art = track ? (
    <CircuitTrackMap circuitName={row.circuitName} locality={row.locality} className="h-7 w-7 text-ink-2" />
  ) : (
    <MapPin className="h-4 w-4 text-muted-foreground" />
  );
  const box = cn(
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-raised",
    className,
  );
  if (!row.circuitId) return <span className={box} aria-hidden>{art}</span>;
  return (
    <Link
      to={circuitHref(row.circuitId)}
      onClick={(e) => e.stopPropagation()}
      aria-label={`${row.circuitName}, circuit page`}
      title={row.circuitName}
      className={cn(box, "transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
    >
      {art}
    </Link>
  );
}

export function NextChip() {
  return (
    <span className="inline-flex items-center rounded-full bg-act px-2.5 py-0.5 text-xs font-semibold text-on-act">Next</span>
  );
}

export function SprintChip() {
  return (
    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs font-medium text-ink-2">
      Sprint
    </span>
  );
}

/** The winner's face for a finished race (with the surname from `sm` up), "Next" for the next one. */
export function RaceOutcome({ row, season, showName = true }: { row: RaceRow; season: number; showName?: boolean }) {
  const w = row.winner;
  if (w) {
    const full = w.givenName ? `${w.givenName} ${w.familyName}` : w.familyName;
    return (
      <span className="flex items-center gap-2">
        <DriverFace
          driverId={w.driverId}
          givenName={w.givenName}
          familyName={w.familyName}
          constructorId={w.constructorId}
          season={season}
          label={`Won by ${full}`}
          size="sm"
        />
        {showName ? <span className="hidden text-sm font-medium text-ink-2 sm:inline">{w.familyName}</span> : null}
      </span>
    );
  }
  return row.status === "next" ? <NextChip /> : null;
}

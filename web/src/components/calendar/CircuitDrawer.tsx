import { Link } from "react-router-dom";
import { CalendarDays, ChevronRight, MapPin, Ruler, Timer } from "lucide-react";
import { useCircuitDetail } from "@/hooks/useCircuitDetail";
import { CircuitTrackMap, getCircuitTrack } from "@/components/calendar/CircuitTrackMap";
import { F1Skeleton } from "@/components/f1";
import { cn } from "@/lib/utils";

interface CircuitDrawerProps {
  circuitId?: string;
  circuitName: string;
  locality: string;
  /** Open the full race dialog (schedule / results / analysis). */
  onOpenDetails: () => void;
}

const Stat = ({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) => (
  <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
    <div className="instrument-label flex items-center gap-1 text-muted-foreground">
      {icon}
      {label}
    </div>
    <div className="readout mt-1 truncate text-sm tabular-nums text-foreground">
      {value}
      {sub ? (
        <span className="timing ml-1 text-2xs font-normal text-muted-foreground">{sub}</span>
      ) : null}
    </div>
  </div>
);

/** Inline circuit detail shown when a calendar row is expanded — track map + the
 *  key readouts (length, lap record, seasons, coords), lazy-loaded per row. */
export function CircuitDrawer({ circuitId, circuitName, locality, onOpenDetails }: CircuitDrawerProps) {
  const { data: circuit, isLoading } = useCircuitDetail(circuitId);
  const track = getCircuitTrack(circuitName, locality);
  const lengthKm = track?.length ? (track.length / 1000).toFixed(3) : null;
  const seasons =
    circuit?.first_season && circuit?.last_season
      ? circuit.first_season === circuit.last_season
        ? `${circuit.first_season}`
        : `${circuit.first_season}–${circuit.last_season}`
      : "—";
  const coords =
    circuit?.lat != null && circuit?.lng != null
      ? `${Number(circuit.lat).toFixed(2)}, ${Number(circuit.lng).toFixed(2)}`
      : "—";

  const trackNode = track ? (
    <CircuitTrackMap
      circuitName={circuitName}
      locality={locality}
      className="h-16 w-16 text-primary transition-transform group-hover/dw:scale-105"
    />
  ) : (
    <MapPin className="h-6 w-6 text-muted-foreground/50" />
  );

  return (
    <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        {/* Track map → full circuit page */}
        {circuitId ? (
          <Link
            to={`/circuits/${circuitId}`}
            aria-label={`${circuitName} circuit details`}
            className="group/dw flex h-20 w-full shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background/40 transition-colors hover:border-primary/50 sm:w-32"
          >
            {trackNode}
          </Link>
        ) : (
          <span className="flex h-20 w-full shrink-0 items-center justify-center rounded-md border border-border bg-background/40 sm:w-32">
            {trackNode}
          </span>
        )}

        {/* Readouts */}
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <F1Skeleton key={i} className="h-[52px] rounded-md" />
              ))
            ) : (
            <>
              <Stat icon={<Ruler className="h-3 w-3" />} label="Length" value={lengthKm ? `${lengthKm} km` : "—"} />
              <Stat
                icon={<Timer className="h-3 w-3" />}
                label="Lap record"
                value={circuit?.record_time ?? "—"}
                sub={circuit?.record_driver_code ?? undefined}
              />
              <Stat icon={<CalendarDays className="h-3 w-3" />} label="Seasons" value={seasons} />
              <Stat icon={<MapPin className="h-3 w-3" />} label="Coords" value={coords} />
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-2.5 flex items-center justify-end gap-4">
        {circuitId ? (
          <Link
            to={`/circuits/${circuitId}`}
            className="inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
          >
            Circuit page
            <ChevronRight className="h-3 w-3" />
          </Link>
        ) : null}
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary",
          )}
          onClick={onOpenDetails}
        >
          Race details
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export default CircuitDrawer;

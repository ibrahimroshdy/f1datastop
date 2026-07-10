import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, MapPin, Flag as FlagIcon } from "lucide-react";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { useTheme } from "@/context/ThemeContext";
import CountryFlag from "@/components/common/CountryFlag";
import { CircuitTrackMap, getCircuitTrack } from "@/components/calendar/CircuitTrackMap";
import { pageShell, pageStack } from "@/lib/layout";
import {
  F1Card,
  F1EmptyState,
  F1ErrorState,
  F1Skeleton,
  PageHeader,
} from "@/components/f1";
import { cn } from "@/lib/utils";

type ScheduleRace = {
  round: string;
  raceName: string;
  date: string;
  Circuit: {
    circuitId?: string;
    circuitName: string;
    Location: {
      locality: string;
      country: string;
    };
  };
};

// ── Compact list header (eyebrow + count) — mirrors Standings ListHeader ──────
const ListHeader = ({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) => (
  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
    <div className="instrument-label flex items-center gap-1.5 text-primary">
      {icon}
      {label}
    </div>
    {count > 0 && (
      <span className="timing shrink-0 text-2xs text-muted-foreground">
        {count} circuits
      </span>
    )}
  </div>
);

// ── Shared row skeleton (track thumb · name/locality · round/length · › ) ──────
const skeletonPlate = (
  <ul className="divide-y divide-border">
    {Array.from({ length: 12 }).map((_, i) => (
      <li key={i} className="flex items-center gap-3 px-4 py-2.5">
        <F1Skeleton className="h-10 w-10 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <F1Skeleton className="h-4 w-40" />
          <F1Skeleton className="h-3 w-24" />
        </div>
        <F1Skeleton className="h-4 w-12 shrink-0" />
      </li>
    ))}
  </ul>
);

const Circuits = () => {
  const currentYear = new Date().getFullYear();
  const { isGlass } = useTheme();
  const { data, isLoading, isError, refetch } = useRaceSchedule(currentYear);

  const cardVariant = isGlass ? "glass" : "default";
  const glassVariant = isGlass ? "panel" : "default";

  const circuits = useMemo(() => {
    const races = (data?.data ?? []) as ScheduleRace[];
    return races.map((race) => ({
      round: race.round,
      raceName: race.raceName,
      circuitId: race.Circuit.circuitId,
      circuitName: race.Circuit.circuitName,
      locality: race.Circuit.Location.locality,
      country: race.Circuit.Location.country,
      date: race.date,
    }));
  }, [data?.data]);

  // ── Circuit rows — dense hairline plate, link to /circuits/:id ──────────────
  const circuitRows = (
    <ul className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-y-0 stagger-children">
      {circuits.map((circuit) => {
        const track = getCircuitTrack(circuit.circuitName, circuit.locality);
        const lengthKm = track?.length ? (track.length / 1000).toFixed(3) : null;
        const to = circuit.circuitId
          ? `/circuits/${circuit.circuitId}`
          : `/race-analysis/${currentYear}/${circuit.round}`;

        return (
          <li
            key={`${circuit.round}-${circuit.circuitName}`}
            className={cn(
              "md:border-b md:border-border",
              // restore the right-column left hairline on desktop 2-col
              "md:[&:nth-child(even)]:border-l md:[&:nth-child(even)]:border-border",
            )}
          >
            <Link to={to} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50">
              {/* Track-outline thumb */}
              <span
                className={cn(
                  "relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border md:h-12 md:w-12",
                  isGlass ? "border-white/10 bg-white/[0.03]" : "border-border bg-muted/30",
                )}
              >
                {track ? (
                  <CircuitTrackMap
                    circuitName={circuit.circuitName}
                    locality={circuit.locality}
                    className="h-9 w-9 text-primary transition-transform duration-200 group-hover:scale-110 md:h-10 md:w-10"
                  />
                ) : (
                  <MapPin className="h-5 w-5 text-muted-foreground/50" />
                )}
              </span>

              {/* Identity */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold leading-tight transition-colors group-hover:text-primary md:text-base">
                  {circuit.circuitName}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CountryFlag country={circuit.country} size={14} />
                  <span className="truncate">
                    {circuit.locality}, {circuit.country}
                  </span>
                </div>
              </div>

              {/* Round · length readouts */}
              <div className="shrink-0 text-right">
                <div className="timing text-xs font-semibold tabular-nums text-foreground md:text-sm">
                  R{circuit.round.padStart(2, "0")}
                </div>
                <div className="timing text-2xs tabular-nums text-muted-foreground">
                  {lengthKm ? `${lengthKm} km` : "—"}
                </div>
              </div>

              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full max-w-4xl", pageStack, "animate-fade-in")}>
        <PageHeader
          eyebrow={`${currentYear} Season`}
          title="Circuits"
          description={`${currentYear} Formula 1 venues — tap a circuit for details and its lap record`}
        />

        <F1Card variant={cardVariant} glassVariant={glassVariant} className="overflow-hidden p-0">
          <ListHeader
            icon={<FlagIcon className="h-3 w-3" />}
            label={`Venues ${currentYear}`}
            count={circuits.length}
          />
          {isError ? (
            <F1ErrorState
              type="network"
              variant="inline"
              className="py-12"
              onRetry={() => refetch()}
            />
          ) : isLoading ? (
            skeletonPlate
          ) : circuits.length === 0 ? (
            <F1EmptyState type="no-data" className="py-12" />
          ) : (
            circuitRows
          )}
        </F1Card>
      </div>
    </div>
  );
};

export default Circuits;

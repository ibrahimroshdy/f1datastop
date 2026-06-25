import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Gauge,
  MapPin,
  Ruler,
  Timer,
  Trophy,
} from "lucide-react";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { useCircuitDetail } from "@/hooks/useCircuitDetail";
import { useTheme } from "@/context/ThemeContext";
import CountryFlag from "@/components/common/CountryFlag";
import { CircuitTrackMap, getCircuitTrack } from "@/components/calendar/CircuitTrackMap";
import { pageShell, pageStack } from "@/lib/layout";
import {
  F1Card,
  F1CardContent,
  F1CardHeader,
  F1CardTitle,
  F1ErrorState,
  F1Skeleton,
  PageHeader,
} from "@/components/f1";
import { cn } from "@/lib/utils";

type ScheduleRace = {
  round: string;
  date: string;
  Circuit: { circuitId?: string };
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
  <div className="rounded-lg border border-border/60 px-3 py-2.5">
    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
      {icon}
      {label}
    </div>
    <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
  </div>
);

const CircuitDetail = () => {
  const { circuitId } = useParams<{ circuitId: string }>();
  const currentYear = new Date().getFullYear();
  const { isGlass } = useTheme();
  const { data: circuit, isLoading, isError, refetch } = useCircuitDetail(circuitId);
  const { data: schedule } = useRaceSchedule(currentYear);

  const cardVariant = isGlass ? "glass" : "default";
  const glassVariant = isGlass ? "panel" : "default";

  // current-season round for this circuit (for the race-analysis link)
  const thisYear = useMemo(() => {
    const races = (schedule?.data ?? []) as ScheduleRace[];
    return races.find((r) => r.Circuit?.circuitId === circuitId) ?? null;
  }, [schedule?.data, circuitId]);

  if (isError) {
    return (
      <div className={cn(pageShell, pageStack)}>
        <F1ErrorState type="network" variant="inline" className="py-12" onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !circuit) {
    return (
      <div className={cn(pageShell, pageStack)}>
        <F1Skeleton variant="card" className="h-40" />
        <div className="grid gap-4 sm:grid-cols-2">
          <F1Skeleton variant="card" className="h-48" />
          <F1Skeleton variant="card" className="h-48" />
        </div>
      </div>
    );
  }

  const track = getCircuitTrack(circuit.name, circuit.locality);
  const lengthKm = track?.length ? (track.length / 1000).toFixed(3) : null;
  const seasons =
    circuit.first_season && circuit.last_season
      ? circuit.first_season === circuit.last_season
        ? `${circuit.first_season}`
        : `${circuit.first_season}–${circuit.last_season}`
      : "—";

  return (
    <div className={cn(pageShell, pageStack)}>
      <Link
        to="/circuits"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All circuits
      </Link>

      <PageHeader
        eyebrow={circuit.country}
        title={circuit.name}
        description={`${circuit.locality}, ${circuit.country}`}
      />

      {/* Hero: track map + location */}
      <F1Card variant={cardVariant} glassVariant={glassVariant} className="overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[1fr_1.2fr]">
          <div
            className={cn(
              "flex h-56 items-center justify-center border-b md:border-b-0 md:border-r",
              isGlass ? "border-white/10 bg-white/[0.03]" : "border-border bg-muted/30",
            )}
          >
            {track ? (
              <CircuitTrackMap
                circuitName={circuit.name}
                locality={circuit.locality}
                className="h-44 w-44 text-primary"
              />
            ) : (
              <MapPin className="h-10 w-10 text-muted-foreground/40" />
            )}
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CountryFlag country={circuit.country} size={20} />
              <span>
                {circuit.locality}, {circuit.country}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat icon={<Ruler className="h-3 w-3" />} label="Length" value={lengthKm ? `${lengthKm} km` : "—"} />
              <Stat icon={<CalendarDays className="h-3 w-3" />} label="In our data" value={seasons} />
              <Stat icon={<Gauge className="h-3 w-3" />} label="Races stored" value={circuit.races_in_db ?? "—"} />
              <Stat
                icon={<MapPin className="h-3 w-3" />}
                label="Coordinates"
                value={circuit.lat != null && circuit.lng != null ? `${Number(circuit.lat).toFixed(2)}, ${Number(circuit.lng).toFixed(2)}` : "—"}
              />
            </div>
            {thisYear && (
              <Link
                to={`/race-analysis/${currentYear}/${thisYear.round}`}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                View {currentYear} race analysis <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </F1Card>

      {/* Lap record */}
      <F1Card variant={cardVariant} glassVariant={glassVariant}>
        <F1CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <F1CardTitle className="text-base">Lap record</F1CardTitle>
          </div>
        </F1CardHeader>
        <F1CardContent>
          {circuit.record_time ? (
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <Timer className="h-3 w-3" /> Fastest race lap
                </div>
                <div className="mt-1 text-3xl font-bold tabular-nums text-primary">
                  {circuit.record_time}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Holder</div>
                <div className="mt-1 text-lg font-semibold">
                  {circuit.record_driver_name ?? circuit.record_driver_code ?? "—"}
                  {circuit.record_driver_code && circuit.record_driver_name ? (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {circuit.record_driver_code}
                    </span>
                  ) : null}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Set in</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{circuit.record_season ?? "—"}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No lap data on record for this circuit yet.</p>
          )}
        </F1CardContent>
      </F1Card>
    </div>
  );
};

export default CircuitDetail;

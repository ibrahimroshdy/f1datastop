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
import { CountUp } from "@/components/CountUp";
import {
  F1Card,
  F1ErrorState,
  F1Skeleton,
} from "@/components/f1";
import { cn } from "@/lib/utils";

type ScheduleRace = {
  round: string;
  date: string;
  Circuit: { circuitId?: string };
};

// ── Readout stat tile — instrument-label eyebrow + mono value ─────────────────
const StatTile = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2.5">
    <div className="instrument-label flex items-center gap-1.5">
      {icon}
      {label}
    </div>
    <div className="readout mt-1.5 text-base tabular-nums text-foreground md:text-lg">
      {value}
    </div>
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
        <F1Skeleton className="h-4 w-28" />
        <F1Skeleton className="h-8 w-56" />
        <F1Skeleton variant="card" className="h-44 md:h-56" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <F1Skeleton variant="card" className="h-20" />
          <F1Skeleton variant="card" className="h-20" />
          <F1Skeleton variant="card" className="h-20" />
          <F1Skeleton variant="card" className="h-20" />
        </div>
        <F1Skeleton variant="card" className="h-32" />
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
    <div className={pageShell}>
      <div className={cn("mx-auto w-full max-w-4xl", pageStack, "animate-fade-in")}>
        {/* ── BackLink ──────────────────────────────────────────────────────── */}
        <Link
          to="/circuits"
          className="inline-flex min-h-11 w-fit -ml-1 items-center gap-1.5 px-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Circuits
        </Link>

        {/* ── Compact identity (eyebrow + name + locality flag) ──────────────── */}
        <div className="space-y-1.5">
          <div className="instrument-label flex items-center gap-1.5 text-primary">
            <MapPin className="h-3 w-3" />
            <span>Circuit</span>
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
            {circuit.name}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CountryFlag country={circuit.country} size={16} />
            <span>
              {circuit.locality}, {circuit.country}
            </span>
          </div>
        </div>

        {/* ── Track map panel (scope-framed) ────────────────────────────────── */}
        <F1Card variant={cardVariant} glassVariant={glassVariant} className="overflow-hidden p-0">
          <div
            className={cn(
              "scope-frame flex h-44 items-center justify-center md:h-56",
              isGlass ? "bg-white/[0.03]" : "bg-muted/30",
            )}
          >
            {track ? (
              <CircuitTrackMap
                circuitName={circuit.name}
                locality={circuit.locality}
                className="h-36 w-36 text-primary md:h-44 md:w-44"
              />
            ) : (
              <MapPin className="h-10 w-10 text-muted-foreground/40" />
            )}
          </div>
        </F1Card>

        {/* ── Stat readout tiles ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <StatTile
            icon={<Ruler className="h-3 w-3" />}
            label="Length"
            value={lengthKm ? `${lengthKm} km` : "—"}
          />
          <StatTile
            icon={<Gauge className="h-3 w-3" />}
            label="Races"
            value={circuit.races_in_db != null ? <CountUp value={circuit.races_in_db} /> : "—"}
          />
          <StatTile
            icon={<CalendarDays className="h-3 w-3" />}
            label="Seasons"
            value={seasons}
          />
          <StatTile
            icon={<MapPin className="h-3 w-3" />}
            label="Coords"
            value={
              circuit.lat != null && circuit.lng != null
                ? `${Number(circuit.lat).toFixed(2)}, ${Number(circuit.lng).toFixed(2)}`
                : "—"
            }
          />
        </div>

        {/* ── Lap record — the signature readout ────────────────────────────── */}
        <F1Card variant={cardVariant} glassVariant={glassVariant} className="overflow-hidden p-0">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
            <div className="instrument-label flex items-center gap-1.5 text-primary">
              <Trophy className="h-3 w-3" />
              Lap Record
            </div>
          </div>
          {circuit.record_time ? (
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3 px-4 py-4 md:gap-x-12">
              <div>
                <div className="instrument-label flex items-center gap-1.5">
                  <Timer className="h-3 w-3" /> Fastest race lap
                </div>
                <div className="readout mt-1.5 text-3xl text-primary md:text-4xl">
                  {circuit.record_time}
                </div>
              </div>
              <div>
                <div className="instrument-label">Holder</div>
                <div className="mt-1.5 text-lg font-semibold leading-tight">
                  {circuit.record_driver_name ?? circuit.record_driver_code ?? "—"}
                  {circuit.record_driver_code && circuit.record_driver_name ? (
                    <span className="timing ml-2 text-sm font-normal tabular-nums text-muted-foreground">
                      {circuit.record_driver_code}
                    </span>
                  ) : null}
                </div>
              </div>
              <div>
                <div className="instrument-label">Set in</div>
                <div className="readout mt-1.5 text-lg tabular-nums">
                  {circuit.record_season ?? "—"}
                </div>
              </div>
            </div>
          ) : (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No lap data on record for this circuit yet.
            </p>
          )}
        </F1Card>

        {/* ── Race analysis CTA ─────────────────────────────────────────────── */}
        {thisYear && (
          <Link
            to={`/race-analysis/${currentYear}/${thisYear.round}`}
            className="group inline-flex w-fit items-center gap-1.5 min-h-11 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            View {currentYear} race analysis
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </div>
  );
};

export default CircuitDetail;

import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { BackLink } from "@/components/ui/back-link";
import {
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
import { getCircuitTrack } from "@/components/calendar/CircuitTrackMap";
import CircuitGeometryMap from "@/components/race/CircuitGeometryMap";
import CircuitHistoryCard from "@/components/circuits/CircuitHistoryCard";
import { pageShell, pageStack } from "@/lib/layout";
import { CountUp } from "@/components/CountUp";
import {
  F1Card,
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
        <BackLink to="/calendar">Calendar</BackLink>

        {/* ── Compact identity (eyebrow + name + locality flag) ──────────────── */}
        <PageHeader
          eyebrow="Circuit"
          title={circuit.name}
          description={`${circuit.locality}, ${circuit.country}`}
        />

        {/* ── Telemetry-derived track map (numbered corners + straights) ─────── */}
        <CircuitGeometryMap circuitId={circuit.circuit_id} />

        {/* ── Stat readout cluster — hairline tiles, mono readouts ───────────── */}
        <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-lg border border-border sm:grid-cols-4">
          {[
            {
              icon: <Ruler className="h-3 w-3" />,
              label: "Length",
              value: lengthKm ? `${lengthKm} km` : "—",
            },
            {
              icon: <Gauge className="h-3 w-3" />,
              label: "Races",
              value: circuit.races_in_db != null ? <CountUp value={circuit.races_in_db} /> : "—",
            },
            {
              icon: <CalendarDays className="h-3 w-3" />,
              label: "Seasons",
              value: seasons,
            },
            {
              icon: <MapPin className="h-3 w-3" />,
              label: "Coords",
              value:
                circuit.lat != null && circuit.lng != null
                  ? `${Number(circuit.lat).toFixed(2)}, ${Number(circuit.lng).toFixed(2)}`
                  : "—",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center justify-center gap-0.5 p-2.5 text-center"
            >
              <span className="readout text-lg font-semibold tabular-nums text-foreground">
                {s.value}
              </span>
              <span className="instrument-label flex items-center gap-1.5 text-muted-foreground">
                {s.icon}
                {s.label}
              </span>
            </div>
          ))}
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

        {/* ── Circuit history — winners + poles across the years ─────────────── */}
        <CircuitHistoryCard circuitId={circuit.circuit_id} />

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

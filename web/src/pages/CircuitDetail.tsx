import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { BackLink } from "@/components/ui/back-link";
import { ArrowRight } from "lucide-react";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { useSeason } from "@/hooks/useSeason";
import { useCircuitHistory } from "@/components/circuits/useCircuitHistory";
import { DriverFace } from "@/components/calendar/DriverFace";
import { driverHref, raceHref } from "@/lib/links";
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
import Seo from "@/components/common/Seo";

type ScheduleRace = {
  round: string;
  date: string;
  Circuit: { circuitId?: string };
};

const CircuitDetail = () => {
  const { circuitId } = useParams<{ circuitId: string }>();
  const [season] = useSeason();
  const { isGlass } = useTheme();
  const { data: circuit, isLoading, isError, refetch } = useCircuitDetail(circuitId);
  const { data: schedule } = useRaceSchedule(season);
  const { data: history } = useCircuitHistory(circuitId);

  const cardVariant = isGlass ? "glass" : "default";
  const glassVariant = isGlass ? "panel" : "default";

  // The race analysis to offer: this circuit in the chosen season, else its latest edition.
  const analysis = useMemo(() => {
    const races = (schedule?.data ?? []) as ScheduleRace[];
    const inSeason = races.find((r) => r.Circuit?.circuitId === circuitId);
    if (inSeason) return { season, round: Number(inSeason.round) };
    const latest = [...(history ?? [])].sort((a, b) => b.season - a.season)[0];
    return latest ? { season: latest.season, round: latest.round } : null;
  }, [schedule?.data, history, circuitId, season]);

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
        : `${circuit.first_season} to ${circuit.last_season}`
      : "None";

  return (
    <div className={pageShell}>
      <Seo
        title={`${circuit.name} — F1 Circuit`}
        path={`/circuits/${circuit.circuit_id}`}
        description={`${circuit.name} (${circuit.locality}, ${circuit.country}) — Formula 1 track map, corners and race history.`}
      />
      <div className={cn("mx-auto w-full max-w-4xl", pageStack, "animate-fade-in")}>
        {/* ── BackLink ──────────────────────────────────────────────────────── */}
        <BackLink to="/calendar">Races</BackLink>

        <PageHeader title={circuit.name} description={`Circuit in ${circuit.locality}, ${circuit.country}`} />

        {/* ── Telemetry-derived track map (numbered corners + straights) ─────── */}
        <CircuitGeometryMap circuitId={circuit.circuit_id} />

        <dl className="m-0 grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-lg border border-border sm:grid-cols-4 sm:divide-y-0">
          {[
            { label: "Length", value: lengthKm ? `${lengthKm} km` : "Not known" },
            { label: "Races", value: circuit.races_in_db != null ? <CountUp value={circuit.races_in_db} /> : "None" },
            { label: "Seasons", value: seasons },
            {
              label: "Location",
              value:
                circuit.lat != null && circuit.lng != null
                  ? `${Number(circuit.lat).toFixed(2)}, ${Number(circuit.lng).toFixed(2)}`
                  : "Not known",
            },
          ].map((s) => (
            <div key={s.label} className="flex flex-col-reverse items-center justify-center gap-1 p-3 text-center">
              <dt className="text-[13px] text-muted-foreground">{s.label}</dt>
              <dd className="m-0 font-mono text-lg font-semibold tabular-nums text-figure">{s.value}</dd>
            </div>
          ))}
        </dl>

        <F1Card variant={cardVariant} glassVariant={glassVariant} className="overflow-hidden p-0">
          <h2 className="border-b border-border px-4 py-3 text-lg">Lap record</h2>
          {circuit.record_time ? (
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4 px-4 py-4 md:gap-x-12">
              <div>
                <p className="text-[13px] text-muted-foreground">Fastest race lap</p>
                <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-fastest-lap md:text-4xl">
                  {circuit.record_time}
                </p>
              </div>
              <div>
                <p className="text-[13px] text-muted-foreground">Holder</p>
                <div className="mt-1 flex items-center gap-2.5">
                  {circuit.record_driver_id ? (
                    <>
                      <DriverFace
                        driverId={circuit.record_driver_id}
                        familyName={circuit.record_driver_name ?? circuit.record_driver_code ?? ""}
                        label={circuit.record_driver_name ?? circuit.record_driver_code ?? "Lap record holder"}
                        size="sm"
                      />
                      <Link
                        to={driverHref(circuit.record_driver_id)}
                        className="text-lg font-semibold leading-tight text-heading hover:underline"
                      >
                        {circuit.record_driver_name ?? circuit.record_driver_code}
                      </Link>
                    </>
                  ) : (
                    <span className="text-lg font-semibold leading-tight">
                      {circuit.record_driver_name ?? circuit.record_driver_code ?? "Not known"}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[13px] text-muted-foreground">Set in</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                  {circuit.record_season && circuit.record_round ? (
                    <Link
                      to={raceHref(circuit.record_season, circuit.record_round)}
                      className="text-heading hover:underline"
                    >
                      {circuit.record_season}
                    </Link>
                  ) : (
                    (circuit.record_season ?? "Not known")
                  )}
                </p>
              </div>
            </div>
          ) : (
            <p className="px-4 py-6 text-sm text-muted-foreground">No lap data on record for this circuit yet.</p>
          )}
        </F1Card>

        {/* ── Circuit history — winners + poles across the years ─────────────── */}
        <CircuitHistoryCard circuitId={circuit.circuit_id} />

        {analysis && (
          <Link
            to={raceHref(analysis.season, analysis.round)}
            className="group inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-act px-5 py-2.5 text-sm font-semibold text-on-act transition-opacity hover:opacity-90"
          >
            View {analysis.season} race analysis
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </div>
  );
};

export default CircuitDetail;

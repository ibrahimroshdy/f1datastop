import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { useTheme } from "@/context/ThemeContext";
import CountryFlag from "@/components/common/CountryFlag";
import { CircuitTrackMap, getCircuitTrack } from "@/components/calendar/CircuitTrackMap";
import { pageShell, pageStack } from "@/lib/layout";
import {
  F1Card,
  F1CardContent,
  F1CardHeader,
  F1CardTitle,
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

  return (
    <div className={cn(pageShell, pageStack, "animate-fade-in")}>
      <PageHeader
        eyebrow={`${currentYear} Season`}
        title="Circuits"
        description={`${currentYear} Formula 1 venues — tap a circuit for details and its lap record`}
      />

      {isError ? (
        <F1ErrorState
          type="network"
          variant="inline"
          className="py-12"
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <F1Skeleton key={index} variant="card" className="h-full" />
          ))}
        </div>
      ) : circuits.length === 0 ? (
        <F1EmptyState type="no-data" className="py-12" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
          {circuits.map((circuit) => {
            const track = getCircuitTrack(circuit.circuitName, circuit.locality);
            const lengthKm = track?.length ? (track.length / 1000).toFixed(3) : null;
            return (
              <Link
                key={`${circuit.round}-${circuit.circuitName}`}
                to={
                  circuit.circuitId
                    ? `/circuits/${circuit.circuitId}`
                    : `/race-analysis/${currentYear}/${circuit.round}`
                }
                className="group block rounded-xl"
              >
                <F1Card
                  variant={cardVariant}
                  glassVariant={glassVariant}
                  size="sm"
                  className="h-full overflow-hidden transition-shadow group-hover:shadow-md"
                >
                  {/* Track outline banner */}
                  <div
                    className={cn(
                      "relative -m-3 mb-0 flex h-28 items-center justify-center border-b",
                      isGlass ? "border-white/10 bg-white/[0.03]" : "border-border bg-muted/30",
                    )}
                  >
                    {track ? (
                      <CircuitTrackMap
                        circuitName={circuit.circuitName}
                        locality={circuit.locality}
                        className="h-24 w-24 text-primary transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <MapPin className="h-8 w-8 text-muted-foreground/50" />
                    )}
                    <span className="instrument-label absolute right-2 top-2 rounded-md bg-background/80 px-2 py-0.5 tabular-nums backdrop-blur">
                      R{circuit.round}
                    </span>
                  </div>

                  <F1CardHeader className="px-0 pb-2 pt-3">
                    <F1CardTitle className="text-base leading-snug group-hover:text-primary transition-colors">
                      {circuit.circuitName}
                    </F1CardTitle>
                  </F1CardHeader>
                  <F1CardContent className="px-0 pb-0">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CountryFlag country={circuit.country} size={18} />
                      <span>
                        {circuit.locality}, {circuit.country}
                      </span>
                    </div>
                    {/* Hairline instrument meta */}
                    <div className="hairline-grid mt-3">
                      <div className="data-row">
                        <span className="instrument-label">Round</span>
                        <span className="font-mono text-sm tabular-nums text-foreground">
                          {circuit.round.padStart(2, "0")}
                        </span>
                      </div>
                      <div className="data-row">
                        <span className="instrument-label">Length</span>
                        <span className="font-mono text-sm tabular-nums text-foreground">
                          {lengthKm ? `${lengthKm} km` : "—"}
                        </span>
                      </div>
                      <div className="data-row">
                        <span className="instrument-label">Date</span>
                        <span className="font-mono text-sm tabular-nums text-foreground">
                          {new Date(circuit.date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end">
                      <span className="instrument-label inline-flex items-center gap-1 group-hover:text-primary">
                        Details <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </F1CardContent>
                </F1Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Circuits;

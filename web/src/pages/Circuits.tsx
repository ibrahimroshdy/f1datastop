import { useMemo } from "react";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { useTheme } from "@/context/ThemeContext";
import CountryFlag from "@/components/common/CountryFlag";
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
      circuitName: race.Circuit.circuitName,
      locality: race.Circuit.Location.locality,
      country: race.Circuit.Location.country,
      date: race.date,
    }));
  }, [data?.data]);

  return (
    <div className={cn(pageShell, pageStack)}>
      <PageHeader
        eyebrow="Pit Wall"
        title="Circuits"
        description={`${currentYear} Formula 1 venues and host locations`}
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
            <F1Skeleton key={index} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : circuits.length === 0 ? (
        <F1EmptyState type="no-data" className="py-12" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {circuits.map((circuit) => (
            <F1Card
              key={`${circuit.round}-${circuit.circuitName}`}
              variant={cardVariant}
              glassVariant={glassVariant}
              className="h-full"
            >
              <F1CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <F1CardTitle className="text-base leading-snug">
                    {circuit.circuitName}
                  </F1CardTitle>
                  <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                    R{circuit.round}
                  </span>
                </div>
              </F1CardHeader>
              <F1CardContent className="space-y-3">
                <p className="text-sm font-medium">{circuit.raceName}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CountryFlag country={circuit.country} size={18} />
                  <span>
                    {circuit.locality}, {circuit.country}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {new Date(circuit.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </F1CardContent>
            </F1Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Circuits;

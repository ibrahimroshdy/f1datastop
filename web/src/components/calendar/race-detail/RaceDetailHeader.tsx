import { format, parseISO } from "date-fns";
import { MapPin, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

type RaceDetailSummaryProps = {
  race: {
    round: string;
    date?: string;
    Sprint?: unknown;
  };
  winner: string | null;
  polePosition: string | null;
  hasSprint: boolean;
  isGlass: boolean;
  circuitName?: string;
  locality?: string;
  country?: string;
};

export function RaceDetailSummary({
  race,
  winner,
  polePosition,
  hasSprint,
  isGlass,
  circuitName,
  locality,
  country,
}: RaceDetailSummaryProps) {
  const raceDate = race.date ? format(parseISO(race.date), "MMM d") : "—";
  const isRaceCompleted = race.date ? parseISO(race.date) < new Date() : false;
  const surface = isGlass ? "bg-white/[0.04]" : "bg-card/50";

  return (
    <>
      {/* Instrument cluster — one cohesive strip, hairline-divided columns */}
      <div
        className={cn(
          "mb-3 mt-3 grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border sm:grid-cols-4 sm:divide-y-0",
          surface,
        )}
      >
        <StatCell label="Race Date" value={raceDate} />
        <StatCell label="Round" value={`R${race.round}`} />
        <StatCell
          label="Winner"
          value={winner || (isRaceCompleted ? "—" : "TBD")}
          accent={winner ? "gold" : undefined}
        />
        {hasSprint ? (
          <StatCell label="Sprint" value="Yes" accent="primary" />
        ) : (
          <StatCell
            label="Pole"
            value={polePosition || (isRaceCompleted ? "—" : "TBD")}
            accent={polePosition ? "purple" : undefined}
          />
        )}
      </div>

      {/* Circuit + location — a clean two-up readout */}
      <div className={cn("mb-3 grid grid-cols-1 gap-2.5 rounded-xl border border-border p-3 sm:grid-cols-2", surface)}>
        <InfoCell icon={MapPin} label="Circuit" value={circuitName || "—"} />
        <InfoCell icon={Flag} label="Location" value={`${locality || "—"}, ${country || "—"}`} />
      </div>
    </>
  );
}

function StatCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "gold" | "purple" | "primary";
}) {
  const isTbd = value === "TBD" || value === "—";
  return (
    <div className="px-3 py-2.5">
      <p className="instrument-label text-[10px]">{label}</p>
      <p
        className={cn(
          "readout mt-1.5 text-lg",
          isTbd
            ? "text-muted-foreground/50"
            : accent === "gold"
              ? "text-position-gold"
              : accent === "purple"
                ? "text-fastest-lap"
                : accent === "primary"
                  ? "text-primary"
                  : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function InfoCell({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background/40">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
      <div className="min-w-0">
        <p className="instrument-label text-[9px]">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

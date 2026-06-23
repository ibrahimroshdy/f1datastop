import { format, parseISO } from "date-fns";
import { Calendar, Flag, MapPin, Trophy, Zap, Clock } from "lucide-react";
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
  const raceDate = race.date ? format(parseISO(race.date), "MMM d") : "-";
  const isRaceCompleted = race.date ? parseISO(race.date) < new Date() : false;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-3 mt-3">
        <StatCell icon={Calendar} iconClass="text-blue-500" label="Race Date" value={raceDate} isGlass={isGlass} />
        <StatCell icon={Flag} iconClass="text-green-500" label="Round" value={`R${race.round}`} isGlass={isGlass} />
        <StatCell
          icon={Trophy}
          iconClass="text-yellow-500"
          label="Winner"
          value={winner || (isRaceCompleted ? "-" : "TBD")}
          isGlass={isGlass}
        />
        {hasSprint ? (
          <StatCell icon={Zap} iconClass="text-orange-500" label="Sprint" value="Yes" isGlass={isGlass} />
        ) : (
          <StatCell
            icon={Clock}
            iconClass="text-purple-500"
            label="Pole"
            value={polePosition || (isRaceCompleted ? "-" : "TBD")}
            isGlass={isGlass}
          />
        )}
      </div>

      <div
        className={cn(
          "grid grid-cols-2 gap-1.5 mb-3 p-2 rounded-md",
          isGlass ? "bg-white/5" : "bg-muted/50",
        )}
      >
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-[8px] text-muted-foreground">Circuit</p>
            <p className="text-xs font-medium truncate">{circuitName || "-"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Flag className="h-3 w-3 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-[8px] text-muted-foreground">Location</p>
            <p className="text-xs font-medium truncate">
              {locality || "-"}, {country || "-"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCell({
  icon: Icon,
  iconClass,
  label,
  value,
  isGlass,
}: {
  icon: typeof Calendar;
  iconClass: string;
  label: string;
  value: string;
  isGlass: boolean;
}) {
  return (
    <div className={cn("text-center p-2 rounded-md", isGlass ? "bg-white/5" : "bg-muted")}>
      <Icon className={cn("h-3 w-3 mx-auto mb-0.5", iconClass)} />
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[8px] text-muted-foreground">{label}</p>
    </div>
  );
}

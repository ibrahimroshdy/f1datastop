import CountryFlag from "@/components/common/CountryFlag";
import { PageHeader } from "@/components/f1";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { cn } from "@/lib/utils";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";

export type RaceContext = {
  round: string;
  raceName: string;
  Circuit?: { circuitName?: string; Location?: { country?: string } };
};

interface RaceAnalysisHeaderProps {
  selectedYear: number;
  currentRace: RaceContext | null;
}

export function RaceAnalysisHeader({
  selectedYear,
  currentRace,
}: RaceAnalysisHeaderProps) {
  const { isGlass } = useThemeVariant();

  const raceLabel = currentRace
    ? getRaceNameWithoutEmoji(currentRace.raceName)
    : "Select a Grand Prix";

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={String(selectedYear)}
        title="Race Analysis"
        description="Lap times, qualifying, strategy, and session-level insights for each Grand Prix."
      />

      <div
        className={cn(
          "sticky top-0 z-20 -mx-4 border-b px-4 py-3 md:-mx-6 md:px-6",
          isGlass
            ? "border-white/10 bg-background/90 backdrop-blur-md"
            : "border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        )}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {currentRace ? (
            <CountryFlag
              country={currentRace.Circuit?.Location?.country || ""}
              size={20}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{raceLabel}</p>
            {currentRace?.Circuit?.circuitName ? (
              <p className="truncate text-xs text-muted-foreground">
                {currentRace.Circuit.circuitName}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {currentRace ? (
              <span className="rounded-md bg-muted px-2 py-1 font-medium text-foreground">
                Round {currentRace.round}
              </span>
            ) : null}
            <span className="rounded-md bg-muted px-2 py-1 font-medium text-foreground">
              {selectedYear}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

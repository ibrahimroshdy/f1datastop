import { Timer, Trophy } from "lucide-react";
import { F1Badge, F1EmptyState, PitIcon } from "@/components/f1";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { useDriverCareer } from "@/hooks/entity";
import { cn } from "@/lib/utils";

export interface DriverCareerPanelProps {
  slug?: string;
  ergastId?: string;
  compact?: boolean;
  className?: string;
}

function formatStat(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

const DriverCareerPanel = ({
  slug,
  ergastId,
  compact = false,
  className,
}: DriverCareerPanelProps) => {
  const { isGlass } = useThemeVariant();
  const { data: profile, isLoading, isFetched } = useDriverCareer({
    slug,
    ergastId,
  });

  const mutedSurface = isGlass ? "bg-white/5" : "bg-muted";

  if (isLoading) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-lg",
          compact ? "h-24" : "h-36",
          mutedSurface,
          className,
        )}
        aria-hidden
      />
    );
  }

  const hasCareerData =
    profile &&
    (profile.championships != null ||
      profile.race_wins != null ||
      profile.podiums != null ||
      profile.bio_short);

  if (isFetched && !hasCareerData) {
    return (
      <F1EmptyState
        type="coming-soon"
        size={compact ? "sm" : "md"}
        title="Career records coming soon"
        description="Lifetime stats will appear here once the entity database is seeded."
        className={className}
      />
    );
  }

  if (!profile) return null;

  const championshipYears = profile.championship_years ?? [];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <PitIcon icon={Trophy} size="sm" className="text-primary" />
        <h4 className="instrument-label text-muted-foreground">Career Records</h4>
      </div>

      {/* Instrument cluster — hairline tiles, mono readouts (no rainbow icons) */}
      <div
        className={cn(
          "grid divide-x divide-y divide-border overflow-hidden rounded-lg border border-border",
          compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4",
        )}
      >
        {[
          { label: "WDC", value: profile.championships, gold: (profile.championships ?? 0) > 0 },
          { label: "Wins", value: profile.race_wins, gold: false },
          { label: "Podiums", value: profile.podiums, gold: false },
          { label: "Poles", value: profile.pole_positions, gold: false },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center justify-center gap-0.5 p-2.5 text-center">
            <span
              className={cn(
                "readout font-semibold tabular-nums",
                compact ? "text-sm" : "text-lg",
                s.gold ? "text-position-gold" : "text-foreground",
              )}
            >
              {formatStat(s.value)}
            </span>
            <span className="instrument-label text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {!compact && profile.fastest_laps != null && (
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <PitIcon icon={Timer} size="xs" />
            Fastest laps
          </span>
          <span className="readout font-semibold tabular-nums">{formatStat(profile.fastest_laps)}</span>
        </div>
      )}

      {championshipYears.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {championshipYears.map((year) => (
            <F1Badge
              key={year}
              className={cn(
                "text-[10px] font-semibold",
                isGlass && "border-white/20 bg-white/5",
              )}
            >
              {year}
            </F1Badge>
          ))}
        </div>
      )}

      {profile.bio_short && (
        <p
          className={cn(
            "text-muted-foreground leading-relaxed",
            compact ? "text-xs line-clamp-2" : "text-sm",
          )}
        >
          {profile.bio_short}
        </p>
      )}

      {profile.scraped_at && !compact && (
        <p className="text-[10px] text-muted-foreground/70">
          Stats as of {new Date(profile.scraped_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};

export default DriverCareerPanel;

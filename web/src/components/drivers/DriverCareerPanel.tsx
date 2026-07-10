import { Flag, Timer, Trophy, Zap } from "lucide-react";
import { F1EmptyState, PitIcon } from "@/components/f1";
import { Badge } from "@/components/ui/badge";
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
        <h4
          className={cn(
            "font-semibold uppercase tracking-wide text-muted-foreground",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          Career Records
        </h4>
      </div>

      <div
        className={cn(
          "grid gap-1.5",
          compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4",
        )}
      >
        <div className={cn("text-center rounded-md p-2", mutedSurface)}>
          <PitIcon
            icon={Trophy}
            size="xs"
            className="mx-auto mb-0.5 text-yellow-500"
          />
          <p className={cn("font-bold", compact ? "text-sm" : "text-lg")}>
            {formatStat(profile.championships)}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">WDC</p>
        </div>
        <div className={cn("text-center rounded-md p-2", mutedSurface)}>
          <PitIcon
            icon={Flag}
            size="xs"
            className="mx-auto mb-0.5 text-orange-500"
          />
          <p className={cn("font-bold", compact ? "text-sm" : "text-lg")}>
            {formatStat(profile.race_wins)}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Wins</p>
        </div>
        <div className={cn("text-center rounded-md p-2", mutedSurface)}>
          <PitIcon
            icon={Flag}
            size="xs"
            className="mx-auto mb-0.5 text-amber-600"
          />
          <p className={cn("font-bold", compact ? "text-sm" : "text-lg")}>
            {formatStat(profile.podiums)}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Podiums</p>
        </div>
        <div className={cn("text-center rounded-md p-2", mutedSurface)}>
          <PitIcon icon={Zap} size="xs" className="mx-auto mb-0.5 text-blue-500" />
          <p className={cn("font-bold", compact ? "text-sm" : "text-lg")}>
            {formatStat(profile.pole_positions)}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Poles</p>
        </div>
      </div>

      {!compact && profile.fastest_laps != null && (
        <div className={cn("flex items-center justify-between rounded-md px-3 py-2 text-sm", mutedSurface)}>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <PitIcon icon={Timer} size="xs" />
            Fastest laps
          </span>
          <span className="font-semibold">{formatStat(profile.fastest_laps)}</span>
        </div>
      )}

      {championshipYears.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {championshipYears.map((year) => (
            <Badge
              key={year}
              variant="outline"
              className={cn(
                "text-[10px] font-semibold",
                isGlass && "border-white/20 bg-white/5",
              )}
            >
              {year}
            </Badge>
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

import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import { F1EmptyState, F1Badge, PitIcon } from "@/components/f1";
import TeamLogo from "@/components/common/TeamLogo";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { useConstructorCareer } from "@/hooks/entity";
import { cn } from "@/lib/utils";

export interface TeamHeritagePanelProps {
  constructorId: string;
  slug?: string;
  teamName?: string;
  teamColor?: string;
  compact?: boolean;
  className?: string;
}

function formatStat(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

const TeamHeritagePanel = ({
  constructorId,
  slug,
  teamName,
  teamColor,
  compact = false,
  className,
}: TeamHeritagePanelProps) => {
  const { isGlass } = useThemeVariant();
  const { data: profile, isLoading, isFetched } = useConstructorCareer({
    slug,
    ergastId: slug ? undefined : constructorId,
  });

  const mutedSurface = isGlass ? "bg-white/5" : "bg-muted";
  const displayName = profile?.display_name ?? teamName ?? "Team";
  const profileSlug = profile?.slug ?? slug;
  const color = profile?.team_color_hex ?? teamColor;

  if (isLoading) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-lg",
          compact ? "h-20" : "h-32",
          mutedSurface,
          className,
        )}
        aria-hidden
      />
    );
  }

  const hasHeritageData =
    profile &&
    (profile.championships != null ||
      profile.race_wins != null ||
      profile.bio_short);

  if (isFetched && !hasHeritageData) {
    if (compact) {
      return (
        <div className={cn("text-center py-2", className)}>
          {profileSlug ? (
            <Link
              to={`/teams/${profileSlug}`}
              className="text-sm text-primary hover:underline"
            >
              View team profile
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">
              Heritage records coming soon
            </span>
          )}
        </div>
      );
    }

    return (
      <F1EmptyState
        type="coming-soon"
        size="md"
        title="Team heritage coming soon"
        description="Championship history will appear here once the entity database is seeded."
        className={className}
      />
    );
  }

  if (!profile) return null;

  const championshipYears = profile.championship_years ?? [];

  return (
    <div className={cn("space-y-3", className)}>
      {!compact && color && (
        <div
          className="h-1 w-full rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}

      <div className="flex items-center gap-3">
        {!compact && (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border-2 bg-neutral-950 px-1.5"
            style={{ borderColor: color ?? undefined }}
          >
            <TeamLogo
              constructorId={constructorId}
              alt={displayName}
              className="max-h-9 max-w-28 object-contain"
              noBackground
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PitIcon icon={Trophy} size="sm" className="text-primary shrink-0" />
            <h4 className="instrument-label truncate text-muted-foreground">
              {compact ? "Heritage" : "Team Heritage"}
            </h4>
          </div>
          {!compact && profile.nationality && (
            <p className="text-xs text-muted-foreground">{profile.nationality}</p>
          )}
        </div>
        {profileSlug && compact && (
          <Link
            to={`/teams/${profileSlug}`}
            className="text-xs text-primary hover:underline shrink-0"
          >
            Profile →
          </Link>
        )}
      </div>

      {/* Instrument cluster — hairline tiles, mono readouts (no rainbow icons) */}
      <div
        className={cn(
          "grid divide-x divide-y divide-border overflow-hidden rounded-lg border border-border",
          compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4",
        )}
      >
        {[
          { label: "Titles", value: formatStat(profile.championships), gold: (profile.championships ?? 0) > 0 },
          { label: "Wins", value: formatStat(profile.race_wins), gold: false },
          { label: "Poles", value: formatStat(profile.pole_positions), gold: false },
          ...(!compact && profile.first_season != null
            ? [{ label: "Since", value: String(profile.first_season), gold: false }]
            : []),
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center justify-center gap-0.5 p-2.5 text-center">
            <span
              className={cn(
                "readout font-semibold tabular-nums",
                compact ? "text-sm" : "text-lg",
                s.gold ? "text-position-gold" : "text-foreground",
              )}
            >
              {s.value}
            </span>
            <span className="instrument-label text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {championshipYears.length > 0 && !compact && (
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

      {profile.bio_short && !compact && (
        <p className="text-sm text-muted-foreground leading-relaxed">
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

export default TeamHeritagePanel;

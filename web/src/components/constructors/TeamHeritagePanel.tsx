import { Link } from "react-router-dom";
import { Flag, Trophy, Zap } from "lucide-react";
import { F1EmptyState, PitIcon } from "@/components/f1";
import TeamLogo from "@/components/common/TeamLogo";
import { Badge } from "@/components/ui/badge";
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
              className="max-h-9 max-w-[7rem] object-contain"
              noBackground
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PitIcon icon={Trophy} size="sm" className="text-primary shrink-0" />
            <h4
              className={cn(
                "font-semibold uppercase tracking-wide text-muted-foreground truncate",
                compact ? "text-[10px]" : "text-xs",
              )}
            >
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

      <div
        className={cn(
          "grid gap-1.5",
          compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4",
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
          <p className="text-[8px] text-muted-foreground">Titles</p>
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
          <p className="text-[8px] text-muted-foreground">Wins</p>
        </div>
        <div className={cn("text-center rounded-md p-2", mutedSurface)}>
          <PitIcon icon={Zap} size="xs" className="mx-auto mb-0.5 text-blue-500" />
          <p className={cn("font-bold", compact ? "text-sm" : "text-lg")}>
            {formatStat(profile.pole_positions)}
          </p>
          <p className="text-[8px] text-muted-foreground">Poles</p>
        </div>
        {!compact && profile.first_season != null && (
          <div className={cn("text-center rounded-md p-2", mutedSurface)}>
            <p className="text-lg font-bold">{profile.first_season}</p>
            <p className="text-[8px] text-muted-foreground">Since</p>
          </div>
        )}
      </div>

      {championshipYears.length > 0 && !compact && (
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

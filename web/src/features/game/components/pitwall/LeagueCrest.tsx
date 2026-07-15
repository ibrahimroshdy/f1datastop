import { cn } from "@/lib/utils";
import { leagueAccent, leagueCrest } from "../../utils/leagueIdentity";

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-base",
  lg: "h-14 w-14 text-lg",
} as const;

/**
 * A league's crest badge — a set emoji or monogram on an accent-tinted carbon
 * tile with a coloured ring. Deterministic per league until a captain sets one,
 * so every league reads as its own thing instead of an identical text row.
 */
export function LeagueCrest({
  league,
  size = "md",
  className,
}: {
  league: { id?: string; name?: string; crest?: string | null; accent?: string | null };
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const accent = leagueAccent(league);
  const crest = leagueCrest(league);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-heading font-bold uppercase leading-none",
        SIZES[size],
        className,
      )}
      style={{
        color: accent,
        backgroundColor: `${accent}1a`,
        boxShadow: `inset 0 0 0 1.5px ${accent}66`,
      }}
      aria-hidden
    >
      {crest}
    </span>
  );
}

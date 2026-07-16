import CountryFlag from "@/components/common/CountryFlag";
import { cn } from "@/lib/utils";

/**
 * Canonical round label across the game: the race country flag with the round
 * number as small text beneath it. Falls back to just "Rxx" when the country
 * isn't known. Never show a bare "Rxx" without the flag.
 */
export function RoundFlag({
  round,
  country,
  size = 16,
  className,
}: {
  round: number | string;
  country?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-col items-center gap-0.5 leading-none", className)}>
      {country ? <CountryFlag country={country} size={size} className="rounded-[1px]" /> : null}
      <span className="timing text-[9px] text-muted-foreground">R{round}</span>
    </span>
  );
}

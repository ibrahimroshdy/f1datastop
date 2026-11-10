import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSeason } from "@/hooks/useSeason";
import { seasons } from "@/lib/links";
import { cn } from "@/lib/utils";

/**
 * The season, in the header pill and the top bar (docs/design/decisions.md D21). One choice
 * for every page, kept in the address. Uses the app's own Select, never a native one.
 */
export function SeasonPill({ className }: { className?: string }) {
  const [season, setSeason] = useSeason();
  return (
    <Select value={String(season)} onValueChange={(v) => setSeason(Number(v))}>
      <SelectTrigger
        aria-label="Season"
        className={cn("press h-9 w-auto gap-1.5 rounded-full border-0 bg-card px-3.5 text-sm font-semibold ring-1 ring-border", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {seasons().map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

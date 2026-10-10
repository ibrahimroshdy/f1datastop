import { cn } from "@/lib/utils";
import { TYRE_HSL } from "../replayEngine";

const LABEL: Record<string, string> = { S: "Soft", M: "Medium", H: "Hard", I: "Inter", W: "Wet" };

interface Props {
  /** Compound letter S/M/H/I/W. */
  compound?: string | null;
  /** Tyre age in laps. */
  age?: number | null;
  size?: "sm" | "md";
  className?: string;
}

/**
 * F1 tyre marker — the compound letter in its compound colour, plus age in laps.
 * No bounding box (kept minimal so it doesn't crowd the driver photo).
 */
export function TyreBadge({ compound, age, size = "sm", className }: Props) {
  if (!compound) return null;
  // Accept a letter (S/M/H/I/W) or a full word (SOFT/MEDIUM/…) — the first char is the code.
  const c = compound.trim().toUpperCase().charAt(0);
  const color = TYRE_HSL[c] ?? "hsl(var(--muted-foreground))";
  return (
    <span className={cn("inline-flex items-baseline gap-0.5", className)} title={`${LABEL[c] ?? c}${age != null ? ` · ${age} lap${age === 1 ? "" : "s"}` : ""}`}>
      <span className={cn("font-bold leading-none", size === "md" ? "text-[11px]" : "text-[9px]")} style={{ color }}>
        {c}
      </span>
      {age != null && <span className="text-[9px] font-medium tabular-nums text-muted-foreground">{age}</span>}
    </span>
  );
}

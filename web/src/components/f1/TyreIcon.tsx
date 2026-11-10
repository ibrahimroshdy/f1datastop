import { TYRE_COLORS, TYRE_LABELS, tyreCode } from "@/constants/tyres";
import { cn } from "@/lib/utils";

/**
 * The tyre icon (docs/design/decisions.md D16): the black tyre, the compound's band near the
 * rim, the letter in the band's colour. One drawing from 16 to 48 px; below 20 px the band and
 * letter thicken so the letter stays readable. Optional tyre age in laps beside it.
 */
export function TyreIcon({
  compound,
  size = 20,
  age,
  className,
}: {
  compound?: string | null;
  size?: number;
  /** Laps on this set, shown beside the icon when given. */
  age?: number | null;
  className?: string;
}) {
  const c = tyreCode(compound);
  if (!c) return null;
  const col = TYRE_COLORS[c];
  const small = size < 20;
  const label = `${TYRE_LABELS[c]} tyre${age != null ? `, ${age} lap${age === 1 ? "" : "s"} old` : ""}`;
  return (
    <span className={cn("inline-flex items-center gap-1", className)} role="img" aria-label={label} title={label}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <circle cx="16" cy="16" r="16" fill="#16161A" />
        <circle cx="16" cy="16" r={small ? 12.2 : 12.6} fill="none" stroke={col} strokeWidth={small ? 5.2 : 4.4} />
        <circle cx="16" cy="16" r="15.5" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1" />
        <text
          x="16"
          y="16.6"
          textAnchor="middle"
          dominantBaseline="central"
          fill={col}
          style={{ font: `800 ${small ? 15 : 13.5}px var(--font-sans)` }}
        >
          {c}
        </text>
      </svg>
      {age != null && <span className="font-mono text-xs tabular-nums text-muted-foreground">{age}</span>}
    </span>
  );
}

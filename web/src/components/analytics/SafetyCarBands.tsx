import { ReferenceArea } from "recharts";
import { cn } from "@/lib/utils";
import type { SafetyPeriod, SafetyPeriodKind } from "@/lib/f1/safetyPeriods";
import { kindTag } from "@/lib/f1/safetyPeriods";

// Categorical band colours (DESIGN.md §1.7 — named tokens for encodings).
// SC + VSC are yellow in F1; VSC is distinguished by a dashed edge + label.
export const BAND_COLOR: Record<SafetyPeriodKind, string> = {
  SC: "hsl(var(--position-gold))",
  VSC: "hsl(var(--position-gold))",
  RED: "hsl(var(--destructive))",
};

/**
 * Recharts <ReferenceArea> bands for SC/VSC/red-flag lap ranges. Spread the
 * returned array directly into a Cartesian chart's children so recharts registers
 * them, e.g.  {safetyBands(periods)}  inside a <LineChart>.
 */
export function safetyBands(periods: SafetyPeriod[]): JSX.Element[] {
  return periods.map((p, i) => (
    <ReferenceArea
      key={`safety-${p.kind}-${p.startLap}-${i}`}
      x1={p.startLap}
      x2={p.endLap}
      fill={BAND_COLOR[p.kind]}
      fillOpacity={p.kind === "RED" ? 0.12 : 0.1}
      stroke={BAND_COLOR[p.kind]}
      strokeOpacity={0.35}
      strokeWidth={1}
      strokeDasharray={p.kind === "VSC" ? "4 3" : undefined}
      ifOverflow="hidden"
      label={{
        value: kindTag(p.kind),
        position: "insideTop",
        fontSize: 9,
        fill: BAND_COLOR[p.kind],
        fontFamily: "var(--font-mono, monospace)",
      }}
    />
  ));
}

/** Small legend row shown under/above a chart when any periods exist. */
export function SafetyLegend({ periods, className }: { periods: SafetyPeriod[]; className?: string }) {
  if (!periods.length) return null;
  const kinds = Array.from(new Set(periods.map((p) => p.kind)));
  const seen: Record<SafetyPeriodKind, string> = { SC: "Safety Car", VSC: "Virtual SC", RED: "Red Flag" };
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground", className)}>
      {kinds.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-3.5 rounded-[2px]"
            style={{
              backgroundColor: BAND_COLOR[k],
              opacity: 0.35,
              outline: k === "VSC" ? `1px dashed ${BAND_COLOR[k]}` : undefined,
            }}
          />
          {seen[k]}
        </span>
      ))}
    </div>
  );
}

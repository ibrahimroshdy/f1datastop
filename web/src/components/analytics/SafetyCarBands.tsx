import { cn } from "@/lib/utils";
import type { SafetyPeriod, SafetyPeriodKind } from "@/lib/f1/safetyPeriods";
import { BAND_COLOR } from "./safetyBands";

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

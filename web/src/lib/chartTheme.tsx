/**
 * Shared "scope" chart theming for recharts — the Telemetry Terminal look.
 * (see web/DESIGN_TERMINAL.md). Dark plot, hairline grid, mono tabular ticks,
 * dark-glass crosshair tooltip, gradient area-fade + soft series glow.
 *
 * Usage:
 *   import { chartTheme, ScopeDefs, scopeFadeId, SCOPE_GLOW } from "@/lib/chartTheme";
 *   <LineChart>
 *     <defs><ScopeDefs id="ver" color={teamColor} /></defs>
 *     <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
 *     <XAxis tick={chartTheme.tick} stroke={chartTheme.axis} />
 *     <Tooltip contentStyle={chartTheme.tooltipContentStyle} cursor={chartTheme.cursor} />
 *     <Area fill={`url(#${scopeFadeId("ver")})`} stroke={teamColor} filter={SCOPE_GLOW} />
 *   </LineChart>
 */
const MONO = "var(--font-mono, 'JetBrains Mono', monospace)";

export const chartTheme = {
  grid: "hsl(var(--border))",
  axis: "hsl(var(--border))",
  tick: {
    fontSize: 11,
    fontFamily: MONO,
    fill: "hsl(var(--muted-foreground))",
  },
  tooltipContentStyle: {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.5rem",
    boxShadow: "var(--shadow-card)",
    fontSize: 12,
    fontFamily: MONO,
    color: "hsl(var(--foreground))",
  } as React.CSSProperties,
  tooltipLabelStyle: {
    color: "hsl(var(--muted-foreground))",
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
  } as React.CSSProperties,
  cursor: { stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" },
  primary: "hsl(var(--primary))",
  gain: "hsl(var(--status-completed))",
  loss: "hsl(var(--destructive))",
};

/** Stable id for a per-series area-fade gradient. */
export const scopeFadeId = (key: string) =>
  `scope-fade-${key.replace(/[^a-zA-Z0-9_-]/g, "")}`;

/** Reference this in a series' `filter` prop for the soft glow. */
export const SCOPE_GLOW = "url(#scope-glow)";

/**
 * Drop into a recharts <defs>: a vertical area-fade gradient (color -> transparent)
 * for `key`, plus the shared soft-glow filter (rendered once is enough, but it's
 * idempotent by id). Pass the series color (token string or team hex).
 */
export function ScopeDefs({ id, color }: { id: string; color: string }) {
  return (
    <>
      <linearGradient id={scopeFadeId(id)} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={0.28} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </linearGradient>
      <filter id="scope-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </>
  );
}

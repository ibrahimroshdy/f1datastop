import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { F1Card, F1CardContent, F1CardFooter, F1CardHeader } from "@/components/f1";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { chartTheme, ScopeDefs, SCOPE_GLOW } from "@/lib/chartTheme";
import CountryFlag from "@/components/common/CountryFlag";
import { useAllDriverResultsBySeason } from "@/hooks/f1";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { ChartSkeleton } from "@/components/f1";
import { cn } from "@/lib/utils";

/** One competitor line: a driver, or a team (points summed across its drivers). */
export interface ProgressionSeries {
  /** react-query key part — the ergast driverIds whose per-round points feed this line. */
  driverIds: string[];
  /** Short label shown in the legend + tooltip (driver code or team short name). */
  code: string;
  color: string;
}

interface Props {
  year: number;
  series: ProgressionSeries[];
  title?: string;
  subtitle?: string;
}

const gpShort = (name: string) => {
  const w = name.replace(/grand prix/i, "").trim();
  return (w.length <= 4 ? w : w.slice(0, 3)).toUpperCase();
};

/**
 * Cumulative points through the season — one line per driver or team, coloured by
 * team. Reads `hsl(var(--token))` via chartTheme, so it re-themes automatically in
 * light / dark / glass. The interactive twin of the `championship` poster's curve.
 */
export default function PointsProgressionChart({ year, series, title, subtitle }: Props) {
  const { isGlass, cardVariant, glassVariant } = useThemeVariant();
  const { data: allRes, isLoading } = useAllDriverResultsBySeason(year);
  const byDriver = (allRes?.data ?? {}) as Record<
    string,
    Array<{ round: string; raceName?: string; country?: string; points?: number }>
  >;

  const chartData = useMemo(() => {
    // Every round any of the plotted competitors contested, with its flag/name.
    const rounds = new Map<number, { raceName: string; country: string }>();
    for (const s of series) {
      for (const id of s.driverIds) {
        for (const r of byDriver[id] ?? []) {
          const rn = Number(r.round);
          if (!rounds.has(rn)) {
            rounds.set(rn, { raceName: getRaceNameWithoutEmoji(r.raceName ?? ""), country: r.country ?? "" });
          }
        }
      }
    }
    const ordered = [...rounds.keys()].sort((a, b) => a - b);

    // per-round total (summed over a series' driverIds), then a running cumulative.
    const cumulative: Record<string, Record<number, number>> = {};
    for (const s of series) {
      const perRound: Record<number, number> = {};
      for (const id of s.driverIds) {
        for (const r of byDriver[id] ?? []) {
          perRound[Number(r.round)] = (perRound[Number(r.round)] ?? 0) + Number(r.points ?? 0);
        }
      }
      let run = 0;
      const m: Record<number, number> = {};
      for (const rn of ordered) {
        if (perRound[rn] != null) run += perRound[rn];
        m[rn] = run;
      }
      cumulative[s.code] = m;
    }

    return ordered.map((rn) => {
      const meta = rounds.get(rn)!;
      const row: Record<string, number | string> = {
        round: rn,
        raceName: meta.raceName,
        gpShort: gpShort(meta.raceName),
        country: meta.country,
      };
      for (const s of series) row[s.code] = cumulative[s.code][rn];
      return row;
    });
  }, [byDriver, series]);

  const chartConfig = useMemo(
    () =>
      Object.fromEntries(series.map((s) => [s.code, { label: s.code, color: s.color }])) as ChartConfig,
    [series],
  );

  const RaceTick = (props: { x?: number; y?: number; payload?: { value?: string | number } }) => {
    const { x, y, payload } = props;
    const d = chartData.find((r) => String(r.round) === String(payload?.value));
    if (x == null || y == null || !d) return null;
    return (
      <g transform={`translate(${x},${y})`}>
        <foreignObject x={-16} y={6} width={32} height={36} style={{ overflow: "visible" }}>
          <div className="flex flex-col items-center gap-0.5">
            {d.country ? (
              <CountryFlag country={String(d.country)} size={14} className="rounded-[1px] shadow-sm" />
            ) : (
              <span className="text-[9px] text-muted-foreground">R{d.round}</span>
            )}
            <span className="text-[8px] font-semibold uppercase leading-none tracking-wide text-muted-foreground">
              {d.gpShort}
            </span>
          </div>
        </foreignObject>
      </g>
    );
  };

  return (
    <F1Card variant={cardVariant} glassVariant={glassVariant} className={cn("p-0", isGlass && "border-white/10")}>
      <F1CardHeader className="pb-2">
        <div className="instrument-label text-muted-foreground">{title ?? "Points Progression"}</div>
        <p className="text-xs text-muted-foreground">{subtitle ?? "Cumulative points through the season"}</p>
      </F1CardHeader>
      <F1CardContent className="pb-2">
        {isLoading ? (
          <ChartSkeleton height={220} />
        ) : (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <LineChart data={chartData} margin={{ top: 16, left: 8, right: 16, bottom: 8 }}>
              <defs>
                <ScopeDefs id="pointsprog" color={chartTheme.primary} />
              </defs>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="round"
                stroke={chartTheme.axis}
                tickLine={false}
                axisLine={false}
                height={40}
                interval={chartData.length > 20 ? 1 : 0}
                tick={<RaceTick />}
              />
              <YAxis
                stroke={chartTheme.axis}
                tick={chartTheme.tick}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={34}
                allowDecimals={false}
              />
              <ChartTooltip
                cursor={chartTheme.cursor}
                content={
                  <ChartTooltipContent
                    className="rounded-lg border-border bg-card font-mono text-xs shadow-card"
                    labelFormatter={(value, payload) => {
                      const data = payload?.[0]?.payload;
                      if (data) {
                        return (
                          <div className="flex items-center gap-1.5">
                            {data.country ? <CountryFlag country={data.country} size={13} /> : null}
                            <span className="font-medium">{data.raceName}</span>
                          </div>
                        );
                      }
                      return value;
                    }}
                  />
                }
              />
              {series.map((s) => (
                <Line
                  key={s.code}
                  dataKey={s.code}
                  type="monotone"
                  stroke={s.color}
                  strokeWidth={2.2}
                  filter={SCOPE_GLOW}
                  dot={false}
                  activeDot={{ r: 5, fill: s.color, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </F1CardContent>
      <F1CardFooter className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t-0 pt-0 text-sm">
        {series.map((s) => (
          <span key={s.code} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="timing text-xs font-semibold">{s.code}</span>
          </span>
        ))}
      </F1CardFooter>
    </F1Card>
  );
}

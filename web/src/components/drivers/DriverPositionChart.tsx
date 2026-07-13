import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { F1Card, F1CardContent, F1CardFooter, F1CardHeader } from "@/components/f1";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { chartTheme, ScopeDefs, SCOPE_GLOW } from "@/lib/chartTheme";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import CountryFlag from "@/components/common/CountryFlag";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { cn } from "@/lib/utils";
import type { DriverRaceResult } from "./driverCardTypes";

interface DriverPositionChartProps {
  history: DriverRaceResult[];
  teamColor: string;
}

/** Short GP tag under the flag (e.g. "British Grand Prix" → "BRI", "Monaco" → "MON"). */
const gpShort = (name: string) => {
  const w = name.replace(/grand prix/i, "").trim();
  return (w.length <= 4 ? w : w.slice(0, 3)).toUpperCase();
};

/** Result → token colour (podium gold/bronze, points blue, else team colour). */
const dotColor = (pos: number, teamColor: string) =>
  pos === 1
    ? "hsl(var(--position-gold))"
    : pos <= 3
      ? "hsl(var(--position-bronze))"
      : pos <= 10
        ? "hsl(var(--status-completed))"
        : teamColor;

/** DNF marker — an ×-in-ring on the retirement lane (clearly not a finish dot). */
const DnfMark = (props: { cx?: number; cy?: number }) => {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={6.5} fill="hsl(var(--loss) / 0.14)" stroke="hsl(var(--loss))" strokeWidth={1.2} />
      <line x1={cx - 3} y1={cy - 3} x2={cx + 3} y2={cy + 3} stroke="hsl(var(--loss))" strokeWidth={1.6} strokeLinecap="round" />
      <line x1={cx - 3} y1={cy + 3} x2={cx + 3} y2={cy - 3} stroke="hsl(var(--loss))" strokeWidth={1.6} strokeLinecap="round" />
    </g>
  );
};

const DriverPositionChart = ({ history, teamColor }: DriverPositionChartProps) => {
  const { isGlass, cardVariant, glassVariant } = useThemeVariant();

  const chartData = useMemo(
    () =>
      history.map((race) => {
        const name = getRaceNameWithoutEmoji(race.raceName);
        return {
          round: race.round,
          raceName: name,
          gpShort: gpShort(name),
          country: race.country ?? "",
          position: race.isDNF ? null : Number(race.position),
          isDNF: !!race.isDNF,
          points: race.points,
        };
      }),
    [history],
  );

  const stats = useMemo(() => {
    const positions = history.filter((r) => r.position && !r.isDNF).map((r) => Number(r.position));
    return { wins: positions.filter((p) => p === 1).length, dnfs: history.filter((r) => r.isDNF).length };
  }, [history]);

  // Y scale + a dedicated DNF lane at the bottom (below the worst finish).
  const { yDomain, yTicks, dnfLane, hasDNF } = useMemo(() => {
    const finishes = chartData.filter((d) => d.position != null).map((d) => d.position as number);
    const dnf = chartData.some((d) => d.isDNF);
    const best = finishes.length ? Math.min(...finishes) : 1;
    const worst = finishes.length ? Math.max(...finishes) : 20;
    const top = Math.max(1, best - 1);
    const lane = Math.min(24, worst + 2);
    const bottom = dnf ? lane : Math.min(22, worst + 1);
    const ticks = [1, 5, 10, 15, 20].filter((t) => t >= top && t <= worst);
    if (!ticks.includes(top)) ticks.unshift(top);
    return { yDomain: [top, bottom] as [number, number], yTicks: ticks, dnfLane: lane, hasDNF: dnf };
  }, [chartData]);

  const chartConfig = { position: { label: "Position", color: teamColor } } satisfies ChartConfig;

  // X tick = country flag + short GP tag (replaces "R1/R2/…").
  const RaceTick = (props: { x?: number; y?: number; payload?: { value?: string | number } }) => {
    const { x, y, payload } = props;
    const d = chartData.find((r) => String(r.round) === String(payload?.value));
    if (x == null || y == null || !d) return null;
    return (
      <g transform={`translate(${x},${y})`}>
        <foreignObject x={-16} y={6} width={32} height={36} style={{ overflow: "visible" }}>
          <div className="flex flex-col items-center gap-0.5">
            {d.country ? (
              <CountryFlag country={d.country} size={14} className="rounded-[1px] shadow-sm" />
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

  if (history.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No race data available
      </div>
    );
  }

  return (
    <F1Card variant={cardVariant} glassVariant={glassVariant} className={cn("p-0", isGlass && "border-white/10")}>
      <F1CardHeader className="pb-2">
        <div className="instrument-label text-muted-foreground">Season Position Trend</div>
        <p className="text-xs text-muted-foreground">Race finishing positions throughout the season</p>
      </F1CardHeader>
      <F1CardContent className="pb-2">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <LineChart data={chartData} margin={{ top: 16, left: 8, right: 16, bottom: 8 }}>
            <defs>
              <ScopeDefs id="dpos" color={chartTheme.primary} />
            </defs>
            <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="round"
              stroke={chartTheme.axis}
              tickLine={false}
              axisLine={false}
              height={40}
              interval={history.length > 20 ? 1 : 0}
              tick={<RaceTick />}
            />
            <YAxis
              domain={yDomain}
              ticks={yTicks}
              reversed
              stroke={chartTheme.axis}
              tick={chartTheme.tick}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `P${value}`}
              width={34}
            />

            {/* DNF retirement lane */}
            {hasDNF && (
              <ReferenceLine
                y={dnfLane}
                stroke="hsl(var(--loss))"
                strokeDasharray="2 3"
                strokeOpacity={0.45}
                label={{ value: "DNF", position: "insideLeft", fill: "hsl(var(--loss))", fontSize: 9, dy: -6 }}
              />
            )}

            <ChartTooltip
              cursor={chartTheme.cursor}
              content={
                <ChartTooltipContent
                  indicator="line"
                  className="rounded-lg border-border bg-card font-mono text-xs shadow-card"
                  labelFormatter={(value, payload) => {
                    if (payload?.[0]) {
                      const data = payload[0].payload;
                      return (
                        <div className="flex items-center gap-1.5">
                          {data.country ? <CountryFlag country={data.country} size={13} /> : null}
                          <span className="font-medium">{data.raceName}</span>
                        </div>
                      );
                    }
                    return value;
                  }}
                  formatter={(value, _name, item) => {
                    const data =
                      typeof item === "object" && item !== null && "payload" in item
                        ? (item as { payload: { isDNF?: boolean; points?: number } }).payload
                        : undefined;
                    if (data?.isDNF) {
                      return (
                        <div className="flex items-center gap-2">
                          <span className="text-base leading-none text-loss">✕</span>
                          <span className="font-medium text-loss">DNF · Retired</span>
                        </div>
                      );
                    }
                    const pos = Number(value);
                    const color =
                      pos === 1
                        ? "text-position-gold"
                        : pos <= 3
                          ? "text-position-bronze"
                          : pos <= 10
                            ? "text-status-completed"
                            : "";
                    return (
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor(pos, teamColor) }} />
                        <span className={cn("font-medium tabular-nums", color)}>P{value}</span>
                        {data && (data.points ?? 0) > 0 && (
                          <span className="text-xs tabular-nums text-muted-foreground">+{data.points} pts</span>
                        )}
                      </div>
                    );
                  }}
                />
              }
            />

            <Line
              dataKey="position"
              type="monotone"
              stroke="var(--color-position)"
              strokeWidth={2}
              filter={SCOPE_GLOW}
              connectNulls={false}
              dot={({ cx, cy, payload }) => {
                if (payload.isDNF || payload.position === null || cx == null || cy == null) {
                  return <g key={`dot-${payload.round}`} />;
                }
                const pos = Number(payload.position);
                return (
                  <circle
                    key={`dot-${payload.round}`}
                    cx={cx}
                    cy={cy}
                    r={pos === 1 ? 5 : 4}
                    fill={dotColor(pos, teamColor)}
                    stroke="hsl(var(--card))"
                    strokeWidth={1.5}
                  />
                );
              }}
              activeDot={{ r: 6, fill: teamColor, stroke: "hsl(var(--card))", strokeWidth: 2 }}
            />

            {/* DNF markers on the retirement lane */}
            {hasDNF &&
              chartData.map((d) =>
                d.isDNF ? <ReferenceDot key={`dnf-${d.round}`} x={d.round} y={dnfLane} r={0} isFront shape={<DnfMark />} /> : null,
              )}
          </LineChart>
        </ChartContainer>
      </F1CardContent>
      <F1CardFooter className="flex-col items-start gap-2 border-t-0 pt-0 text-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-position-gold" />
            <span className="text-xs text-muted-foreground">Win</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-position-bronze" />
            <span className="text-xs text-muted-foreground">Podium</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-status-completed" />
            <span className="text-xs text-muted-foreground">Points</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-bold leading-none text-loss">✕</span>
            <span className="text-xs text-muted-foreground">DNF</span>
          </span>
        </div>
        <div className="flex gap-3 text-xs leading-none text-muted-foreground">
          {stats.wins > 0 && (
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3 text-position-gold" />
              <span className="tabular-nums">{stats.wins}</span> win{stats.wins > 1 ? "s" : ""}
            </span>
          )}
          {stats.dnfs > 0 && (
            <span className="flex items-center gap-1 text-loss">
              <span className="font-bold">✕</span>
              <span className="tabular-nums">{stats.dnfs}</span> DNF{stats.dnfs > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </F1CardFooter>
    </F1Card>
  );
};

export default DriverPositionChart;

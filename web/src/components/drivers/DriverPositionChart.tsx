import { useMemo } from "react";
import { Trophy } from "lucide-react";
import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardFooter,
  F1CardHeader,
  F1CardTitle,
} from "@/components/f1";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { chartTheme, ScopeDefs, SCOPE_GLOW } from "@/lib/chartTheme";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { cn } from "@/lib/utils";
import type { DriverRaceResult } from "./driverCardTypes";

interface DriverPositionChartProps {
  history: DriverRaceResult[];
  teamColor: string;
}

const DriverPositionChart = ({ history, teamColor }: DriverPositionChartProps) => {
  const { isGlass, cardVariant, glassVariant } = useThemeVariant();

  const chartData = useMemo(
    () =>
      history.map((race) => ({
        round: `R${race.round}`,
        position: race.isDNF ? null : Number(race.position),
        raceName: getRaceNameWithoutEmoji(race.raceName),
        isDNF: race.isDNF,
        points: race.points,
      })),
    [history],
  );

  const stats = useMemo(() => {
    const positions = history
      .filter((r) => r.position && !r.isDNF)
      .map((r) => Number(r.position));
    const wins = positions.filter((p) => p === 1).length;
    const dnfs = history.filter((r) => r.isDNF).length;
    return { wins, dnfs };
  }, [history]);

  const chartConfig = {
    position: {
      label: "Position",
      color: teamColor,
    },
  } satisfies ChartConfig;

  const yDomain = useMemo(() => {
    const positions = chartData
      .filter((d) => d.position !== null)
      .map((d) => d.position as number);
    if (positions.length === 0) return [1, 20];
    const min = Math.max(1, Math.min(...positions) - 1);
    const max = Math.min(22, Math.max(...positions) + 2);
    return [min, max];
  }, [chartData]);

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No race data available
      </div>
    );
  }

  return (
    <F1Card
      variant={cardVariant}
      glassVariant={glassVariant}
      className={cn("p-0", isGlass && "border-white/10")}
    >
      <F1CardHeader className="pb-2">
        <F1CardTitle className="!text-sm !font-medium">Season Position Trend</F1CardTitle>
        <F1CardDescription>Race finishing positions throughout the season</F1CardDescription>
      </F1CardHeader>
      <F1CardContent className="pb-2">
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <LineChart
            data={chartData}
            margin={{ top: 20, left: 12, right: 12, bottom: 0 }}
          >
            <defs>
              <ScopeDefs id="dpos" color={chartTheme.primary} />
            </defs>
            <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="round"
              stroke={chartTheme.axis}
              tick={chartTheme.tick}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={history.length > 15 ? 2 : history.length > 10 ? 1 : 0}
            />
            <YAxis
              domain={yDomain}
              reversed
              stroke={chartTheme.axis}
              tick={chartTheme.tick}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `P${value}`}
              width={32}
            />
            <ChartTooltip
              cursor={chartTheme.cursor}
              content={
                <ChartTooltipContent
                  indicator="line"
                  className="bg-card border-border rounded-lg shadow-card font-mono text-xs"
                  labelFormatter={(value, payload) => {
                    if (payload?.[0]) {
                      const data = payload[0].payload;
                      return (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{data.raceName}</span>
                          <span className="text-muted-foreground text-xs uppercase tracking-wider">{value}</span>
                        </div>
                      );
                    }
                    return value;
                  }}
                  formatter={(value, _name, item) => {
                    const data = typeof item === 'object' && item !== null && 'payload' in item
                      ? (item as { payload: { isDNF?: boolean; points?: number } }).payload
                      : undefined;
                    if (data?.isDNF) {
                      return (
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                          <span className="text-red-500 font-medium">DNF</span>
                        </div>
                      );
                    }
                    const pos = Number(value);
                    const color =
                      pos === 1
                        ? "text-yellow-500"
                        : pos <= 3
                          ? "text-amber-500"
                          : pos <= 10
                            ? "text-green-500"
                            : "";
                    return (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              pos === 1
                                ? "#eab308"
                                : pos <= 3
                                  ? "#f59e0b"
                                  : pos <= 10
                                    ? "#22c55e"
                                    : teamColor,
                          }}
                        />
                        <span className={cn("font-medium font-mono tabular-nums", color)}>P{value}</span>
                        {data && (data.points ?? 0) > 0 && (
                          <span className="text-muted-foreground text-xs font-mono tabular-nums">
                            +{data.points} pts
                          </span>
                        )}
                      </div>
                    );
                  }}
                />
              }
            />
            <Line
              dataKey="position"
              type="natural"
              stroke="var(--color-position)"
              strokeWidth={2}
              filter={SCOPE_GLOW}
              dot={({ cx, cy, payload }) => {
                if (payload.isDNF || payload.position === null) {
                  return (
                    <circle
                      key={`dot-${payload.round}`}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="#ef4444"
                      stroke="#ef4444"
                      strokeWidth={1}
                    />
                  );
                }
                const pos = Number(payload.position);
                const fillColor =
                  pos === 1
                    ? "#eab308"
                    : pos <= 3
                      ? "#f59e0b"
                      : pos <= 10
                        ? "#22c55e"
                        : teamColor;
                return (
                  <circle
                    key={`dot-${payload.round}`}
                    cx={cx}
                    cy={cy}
                    r={pos === 1 ? 5 : 4}
                    fill={fillColor}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                );
              }}
              activeDot={{
                r: 6,
                fill: teamColor,
                stroke: "white",
                strokeWidth: 2,
              }}
              connectNulls={false}
            />
          </LineChart>
        </ChartContainer>
      </F1CardContent>
      <F1CardFooter className="flex-col items-start gap-2 text-sm pt-0 border-t-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground text-xs">Win</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-muted-foreground text-xs">Podium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-muted-foreground text-xs">Points</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-muted-foreground text-xs">DNF</span>
          </div>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground leading-none">
          {stats.wins > 0 && (
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3 text-yellow-500" />
              {stats.wins} win{stats.wins > 1 ? "s" : ""}
            </span>
          )}
          {stats.dnfs > 0 && (
            <span className="text-red-500">
              {stats.dnfs} DNF{stats.dnfs > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </F1CardFooter>
    </F1Card>
  );
};

export default DriverPositionChart;

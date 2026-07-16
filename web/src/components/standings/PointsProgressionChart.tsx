import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { F1Card, F1CardContent, F1CardFooter, F1CardHeader } from "@/components/f1";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { chartTheme, ScopeDefs, SCOPE_GLOW } from "@/lib/chartTheme";
import CountryFlag from "@/components/common/CountryFlag";
import TeamLogo from "@/components/common/TeamLogo";
import { getF1TeamLogoUrl } from "@/constants/f1TeamLogoMedia";
import {
  buildF1DriverHeadshotUrl,
  getF1PortraitPathForErgastDriverId,
} from "@/constants/f1DriverPortraitMedia";
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
  /** Constructor for the legend's team logo. */
  constructorId?: string;
  /** Ergast id — resolves the driver photo shown at the end of the line. */
  driverId?: string;
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
  const [showImages, setShowImages] = useState(true);
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

  // Teammates share a team colour, so the 2nd (and 3rd) driver of each team gets
  // a dashed line — keeps the 11 colour-pairs distinguishable with all drivers shown.
  const dashByCode = useMemo(() => {
    const seen = new Map<string, number>();
    const m: Record<string, string | undefined> = {};
    for (const s of series) {
      const key = s.constructorId ?? s.code;
      const idx = seen.get(key) ?? 0;
      seen.set(key, idx + 1);
      m[s.code] = idx === 0 ? undefined : idx === 1 ? "5 4" : "2 3";
    }
    return m;
  }, [series]);

  const lastIdx = chartData.length - 1;
  // End-of-line image: driver photo (drivers chart) or team logo (constructors).
  const endImageByCode = useMemo(() => {
    const m: Record<string, string | undefined> = {};
    for (const s of series) {
      if (s.driverId) {
        const p = getF1PortraitPathForErgastDriverId(s.driverId);
        m[s.code] = p ? buildF1DriverHeadshotUrl(p) : undefined;
      } else if (s.constructorId) {
        m[s.code] = getF1TeamLogoUrl(s.constructorId) ?? undefined;
      }
    }
    return m;
  }, [series]);

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
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="instrument-label text-muted-foreground">{title ?? "Points Progression"}</div>
            <p className="text-xs text-muted-foreground">{subtitle ?? "Cumulative points through the season"}</p>
          </div>
          <label className="flex shrink-0 cursor-pointer select-none items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showImages}
              onChange={(e) => setShowImages(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Images
          </label>
        </div>
      </F1CardHeader>
      <F1CardContent className="pb-2">
        {isLoading ? (
          <ChartSkeleton height={220} />
        ) : (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <LineChart data={chartData} margin={{ top: 16, left: 8, right: 26, bottom: 8 }}>
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
                  strokeWidth={1.8}
                  strokeDasharray={dashByCode[s.code]}
                  filter={SCOPE_GLOW}
                  dot={showImages ? (dp: { cx?: number; cy?: number; index?: number; key?: string }) => {
                    const { cx, cy, index, key } = dp;
                    if (index !== lastIdx || cx == null || cy == null) return <g key={key} />;
                    const url = endImageByCode[s.code];
                    const R = 11;
                    const clip = `end-${s.code}`;
                    return (
                      <g key={key}>
                        <clipPath id={clip}>
                          <circle cx={cx} cy={cy} r={R} />
                        </clipPath>
                        {url ? (
                          <image
                            href={url}
                            x={cx - R}
                            y={cy - R}
                            width={2 * R}
                            height={2 * R}
                            clipPath={`url(#${clip})`}
                            preserveAspectRatio="xMidYMid slice"
                          />
                        ) : null}
                        <circle cx={cx} cy={cy} r={R} fill={url ? "none" : s.color} stroke={s.color} strokeWidth={2} />
                      </g>
                    );
                  } : false}
                  activeDot={{ r: 4, fill: s.color, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </F1CardContent>
      <F1CardFooter className="grid grid-cols-3 gap-x-2 gap-y-1.5 border-t-0 pt-0 sm:grid-cols-4 lg:grid-cols-6">
        {series.map((s) => (
          <span key={s.code} className="flex items-center gap-1.5" title={s.code}>
            <svg width="14" height="4" className="shrink-0" aria-hidden>
              <line
                x1="0"
                y1="2"
                x2="14"
                y2="2"
                stroke={s.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={dashByCode[s.code] ? "3 2" : undefined}
              />
            </svg>
            {s.constructorId ? (
              <TeamLogo constructorId={s.constructorId} size="sm" noBackground className="!h-3.5 w-auto shrink-0" />
            ) : null}
            <span className="timing text-2xs font-semibold">{s.code}</span>
          </span>
        ))}
      </F1CardFooter>
    </F1Card>
  );
}

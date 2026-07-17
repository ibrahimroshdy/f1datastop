import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { chartTheme } from "@/lib/chartTheme";
import type { RaceReplayBlob } from "@/services/raceReplayService";

interface Props {
  blob?: RaceReplayBlob;
  selected: string[];
  /** Current lap from the race player — drawn as a vertical marker over the full race. */
  currentLap?: number;
}

/** Position-over-laps for the selected drivers (whole race) with a current-lap marker. */
export function PositionChart({ blob, selected, currentLap }: Props) {
  const model = useMemo(() => {
    if (!blob?.drivers) return null;
    const codes = selected.filter((c) => blob.drivers.some((d) => d.code === c));
    if (!codes.length) return null;
    const colorOf: Record<string, string> = {};
    const posByLap: Record<string, Record<number, number>> = {};
    let maxLap = blob.total_laps ?? 0;
    let maxPos = 0;
    for (const c of codes) {
      const d = blob.drivers.find((x) => x.code === c)!;
      colorOf[c] = d.team_color || "#9ca3af";
      const m: Record<number, number> = {};
      let fi = 0;
      for (const l of (d.laps ?? []).slice().sort((a, b) => a.n - b.n)) {
        const te = l.s3t ?? l.te;
        if (te == null) continue;
        while (fi < blob.times.length - 1 && blob.times[fi] < te) fi++;
        const p = d.pos?.[fi];
        if (p != null) {
          m[l.n] = p;
          maxPos = Math.max(maxPos, p);
          maxLap = Math.max(maxLap, l.n);
        }
      }
      posByLap[c] = m;
    }
    return { codes, colorOf, posByLap, maxLap: Math.max(1, maxLap), maxPos: Math.max(2, maxPos) };
  }, [blob, selected]);

  if (!model) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
        Select drivers to chart their positions.
      </div>
    );
  }

  const { codes, colorOf, posByLap, maxLap, maxPos } = model;
  const rows: Record<string, number | null>[] = [];
  for (let lap = 1; lap <= maxLap; lap++) {
    const row: Record<string, number | null> = { lap };
    for (const c of codes) row[c] = posByLap[c][lap] ?? null;
    rows.push(row);
  }
  const marker = currentLap && currentLap >= 1 && currentLap <= maxLap ? currentLap : null;

  return (
    <ResponsiveContainer width="100%" height={170}>
      <LineChart data={rows} margin={{ top: 16, right: 10, left: 2, bottom: 4 }}>
        <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="lap" type="number" domain={[1, maxLap]} hide />
        {marker != null && (
          <ReferenceLine
            x={marker}
            stroke={chartTheme.primary}
            strokeWidth={1.6}
            label={{ value: `L${Math.round(marker)}`, position: "top", fill: chartTheme.primary, fontSize: 9 }}
          />
        )}
        <YAxis
          reversed
          domain={[1, maxPos]}
          ticks={[1, Math.ceil(maxPos / 2), maxPos]}
          width={22}
          stroke={chartTheme.axis}
          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        {codes.map((c) => (
          <Line
            key={c}
            dataKey={c}
            type="monotone"
            stroke={colorOf[c]}
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { chartTheme } from "@/lib/chartTheme";
import type { RaceReplayBlob } from "@/services/raceReplayService";

interface Props {
  blob?: RaceReplayBlob;
  selected: string[];
  /** Optional live cutoff (replay leader lap). Omit to draw the whole race. */
  leaderLap?: number;
}

/** Compact position-over-laps chart for the selected drivers; builds as the replay runs. */
export function PositionChart({ blob, selected, leaderLap }: Props) {
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
  const upto = Math.min(maxLap, Math.max(1, Math.round(leaderLap ?? maxLap) || maxLap));
  const rows: Record<string, number | null>[] = [];
  for (let lap = 1; lap <= upto; lap++) {
    const row: Record<string, number | null> = { lap };
    for (const c of codes) row[c] = posByLap[c][lap] ?? null;
    rows.push(row);
  }

  return (
    <ResponsiveContainer width="100%" height={170}>
      <LineChart data={rows} margin={{ top: 6, right: 10, left: 2, bottom: 4 }}>
        <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray="3 3" />
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

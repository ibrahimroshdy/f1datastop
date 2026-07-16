import { useMemo } from "react";
import type { Lap, LapModel } from "../lapModel";

interface Props {
  laps: Lap[];
  /** Sample index for each lap at the current playhead time. */
  indices: number[];
  bounds: LapModel["bounds"];
  refCode: string | null;
}

const PAD = 0.06;

/**
 * The single-lap track — racing line drawn from telemetry x/y, with a moving dot per
 * driver at the shared playhead. Telemetry x/y is un-rotated, so it's plotted directly
 * (flipping Y so north points up).
 */
export function LapTrack({ laps, indices, bounds, refCode }: Props) {
  const geom = useMemo(() => {
    if (!bounds || !laps.length) return null;
    const w = bounds.maxX - bounds.minX || 1;
    const h = bounds.maxY - bounds.minY || 1;
    const padX = w * PAD;
    const padY = h * PAD;
    const flipY = (y: number) => bounds.minY + bounds.maxY - y;
    // Racing line from the reference (or first) lap.
    const base = laps.find((l) => l.code === refCode) ?? laps[0];
    const d = base.x
      .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${flipY(base.y[i]).toFixed(1)}`)
      .join("");
    const viewBox = `${bounds.minX - padX} ${bounds.minY - padY} ${w + 2 * padX} ${h + 2 * padY}`;
    const r = Math.max(w, h) * 0.012;
    return { d, viewBox, flipY, r };
  }, [bounds, laps, refCode]);

  if (!geom) {
    return (
      <div className="grid h-40 place-items-center text-2xs text-muted-foreground">
        Track loads with telemetry
      </div>
    );
  }

  return (
    <svg viewBox={geom.viewBox} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <path d={geom.d} fill="none" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.35} strokeWidth={geom.r * 1.6} strokeLinejoin="round" strokeLinecap="round" />
      {laps.map((l, li) => {
        const idx = Math.min(indices[li] ?? 0, l.x.length - 1);
        const cx = l.x[idx];
        const cy = geom.flipY(l.y[idx]);
        const isRef = l.code === refCode;
        return (
          <g key={l.code}>
            <circle cx={cx} cy={cy} r={geom.r * (isRef ? 3 : 2.3)} fill={l.color} stroke="hsl(var(--background))" strokeWidth={geom.r * 0.6} />
            <text
              x={cx}
              y={cy - geom.r * 4}
              textAnchor="middle"
              fontSize={geom.r * 5}
              fontWeight={700}
              fill={l.color}
              style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: geom.r }}
            >
              {l.code}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

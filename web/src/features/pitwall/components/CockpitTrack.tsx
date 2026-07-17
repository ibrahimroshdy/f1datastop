import { useMemo } from "react";
import type { RaceReplayBlob } from "@/services/raceReplayService";
import type { CircuitGeometryBlob } from "@/services/circuitGeometryService";
import { buildGeom, interpCars, SECTOR_COLOR } from "../replayEngine";

interface Props {
  blob: RaceReplayBlob;
  geom?: CircuitGeometryBlob;
  frame: number;
  /** Selected driver codes — highlighted on track. */
  selected: string[];
}

/**
 * The track map — outline split into three colour-coded sectors, numbered corners, the
 * start/finish line, and every car at its real position for the current race frame. Same
 * geometry Race Control uses; driven by the shared race player.
 */
export function CockpitTrack({ blob, geom, frame, selected }: Props) {
  const paths = useMemo(() => buildGeom(geom, blob), [geom, blob]);
  const cars = useMemo(() => interpCars(blob, frame), [blob, frame]);

  const { min_x, max_x, min_y, max_y } = blob.bounds;
  const w = max_x - min_x || 1;
  const h = max_y - min_y || 1;
  const size = Math.max(w, h);
  const pad = size * 0.07;
  const r = size / 74;
  const fs = size / 52;
  const cfs = size / 66;
  const sel = new Set(selected);
  const anySel = sel.size > 0;
  const isUp = (code: string | null) => !!code && sel.has(code);
  const ordered = [...cars.filter((c) => !isUp(c.code)), ...cars.filter((c) => isUp(c.code))];

  return (
    <svg
      viewBox={`${min_x - pad} ${min_y - pad} ${w + 2 * pad} ${h + 2 * pad}`}
      className="h-full w-full"
      fill="none"
      role="img"
      aria-label="Track position"
    >
      {/* Sectors */}
      {paths.sectorPaths ? (
        <>
          <path d={paths.outlinePath ?? ""} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.14} strokeWidth={size / 130} strokeLinecap="round" />
          {paths.sectorPaths.map((d, i) => (
            <path key={i} d={d} stroke={SECTOR_COLOR[i]} strokeOpacity={0.85} strokeWidth={size / 120} strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </>
      ) : (
        paths.outlinePath && (
          <path d={paths.outlinePath} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.35} strokeWidth={size / 130} strokeLinecap="round" strokeLinejoin="round" />
        )
      )}

      {/* Start / finish */}
      {paths.startFinish && (
        <line
          x1={paths.startFinish.ax}
          y1={paths.startFinish.ay}
          x2={paths.startFinish.bx}
          y2={paths.startFinish.by}
          stroke="hsl(var(--foreground))"
          strokeWidth={size / 64}
          strokeDasharray={`${size / 90} ${size / 90}`}
        />
      )}

      {/* Numbered corners */}
      {paths.corners.map((c) => (
        <g key={`c${c.n}`}>
          <circle cx={c.x} cy={c.y} r={cfs * 0.95} fill="hsl(var(--background))" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} strokeWidth={cfs * 0.12} />
          <text x={c.x} y={c.y + cfs * 0.36} fontSize={cfs} textAnchor="middle" className="fill-muted-foreground font-mono">
            {c.label}
          </text>
        </g>
      ))}

      {/* Cars */}
      {ordered.map((c) => {
        const up = isUp(c.code);
        const rr = up ? r * 1.7 : r * (anySel ? 0.9 : 1.1);
        return (
          <g key={c.id} opacity={anySel && !up ? 0.32 : 1} style={{ transition: "opacity 0.2s" }}>
            {up && <circle cx={c.x} cy={c.y} r={rr * 1.7} fill="none" stroke={c.color} strokeOpacity={0.5} strokeWidth={r * 0.35} />}
            <circle cx={c.x} cy={c.y} r={rr} fill={c.color} stroke="hsl(var(--background))" strokeWidth={rr * 0.3} />
            {up && (
              <text
                x={c.x}
                y={c.y - rr * 1.8}
                fontSize={fs * 1.15}
                textAnchor="middle"
                className="fill-foreground font-mono font-bold"
                style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: fs * 0.34, strokeLinejoin: "round" }}
              >
                {c.code}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

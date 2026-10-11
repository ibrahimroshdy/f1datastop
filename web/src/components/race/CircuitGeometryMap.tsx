import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Flag, Milestone } from "lucide-react";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle, F1Skeleton } from "@/components/f1";
import { cn } from "@/lib/utils";
import {
  getCircuitGeometry,
  getCircuitGeometryByCircuit,
  fetchCircuitGeometryBlob,
  type CircuitGeometryBlob,
} from "@/services/circuitGeometryService";

// Two lookup modes: by race (season + round) or by circuit (latest season for a
// circuit_id — used on the circuit detail page).
type Props = {
  className?: string;
  accent?: string;
} & (
  | { season: number; round: number; circuitId?: undefined }
  | { circuitId: string; season?: undefined; round?: undefined }
);

/** Build an SVG path from [x, y, d] points, flipping Y (telemetry Y is up, SVG Y is down). */
function toPath(pts: [number, number, number][], flipY: (y: number) => number): string {
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${flipY(p[1])}`)
    .join(" ");
}

function TrackSVG({
  blob,
  accent,
  showCorners,
  showStraights,
  showSectors,
}: {
  blob: CircuitGeometryBlob;
  accent: string;
  showCorners: boolean;
  showStraights: boolean;
  showSectors: boolean;
}) {
  const { min_x, max_x, min_y, max_y } = blob.bounds;
  const w = max_x - min_x || 1;
  const h = max_y - min_y || 1;
  const size = Math.max(w, h);
  const pad = size * 0.08;
  const flipY = (y: number) => min_y + max_y - y; // vertical flip, bounds preserved
  const sw = size / 130; // outline stroke
  const straightSw = sw * 2.4;
  const r = size / 75; // corner dot radius
  const fs = size / 42; // corner label font size

  const trackPath = useMemo(() => toPath(blob.outline, flipY), [blob.outline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Slice the outline into each straight's contiguous points (by distance).
  const straightPaths = useMemo(() => {
    if (!showStraights) return [];
    return blob.straights.map((s) => {
      const seg = blob.outline.filter((p) => p[2] >= s.start_d && p[2] <= s.end_d);
      return seg.length >= 2 ? toPath(seg, flipY) : "";
    }).filter(Boolean);
  }, [blob.straights, blob.outline, showStraights]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <svg
      viewBox={`${min_x - pad} ${min_y - pad} ${w + 2 * pad} ${h + 2 * pad}`}
      className="h-full w-full"
      fill="none"
      role="img"
      aria-label={`${blob.circuit_name ?? blob.circuit_id} track map`}
    >
      {/* base outline */}
      <path
        d={trackPath}
        stroke="currentColor"
        className="text-muted-foreground/40"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* full-throttle straights */}
      {straightPaths.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke={accent}
          strokeWidth={straightSw}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
      ))}
      {/* marshal sectors */}
      {showSectors &&
        blob.marshal_sectors.map((m, i) => (
          <circle key={`ms${i}`} cx={m.x} cy={flipY(m.y)} r={r * 0.55}
            fill="hsl(var(--position-gold))" fillOpacity={0.7} />
        ))}
      {/* numbered corners */}
      {showCorners &&
        blob.corners.map((c) => (
          <g key={`c${c.n}${c.letter}`}>
            <circle cx={c.x} cy={flipY(c.y)} r={r} fill={accent} opacity={0.15} />
            <circle cx={c.x} cy={flipY(c.y)} r={r * 0.34} fill={accent} />
            <text
              x={c.x}
              y={flipY(c.y) - r * 1.4}
              fontSize={fs}
              textAnchor="middle"
              className="fill-foreground font-mono"
            >
              {c.n}
              {c.letter}
            </text>
          </g>
        ))}
    </svg>
  );
}

function Toggle({
  on,
  onClick,
  icon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        on
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:bg-accent",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** Telemetry-derived track map: real outline + numbered corners + full-throttle
 *  straights. Renders nothing-yet state when a round hasn't been extracted. */
export function CircuitGeometryMap({ season, round, circuitId, className, accent = "hsl(var(--primary))" }: Props) {
  const [showCorners, setShowCorners] = useState(true);
  const [showStraights, setShowStraights] = useState(true);
  const [showSectors, setShowSectors] = useState(false);

  const index = useQuery({
    queryKey: circuitId
      ? ["circuit-geometry", "by-circuit", circuitId]
      : ["circuit-geometry", "index", season, round],
    queryFn: () =>
      circuitId ? getCircuitGeometryByCircuit(circuitId) : getCircuitGeometry(season!, round!),
    enabled: circuitId ? !!circuitId : season != null && round != null,
  });
  const blob = useQuery({
    queryKey: ["circuit-geometry", "blob", index.data?.public_url],
    queryFn: () => fetchCircuitGeometryBlob(index.data!.public_url),
    enabled: !!index.data?.public_url,
  });

  if (index.isLoading) return <F1Skeleton variant="card" className={cn("h-72", className)} />;

  if (!index.data) {
    return (
      <F1Card className={className}>
        <F1CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <MapPin className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Track map not available yet.</p>
          <p className="text-2xs text-muted-foreground">Generated from race telemetry once the session runs.</p>
        </F1CardContent>
      </F1Card>
    );
  }

  return (
    <F1Card className={className}>
      <F1CardHeader className="flex-row items-center justify-between pb-2">
        <div>
          <F1CardTitle className="text-base">{index.data.circuit_name ?? "Track map"}</F1CardTitle>
          <p className="instrument-label mt-0.5 text-muted-foreground">
            <span className="readout text-primary">{index.data.corner_count ?? "—"}</span> corners ·{" "}
            <span className="readout text-primary">{index.data.straight_count ?? "—"}</span> straights
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Toggle on={showCorners} onClick={() => setShowCorners((v) => !v)}
            icon={<Flag className="h-3 w-3" />} label="Corners" />
          <Toggle on={showStraights} onClick={() => setShowStraights((v) => !v)}
            icon={<Milestone className="h-3 w-3" />} label="Straights" />
          <Toggle on={showSectors} onClick={() => setShowSectors((v) => !v)}
            icon={<MapPin className="h-3 w-3" />} label="Sectors" />
        </div>
      </F1CardHeader>
      <F1CardContent>
        <div className="aspect-4/3 w-full">
          {blob.isLoading ? (
            <F1Skeleton variant="card" className="h-full w-full" />
          ) : blob.data ? (
            <TrackSVG
              blob={blob.data}
              accent={accent}
              showCorners={showCorners}
              showStraights={showStraights}
              showSectors={showSectors}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Failed to load track map.
            </div>
          )}
        </div>
      </F1CardContent>
    </F1Card>
  );
}

export default CircuitGeometryMap;

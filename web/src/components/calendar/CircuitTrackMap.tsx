import circuitTracks from "@/data/circuitTracks.json";
import { cn } from "@/lib/utils";

type Track = {
  path: string;
  name: string;
  location: string;
  length: number | null;
};

const tracks = circuitTracks as Record<string, Track>;

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Look up a circuit's track outline by Ergast circuit name, falling back to locality. */
export function getCircuitTrack(
  circuitName?: string | null,
  locality?: string | null,
): Track | null {
  if (circuitName && tracks[slugify(circuitName)]) return tracks[slugify(circuitName)];
  if (locality && tracks[slugify(locality)]) return tracks[slugify(locality)];
  return null;
}

interface CircuitTrackMapProps {
  circuitName?: string | null;
  locality?: string | null;
  className?: string;
  color?: string;
  strokeWidth?: number;
}

/** Renders a circuit's track layout as a normalized SVG. Returns null if unknown. */
export function CircuitTrackMap({
  circuitName,
  locality,
  className,
  color = "currentColor",
  strokeWidth = 2.5,
}: CircuitTrackMapProps) {
  const track = getCircuitTrack(circuitName, locality);
  if (!track) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("h-full w-full", className)}
      fill="none"
      role="img"
      aria-label={`${track.name} track layout`}
    >
      <path
        d={track.path}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default CircuitTrackMap;

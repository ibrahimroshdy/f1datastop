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
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents: Montréal→montreal, São Paulo→sao-paulo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// FastF1 names a few circuits differently than the track-geometry file keys.
// Map the leftover mismatches (post-accent-strip) to their canonical track key.
const TRACK_ALIASES: Record<string, string> = {
  "marina-bay": "marina-bay-street-circuit",
  "miami-gardens": "miami",
  "monte-carlo": "monaco",
};

/** Look up a circuit's track outline by circuit name, falling back to locality. */
export function getCircuitTrack(
  circuitName?: string | null,
  locality?: string | null,
): Track | null {
  for (const raw of [circuitName, locality]) {
    if (!raw) continue;
    const slug = slugify(raw);
    const key = TRACK_ALIASES[slug] ?? slug;
    if (tracks[key]) return tracks[key];
  }
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

import { cn } from "@/lib/utils";

/**
 * The replay transport's speed selector, shared by Pit Wall and Race Control.
 *
 * Both surfaces replay the same blob through the same frame loop, so a multiplier has to
 * mean — and look like — the same thing in each. They previously kept private copies and
 * drifted apart on every axis: different ladders (0.25-2x vs 1-8x), different labels
 * ("2x" vs "2×"), different shapes (segmented group vs loose buttons) and different
 * active states. One component removes the possibility.
 *
 * Pit Wall's segmented styling is the reference. The one deliberate change is a min-height
 * on each button, so the control keeps a usable tap target on mobile.
 */

/**
 * Internal playback multipliers. These are NOT what the buttons say — the labels are the
 * real-time multiple each one works out to (see realTimeFactor). Kept as-is so playback
 * behaviour is unchanged; only the naming became honest.
 */
export const REPLAY_SPEEDS = [0.25, 0.5, 1, 2] as const;

export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

/**
 * Frames advanced per wall-second at multiplier 1. Lives here with the ladder because the
 * two are one contract: the multiplier is meaningless without the base rate, and both
 * surfaces must share it or a given step silently means different things on each.
 */
export const REPLAY_FPS = 6;

/** Seconds of session covered by one replay frame — the exporter's fixed cadence. */
export const DEFAULT_SECONDS_PER_FRAME = 1.5;

/**
 * How many times faster than real life a multiplier actually runs.
 *
 * The old labels claimed 0.25x-2x, but none of them was close to real time: a frame is
 * 1.5s of session, so at 6 fps the "1x" button ran at 9x real life and "2x" at 18x. The
 * buttons now show the true multiple. Derived from the blob's own cadence rather than a
 * constant, so the labels stay correct if the exporter's frame spacing ever changes.
 */
export function realTimeFactor(speed: number, secondsPerFrame = DEFAULT_SECONDS_PER_FRAME) {
  return speed * REPLAY_FPS * secondsPerFrame;
}

/** "9", "2.25", "18" — trailing zeros trimmed so the buttons stay narrow. */
export function formatRealTime(factor: number) {
  return factor.toFixed(2).replace(/\.?0+$/, "");
}

interface Props {
  speed: number;
  setSpeed: (s: ReplaySpeed) => void;
  /** Session seconds per replay frame, from the blob (duration_s / frames). */
  secondsPerFrame?: number;
  className?: string;
}

export default function ReplaySpeedControl({
  speed,
  setSpeed,
  secondsPerFrame = DEFAULT_SECONDS_PER_FRAME,
  className,
}: Props) {
  return (
    <div className={cn("flex shrink-0 overflow-hidden rounded-md border border-border", className)}>
      {REPLAY_SPEEDS.map((s) => {
        const label = formatRealTime(realTimeFactor(s, secondsPerFrame));
        return (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            aria-pressed={speed === s}
            aria-label={`Playback speed ${label} times real time`}
            title={`${label}× real time`}
            className={cn(
              "min-h-8 px-2 py-1 text-2xs font-semibold tabular-nums transition-colors",
              speed === s
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}x
          </button>
        );
      })}
    </div>
  );
}

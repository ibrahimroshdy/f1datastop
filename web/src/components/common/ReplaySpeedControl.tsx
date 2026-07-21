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

export const REPLAY_SPEEDS = [0.25, 0.5, 1, 2] as const;

export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

/**
 * Frames advanced per wall-second at 1x. Lives here with the ladder because the two are
 * one contract: the multiplier is meaningless without the base rate, and both surfaces
 * must share it or "1x" silently means different things on each.
 *
 * A replay frame is ~1.5s of session, so 6 fps puts 1x at ~9x real time — a 44-lap race
 * runs ~9.5 min at 1x, ~38 min at 0.25x, ~4.8 min at 2x. Halved from 12 (18x real time),
 * which was too fast to follow the racing.
 */
export const REPLAY_FPS = 6;

interface Props {
  speed: number;
  setSpeed: (s: ReplaySpeed) => void;
  className?: string;
}

export default function ReplaySpeedControl({ speed, setSpeed, className }: Props) {
  return (
    <div className={cn("flex shrink-0 overflow-hidden rounded-md border border-border", className)}>
      {REPLAY_SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => setSpeed(s)}
          aria-pressed={speed === s}
          aria-label={`Playback speed ${s}x`}
          className={cn(
            "min-h-8 px-2 py-1 text-2xs font-semibold tabular-nums transition-colors",
            speed === s
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {s}x
        </button>
      ))}
    </div>
  );
}

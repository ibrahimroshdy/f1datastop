import { Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtLapClock } from "../lapModel";
import type { LapPlayhead } from "../hooks/useLapPlayhead";

const SPEEDS = [0.5, 1, 2, 4];

/** Transport for the shared lap playhead — play/pause, scrub, restart, speed. */
export function LapPlayBar({ playhead }: { playhead: LapPlayhead }) {
  const { t, duration, playing, speed } = playhead;
  const pct = duration > 0 ? (t / duration) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={playhead.restart}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
        aria-label="Restart lap"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={playhead.toggle}
        disabled={duration <= 0}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>

      <input
        type="range"
        min={0}
        max={Math.max(duration, 0.001)}
        step={0.01}
        value={t}
        onChange={(e) => playhead.setT(Number(e.target.value))}
        className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        style={{ background: `linear-gradient(to right, hsl(var(--primary)) ${pct}%, hsl(var(--muted)) ${pct}%)` }}
        aria-label="Lap position"
      />

      <span className="readout shrink-0 text-xs tabular-nums text-muted-foreground">
        {fmtLapClock(t)}<span className="opacity-50"> / {fmtLapClock(duration)}</span>
      </span>

      <div className="flex shrink-0 overflow-hidden rounded-lg border border-border">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => playhead.setSpeed(s)}
            className={cn(
              "px-1.5 py-1 text-2xs font-semibold transition-colors",
              speed === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}

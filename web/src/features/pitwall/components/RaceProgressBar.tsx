import { useMemo } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { F1Card } from "@/components/f1";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { colorWithAlpha } from "@/constants/f1Colors";
import type { RaceReplayBlob } from "@/services/raceReplayService";
import type { ReplayPlayhead } from "../hooks/useReplayPlayhead";
import { computeTiming, fmtClock, SAFETY_STYLE } from "../replayEngine";
import ReplaySpeedControl from "@/components/common/ReplaySpeedControl";

interface Props {
  blob: RaceReplayBlob;
  playhead: ReplayPlayhead;
}

/**
 * The race player — whole-race scrubber with the lap counter, clock, speed and a timeline
 * that highlights safety-car / VSC / red-flag windows and overtakes (click a band to jump).
 * This is the ONE transport; its frame drives the telemetry crosshair and cockpit.
 */
export function RaceProgressBar({ blob, playhead }: Props) {
  const { cardVariant, glassVariant } = useThemeVariant();
  const { frame, setFrame, playing, setPlaying, speed, setSpeed, lastFrame } = playhead;
  const fi = Math.round(frame);
  const { leaderLap, t } = useMemo(() => computeTiming(blob, fi), [blob, fi]);
  const dur = blob.duration_s || 1;
  const safety = blob.safety ?? [];
  const overtakes = blob.overtakes ?? [];
  const isRace = blob.is_race !== false;
  const atEnd = frame >= lastFrame;
  const active = safety.find((p) => t >= p.start_s && t <= p.end_s) ?? null;
  const sToFrame = (s: number) => {
    for (let i = 0; i < blob.times.length; i++) if (blob.times[i] >= s) return i;
    return blob.times.length - 1;
  };
  const hasMarks = safety.length > 0 || overtakes.length > 0;

  return (
    <F1Card variant={cardVariant} glassVariant={glassVariant} size="sm" className="space-y-1.5 rounded-2xl p-2.5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <button
          type="button"
          onClick={() => (atEnd ? (setFrame(0), setPlaying(true)) : setPlaying(!playing))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setFrame(0);
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-accent"
          aria-label="Restart"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        {isRace ? (
          <div className="instrument-label ml-1 flex items-baseline gap-1 text-muted-foreground">
            Lap <span className="readout text-lg text-primary">{leaderLap || "—"}</span>
            <span className="text-muted-foreground/60">/ {blob.total_laps ?? "—"}</span>
          </div>
        ) : (
          <span className="instrument-label ml-1 text-muted-foreground">Best-lap order</span>
        )}
        <span className="timing ml-1 text-xs text-muted-foreground">
          {fmtClock(t)} / {fmtClock(dur)}
        </span>
        {active && (
          <span
            className="ml-1 rounded px-1.5 py-0.5 text-2xs font-bold text-black"
            style={{ backgroundColor: SAFETY_STYLE[active.kind].color }}
          >
            {SAFETY_STYLE[active.kind].label}
          </span>
        )}
        <ReplaySpeedControl
          speed={speed}
          setSpeed={setSpeed}
          secondsPerFrame={blob.frames ? blob.duration_s / blob.frames : undefined}
          className="ml-auto"
        />
      </div>

      {/* Timeline — SC solid · VSC hatched · red · overtake ticks */}
      <div className="space-y-1">
        {hasMarks && (
          <div className="relative h-2.5 w-full overflow-hidden rounded-sm bg-muted/40">
            {safety.map((p, i) => {
              const a = sToFrame(p.start_s);
              const b = sToFrame(p.end_s);
              const left = (a / (lastFrame || 1)) * 100;
              const width = Math.max(1.2, ((b - a) / (lastFrame || 1)) * 100);
              const c = SAFETY_STYLE[p.kind].color;
              const style =
                p.kind === "RED"
                  ? { backgroundColor: c }
                  : p.kind === "VSC"
                    ? {
                        backgroundColor: colorWithAlpha(c, 0.28),
                        backgroundImage: `repeating-linear-gradient(45deg, ${c} 0, ${c} 2.5px, transparent 2.5px, transparent 6px)`,
                      }
                    : { backgroundColor: c };
              return (
                <button
                  key={`s${i}`}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setFrame(a);
                  }}
                  title={`${SAFETY_STYLE[p.kind].label} — jump here`}
                  aria-label={`Jump to ${SAFETY_STYLE[p.kind].label}`}
                  className="absolute top-0 h-2.5 opacity-90 transition-opacity hover:opacity-100"
                  style={{ left: `${left}%`, width: `${width}%`, ...style }}
                />
              );
            })}
            {overtakes.map((o, i) => {
              const left = (sToFrame(o.t) / (lastFrame || 1)) * 100;
              return (
                <span key={`o${i}`} className="pointer-events-none absolute bottom-0 h-1.5 w-px bg-gain" style={{ left: `${left}%` }} />
              );
            })}
          </div>
        )}
        <input
          type="range"
          min={0}
          max={lastFrame}
          step={0.5}
          value={frame}
          onChange={(e) => {
            setPlaying(false);
            setFrame(Number(e.target.value));
          }}
          className="h-1 w-full accent-primary"
          aria-label="Race position"
        />
        {hasMarks && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9px] text-muted-foreground">
            {safety.some((p) => p.kind === "SC") && (
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ backgroundColor: SAFETY_STYLE.SC.color }} /> SC</span>
            )}
            {safety.some((p) => p.kind === "VSC") && (
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ backgroundColor: colorWithAlpha(SAFETY_STYLE.VSC.color, 0.28), backgroundImage: `repeating-linear-gradient(45deg, ${SAFETY_STYLE.VSC.color} 0, ${SAFETY_STYLE.VSC.color} 2px, transparent 2px, transparent 4px)` }} /> VSC</span>
            )}
            {safety.some((p) => p.kind === "RED") && (
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ backgroundColor: SAFETY_STYLE.RED.color }} /> Red flag</span>
            )}
            {overtakes.length > 0 && (
              <span className="flex items-center gap-1"><span className="h-2 w-px bg-gain" /> Overtake</span>
            )}
          </div>
        )}
      </div>
    </F1Card>
  );
}

import { cn } from "@/lib/utils";
import type { Lap } from "../lapModel";

interface Props {
  laps: Lap[];
  indices: number[];
  refCode: string | null;
  onSetRef: (code: string) => void;
}

function val(arr: number[] | undefined, i: number): number | null {
  return arr && i < arr.length ? arr[i] : null;
}

const DOTS = 12;

/** LED-style dot meter for throttle / brake — lit dots grow with pedal application. */
function DotMeter({ pct, color }: { pct: number; color: string }) {
  const on = Math.round(Math.min(1, Math.max(0, pct)) * DOTS);
  return (
    <div className="flex flex-1 items-center justify-between">
      {Array.from({ length: DOTS }).map((_, i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full transition-colors duration-75"
          style={{ backgroundColor: i < on ? color : "hsl(var(--muted-foreground) / 0.2)" }}
        />
      ))}
    </div>
  );
}

/** Per-driver live channel readout at the shared playhead — the reference's "live inputs". */
export function LiveInputs({ laps, indices, refCode, onSetRef }: Props) {
  if (!laps.length) {
    return <div className="grid h-24 place-items-center text-2xs text-muted-foreground">Pick drivers to see inputs</div>;
  }
  return (
    <div className="space-y-1.5">
      <p className="text-[9px] leading-snug text-muted-foreground">
        Each driver's readout where the play-head sits on the lap — speed, gear, engine rpm, plus{" "}
        <span className="font-semibold" style={{ color: "hsl(140 68% 46%)" }}>throttle&nbsp;(T)</span> and{" "}
        <span className="font-semibold" style={{ color: "hsl(0 85% 55%)" }}>brake&nbsp;(B)</span> as dot meters (more dots = harder on the pedal).
      </p>
      {laps.map((l, li) => {
        const i = Math.min(indices[li] ?? 0, l.time.length - 1);
        const ch = l.blob.channels;
        const speed = val(ch.speed, i);
        const gear = val(ch.gear, i);
        const rpm = val(ch.rpm, i);
        const thr = (val(ch.throttle, i) ?? 0) / 100;
        const brk = val(ch.brake, i) ?? 0;
        const brkOn = brk > 0.05;
        const isRef = l.code === refCode;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => onSetRef(l.code)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors",
              isRef ? "border-transparent" : "border-border/60 hover:border-foreground/20",
            )}
            style={isRef ? { backgroundColor: `${l.color}16`, boxShadow: `inset 0 0 0 1px ${l.color}66` } : undefined}
          >
            <span className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
            <span className="timing w-9 shrink-0 text-sm font-bold" style={{ color: l.color }}>{l.code}</span>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="w-14 shrink-0">
                <div className="readout text-base font-semibold leading-none tabular-nums">{speed != null ? Math.round(speed) : "—"}</div>
                <div className="text-[8px] uppercase tracking-wide text-muted-foreground">km/h</div>
              </div>
              <div className="flex w-8 shrink-0 flex-col items-center">
                <div className="readout text-sm font-semibold leading-none">{gear ?? "—"}</div>
                <div className="text-[8px] uppercase tracking-wide text-muted-foreground">gear</div>
              </div>
              <div className="flex w-12 shrink-0 flex-col items-center">
                <div className="readout text-xs font-semibold leading-none tabular-nums">{rpm != null ? Math.round(rpm / 1000 * 10) / 10 + "k" : "—"}</div>
                <div className="text-[8px] uppercase tracking-wide text-muted-foreground">rpm</div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-1.5" title="Throttle">
                  <span className="w-2 shrink-0 text-[7px] font-bold leading-none" style={{ color: "hsl(140 68% 46%)" }}>T</span>
                  <DotMeter pct={thr} color="hsl(140 68% 46%)" />
                </div>
                <div className="flex items-center gap-1.5" title="Brake">
                  <span className="w-2 shrink-0 text-[7px] font-bold leading-none" style={{ color: "hsl(0 85% 55%)" }}>B</span>
                  <DotMeter pct={brkOn ? Math.max(brk, 0.15) : 0} color="hsl(0 85% 55%)" />
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

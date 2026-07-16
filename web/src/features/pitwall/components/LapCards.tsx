import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import TeamLogo from "@/components/common/TeamLogo";
import { fmtLapClock, TYRE_ABBR, type Lap } from "../lapModel";
import { TYRE_HSL } from "../replayEngine";

interface Props {
  laps: Lap[];
  refCode: string | null;
  constructorByDriver: Map<string, string>;
  onSetRef: (code: string) => void;
}

/** mm:ss.mmm string straight from FastF1 (already formatted) or integrated fallback. */
function lapTimeLabel(l: Lap): string {
  const raw = l.blob.lap_time;
  if (raw && /\d/.test(raw)) return raw.replace(/^0:/, "").replace(/000$/, "");
  return fmtLapClock(l.dur);
}

/** Header strip — one card per driver's lap (the reference's driver lap-cards row). */
export function LapCards({ laps, refCode, constructorByDriver, onSetRef }: Props) {
  if (!laps.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {laps.map((l) => {
        const tyre = (l.blob.compound || "").toUpperCase();
        const tyreKey = TYRE_ABBR[tyre] ?? tyre[0];
        const isRef = l.code === refCode;
        const cId = constructorByDriver.get(l.blob.driver_id ?? "");
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => onSetRef(l.code)}
            className={cn(
              "group relative flex min-w-[150px] shrink-0 flex-col gap-1 rounded-xl border px-3 py-2 text-left transition-colors",
              isRef ? "border-transparent" : "border-border hover:border-foreground/20",
            )}
            style={isRef ? { backgroundColor: `${l.color}1f`, boxShadow: `inset 0 0 0 1px ${l.color}` } : undefined}
          >
            {/* colour bar = this driver's trace colour */}
            <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full" style={{ backgroundColor: l.color }} />
            <div className="flex items-center gap-1.5 pl-1.5">
              {cId && <TeamLogo constructorId={cId} size="sm" noBackground className="!h-3.5 w-auto max-w-[26px] shrink-0" />}
              <span className="timing text-sm font-bold" style={{ color: l.color }}>{l.code}</span>
              {isRef && <Star className="h-3 w-3 fill-current text-position-gold" />}
              <span className="instrument-label ml-auto text-muted-foreground">L{l.blob.lap_number}</span>
            </div>
            <div className="flex items-baseline gap-2 pl-1.5">
              <span className="readout text-base font-semibold tabular-nums">{lapTimeLabel(l)}</span>
              {tyre && (
                <span
                  className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-black"
                  style={{ backgroundColor: TYRE_HSL[tyreKey] ?? "hsl(0 0% 70%)" }}
                  title={tyre}
                >
                  {tyreKey}
                </span>
              )}
              {l.blob.metrics?.top_speed != null && (
                <span className="ml-auto text-2xs text-muted-foreground">
                  {Math.round(l.blob.metrics.top_speed)} <span className="text-[8px]">km/h</span>
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TeamLogo from "@/components/common/TeamLogo";
import { cn } from "@/lib/utils";
import {
  buildF1DriverHeadshotUrl,
  DRIVER_CODE_TO_CONSTRUCTOR,
  ergastIdForDriver,
  getF1PortraitPathForErgastDriverId,
} from "@/constants/f1DriverPortraitMedia";
import type { RaceReplayBlob } from "@/services/raceReplayService";
import { carSpeeds, computeTiming, fmtGap, fmtLap } from "../replayEngine";
import type { PitWallDriver } from "../hooks/usePitWallData";
import { TyreBadge } from "./TyreBadge";

interface Row {
  id: string;
  code: string;
  color: string;
  pos: number | null;
  gap: number | null;
  lapsDown: number;
  tyre?: string | null;
  tyl?: number | null;
  lastTime?: number | null;
  sec?: (number | null)[];
  pb?: [number, number, number];
  isFL?: boolean;
  pit?: boolean;
  speed?: number;
}

interface Props {
  blob?: RaceReplayBlob;
  frame: number;
  isRace: boolean;
  drivers: PitWallDriver[];
  selected: string[];
  refCode: string | null;
  year: number;
  constructorByDriver: Map<string, string>;
  onToggle: (code: string) => void;
  onSetRef: (code: string) => void;
}

/** Sectors 1·2·3 as an LED gauge — purple = session best, green = personal best, yellow =
 *  a completed sector, dim = not set yet. Fills left→right in order as the lap runs. */
function SectorLeds({ sec, pb, id, bestHolder }: { sec?: (number | null)[]; pb?: [number, number, number]; id: string; bestHolder: (string | null)[] }) {
  if (!sec) return null;
  return (
    <span className="flex items-center gap-1">
      {sec.map((s, k) => {
        let dot = "bg-muted-foreground/25";
        let what = "not set";
        if (id === bestHolder[k]) {
          dot = "bg-fastest-lap shadow-[0_0_5px] shadow-fastest-lap/70";
          what = "session best";
        } else if (s != null && pb && s === pb[k]) {
          dot = "bg-gain shadow-[0_0_5px] shadow-gain/70";
          what = "personal best";
        } else if (s != null) {
          dot = "bg-yellow-500 dark:bg-yellow-400";
          what = "set";
        }
        // Per-dot title: the times are the point of the gauge, and one label on the group
        // ("Sectors 1·2·3") gave no way to read them.
        return (
          <span
            key={k}
            className={cn("h-2 w-2 rounded-full transition-colors", dot)}
            title={`Sector ${k + 1} — ${s == null ? "—" : `${(s / 1000).toFixed(3)}s`} (${what})`}
          />
        );
      })}
    </span>
  );
}

/** The one drivers panel — live position, photo, correct logo, lap time, tyre, speed, sectors, delta. */
export function DriverBoard({
  blob,
  frame,
  isRace,
  drivers,
  selected,
  refCode,
  year,
  constructorByDriver,
  onToggle,
}: Props) {
  const { rows, bestHolder } = useMemo(() => {
    if (blob) {
      const { snaps, bestHolder } = computeTiming(blob, Math.round(frame));
      const speeds = carSpeeds(blob, frame);
      const rows: Row[] = snaps.map((s) => ({
        id: s.id,
        code: s.code,
        color: s.color,
        pos: s.pos,
        gap: s.gap,
        lapsDown: s.lapsDown,
        tyre: s.tyre,
        tyl: s.tyl,
        lastTime: s.lastTime,
        sec: s.sec,
        pb: s.pb,
        isFL: s.isFL,
        pit: s.pit,
        speed: speeds[s.code],
      }));
      return { rows, bestHolder };
    }
    const rows: Row[] = drivers.map((d) => ({
      id: d.driver_id ?? d.code,
      code: d.code,
      color: d.team_color || "#9ca3af",
      pos: d.position,
      gap: null,
      lapsDown: 0,
    }));
    return { rows, bestHolder: [null, null, null] as (string | null)[] };
  }, [blob, frame, drivers]);

  if (!rows.length) {
    return <p className="text-xs text-muted-foreground">No drivers for this session yet.</p>;
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card/40">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="instrument-label text-primary">Drivers</span>
        <span className="text-2xs text-muted-foreground">{selected.length}/{rows.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        <AnimatePresence initial={false}>
          {rows.map((r) => {
            const isSel = selected.includes(r.code);
            const isRef = refCode === r.code;
            const ergId = ergastIdForDriver(r.id, r.code);
            const cid = constructorByDriver.get(ergId) ?? constructorByDriver.get(r.id) ?? DRIVER_CODE_TO_CONSTRUCTOR[r.code];
            const path = getF1PortraitPathForErgastDriverId(ergId, year);
            const src = path ? buildF1DriverHeadshotUrl(path) : undefined;
            const gapText = r.pos === 1 ? (isRace ? "LEADER" : "") : isRace && r.lapsDown >= 1 ? `+${r.lapsDown}L` : fmtGap(r.gap);
            return (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ layout: { type: "spring", stiffness: 600, damping: 44 }, opacity: { duration: 0.15 } }}
                className={cn(
                  "mb-0.5 rounded-lg border px-2 py-[3px] transition-colors",
                  isRef ? "border-primary" : isSel ? "border-white/12" : "border-border/60 hover:border-primary/40",
                  r.pit && "opacity-60",
                )}
                style={isSel ? { backgroundColor: `${r.color}1a` } : undefined}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggle(r.code)}
                    aria-pressed={isSel}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="w-4 shrink-0 text-center text-xs font-bold text-muted-foreground">{r.pos ?? "—"}</span>
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-muted"
                      style={{ boxShadow: `0 0 0 1.5px ${r.color}` }}
                    >
                      {src ? (
                        <img src={src} alt={r.code} className="h-full w-full object-cover object-top" loading="lazy" />
                      ) : (
                        <span className="text-[8px] font-bold text-muted-foreground">{r.code}</span>
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {/* Left — identity + inputs */}
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className={cn("timing text-sm font-bold leading-none", isSel ? "text-foreground" : "text-foreground/90")}>
                            {r.code}
                          </span>
                          {cid && <TeamLogo constructorId={cid} size="sm" noBackground className="!h-3 w-auto shrink-0" />}
                        </span>
                        {blob && (r.tyre || r.speed != null || r.pit) && (
                          <span className="flex items-center gap-2 text-[10px] leading-none text-muted-foreground">
                            {r.tyre && <TyreBadge compound={r.tyre} age={r.tyl} />}
                            {r.speed != null && (
                              <span className="readout text-foreground/80">{Math.round(r.speed)}<span className="text-[8px] text-muted-foreground"> km/h</span></span>
                            )}
                            {r.pit && (
                              <span className="grid h-3 w-3 shrink-0 place-items-center rounded-[3px] border border-foreground/40 text-[7px] font-bold leading-none text-foreground" title="In the pit lane">P</span>
                            )}
                          </span>
                        )}
                      </span>
                      {/* Right — lap time · delta · sectors, stacked */}
                      <span className="flex shrink-0 flex-col items-end gap-[3px] leading-none">
                        {r.lastTime != null && (
                          <span className={cn("readout text-[11px]", r.isFL ? "text-fastest-lap" : "text-foreground/90")}>{fmtLap(r.lastTime)}</span>
                        )}
                        {gapText && <span className="timing text-[9px] text-muted-foreground">{gapText}</span>}
                        {blob && r.sec && <SectorLeds sec={r.sec} pb={r.pb} id={r.code} bestHolder={bestHolder} />}
                      </span>
                    </span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

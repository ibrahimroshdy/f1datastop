import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Star } from "lucide-react";
import { DriverAvatar } from "@/components/f1";
import TeamLogo from "@/components/common/TeamLogo";
import { cn } from "@/lib/utils";
import {
  buildF1DriverHeadshotUrl,
  getF1PortraitPathForErgastDriverId,
} from "@/constants/f1DriverPortraitMedia";
import type { RaceReplayBlob } from "@/services/raceReplayService";
import { TYRE_HSL, carSpeeds, computeTiming, fmtGap, fmtLap } from "../replayEngine";
import type { PitWallDriver } from "../hooks/usePitWallData";

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

function SectorBars({ sec, pb, id, bestHolder }: { sec?: (number | null)[]; pb?: [number, number, number]; id: string; bestHolder: (string | null)[] }) {
  if (!sec) return null;
  return (
    <span className="flex items-center gap-0.5">
      {sec.map((s, k) => {
        let cls = "bg-muted-foreground/25";
        if (id === bestHolder[k]) cls = "bg-fastest-lap";
        else if (s != null && pb && s === pb[k]) cls = "bg-gain";
        else if (s != null) cls = "bg-muted-foreground/50";
        return <span key={k} className={cn("h-1 w-3 rounded-sm", cls)} />;
      })}
    </span>
  );
}

/** The one drivers panel — live position, photo, correct logo, lap time, sector colours, speed, delta. */
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
  onSetRef,
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
            const cid = constructorByDriver.get(r.id);
            const path = getF1PortraitPathForErgastDriverId(r.id, year);
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
                  "mb-1 rounded-xl border px-2 py-1.5 transition-colors",
                  isSel ? "border-transparent" : "border-border/60 hover:border-primary/40",
                  r.pit && "opacity-60",
                )}
                style={
                  isSel
                    ? { backgroundColor: `${r.color}22`, boxShadow: `inset 3px 0 0 ${r.color}` }
                    : { boxShadow: `inset 3px 0 0 ${r.color}88` }
                }
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggle(r.code)}
                    aria-pressed={isSel}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="w-5 shrink-0 text-center text-sm font-bold text-muted-foreground">{r.pos ?? "—"}</span>
                    <DriverAvatar driverCode={r.code} src={src} teamColor={r.color} size="sm" />
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className={cn("timing text-sm font-bold leading-none", isSel ? "text-foreground" : "text-foreground/90")}>
                        {r.code}
                      </span>
                      {cid && <TeamLogo constructorId={cid} size="sm" noBackground className="!h-3 w-auto shrink-0" />}
                    </span>
                    <span className="ml-auto flex flex-col items-end leading-none">
                      {r.lastTime != null && <span className={cn("readout text-[11px]", r.isFL ? "text-fastest-lap" : "text-foreground/90")}>{fmtLap(r.lastTime)}</span>}
                      {gapText && <span className="timing text-[10px] text-muted-foreground">{gapText}</span>}
                    </span>
                  </button>
                  {isSel && (
                    <button type="button" onClick={() => onSetRef(r.code)} title={isRef ? "Reference driver" : "Set as reference"} className="shrink-0">
                      <Star className={cn("h-4 w-4", isRef ? "fill-primary text-primary" : "text-muted-foreground/40 hover:text-muted-foreground")} />
                    </button>
                  )}
                </div>
                {blob && (
                  <div className="mt-1 flex items-center gap-2 pl-7 text-[10px] text-muted-foreground">
                    {r.tyre && (
                      <span className="font-bold" style={{ color: TYRE_HSL[r.tyre] ?? "hsl(var(--muted-foreground))" }}>
                        {r.tyre}
                        {r.tyl != null ? r.tyl : ""}
                      </span>
                    )}
                    {r.speed != null && (
                      <span className="readout text-foreground/80">{Math.round(r.speed)}<span className="text-[8px] text-muted-foreground"> km/h</span></span>
                    )}
                    <SectorBars sec={r.sec} pb={r.pb} id={r.id} bestHolder={bestHolder} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TeamLogo from "@/components/common/TeamLogo";
import { cn } from "@/lib/utils";
import { useDriverStandings } from "@/hooks/f1";
import { normalizeTeamId } from "@/components/standings/standingsUtils";
import {
  buildF1DriverHeadshotUrl,
  DRIVER_CODE_TO_CONSTRUCTOR,
  ergastIdForDriver,
  getF1PortraitPathForErgastDriverId,
} from "@/constants/f1DriverPortraitMedia";

/**
 * Race Control's drivers panel.
 *
 * Deliberately its OWN component rather than Pit Wall's DriverBoard, even though the two
 * look alike. They model different things and sharing one would force both to carry the
 * other's baggage:
 *
 *   Pit Wall     multi-select (build a console from N drivers) + a reference driver, rows
 *                keyed off PitWallDriver, no interval or DRS.
 *   Race Control single-select "follow this car on track", plus interval-to-car-ahead and
 *                a DRS/override light, rows keyed off the replay's timing Snap.
 *
 * The design is copied, not the code: same card shell, portrait with a team-colour ring,
 * code + constructor logo, tyre badge and sector LEDs. Changes to one are not meant to
 * silently change the other.
 */

export interface DriverRow {
  id: string;
  code: string;
  color: string;
  pos: number | null;
  gap: number | null;
  int: number | null;
  sec: (number | null)[];
  pb: [number, number, number];
  lastTime: number | null;
  tyre: string | null;
  tyl: number | null;
  lapsDown: number;
  isFL: boolean;
  isFLLap: boolean;
  pit: boolean;
  drs: boolean;
}

const TYRE_COLOR: Record<string, string> = {
  S: "hsl(0 85% 55%)",
  M: "hsl(45 95% 55%)",
  H: "hsl(0 0% 92%)",
  I: "hsl(140 68% 46%)",
  W: "hsl(210 90% 56%)",
};

const fmtLap = (s: number | null) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toFixed(3).padStart(6, "0")}`;
};
const fmtGap = (s: number | null) => (s == null ? "—" : s < 0.05 ? "—" : `+${s.toFixed(1)}`);

/** Sector time in ms → "28.412". */
const fmtSector = (ms: number | null | undefined) =>
  ms == null ? "—" : (ms / 1000).toFixed(3);

/** Sectors 1·2·3 as an LED gauge — fastest-lap token = session best, gain = personal best,
 *  position-gold = set this lap, dim = not yet. Each dot carries its own time on hover. */
function SectorLeds({
  sec,
  pb,
  id,
  bestHolder,
}: {
  sec: (number | null)[];
  pb: [number, number, number];
  id: string;
  bestHolder: (string | null)[];
}) {
  return (
    <span className="flex items-center gap-1">
      {sec.map((s, k) => {
        let dot = "bg-muted-foreground/25";
        let what = "not set";
        if (id === bestHolder[k]) {
          dot = "bg-fastest-lap shadow-[0_0_5px] shadow-fastest-lap/70";
          what = "session best";
        } else if (s != null && s === pb[k]) {
          dot = "bg-gain shadow-[0_0_5px] shadow-gain/70";
          what = "personal best";
        } else if (s != null) {
          dot = "bg-position-gold";
          what = "set";
        }
        // Per-dot title: the whole point of the gauge is the times behind it, and a single
        // label on the group ("Sectors 1·2·3") gave no way to read them.
        return (
          <span
            key={k}
            className={cn("h-2 w-2 rounded-full transition-colors", dot)}
            title={`Sector ${k + 1} — ${fmtSector(s)}${s != null ? "s" : ""} (${what})`}
          />
        );
      })}
    </span>
  );
}

function TyreBadge({ compound, age }: { compound: string; age: number | null }) {
  return (
    <span
      className="inline-flex items-baseline gap-px text-[10px] font-bold leading-none"
      style={{ color: TYRE_COLOR[compound] ?? "hsl(var(--muted-foreground))" }}
      title={age != null ? `${compound} · ${age} laps old` : compound}
    >
      {compound}
      {age != null && <span className="text-[8px] text-muted-foreground">{age}</span>}
    </span>
  );
}

interface Props {
  rows: DriverRow[];
  bestHolder: (string | null)[];
  isRace: boolean;
  /** Season, for the portrait media path. */
  year: number;
  /** "DRS" pre-2026, "Override" from 2026 — the era-correct name for the boost light. */
  aidLabel: string;
  /** Driver id currently followed on track, or null. */
  selected: string | null;
  onSelect: (id: string | null) => void;
}

interface StandingRow {
  Driver?: { driverId?: string };
  Constructors?: Array<{ constructorId?: string }>;
}

/**
 * ergast driverId → constructor id, for the team logo.
 *
 * DRIVER_CODE_TO_CONSTRUCTOR is a one-entry override, not a lookup table, so the season's
 * driver standings are the authoritative source. Derived here rather than reusing Pit
 * Wall's hook so this panel stays self-contained — it's a few lines over a shared query,
 * and Race Control shouldn't reach into another feature's internals for it.
 */
function useConstructorByDriverId(year: number): Map<string, string> {
  const standings = useDriverStandings(year);
  return useMemo(() => {
    const m = new Map<string, string>();
    for (const s of (standings.data?.data ?? []) as StandingRow[]) {
      const did = s.Driver?.driverId;
      const cons = s.Constructors?.[s.Constructors.length - 1]?.constructorId;
      if (did && cons) m.set(did, normalizeTeamId(cons));
    }
    return m;
  }, [standings.data]);
}

export default function RaceControlDriverBoard({
  rows,
  bestHolder,
  isRace,
  year,
  aidLabel,
  selected,
  onSelect,
}: Props) {
  const constructorByDriver = useConstructorByDriverId(year);

  if (!rows.length) {
    return <p className="text-xs text-muted-foreground">No timing for this session yet.</p>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card/40">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="instrument-label text-primary">Drivers</span>
        <span className="text-2xs text-muted-foreground">{rows.length}</span>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="ml-auto text-2xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear follow
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        <AnimatePresence initial={false}>
          {rows.map((r) => {
            const isSel = r.id === selected;
            const ergId = ergastIdForDriver(r.id, r.code);
            const cid =
              constructorByDriver.get(ergId) ??
              constructorByDriver.get(r.id) ??
              DRIVER_CODE_TO_CONSTRUCTOR[r.code];
            const path = getF1PortraitPathForErgastDriverId(ergId, year);
            const src = path ? buildF1DriverHeadshotUrl(path) : undefined;
            const gapText =
              r.pos === 1
                ? isRace
                  ? "LEADER"
                  : ""
                : isRace && r.lapsDown >= 1
                  ? `+${r.lapsDown}L`
                  : fmtGap(r.gap);
            return (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  layout: { type: "spring", stiffness: 600, damping: 44 },
                  opacity: { duration: 0.15 },
                }}
                className={cn(
                  "mb-0.5 rounded-lg border px-2 py-[3px] transition-colors",
                  isSel ? "border-primary" : "border-border/60 hover:border-primary/40",
                  r.pit && "opacity-60",
                )}
                style={isSel ? { backgroundColor: `${r.color}1a` } : undefined}
              >
                <button
                  type="button"
                  onClick={() => onSelect(isSel ? null : r.id)}
                  aria-pressed={isSel}
                  aria-label={`Follow ${r.code} on track`}
                  className="flex w-full min-w-0 items-center gap-2 text-left"
                >
                  <span className="w-4 shrink-0 text-center text-xs font-bold text-muted-foreground">
                    {r.pos ?? "—"}
                  </span>
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-muted"
                    style={{ boxShadow: `0 0 0 1.5px ${r.color}` }}
                  >
                    {src ? (
                      <img
                        src={src}
                        alt={r.code}
                        className="h-full w-full object-cover object-top"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-[8px] font-bold text-muted-foreground">{r.code}</span>
                    )}
                  </span>

                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {/* Left — identity, tyre, live lights */}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className="timing text-sm font-bold leading-none text-foreground/90">
                          {r.code}
                        </span>
                        {cid && (
                          <TeamLogo
                            constructorId={cid}
                            size="sm"
                            noBackground
                            className="!h-3 w-auto shrink-0"
                          />
                        )}
                        {r.isFL && (
                          <span className="text-[8px] leading-none text-fastest-lap" title="Fastest lap">
                            ◆
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-2 text-[10px] leading-none text-muted-foreground">
                        {r.tyre && <TyreBadge compound={r.tyre} age={r.tyl} />}
                        {r.drs && (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-gain"
                            title={aidLabel}
                          />
                        )}
                        {r.pit && (
                          <span
                            className="grid h-3 w-3 shrink-0 place-items-center rounded-[3px] border border-foreground/40 text-[7px] font-bold leading-none text-foreground"
                            title="In the pit lane"
                          >
                            P
                          </span>
                        )}
                      </span>
                    </span>

                    {/* Right — lap time, gap (+ interval), sectors */}
                    <span className="flex shrink-0 flex-col items-end gap-[3px] leading-none">
                      <span
                        className={cn(
                          "readout text-[11px]",
                          r.isFLLap ? "text-fastest-lap" : "text-foreground/90",
                        )}
                      >
                        {fmtLap(r.lastTime)}
                      </span>
                      <span className="flex items-baseline gap-1">
                        {gapText && (
                          <span className="timing text-[9px] text-muted-foreground">{gapText}</span>
                        )}
                        {r.pos !== 1 && r.int != null && (
                          <span
                            className="timing text-[9px] text-muted-foreground/60"
                            title="Interval to car ahead"
                          >
                            {fmtGap(r.int)}
                          </span>
                        )}
                      </span>
                      <SectorLeds sec={r.sec} pb={r.pb} id={r.code} bestHolder={bestHolder} />
                    </span>
                  </span>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

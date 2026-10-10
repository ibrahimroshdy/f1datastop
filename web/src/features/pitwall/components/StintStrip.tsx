import { useMemo } from "react";
import type { RaceReplayBlob } from "@/services/raceReplayService";
import type { PitWallDriver } from "../hooks/usePitWallData";
import { tyreColor } from "../pitwall.config";

interface Props {
  blob?: RaceReplayBlob;
  drivers: PitWallDriver[];
  selected: string[];
}

interface Stint {
  compound?: string | null;
  from: number;
  to: number;
}

export function StintStrip({ blob, drivers, selected }: Props) {
  const colorOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of drivers) m[d.code] = d.team_color || "#9ca3af";
    return m;
  }, [drivers]);

  if (!blob) {
    return <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">No session data.</div>;
  }
  const sel = selected.filter((c) => blob.drivers.some((d) => d.code === c));
  if (!sel.length) {
    return <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">Select drivers to see stints.</div>;
  }

  const totalLaps =
    blob.total_laps ?? Math.max(1, ...blob.drivers.flatMap((d) => (d.laps ?? []).map((l) => l.n)));

  const stintsOf = (code: string): { stints: Stint[]; stops: number } => {
    const d = blob.drivers.find((x) => x.code === code);
    const laps = (d?.laps ?? []).slice().sort((a, b) => a.n - b.n);
    const stints: Stint[] = [];
    let cur: Stint | null = null;
    let stops = 0;
    let prevPit = false;
    for (const l of laps) {
      if (l.pit && !prevPit) stops++; // count pit-lane entries, not every pit lap
      prevPit = !!l.pit;
      if (!cur || l.tyre !== cur.compound) {
        if (cur) stints.push(cur);
        cur = { compound: l.tyre, from: l.n, to: l.n };
      } else {
        cur.to = l.n;
      }
    }
    if (cur) stints.push(cur);
    return { stints, stops: Math.max(0, stops) };
  };

  return (
    <div className="space-y-2">
      {sel.map((code) => {
        const { stints, stops } = stintsOf(code);
        return (
          <div key={code} className="flex items-center gap-2">
            <span className="timing w-9 shrink-0 text-xs font-bold" style={{ color: colorOf[code] }}>
              {code}
            </span>
            <div className="flex h-7 flex-1 overflow-hidden rounded border border-border">
              {stints.map((s, i) => {
                const laps = s.to - s.from + 1;
                const w = (laps / totalLaps) * 100;
                return (
                  <div
                    key={i}
                    className="flex flex-col items-center justify-center leading-none text-black/75"
                    style={{ width: `${w}%`, backgroundColor: tyreColor(s.compound) }}
                    title={`${s.compound ?? "?"} · ${laps} lap${laps === 1 ? "" : "s"} (${s.from}–${s.to})`}
                  >
                    {w > 6 && <span className="text-[9px] font-bold">{s.compound ?? ""}</span>}
                    {w > 9 && <span className="text-[7px] font-semibold opacity-75">{laps}</span>}
                  </div>
                );
              })}
            </div>
            <span className="w-14 shrink-0 text-right text-2xs text-muted-foreground">
              {stops} stop{stops === 1 ? "" : "s"}
            </span>
          </div>
        );
      })}
      <div className="text-2xs text-muted-foreground">Compound per stint across {totalLaps} laps.</div>
    </div>
  );
}

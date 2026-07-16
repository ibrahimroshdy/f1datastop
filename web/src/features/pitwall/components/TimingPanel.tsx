import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { RaceReplayBlob } from "@/services/raceReplayService";
import { tyreColor } from "../pitwall.config";

interface Props {
  blob?: RaceReplayBlob;
  selected: string[];
}

const lastNonNull = (arr?: (number | null)[]): number | null => {
  if (!arr) return null;
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i];
  return null;
};

const fmtBest = (s?: number | null) =>
  s == null ? "—" : `${Math.floor(s / 60)}:${(s - Math.floor(s / 60) * 60).toFixed(3).padStart(6, "0")}`;

export function TimingPanel({ blob, selected }: Props) {
  const rows = useMemo(() => {
    if (!blob?.drivers) return [];
    return blob.drivers
      .filter((d) => d.code)
      .map((d) => {
        const laps = d.laps ?? [];
        let best = Infinity;
        let stops = 0;
        let prevPit = false;
        let finalTyre: string | null | undefined;
        for (const l of laps) {
          if (l.last != null && !l.pit) best = Math.min(best, l.last);
          if (l.pit && !prevPit) stops++; // pit-lane entries, not every pit lap
          prevPit = !!l.pit;
          finalTyre = l.tyre;
        }
        return {
          code: d.code as string,
          color: d.team_color || "#9ca3af",
          pos: lastNonNull(d.pos),
          best: isFinite(best) ? best : null,
          stops,
          tyre: finalTyre,
        };
      })
      .sort((a, b) => (a.pos ?? 99) - (b.pos ?? 99));
  }, [blob]);

  if (!rows.length) {
    return <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">No session classification.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="instrument-label px-1.5 py-1 text-left text-[10px]">Pos</th>
            <th className="instrument-label px-1.5 py-1 text-left text-[10px]">Driver</th>
            <th className="instrument-label px-1.5 py-1 text-right text-[10px]">Best lap</th>
            <th className="instrument-label px-1.5 py-1 text-center text-[10px]">Tyre</th>
            <th className="instrument-label px-1.5 py-1 text-right text-[10px]">Stops</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isSel = selected.includes(r.code);
            return (
              <tr
                key={r.code}
                className={cn("border-b border-border/50", isSel && "bg-primary/[0.06]")}
                style={isSel ? { boxShadow: `inset 2px 0 0 ${r.color}` } : undefined}
              >
                <td className="timing px-1.5 py-1 text-muted-foreground">{r.pos ?? i + 1}</td>
                <td className="px-1.5 py-1">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                    <span className={cn("timing font-semibold", isSel && "text-foreground")}>{r.code}</span>
                  </span>
                </td>
                <td className="timing px-1.5 py-1 text-right">{fmtBest(r.best)}</td>
                <td className="px-1.5 py-1 text-center">
                  {r.tyre ? (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full align-middle"
                      style={{ backgroundColor: tyreColor(r.tyre) }}
                      title={r.tyre}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="timing px-1.5 py-1 text-right text-muted-foreground">{r.stops}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

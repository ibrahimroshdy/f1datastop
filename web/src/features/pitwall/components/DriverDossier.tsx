import { DriverAvatar } from "@/components/f1";
import { colorWithAlpha, TEAM_COLORS } from "@/constants/f1Colors";
import {
  buildF1DriverHeadshotUrl,
  getF1PortraitPathForErgastDriverId,
} from "@/constants/f1DriverPortraitMedia";
import type { RaceReplayBlob } from "@/services/raceReplayService";
import type { PitWallDriver } from "../hooks/usePitWallData";

interface Props {
  year: number;
  blob?: RaceReplayBlob;
  drivers: PitWallDriver[];
  selected: string[];
  refCode: string | null;
}

const fmt = (s?: number | null) =>
  s == null ? "—" : `${Math.floor(s / 60)}:${(s - Math.floor(s / 60) * 60).toFixed(3).padStart(6, "0")}`;

/** Premium identity strip for the selected drivers (headshot, number, best lap). */
export function DriverDossier({ year, blob, drivers, selected, refCode }: Props) {
  const sel = drivers.filter((d) => selected.includes(d.code));
  if (!sel.length) return null;

  const bestOf = (code: string) => {
    const d = blob?.drivers.find((x) => x.code === code);
    if (!d?.laps) return null;
    let b = Infinity;
    for (const l of d.laps) if (l.last != null && !l.pit) b = Math.min(b, l.last);
    return isFinite(b) ? b : null;
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {sel.map((d) => {
        const color = d.team_color || TEAM_COLORS.default;
        const path = getF1PortraitPathForErgastDriverId(d.driver_id || "", year);
        const src = path ? buildF1DriverHeadshotUrl(path) : undefined;
        const best = bestOf(d.code);
        return (
          <div
            key={d.code}
            className="flex items-center gap-2.5 rounded-xl border px-2.5 py-2"
            style={{ borderColor: colorWithAlpha(color, 0.4), backgroundColor: colorWithAlpha(color, 0.08) }}
          >
            <DriverAvatar driverCode={d.code} src={src} teamColor={color} size="sm" driverNumber={d.number ?? undefined} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="timing text-sm font-bold leading-none">{d.code}</span>
                {refCode === d.code && (
                  <span className="rounded bg-primary/15 px-1 text-[9px] font-semibold uppercase text-primary">Ref</span>
                )}
              </div>
              <div className="mt-0.5 text-[10px] leading-none text-muted-foreground">
                {d.number != null ? `#${d.number} · ` : ""}
                <span className="timing">{fmt(best)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

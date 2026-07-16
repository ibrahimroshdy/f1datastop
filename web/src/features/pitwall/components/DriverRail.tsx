import { Star } from "lucide-react";
import { DriverAvatar, F1Skeleton } from "@/components/f1";
import TeamLogo from "@/components/common/TeamLogo";
import { cn } from "@/lib/utils";
import { colorWithAlpha } from "@/constants/f1Colors";
import {
  buildF1DriverHeadshotUrl,
  getF1PortraitPathForErgastDriverId,
} from "@/constants/f1DriverPortraitMedia";
import { constructorIdFromColor } from "../replayEngine";
import type { PitWallDriver } from "../hooks/usePitWallData";
import type { CompareMode } from "../pitwall.config";

interface Props {
  year: number;
  drivers: PitWallDriver[];
  selected: string[];
  refCode: string | null;
  mode: CompareMode;
  onToggle: (code: string) => void;
  onSetRef: (code: string) => void;
  isLoading?: boolean;
}

function headshotUrl(driverId: string | null, season: number): string | undefined {
  if (!driverId) return undefined;
  const path = getF1PortraitPathForErgastDriverId(driverId, season);
  return path ? buildF1DriverHeadshotUrl(path) : undefined;
}

/** Position-ordered driver list — one clean selector (photo + team logo). */
export function DriverRail({ year, drivers, selected, refCode, mode, onToggle, onSetRef, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <F1Skeleton key={i} className="h-9" />
        ))}
      </div>
    );
  }
  if (!drivers.length) {
    return <p className="text-xs text-muted-foreground">No drivers for this session yet.</p>;
  }

  return (
    <div className="flex max-h-[46vh] flex-col gap-1 overflow-y-auto pr-0.5 lg:max-h-[600px]">
      {drivers.map((d) => {
        const isSel = selected.includes(d.code);
        const isRef = refCode === d.code;
        const color = d.team_color || "#9ca3af";
        const cid = constructorIdFromColor(color);
        return (
          <div
            key={d.code}
            className={cn(
              "group flex items-center gap-2 rounded-lg border px-1.5 py-1 transition-colors",
              isSel ? "border-transparent" : "border-border/70 hover:border-primary/40",
            )}
            style={
              isSel
                ? { backgroundColor: colorWithAlpha(color, 0.16), boxShadow: `inset 3px 0 0 ${color}` }
                : { boxShadow: `inset 3px 0 0 ${colorWithAlpha(color, 0.55)}` }
            }
          >
            <button
              type="button"
              onClick={() => onToggle(d.code)}
              aria-pressed={isSel}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span className="timing w-4 shrink-0 text-right text-2xs text-muted-foreground">{d.position ?? "—"}</span>
              <DriverAvatar driverCode={d.code} src={headshotUrl(d.driver_id, year)} teamColor={color} size="xs" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <span className={cn("timing text-xs font-bold leading-none", isSel ? "text-foreground" : "text-muted-foreground")}>
                    {d.code}
                  </span>
                  {cid && <TeamLogo constructorId={cid} size="sm" noBackground className="!h-2.5 w-auto shrink-0" />}
                </span>
                {d.number != null && <span className="text-[9px] leading-none text-muted-foreground">#{d.number}</span>}
              </span>
            </button>
            {isSel && (
              <button
                type="button"
                onClick={() => onSetRef(d.code)}
                title={
                  mode === "focus"
                    ? isRef
                      ? "Focused driver"
                      : "Focus this driver"
                    : isRef
                      ? "Reference driver"
                      : "Set as reference"
                }
                aria-label={isRef ? "Reference driver" : "Set as reference"}
                className="shrink-0"
              >
                <Star className={cn("h-3.5 w-3.5", isRef ? "fill-primary text-primary" : "text-muted-foreground/50 hover:text-muted-foreground")} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

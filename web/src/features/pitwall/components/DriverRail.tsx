import { Star } from "lucide-react";
import { DriverAvatar, F1Skeleton } from "@/components/f1";
import { cn } from "@/lib/utils";
import { colorWithAlpha } from "@/constants/f1Colors";
import {
  buildF1DriverHeadshotUrl,
  getF1PortraitPathForErgastDriverId,
} from "@/constants/f1DriverPortraitMedia";
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

export function DriverRail({
  year,
  drivers,
  selected,
  refCode,
  mode,
  onToggle,
  onSetRef,
  isLoading,
}: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <F1Skeleton key={i} className="h-11" />
        ))}
      </div>
    );
  }

  if (!drivers.length) {
    return <p className="text-xs text-muted-foreground">No drivers for this session yet.</p>;
  }

  return (
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-2">
      {drivers.map((d) => {
        const isSel = selected.includes(d.code);
        const isRef = refCode === d.code;
        const color = d.team_color || "#9ca3af";
        return (
          <div
            key={d.code}
            className={cn(
              "group relative flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors",
              isSel ? "border-transparent" : "border-border hover:border-primary/40",
            )}
            style={
              isSel
                ? { backgroundColor: colorWithAlpha(color, 0.16), boxShadow: `inset 2px 0 0 ${color}` }
                : undefined
            }
          >
            <button
              type="button"
              onClick={() => onToggle(d.code)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              aria-pressed={isSel}
            >
              <DriverAvatar
                driverCode={d.code}
                src={headshotUrl(d.driver_id, year)}
                teamColor={color}
                size="xs"
              />
              <span className="min-w-0">
                <span className={cn("timing block text-xs font-bold leading-none", isSel ? "text-foreground" : "text-muted-foreground")}>
                  {d.code}
                </span>
                {d.number != null && (
                  <span className="text-[10px] leading-none text-muted-foreground">#{d.number}</span>
                )}
              </span>
            </button>

            {/* Reference driver: delta baseline in Overlay, the focused car in Focus */}
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
                      ? "Reference driver (delta baseline)"
                      : "Set as reference"
                }
                aria-label={isRef ? "Reference driver" : "Set as reference"}
                className="shrink-0"
              >
                <Star
                  className={cn(
                    "h-3.5 w-3.5 transition-colors",
                    isRef ? "fill-primary text-primary" : "text-muted-foreground/50 hover:text-muted-foreground",
                  )}
                />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

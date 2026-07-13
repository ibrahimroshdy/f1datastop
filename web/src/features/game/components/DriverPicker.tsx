import { useMemo } from "react";
import { ChevronUp, ChevronDown, X, Plus } from "lucide-react";
import { getTeamColorById } from "@/constants/f1Colors";
import { cn } from "@/lib/utils";
import { medalBadge } from "../utils/medal";
import type { SeasonDriver } from "../api/gameClient";

/** Tactile ordered-pick editor: your ranked slots on top, a tap-to-add driver pool below.
 *  Controlled — parent owns `value` (ordered driver ids) + persistence. */
export function DriverPicker({
  depth,
  drivers,
  value,
  editable,
  onChange,
}: {
  depth: number;
  drivers: SeasonDriver[];
  value: string[];
  editable: boolean;
  onChange: (ids: string[]) => void;
}) {
  const byId = useMemo(() => {
    const m = new Map<string, SeasonDriver>();
    for (const d of drivers) m.set(d.driver_id, d);
    return m;
  }, [drivers]);
  const picked = useMemo(() => new Set(value), [value]);

  const add = (id: string) => {
    if (value.includes(id) || value.length >= depth) return;
    onChange([...value, id]);
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Ordered slots */}
      <ol className="flex flex-col gap-1.5">
        {Array.from({ length: depth }).map((_, i) => {
          const id = value[i];
          const d = id ? byId.get(id) : undefined;
          const team = d?.constructor_id ? getTeamColorById(d.constructor_id) : "transparent";
          const pos = i + 1;
          return (
            <li
              key={i}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors",
                d ? "border-border bg-card" : "border border-border/60 bg-muted/10",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-2xs font-bold tabular-nums",
                  medalBadge(pos),
                )}
              >
                {pos}
              </span>
              {d ? (
                <>
                  <span className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: team }} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-mono text-xs font-semibold">{d.code ?? "—"}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{d.name}</span>
                  </span>
                  {editable && (
                    <div className="flex shrink-0 items-center">
                      <button type="button" aria-label="Move up" disabled={i === 0}
                        onClick={() => move(i, -1)}
                        className="flex h-7 w-6 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label="Move down" disabled={i === value.length - 1}
                        onClick={() => move(i, 1)}
                        className="flex h-7 w-6 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label="Remove" onClick={() => remove(i)}
                        className="flex h-7 w-6 items-center justify-center text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-xs text-muted-foreground/50">
                  {!editable ? "No pick" : i === value.length ? "Tap a driver to add ↓" : ""}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Driver pool */}
      {editable && (
        <div>
          <div className="instrument-label mb-1.5 text-muted-foreground">
            Drivers · {value.length}/{depth} picked
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {drivers.map((d) => {
              const isPicked = picked.has(d.driver_id);
              const pickPos = isPicked ? value.indexOf(d.driver_id) + 1 : 0;
              const full = value.length >= depth && !isPicked;
              const team = d.constructor_id ? getTeamColorById(d.constructor_id) : "transparent";
              return (
                <button
                  key={d.driver_id}
                  type="button"
                  disabled={full}
                  onClick={() => (isPicked ? remove(value.indexOf(d.driver_id)) : add(d.driver_id))}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2 py-2 text-left transition-all",
                    isPicked
                      ? "border-primary/40 bg-primary/[0.06]"
                      : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm",
                    full && "cursor-not-allowed opacity-40",
                  )}
                >
                  <span className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: team }} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs font-semibold">{d.code ?? "—"}</span>
                    <span className="block truncate text-2xs text-muted-foreground">{d.name}</span>
                  </span>
                  {isPicked ? (
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-2xs font-bold tabular-nums",
                        medalBadge(pickPos),
                      )}
                      aria-label={`Picked P${pickPos}`}
                    >
                      {pickPos}
                    </span>
                  ) : (
                    <Plus className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

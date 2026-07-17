import { useMemo } from "react";
import { Flag, Link2, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CountryFlag from "@/components/common/CountryFlag";
import { F1Card } from "@/components/f1";
import { cn } from "@/lib/utils";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { useRaceSchedule } from "@/hooks/f1/useSchedule";
import type { RaceContext } from "@/components/race-analysis/RaceAnalysisHeader";
import { PITWALL_SEASONS, sessionsForRace, type CompareMode } from "../pitwall.config";
import type { PitWallState } from "../hooks/usePitWallState";

interface Props {
  state: PitWallState;
  patch: (next: Partial<PitWallState>) => void;
}

type ScheduleRace = RaceContext & { date?: string };

const SESSION_NAME: Record<string, string> = { R: "Race", Q: "Qualifying", S: "Sprint" };
const cleanName = (n: string) => n.replace(/grand prix/i, "GP").replace(/[\u{1F1E0}-\u{1F1FF}]{2}/gu, "").trim();
const isSprint = (r: { Sprint?: unknown; SprintQualifying?: unknown }) => !!(r.Sprint || r.SprintQualifying);

export function ContextBar({ state, patch }: Props) {
  const { cardVariant, glassVariant, isGlass } = useThemeVariant();
  const schedule = useRaceSchedule(state.year);
  const races = (schedule.data?.data ?? []) as ScheduleRace[];
  const currentRace = useMemo(
    () => races.find((r) => Number(r.round) === state.round) ?? null,
    [races, state.round],
  );
  const sessions = sessionsForRace(currentRace);
  const raceLabel = currentRace ? cleanName(currentRace.raceName) : "";

  const onShare = () => {
    navigator.clipboard?.writeText(window.location.href).then(
      () => toast.success("Pit Wall link copied"),
      () => toast.error("Couldn't copy link"),
    );
  };

  return (
    <F1Card size="sm" variant={cardVariant} glassVariant={glassVariant} className={cn("overflow-hidden p-0", isGlass && "border-white/10")}>
      {/* Summary strip — flag + session + GP + round (mirrors the Race Analysis picker) */}
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2 md:px-4">
        <span className="instrument-label flex shrink-0 items-center gap-1.5 text-primary">
          <Flag className="h-3 w-3" /> {SESSION_NAME[state.session] ?? state.session}
        </span>
        {currentRace && <CountryFlag country={currentRace.Circuit?.Location?.country ?? ""} size={16} className="rounded-[1px]" />}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {raceLabel || <span className="text-muted-foreground">Select a Grand Prix</span>}
        </span>
        {currentRace && (
          <span className="timing shrink-0 rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">R{currentRace.round}</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-2 px-3 py-2.5 md:gap-3 md:px-4">
        <div>
          <label className="instrument-label mb-1 block">Season</label>
          <Select value={String(state.year)} onValueChange={(v) => patch({ year: Number(v), round: null, drivers: [], ref: null, lap: null })}>
            <SelectTrigger className="h-9 w-[92px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PITWALL_SEASONS.map((y) => (
                <SelectItem key={y} value={String(y)} className="timing">{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[180px] flex-1">
          <label className="instrument-label mb-1 block">Grand Prix</label>
          <Select
            value={state.round ? String(state.round) : ""}
            onValueChange={(v) => patch({ round: Number(v), lap: null })}
            disabled={schedule.isLoading || races.length === 0}
          >
            <SelectTrigger className="h-9 w-full"><SelectValue placeholder={schedule.isLoading ? "Loading races…" : "Select a race"} /></SelectTrigger>
            <SelectContent>
              {races.map((r) => (
                <SelectItem key={r.round} value={String(r.round)}>
                  <span className="flex items-center gap-2">
                    <CountryFlag country={r.Circuit?.Location?.country ?? ""} size={14} />
                    <span className="timing text-xs text-muted-foreground">R{r.round}</span>
                    <span className="truncate">{r.Circuit?.circuitName || cleanName(r.raceName)}</span>
                    {isSprint(r) && <Star className="h-3 w-3 shrink-0 fill-current text-position-gold" aria-label="Sprint weekend" />}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="instrument-label mb-1 block">Session</label>
          <div className="flex overflow-hidden rounded-lg border border-border">
            {sessions.map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => patch({ session: s.code, lap: null })}
                className={cn(
                  "min-h-9 px-3 text-xs font-semibold transition-colors",
                  state.session === s.code ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {s.short}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="instrument-label mb-1 block">Compare</label>
            <div className="flex overflow-hidden rounded-lg border border-border">
              {(["focus", "overlay"] as CompareMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => patch({ mode: m })}
                  className={cn(
                    "min-h-9 px-3 text-xs font-semibold capitalize transition-colors",
                    state.mode === m ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {m === "overlay" ? <span className="flex items-center gap-1"><Users className="h-3 w-3" />Overlay</span> : "Focus"}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onShare}
            title="Copy Pit Wall link"
            aria-label="Share — copy link"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Link2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </F1Card>
  );
}

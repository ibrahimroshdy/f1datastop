import { useMemo } from "react";
import { Link2, Radio, Users } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CountryFlag from "@/components/common/CountryFlag";
import { cn } from "@/lib/utils";
import { useRaceSchedule } from "@/hooks/f1/useSchedule";
import type { RaceContext } from "@/components/race-analysis/RaceAnalysisHeader";
import { PITWALL_SEASONS, sessionsForRace, type CompareMode } from "../pitwall.config";
import type { PitWallState } from "../hooks/usePitWallState";

interface Props {
  state: PitWallState;
  patch: (next: Partial<PitWallState>) => void;
}

type ScheduleRace = RaceContext & { date?: string };

const cleanName = (n: string) => n.replace(/grand prix/i, "GP").replace(/[\u{1F1E0}-\u{1F1FF}]{2}/gu, "").trim();

export function ContextBar({ state, patch }: Props) {
  const schedule = useRaceSchedule(state.year);
  const races = (schedule.data?.data ?? []) as ScheduleRace[];
  const currentRace = useMemo(
    () => races.find((r) => Number(r.round) === state.round) ?? null,
    [races, state.round],
  );
  const sessions = sessionsForRace(currentRace);

  const onShare = () => {
    navigator.clipboard?.writeText(window.location.href).then(
      () => toast.success("Pit Wall link copied"),
      () => toast.error("Couldn't copy link"),
    );
  };

  return (
    <div className="sticky top-0 z-20 -mx-1 rounded-2xl border border-border bg-card/80 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex flex-wrap items-center gap-2">
        <span className="instrument-label mr-1 hidden items-center gap-1.5 text-primary sm:flex">
          <Radio className="h-3.5 w-3.5" /> Pit Wall
        </span>

        {/* Season */}
        <Select value={String(state.year)} onValueChange={(v) => patch({ year: Number(v), round: null, drivers: [], ref: null, lap: null })}>
          <SelectTrigger className="h-9 w-[92px] shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PITWALL_SEASONS.map((y) => (
              <SelectItem key={y} value={String(y)} className="timing">{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Event */}
        <Select
          value={state.round ? String(state.round) : ""}
          onValueChange={(v) => patch({ round: Number(v), lap: null })}
          disabled={schedule.isLoading || races.length === 0}
        >
          <SelectTrigger className="h-9 min-w-[190px] flex-1"><SelectValue placeholder={schedule.isLoading ? "Loading races…" : "Select a Grand Prix"} /></SelectTrigger>
          <SelectContent>
            {races.map((r) => (
              <SelectItem key={r.round} value={String(r.round)}>
                <span className="flex items-center gap-2">
                  <CountryFlag country={r.Circuit?.Location?.country ?? ""} size={14} />
                  <span className="truncate">{cleanName(r.raceName)}</span>
                  <span className="timing text-2xs text-muted-foreground">R{r.round}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Session */}
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-border">
          {sessions.map((s) => (
            <button
              key={s.code}
              type="button"
              onClick={() => patch({ session: s.code, lap: null })}
              className={cn(
                "min-h-9 px-3 text-xs font-semibold transition-colors",
                state.session === s.code
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {s.short}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Mode */}
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-border" title="Comparison mode">
            {(["focus", "overlay"] as CompareMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => patch({ mode: m })}
                className={cn(
                  "min-h-9 px-3 text-xs font-semibold capitalize transition-colors",
                  state.mode === m
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {m === "overlay" ? <span className="flex items-center gap-1"><Users className="h-3 w-3" />Overlay</span> : "Focus"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onShare}
            className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Link2 className="h-3.5 w-3.5" /> Share
          </button>
        </div>
      </div>
    </div>
  );
}

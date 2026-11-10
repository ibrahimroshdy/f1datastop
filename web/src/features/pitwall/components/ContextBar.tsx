import { useMemo } from "react";
import { ArrowUpRight, Link2, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CountryFlag from "@/components/common/CountryFlag";
import { F1Card, SessionSelector, type SessionOption } from "@/components/f1";
import { cn } from "@/lib/utils";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { useRaceSchedule } from "@/hooks/f1/useSchedule";
import type { RaceContext } from "@/components/race-analysis/RaceAnalysisHeader";
import { raceHref } from "@/lib/links";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { isSprintWeekend } from "@/components/race-analysis/raceContext";
import { sessionsForRace, type CompareMode, type SessionCode } from "../pitwall.config";
import type { PitWallState } from "../hooks/usePitWallState";

interface Props {
  state: PitWallState;
  patch: (next: Partial<PitWallState>) => void;
}

type ScheduleRace = RaceContext & { date?: string };

const SESSION_NAME: Record<string, string> = {
  R: "Race", Q: "Qualifying", S: "Sprint", SQ: "Sprint qualifying", SS: "Sprint shootout",
  FP1: "Practice 1", FP2: "Practice 2", FP3: "Practice 3",
};

export function ContextBar({ state, patch }: Props) {
  const { cardVariant, glassVariant, isGlass } = useThemeVariant();
  const schedule = useRaceSchedule(state.year);
  const races = (schedule.data?.data ?? []) as ScheduleRace[];
  const currentRace = useMemo(
    () => races.find((r) => Number(r.round) === state.round) ?? null,
    [races, state.round],
  );
  const sessions = sessionsForRace(currentRace);
  const sessionOptions: SessionOption[] = sessions.map((s, i) => ({
    session_key: i + 1,
    session_name: s.label,
    session_type: s.code,
    date_start: "",
    date_end: "",
    meeting_key: 0,
  }));
  const selectedSessionKey =
    sessionOptions.find((o) => o.session_type === state.session)?.session_key ?? null;
  const raceLabel = currentRace ? getRaceNameWithoutEmoji(currentRace.raceName) : "";

  const onShare = () => {
    navigator.clipboard?.writeText(window.location.href).then(
      () => toast.success("Pit Wall link copied"),
      () => toast.error("Couldn't copy link"),
    );
  };

  return (
    <F1Card size="sm" variant={cardVariant} glassVariant={glassVariant} className={cn("overflow-hidden p-0", isGlass && "border-white/10")}>
      {/* The Grand Prix and session on screen, with the way back to its full page */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-border px-3 py-2.5 md:px-4">
        {currentRace && <CountryFlag country={currentRace.Circuit?.Location?.country ?? ""} size={18} />}
        {currentRace ? (
          <Link to={raceHref(state.year, currentRace.round, undefined, state.session)} viewTransition className="min-w-0 text-sm font-semibold text-heading hover:underline">
            {state.year} {raceLabel}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">Pick a Grand Prix</span>
        )}
        <span className="text-sm text-ink-2">{SESSION_NAME[state.session] ?? state.session}</span>
        {currentRace && (
          <Link
            to={raceHref(state.year, currentRace.round, undefined, state.session)}
            viewTransition
            className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-heading hover:underline"
          >
            Grand Prix page <ArrowUpRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-2 px-3 py-2.5 md:gap-3 md:px-4">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Grand Prix</label>
          <Select
            value={state.round ? String(state.round) : ""}
            onValueChange={(v) => patch({ round: Number(v), lap: null })}
            disabled={schedule.isLoading || races.length === 0}
          >
            <SelectTrigger className="h-9 w-full"><SelectValue placeholder={schedule.isLoading ? "Loading races…" : "Pick a Grand Prix"} /></SelectTrigger>
            <SelectContent>
              {races.map((r) => (
                <SelectItem key={r.round} value={String(r.round)}>
                  <span className="flex items-center gap-2">
                    <CountryFlag country={r.Circuit?.Location?.country ?? ""} size={14} />
                    <span>{getRaceNameWithoutEmoji(r.raceName)}</span>
                    {isSprintWeekend(r) && <span className="text-xs text-muted-foreground">Sprint</span>}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SessionSelector
          label="Session"
          sessions={sessionOptions}
          selectedSessionKey={selectedSessionKey}
          onSessionChange={(v) => {
            const opt = sessionOptions.find((o) => String(o.session_key) === v);
            if (opt) patch({ session: opt.session_type as SessionCode, lap: null });
          }}
        />

        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Compare</label>
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

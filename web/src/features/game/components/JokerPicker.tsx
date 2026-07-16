import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoundFlag } from "./RoundFlag";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle } from "@/components/f1";
import { getGameSchedule, getMyJoker, setJoker, ACTIVE_GAME_SEASON } from "../api/gameClient";

/** Pick ONE upcoming round to double your points ("joker"). Editable while that round is open. */
export function JokerPicker() {
  const qc = useQueryClient();
  const schedule = useQuery({ queryKey: ["game", "schedule", ACTIVE_GAME_SEASON], queryFn: () => getGameSchedule() });
  const joker = useQuery({ queryKey: ["game", "joker"], queryFn: () => getMyJoker() });

  const openRounds = (schedule.data ?? []).filter((r) => !r.is_locked);
  const jokerRound = joker.data ?? null;
  const jokerRace = schedule.data?.find((r) => r.round === jokerRound);
  const jokerLocked = jokerRace?.is_locked ?? false;

  const save = useMutation({
    mutationFn: (round: number) => setJoker(round),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["game", "joker"] }),
  });

  return (
    <F1Card>
      <F1CardHeader className="flex-row items-center gap-1.5 pb-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <F1CardTitle className="text-base">Joker — double points</F1CardTitle>
      </F1CardHeader>
      <F1CardContent className="flex flex-col gap-2">
        <p className="text-2xs text-muted-foreground">
          Pick one race to <strong>double</strong> its points. Locked once that weekend starts.
        </p>
        {jokerRound && (
          <div className="text-sm">
            Active on <span className="font-semibold text-primary">{jokerRace?.race_name ?? `Round ${jokerRound}`}</span>
            {jokerLocked && <span className="ml-1.5 text-2xs text-muted-foreground">(locked)</span>}
          </div>
        )}
        {openRounds.length > 0 ? (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Joker round">
            {openRounds.map((r) => {
              const active = jokerRound === r.round && !jokerLocked;
              return (
                <button
                  key={r.round}
                  type="button"
                  onClick={() => save.mutate(r.round)}
                  aria-pressed={active}
                  disabled={save.isPending}
                  className={cn(
                    "flex min-h-11 shrink-0 flex-col items-center justify-center rounded-lg border px-3 py-1.5 text-center transition-colors disabled:opacity-60",
                    active
                      ? "border-primary bg-primary/10 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
                      : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <RoundFlag round={r.round} country={r.country} />
                  <span className="max-w-[7rem] truncate text-2xs">{r.race_name}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No open rounds left to joker this season.</p>
        )}
        {save.error ? <p className="text-xs text-destructive">{(save.error as Error).message}</p> : null}
      </F1CardContent>
    </F1Card>
  );
}

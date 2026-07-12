import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BackLink } from "@/components/ui/back-link";
import { F1Card, F1CardContent, F1Skeleton } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useGameActivation } from "../hooks/useGameActivation";
import { getMyHistory, getMyTotal, getGameSchedule, type SessionType } from "../api/gameClient";

const SESSION_ORDER: SessionType[] = ["Q", "S", "R"];
const SESSION_LABEL: Record<SessionType, string> = { Q: "Quali", S: "Sprint", R: "Race" };

export default function GameHistory() {
  const { entryId } = useGameActivation();
  const history = useQuery({
    queryKey: ["game", "history", entryId],
    queryFn: () => getMyHistory(entryId as string),
    enabled: !!entryId,
  });
  const total = useQuery({
    queryKey: ["game", "total", entryId],
    queryFn: () => getMyTotal(entryId as string),
    enabled: !!entryId,
  });
  const schedule = useQuery({ queryKey: ["game", "schedule"], queryFn: () => getGameSchedule() });

  const byRound = useMemo(() => {
    const m = new Map<number, Partial<Record<SessionType, number>>>();
    for (const s of history.data ?? []) {
      const r = m.get(s.round) ?? {};
      r[s.session_type] = Number(s.points);
      m.set(s.round, r);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [history.data]);

  const nameFor = (round: number) =>
    schedule.data?.find((r) => r.round === round)?.race_name ?? `Round ${round}`;

  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full max-w-2xl", pageStack, "animate-fade-in")}>
        <BackLink to="/game">Predictions</BackLink>
        <div className="space-y-1.5">
          <div className="instrument-label text-primary">Your season</div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">Points History</h1>
          {total.data && (
            <p className="text-sm text-muted-foreground">
              <span className="readout text-primary">{Number(total.data.total_points)}</span> total points ·{" "}
              {total.data.exact_hits} exact hits
            </p>
          )}
        </div>

        {history.isLoading ? (
          <F1Skeleton variant="card" className="h-48" />
        ) : byRound.length === 0 ? (
          <F1Card>
            <F1CardContent className="py-6 text-sm text-muted-foreground">
              No graded rounds yet. Points appear here after each session's results are in.
            </F1CardContent>
          </F1Card>
        ) : (
          <F1Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="instrument-label px-4 py-2 text-left text-[10px]">Round</th>
                    {SESSION_ORDER.map((s) => (
                      <th key={s} className="instrument-label px-3 py-2 text-right text-[10px]">{SESSION_LABEL[s]}</th>
                    ))}
                    <th className="instrument-label px-4 py-2 text-right text-[10px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {byRound.map(([round, sess]) => {
                    const rowTotal = SESSION_ORDER.reduce((a, s) => a + (sess[s] ?? 0), 0);
                    return (
                      <tr key={round} className="border-b border-border/60 transition-colors hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-2 font-medium">{nameFor(round)}</td>
                        {SESSION_ORDER.map((s) => (
                          <td key={s} className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {sess[s] != null ? sess[s] : "–"}
                          </td>
                        ))}
                        <td className="readout px-4 py-2 text-right font-bold tabular-nums text-primary">{rowTotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </F1Card>
        )}
      </div>
    </div>
  );
}

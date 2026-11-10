import { useMemo } from "react";
import { Link } from "react-router-dom";
import { F1Card, F1Skeleton } from "@/components/f1";
import { DriverIdentity } from "@/components/f1/DriverIdentity";
import { DriverFace } from "@/components/calendar/DriverFace";
import { driverHref, raceHref } from "@/lib/links";
import { useCircuitHistory } from "./useCircuitHistory";

/**
 * This track across the years: every edition's winner and pole, newest first, and who has won
 * here most. Each year opens that Grand Prix; each winner opens the driver. Hidden under 2 editions.
 */
export default function CircuitHistoryCard({ circuitId }: { circuitId?: string }) {
  const { data, isLoading } = useCircuitHistory(circuitId);

  const eds = useMemo(
    () => (data ?? []).filter((e) => e.winner).sort((a, b) => b.season - a.season || b.round - a.round),
    [data],
  );

  const wins = useMemo(() => {
    const m = new Map<string, { n: number; id?: string; name?: string; teamId?: string }>();
    for (const e of eds) {
      const cur = m.get(e.winner!) ?? { n: 0, id: e.winner_id, name: e.winner_name, teamId: e.winner_team_id };
      m.set(e.winner!, { ...cur, n: cur.n + 1 });
    }
    return [...m.entries()]
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  }, [eds]);

  if (isLoading) return <F1Skeleton variant="card" className="h-56" />;
  if (eds.length < 2) return null;

  return (
    <F1Card className="overflow-hidden p-0">
      <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-lg">Winners here</h2>
        <span className="text-[13px] text-muted-foreground">{eds.length} races</span>
      </div>

      <div className="grid gap-0 md:grid-cols-[1.4fr_1fr] md:divide-x md:divide-border">
        <ul className="m-0 list-none divide-y divide-border p-0">
          {eds.map((e) => (
            <li key={`${e.season}-${e.round}`} className="flex items-center gap-3 px-4 py-2.5">
              <Link
                to={raceHref(e.season, e.round)}
                aria-label={`${e.season} ${e.race_name ?? "Grand Prix"}`}
                className="w-12 shrink-0 font-mono text-sm font-semibold tabular-nums text-heading hover:underline"
              >
                {e.season}
              </Link>
              {e.winner_id ? (
                <DriverIdentity
                  driverId={e.winner_id}
                  familyName={e.winner_name ?? e.winner ?? ""}
                  constructorId={e.winner_team_id}
                  teamName={e.winner_team}
                  size={32}
                  className="flex-1"
                />
              ) : (
                <span className="flex-1 text-sm font-semibold">{e.winner_name ?? e.winner}</span>
              )}
              {e.pole ? (
                <span className="shrink-0 text-right text-[13px] text-muted-foreground">
                  Pole <span className="font-mono tabular-nums">{e.pole}</span>
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="border-t border-border p-4 md:border-t-0">
          <h3 className="mb-3 text-base">Most wins here</h3>
          <ul className="m-0 list-none space-y-2.5 p-0">
            {wins.map((w) => (
              <li key={w.code} className="flex items-center gap-3">
                {w.id ? (
                  <DriverFace
                    driverId={w.id}
                    familyName={w.name ?? w.code}
                    constructorId={w.teamId}
                    label={w.name ?? w.code}
                    size="sm"
                  />
                ) : null}
                {w.id ? (
                  <Link to={driverHref(w.id)} className="flex-1 text-sm font-semibold text-heading hover:underline">
                    {w.name ?? w.code}
                  </Link>
                ) : (
                  <span className="flex-1 text-sm font-semibold">{w.name ?? w.code}</span>
                )}
                <span className="shrink-0 text-sm text-ink-2">
                  {w.n === 1 ? "1 win" : `${w.n} wins`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </F1Card>
  );
}

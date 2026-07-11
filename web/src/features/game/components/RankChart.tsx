import { useMemo } from "react";
import type { RankHistoryRow } from "../api/leaguesClient";

/** Bump chart of league rank over rounds (rank 1 at top). Highlights the current user. */
export function RankChart({ rows, meId }: { rows: RankHistoryRow[]; meId?: string }) {
  const { series, rounds, maxRank } = useMemo(() => {
    const byUser = new Map<string, { username: string | null; points: { round: number; rank: number }[] }>();
    const roundSet = new Set<number>();
    let maxR = 1;
    for (const r of rows) {
      roundSet.add(r.round);
      maxR = Math.max(maxR, r.rank);
      const u = byUser.get(r.user_id) ?? { username: r.username, points: [] };
      u.points.push({ round: r.round, rank: r.rank });
      byUser.set(r.user_id, u);
    }
    const rs = [...roundSet].sort((a, b) => a - b);
    return {
      series: [...byUser.entries()].map(([id, v]) => ({ id, ...v })),
      rounds: rs,
      maxRank: maxR,
    };
  }, [rows]);

  if (rounds.length < 2) return null;

  const W = 320, H = 160, padX = 16, padY = 14;
  const x = (round: number) =>
    padX + ((round - rounds[0]) / Math.max(1, rounds[rounds.length - 1] - rounds[0])) * (W - padX * 2);
  const y = (rank: number) => padY + ((rank - 1) / Math.max(1, maxRank - 1)) * (H - padY * 2);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280 }} role="img" aria-label="Rank over rounds">
        {series.map((s) => {
          const mine = s.id === meId;
          const pts = [...s.points].sort((a, b) => a.round - b.round);
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.round).toFixed(1)},${y(p.rank).toFixed(1)}`).join(" ");
          return (
            <g key={s.id}>
              <path
                d={d}
                fill="none"
                stroke={mine ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                strokeWidth={mine ? 2.2 : 1}
                strokeOpacity={mine ? 1 : 0.35}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {mine &&
                pts.map((p) => (
                  <circle key={p.round} cx={x(p.round)} cy={y(p.rank)} r={2.6} fill="hsl(var(--primary))" />
                ))}
            </g>
          );
        })}
        {rounds.map((r) => (
          <text key={r} x={x(r)} y={H - 2} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 8 }}>
            R{r}
          </text>
        ))}
      </svg>
    </div>
  );
}

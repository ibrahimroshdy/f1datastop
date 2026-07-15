import { cn } from "@/lib/utils";

export interface TimingRow {
  pos: number;
  name: string;
  sub?: string;
  points: number | string;
  /** +n up / -n down since last round; omit or 0 = no marker. */
  movement?: number;
  teamColor?: string;
  avatarUrl?: string;
  isYou?: boolean;
}

const posTone = (p: number) =>
  p === 1
    ? "text-position-gold"
    : p === 2
      ? "text-position-silver"
      : p === 3
        ? "text-position-bronze"
        : "text-muted-foreground";

/**
 * The Pit Wall leaderboard grammar — a live timing tower. Monospace positions,
 * a team-colour left edge, optional face + movement arrow, and a mono points
 * readout on the right. The YOU row gets a primary tint + chip.
 */
export function TimingTower({
  rows,
  title,
  unit = "PTS",
  className,
}: {
  rows: TimingRow[];
  title?: string;
  unit?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-card/40", className)}>
      {title ? (
        <div className="instrument-label flex items-center justify-between border-b border-border px-3 py-2 text-muted-foreground">
          <span>{title}</span>
          <span>{unit}</span>
        </div>
      ) : null}
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li
            key={`${r.pos}-${r.name}`}
            className={cn(
              "flex items-center gap-3 px-3 py-2 transition-colors",
              r.isYou && "bg-primary/5",
            )}
            style={r.teamColor ? { borderLeft: `2px solid ${r.teamColor}` } : undefined}
          >
            <span className={cn("timing w-7 shrink-0 text-center text-sm font-bold tabular-nums", posTone(r.pos))}>
              P{r.pos}
            </span>
            {r.avatarUrl ? (
              <img
                src={r.avatarUrl}
                alt=""
                loading="lazy"
                className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-border"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate text-sm font-semibold">
                <span className="truncate">{r.name}</span>
                {r.isYou ? (
                  <span className="shrink-0 rounded bg-primary px-1 py-px text-2xs font-bold uppercase text-primary-foreground">
                    You
                  </span>
                ) : null}
              </div>
              {r.sub ? <div className="truncate text-2xs text-muted-foreground">{r.sub}</div> : null}
            </div>
            {r.movement ? (
              <span
                className={cn(
                  "timing shrink-0 text-2xs font-semibold tabular-nums",
                  r.movement > 0 ? "text-gain" : "text-loss",
                )}
              >
                {r.movement > 0 ? "▲" : "▼"}
                {Math.abs(r.movement)}
              </span>
            ) : null}
            <span className="readout w-12 shrink-0 text-right font-mono text-sm font-bold tabular-nums text-primary">
              {r.points}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

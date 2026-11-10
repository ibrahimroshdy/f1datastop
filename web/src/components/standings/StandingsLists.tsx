import { Link } from "react-router-dom";
import { DriverIdentity } from "@/components/f1/DriverIdentity";
import { TeamName } from "@/components/f1/TeamName";
import { getTeamColorById } from "@/constants/f1Colors";
import { driverHref, teamHref } from "@/lib/links";

/**
 * The championship as rows (docs/design/screens/content.py "standings"): position, the driver
 * or team, wins, points and the gap to the leader in words. No bars behind the rows.
 */

export type DriverStandingRow = {
  position: string;
  points: string;
  wins?: string;
  Driver: { driverId?: string; givenName: string; familyName: string; code: string; nationality?: string };
  Constructors: Array<{ constructorId?: string; name: string; nationality?: string }>;
};

export type ConstructorStandingRow = {
  position: string;
  points: string;
  wins?: string;
  Constructor: { constructorId?: string; name: string; nationality?: string };
};

/** "Leader", "Level" or "111 behind". */
export function gapWords(leader: number, points: number, isLeader: boolean): string {
  if (isLeader) return "Leader";
  const gap = Math.max(0, leader - points);
  return gap === 0 ? "Level" : `${gap.toLocaleString()} behind`;
}

export const winsWords = (wins: number) => (wins === 1 ? "1 win" : `${wins} wins`);

const Pos = ({ position }: { position: string }) => (
  <span className="timing w-6 shrink-0 text-center text-sm font-semibold text-ink-2">{position}</span>
);

const End = ({ points, gap }: { points: number; gap: string }) => (
  <span className="flex shrink-0 flex-col items-end text-right">
    <span className="readout text-base font-semibold text-figure">
      {points.toLocaleString()}
      <span className="sr-only"> points</span>
    </span>
    <span className="text-[13px] text-muted-foreground">{gap}</span>
  </span>
);

export function DriverStandingsList({
  rows,
  limit,
  compact = false,
}: {
  rows: DriverStandingRow[];
  limit?: number;
  /** Surname only and a smaller face, for summary cards. */
  compact?: boolean;
}) {
  const leader = Number(rows[0]?.points ?? 0);
  const visible = limit ? rows.slice(0, limit) : rows;
  return (
    <ul className="divide-y divide-border">
      {visible.map((row, i) => {
        const team = row.Constructors[row.Constructors.length - 1];
        const wins = Number(row.wins ?? 0);
        const points = Number(row.points) || 0;
        return (
          <li key={row.Driver.driverId ?? row.Driver.code} className="flex items-center gap-3 px-4 py-2.5">
            <Pos position={row.position} />
            <DriverIdentity
              driverId={row.Driver.driverId ?? row.Driver.code}
              givenName={row.Driver.givenName}
              familyName={row.Driver.familyName}
              nationality={row.Driver.nationality}
              constructorId={team?.constructorId}
              teamName={team?.name}
              size={compact ? 32 : 40}
              compact={compact}
              className="flex-1"
            />
            {!compact && (
              <span className="hidden w-16 shrink-0 text-right text-sm text-ink-2 md:block">{winsWords(wins)}</span>
            )}
            <End points={points} gap={gapWords(leader, points, row.position === "1" || (!row.position && i === 0))} />
          </li>
        );
      })}
    </ul>
  );
}

export type TeamDriverLink = { driverId?: string; name: string; points: number };

export function TeamStandingsList({
  rows,
  season,
  limit,
  leaderPoints,
  driversByTeam,
}: {
  rows: ConstructorStandingRow[];
  season?: number;
  limit?: number;
  /** The leader's points, when `rows` is a filtered or paged slice. */
  leaderPoints?: number;
  /** When given, each team lists its drivers' points under the name. Keyed by constructorId. */
  driversByTeam?: Record<string, TeamDriverLink[]>;
}) {
  const leader = leaderPoints ?? Number(rows[0]?.points ?? 0);
  const visible = limit ? rows.slice(0, limit) : rows;
  return (
    <ul className="divide-y divide-border">
      {visible.map((row, i) => {
        const id = row.Constructor.constructorId ?? "";
        const wins = Number(row.wins ?? 0);
        const points = Number(row.points) || 0;
        const drivers = driversByTeam?.[id] ?? [];
        return (
          <li key={id || row.Constructor.name} className="flex items-center gap-3 px-4 py-2.5">
            <Pos position={row.position} />
            <span
              className="w-1.5 self-stretch rounded-full"
              style={{ backgroundColor: getTeamColorById(id) }}
              aria-hidden
            />
            <span className="flex min-w-0 flex-1 flex-col">
              {id ? (
                <TeamName
                  constructorId={id}
                  name={row.Constructor.name}
                  to={teamHref(id, season)}
                  size={18}
                  className="font-semibold text-heading"
                />
              ) : (
                <span className="font-semibold text-heading">{row.Constructor.name}</span>
              )}
              <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
                <span>{winsWords(wins)}</span>
                {drivers.map((d) =>
                  d.driverId ? (
                    <Link key={d.driverId} to={driverHref(d.driverId, season)} className="hover:text-foreground hover:underline">
                      {d.name} {d.points}
                    </Link>
                  ) : (
                    <span key={d.name}>
                      {d.name} {d.points}
                    </span>
                  ),
                )}
              </span>
            </span>
            <End points={points} gap={gapWords(leader, points, row.position === "1" || (!row.position && i === 0))} />
          </li>
        );
      })}
    </ul>
  );
}

/** The drivers of each team from a driver standings list, best first, keyed by constructorId. */
export function driversByTeam(rows: DriverStandingRow[]): Record<string, TeamDriverLink[]> {
  const out: Record<string, TeamDriverLink[]> = {};
  for (const r of rows) {
    const team = r.Constructors[r.Constructors.length - 1];
    const id = team?.constructorId;
    if (!id) continue;
    (out[id] ??= []).push({ driverId: r.Driver.driverId, name: r.Driver.familyName, points: Number(r.points) || 0 });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => b.points - a.points);
  return out;
}

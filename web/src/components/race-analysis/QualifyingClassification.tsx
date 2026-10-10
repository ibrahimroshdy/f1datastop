import React, { useMemo } from "react";
import { useRaceQualifying, useQualifyingLaps } from "@/hooks/f1";
import { getTeamColorById } from "@/constants/f1Colors";
import { F1Skeleton, F1EmptyState, F1ErrorState } from "@/components/f1";
import { cn } from "@/lib/utils";

/**
 * The official-style qualifying classification: Pos / No. / Driver / Team / Q1 / Q2 / Q3 / Laps.
 *
 * The existing MuiQualifyingChart compares a couple of drivers' times visually, which
 * answers "how close were they" but not "what actually happened in the session". This is
 * the reference table people expect to read first — every driver, every segment, in order.
 */

interface QualifyingClassificationProps {
  year: number;
  round: string;
}

interface Row {
  position: number;
  number: string;
  driverId: string;
  code: string;
  firstName: string;
  lastName: string;
  team: string;
  teamColor: string;
  q1: string | null;
  q2: string | null;
  q3: string | null;
  laps: number | null;
}

/** Parse "m:ss.mmm" (or "ss.mmm") to seconds, for picking the quickest time in a segment. */
function parseLap(t?: string | null): number | null {
  if (!t) return null;
  const m = String(t).match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return (m[1] ? parseInt(m[1], 10) * 60 : 0) + parseFloat(m[2]);
}

const SEGMENTS = ["q1", "q2", "q3"] as const;
type Segment = (typeof SEGMENTS)[number];

const QualifyingClassification: React.FC<QualifyingClassificationProps> = ({ year, round }) => {
  const quali = useRaceQualifying(year, round);
  const lapsQuery = useQualifyingLaps(year, round);

  const rows = useMemo<Row[]>(() => {
    const raceObj = (quali.data as { data?: Record<string, unknown> } | undefined)?.data ?? {};
    const list = (raceObj.QualifyingResults ?? []) as Record<string, any>[];
    const laps = lapsQuery.data ?? {};
    return list
      .map((r, i) => {
        const driverId = r.Driver?.driverId ?? "";
        const constructorId = r.Constructor?.constructorId || r.Constructor?.name || "";
        return {
          position: parseInt(r.position, 10) || i + 1,
          number: r.number ?? r.Driver?.permanentNumber ?? "—",
          driverId,
          code:
            r.Driver?.code ||
            `${r.Driver?.givenName?.[0] ?? ""}${r.Driver?.familyName?.slice(0, 2) ?? ""}`.toUpperCase(),
          firstName: r.Driver?.givenName ?? "",
          lastName: r.Driver?.familyName ?? "",
          team: r.Constructor?.name ?? "Unknown",
          teamColor: getTeamColorById(constructorId),
          q1: r.Q1 ?? null,
          q2: r.Q2 ?? null,
          q3: r.Q3 ?? null,
          laps: laps[driverId] ?? null,
        };
      })
      .sort((a, b) => a.position - b.position);
  }, [quali.data, lapsQuery.data]);

  /** Quickest time in each segment — shown in the "best" colour, F1 timing-screen style. */
  const bestBySegment = useMemo(() => {
    const best: Record<Segment, string | null> = { q1: null, q2: null, q3: null };
    for (const seg of SEGMENTS) {
      let bestSecs = Infinity;
      for (const row of rows) {
        const secs = parseLap(row[seg]);
        if (secs != null && secs < bestSecs) {
          bestSecs = secs;
          best[seg] = row[seg];
        }
      }
    }
    return best;
  }, [rows]);

  /**
   * Knockout boundaries — where the hairlines separating Q3 / Q2-out / Q1-out are drawn.
   *
   * Q3 is a fixed top ten: it has been ten cars in every season that runs a Q1/Q2/Q3
   * format, so the constant is safe for anything that reaches this table. Counting who
   * set a Q3 time is NOT safe — a driver can reach Q3 and not run (Spa 2026: ten in Q3,
   * nine times set), which draws the line a row too high.
   *
   * The Q1 cut can't be a constant the same way — it's grid-size dependent (fifteen
   * advance from a twenty-car grid, sixteen from 2026's twenty-two), so it comes from
   * the data, floored at the Q3 cut so the two lines can never cross.
   */
  const { q3Cut, q2Cut } = useMemo(() => {
    const cut = Math.min(10, rows.length);
    const advancedToQ2 = rows.filter((r) => r.q2).length;
    return { q3Cut: cut, q2Cut: Math.max(advancedToQ2, cut) };
  }, [rows]);

  if (quali.isLoading) {
    return (
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border py-2.5">
            <F1Skeleton className="h-5 w-7 shrink-0" />
            <F1Skeleton className="h-4 flex-1" />
            <F1Skeleton className="hidden h-4 w-20 shrink-0 sm:block" />
            <F1Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (quali.error) {
    return (
      <F1ErrorState
        type="server"
        variant="inline"
        size="sm"
        className="my-2"
        title="Classification unavailable"
        message="Qualifying results couldn't be loaded for this session."
      />
    );
  }

  if (rows.length === 0) {
    return (
      <F1EmptyState
        type="no-data"
        size="sm"
        title="No qualifying classification"
        description="Results for this session haven't been published yet."
      />
    );
  }

  const cell = "px-2 py-2.5 text-sm";
  const headCell = "px-2 pb-2 text-left instrument-label whitespace-nowrap";

  return (
    // The table is wider than a phone; it scrolls inside this box so the page body never does.
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="w-full min-w-[640px] border-collapse">
        <caption className="sr-only">
          Qualifying classification: position, car number, driver, team, Q1, Q2 and Q3 times, and laps completed.
        </caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={cn(headCell, "w-10")}>
              Pos
            </th>
            <th scope="col" className={cn(headCell, "w-10")}>
              No.
            </th>
            <th scope="col" className={headCell}>
              Driver
            </th>
            <th scope="col" className={cn(headCell, "hidden sm:table-cell")}>
              Team
            </th>
            <th scope="col" className={cn(headCell, "text-right")}>
              Q1
            </th>
            <th scope="col" className={cn(headCell, "text-right")}>
              Q2
            </th>
            <th scope="col" className={cn(headCell, "text-right")}>
              Q3
            </th>
            <th scope="col" className={cn(headCell, "w-12 text-right")}>
              Laps
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            // A hairline under the last driver of each segment marks who got knocked out where.
            const isKnockout = row.position === q3Cut || row.position === q2Cut;
            return (
              <tr
                key={row.driverId || row.position}
                className={cn(
                  "border-b border-border/60 transition-colors hover:bg-muted/40",
                  isKnockout && "border-b-2 border-b-border",
                )}
              >
                <td className={cn(cell, "timing font-semibold")}>
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-4 w-0.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.teamColor }}
                    />
                    {row.position}
                  </span>
                </td>
                <td className={cn(cell, "timing text-muted-foreground")}>{row.number}</td>
                <td className={cell}>
                  <span className="font-medium text-foreground">
                    <span className="hidden sm:inline">{row.firstName} </span>
                    <span className="uppercase sm:normal-case">
                      <span className="sm:hidden">{row.code}</span>
                      <span className="hidden sm:inline">{row.lastName}</span>
                    </span>
                  </span>
                  <span className="block text-xs text-muted-foreground sm:hidden">{row.team}</span>
                </td>
                <td className={cn(cell, "hidden text-muted-foreground sm:table-cell")}>{row.team}</td>
                {SEGMENTS.map((seg) => {
                  const time = row[seg];
                  const isBest = time != null && time === bestBySegment[seg];
                  return (
                    <td
                      key={seg}
                      className={cn(
                        cell,
                        "timing text-right",
                        isBest ? "timing-best font-semibold" : "text-foreground",
                        !time && "text-muted-foreground/50",
                      )}
                    >
                      {time ?? "—"}
                    </td>
                  );
                })}
                <td className={cn(cell, "timing text-right text-muted-foreground")}>
                  {row.laps ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default QualifyingClassification;

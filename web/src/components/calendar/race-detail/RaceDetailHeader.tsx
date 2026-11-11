import { Link } from "react-router-dom";
import { DriverFace } from "../DriverFace";
import { driverHref } from "@/lib/links";
import type { ErgastResult } from "./types";

type Tile = { label: string; result: ErgastResult; extra?: React.ReactNode };

/**
 * The weekend in three faces (docs/design/screens "quick"): the winner, the pole sitter and the
 * fastest lap, each linked to the driver. Shows only what has happened; nothing before qualifying.
 */
export function RaceDetailSummary({
  season,
  results,
  qualifying,
}: {
  season: number;
  results?: ErgastResult[];
  qualifying?: ErgastResult[];
}) {
  const winner = results?.[0];
  const pole = qualifying?.[0];
  const fastest = results?.find((r) => r.FastestLap?.rank === "1");

  const tiles: Tile[] = [];
  if (winner) tiles.push({ label: "Winner", result: winner });
  if (pole) tiles.push({ label: "Pole", result: pole, extra: pole.Q3 || pole.Q2 || pole.Q1 });
  if (fastest)
    tiles.push({
      label: "Fastest lap",
      result: fastest,
      extra: <span className="text-fastest-lap">{fastest.FastestLap?.Time?.time}</span>,
    });
  if (!tiles.length) return null;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {tiles.map(({ label, result, extra }) => {
        const d = result.Driver;
        const full = d.givenName ? `${d.givenName} ${d.familyName}` : d.familyName;
        return (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-raised px-3 py-2.5">
            <DriverFace
              driverId={d.driverId}
              givenName={d.givenName}
              familyName={d.familyName}
              constructorId={result.Constructor?.constructorId}
              season={season}
              label={`${label}, ${full}`}
              size="md"
            />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-[13px] text-muted-foreground">{label}</span>
              <Link
                to={driverHref(d.driverId, season)}
                className="font-semibold text-heading hover:underline"
              >
                {d.familyName}
              </Link>
              {extra ? <span className="font-mono text-[13px] tabular-nums text-ink-2">{extra}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

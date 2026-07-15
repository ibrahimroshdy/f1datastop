import { useMemo, useState } from "react";
import { useSeasonResults } from "@/hooks/f1";
import { getTeamHexColor, normalizeTeamId } from "@/components/standings/standingsUtils";
import CountryFlag from "@/components/common/CountryFlag";
import { F1Card, F1Skeleton } from "@/components/f1";
import { cn } from "@/lib/utils";

interface DriverRow {
  Driver: { driverId?: string; givenName: string; familyName: string; code: string; nationality?: string };
  Constructors: Array<{ constructorId?: string; name: string }>;
}
interface RaceRes {
  round: string;
  country?: string;
  raceName?: string;
  isDNF?: boolean;
  status?: string;
  position?: string;
}

const posTone = (p: number) =>
  p === 1
    ? "text-position-gold font-bold"
    : p === 2
      ? "text-position-silver font-bold"
      : p === 3
        ? "text-position-bronze font-bold"
        : "text-foreground";

/**
 * Season results matrix — every driver (rows) × every round (columns). Each cell
 * is the finishing position; DNFs are flagged red so retirements read across the
 * whole grid at a glance. A DNF total pins to the right. Same grammar as a
 * standings table, not a chart. Sort by championship order or by DNFs.
 */
export default function ReliabilityBoard({ year, drivers }: { year: number; drivers: DriverRow[] }) {
  const { data: seasonRows, isLoading } = useSeasonResults(year);
  const [sortByDnf, setSortByDnf] = useState(false);

  // Group the flat warehouse rows into per-driver race lists.
  const byDriver = useMemo(() => {
    const m: Record<string, RaceRes[]> = {};
    (seasonRows ?? []).forEach((r) => {
      (m[r.driverId] ??= []).push({
        round: String(r.round),
        country: r.country ?? undefined,
        raceName: r.raceName || undefined,
        isDNF: r.isDNF,
        status: r.status ?? undefined,
        position: r.position ?? undefined,
      });
    });
    return m;
  }, [seasonRows]);

  // Columns = every round any driver raced, with its country flag.
  const rounds = useMemo(() => {
    const map = new Map<number, { country?: string; name?: string }>();
    Object.values(byDriver).forEach((races) =>
      races.forEach((r) => {
        const n = Number(r.round);
        if (!map.has(n)) map.set(n, { country: r.country, name: r.raceName });
      }),
    );
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([round, m]) => ({ round, ...m }));
  }, [byDriver]);

  // Rows = drivers (championship order by default), each with per-round result.
  const rows = useMemo(() => {
    const list = drivers
      .map((d) => {
        const id = d.Driver.driverId || d.Driver.code;
        const races = byDriver[id] ?? [];
        return {
          id,
          code: d.Driver.code,
          name: `${d.Driver.givenName} ${d.Driver.familyName}`,
          teamColor: getTeamHexColor(normalizeTeamId(d.Constructors?.[0]?.constructorId || "default")),
          byRound: new Map(races.map((r) => [Number(r.round), r])),
          dnfs: races.filter((r) => r.isDNF).length,
          total: races.length,
        };
      })
      .filter((r) => r.total > 0);
    return sortByDnf ? [...list].sort((a, b) => b.dnfs - a.dnfs) : list;
  }, [drivers, byDriver, sortByDnf]);

  const totalDnfs = rows.reduce((s, r) => s + r.dnfs, 0);

  if (isLoading) return <F1Skeleton variant="card" className="h-96" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="instrument-label text-muted-foreground">
          {year} · {totalDnfs} DNFs across {rounds.length} rounds
        </span>
        <button
          type="button"
          onClick={() => setSortByDnf((v) => !v)}
          className="instrument-label text-primary transition-colors hover:text-foreground"
        >
          {sortByDnf ? "Championship order" : "Sort by DNFs ↓"}
        </button>
      </div>

      <F1Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left">
                  <span className="instrument-label text-muted-foreground">Driver</span>
                </th>
                {rounds.map((r) => (
                  <th key={r.round} className="px-1.5 py-2 text-center align-bottom" title={r.name}>
                    <div className="flex flex-col items-center gap-0.5">
                      {r.country ? <CountryFlag country={r.country} size={14} className="rounded-[1px]" /> : null}
                      <span className="timing text-[9px] text-muted-foreground">R{r.round}</span>
                    </div>
                  </th>
                ))}
                <th className="sticky right-0 z-10 bg-card px-2.5 py-2 text-center">
                  <span className="instrument-label text-primary">DNF</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td
                    className="sticky left-0 z-10 bg-card px-3 py-1.5"
                    style={{ borderLeft: `3px solid ${row.teamColor}` }}
                  >
                    <span className="timing text-xs font-bold">{row.code}</span>
                  </td>
                  {rounds.map((r) => {
                    const res = row.byRound.get(r.round);
                    if (!res)
                      return (
                        <td key={r.round} className="px-1.5 py-1.5 text-center text-2xs text-muted-foreground/40">
                          ·
                        </td>
                      );
                    if (res.isDNF)
                      return (
                        <td
                          key={r.round}
                          className="bg-loss/10 px-1.5 py-1.5 text-center"
                          title={`R${r.round} ${res.raceName ?? ""} — ${res.status ?? "DNF"}`}
                        >
                          <span className="timing text-2xs font-bold text-loss">DNF</span>
                        </td>
                      );
                    const pos = Number(res.position);
                    return (
                      <td
                        key={r.round}
                        className="px-1.5 py-1.5 text-center"
                        title={`R${r.round} ${res.raceName ?? ""} — P${res.position}`}
                      >
                        <span className={cn("timing text-xs tabular-nums", posTone(pos))}>{res.position}</span>
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-10 bg-card px-2.5 py-1.5 text-center">
                    <span
                      className={cn(
                        "readout text-sm font-bold tabular-nums",
                        row.dnfs ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {row.dnfs}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </F1Card>
      <p className="text-2xs text-muted-foreground">
        Every driver × every round. <span className="font-semibold text-loss">DNF</span> = retirement / did-not-start /
        disqualified; lapped finishers show their position. Scroll for all races.
      </p>
    </div>
  );
}

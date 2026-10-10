import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSeasonResults, useAllDriverResultsBySeason } from "@/hooks/f1";
import { getTeamHexColor, normalizeTeamId } from "@/components/standings/standingsUtils";
import CountryFlag from "@/components/common/CountryFlag";
import { DriverAvatar, F1Card, F1Skeleton } from "@/components/f1";
import {
  buildF1DriverHeadshotUrl,
  getF1PortraitPathForErgastDriverId,
} from "@/constants/f1DriverPortraitMedia";
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
  points?: number;
}

const posTone = (p: number) =>
  p === 1
    ? "text-position-gold font-bold"
    : p === 2
      ? "text-position-silver font-bold"
      : p === 3
        ? "text-position-bronze font-bold"
        : "text-foreground";

const headshot = (id: string) => {
  const p = getF1PortraitPathForErgastDriverId(id);
  return p ? buildF1DriverHeadshotUrl(p) : undefined;
};

/**
 * Season results matrix — every driver (rows) × every round (columns). Each cell
 * is the finishing position; DNFs are flagged red so retirements read across the
 * whole grid at a glance. A DNF total pins to the right. Same grammar as a
 * standings table, not a chart. Sort by championship order or by DNFs.
 */
export default function ReliabilityBoard({ year, drivers }: { year: number; drivers: DriverRow[] }) {
  const { data: seasonRows, isLoading: whLoading } = useSeasonResults(year);
  const { data: fallback, isLoading: falLoading } = useAllDriverResultsBySeason(year);
  const [sortByDnf, setSortByDnf] = useState(false);
  // Metric lives in the URL (?metric=position); Points is the default (no param).
  const [searchParams, setSearchParams] = useSearchParams();
  const metric: "position" | "points" = searchParams.get("metric") === "position" ? "position" : "points";
  const setMetric = (m: "position" | "points") =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (m === "position") next.set("metric", "position");
        else next.delete("metric");
        return next;
      },
      { replace: true },
    );
  const isLoading = whLoading && falLoading;

  // Warehouse first (complete + correct is_dnf); fall back to the Jolpica
  // aggregate where the warehouse isn't served (e.g. local dev).
  const byDriver = useMemo(() => {
    if (seasonRows && seasonRows.length) {
      const m: Record<string, RaceRes[]> = {};
      seasonRows.forEach((r) => {
        (m[r.driverId] ??= []).push({
          round: String(r.round),
          country: r.country ?? undefined,
          raceName: r.raceName || undefined,
          isDNF: r.isDNF,
          status: r.status ?? undefined,
          position: r.position ?? undefined,
          points: r.points,
        });
      });
      return m;
    }
    return (fallback?.data ?? {}) as Record<string, RaceRes[]>;
  }, [seasonRows, fallback]);

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
          points: races.reduce((s, r) => s + (r.points ?? 0), 0),
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="instrument-label text-muted-foreground">
          {year} · {totalDnfs} DNFs across {rounds.length} rounds
        </span>
        <div className="flex items-center gap-3">
          <div className="flex gap-1" role="group" aria-label="Cell metric">
            {(["position", "points"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                aria-pressed={metric === m}
                className={cn(
                  "min-h-8 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  metric === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted",
                )}
              >
                {m === "position" ? "Positions" : "Points"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSortByDnf((v) => !v)}
            className="instrument-label text-primary transition-colors hover:text-foreground"
          >
            {sortByDnf ? "Championship" : "Sort DNFs ↓"}
          </button>
        </div>
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
                  <span className="instrument-label text-primary">{metric === "points" ? "PTS" : "DNF"}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td
                    className="sticky left-0 z-10 bg-card px-2 py-1"
                    style={{ borderLeft: `3px solid ${row.teamColor}` }}
                  >
                    <div className="flex items-center gap-1.5">
                      <DriverAvatar
                        driverCode={row.code}
                        driverName={row.name}
                        teamColor={row.teamColor}
                        size="xs"
                        src={headshot(row.id)}
                        className="shrink-0"
                      />
                      <span className="timing text-xs font-bold">{row.code}</span>
                    </div>
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
                    const pts = Number(res.points ?? 0);
                    return (
                      <td
                        key={r.round}
                        className="px-1.5 py-1.5 text-center"
                        title={`R${r.round} ${res.raceName ?? ""} — P${res.position} · ${pts} pts`}
                      >
                        {metric === "points" ? (
                          <span
                            className={cn(
                              "timing text-xs tabular-nums",
                              pts >= 15 ? "text-position-gold font-bold" : pts > 0 ? "text-gain" : "text-muted-foreground/50",
                            )}
                          >
                            {pts}
                          </span>
                        ) : (
                          <span className={cn("timing text-xs tabular-nums", posTone(pos))}>{res.position}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-10 bg-card px-2.5 py-1.5 text-center">
                    <span
                      className={cn(
                        "readout text-sm font-bold tabular-nums",
                        metric === "points" || row.dnfs ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {metric === "points" ? row.points : row.dnfs}
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

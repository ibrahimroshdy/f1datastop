import { useMemo, useState } from "react";
import { useAllDriverResultsBySeason } from "@/hooks/f1";
import { getTeamHexColor, normalizeTeamId } from "@/components/standings/standingsUtils";
import {
  buildF1DriverHeadshotUrl,
  getF1PortraitPathForErgastDriverId,
} from "@/constants/f1DriverPortraitMedia";
import CountryFlag from "@/components/common/CountryFlag";
import { DriverAvatar, F1Card, F1CardContent, F1Skeleton } from "@/components/f1";
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

const headshot = (id?: string) => {
  const p = id ? getF1PortraitPathForErgastDriverId(id) : undefined;
  return p ? buildF1DriverHeadshotUrl(p) : undefined;
};

/**
 * Reliability board — every driver's DNFs for the season, ranked (most first),
 * with the exact races they retired in and a finish rate. Tap driver chips to
 * focus specific drivers. Lapped finishers count as finishes (not DNFs).
 */
export default function ReliabilityBoard({ year, drivers }: { year: number; drivers: DriverRow[] }) {
  const { data: allResp, isLoading } = useAllDriverResultsBySeason(year);
  const byDriver = (allResp?.data ?? {}) as Record<string, RaceRes[]>;
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    return drivers
      .map((d) => {
        const id = d.Driver.driverId || d.Driver.code;
        const races = byDriver[id] ?? [];
        const dnfRaces = races.filter((r) => r.isDNF);
        const total = races.length;
        const dnfs = dnfRaces.length;
        return {
          id,
          code: d.Driver.code,
          name: `${d.Driver.givenName} ${d.Driver.familyName}`,
          nationality: d.Driver.nationality,
          teamColor: getTeamHexColor(normalizeTeamId(d.Constructors?.[0]?.constructorId || "default")),
          team: d.Constructors?.[0]?.name ?? "",
          total,
          dnfs,
          finishRate: total ? Math.round(((total - dnfs) / total) * 100) : 0,
          dnfRaces,
        };
      })
      .filter((r) => r.total > 0)
      .filter((r) => picked.size === 0 || picked.has(r.id))
      .sort((a, b) => b.dnfs - a.dnfs || a.finishRate - b.finishRate);
  }, [drivers, byDriver, picked]);

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const seasonDNFs = rows.reduce((s, r) => s + r.dnfs, 0);

  if (isLoading) return <F1Skeleton variant="card" className="h-64" />;

  return (
    <div className="space-y-4">
      {/* driver filter — pick specific drivers, or leave empty for all */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="instrument-label text-muted-foreground">
            {picked.size ? `Focused · ${picked.size}` : `All drivers · ${seasonDNFs} DNFs`}
          </span>
          {picked.size ? (
            <button
              type="button"
              onClick={() => setPicked(new Set())}
              className="instrument-label text-primary transition-colors hover:text-foreground"
            >
              Clear ✕
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter drivers">
          {drivers.map((d) => {
            const id = d.Driver.driverId || d.Driver.code;
            const active = picked.has(id);
            const col = getTeamHexColor(normalizeTeamId(d.Constructors?.[0]?.constructorId || "default"));
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                aria-pressed={active}
                className={cn(
                  "min-h-8 shrink-0 rounded-md border px-2 py-1 text-xs font-bold transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
                style={{ borderLeft: `3px solid ${col}` }}
              >
                {d.Driver.code}
              </button>
            );
          })}
        </div>
      </div>

      {/* reliability table */}
      <F1Card className="overflow-hidden p-0">
        <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-border px-3 py-2 sm:grid-cols-[2rem_1fr_5rem_4rem_1fr]">
          <span className="instrument-label text-muted-foreground">#</span>
          <span className="instrument-label text-muted-foreground">Driver</span>
          <span className="instrument-label hidden text-right text-muted-foreground sm:block">Finish %</span>
          <span className="instrument-label text-right text-muted-foreground">DNFs</span>
          <span className="instrument-label hidden text-muted-foreground sm:block">Retired at</span>
        </div>
        <ul className="divide-y divide-border">
          {rows.map((r, i) => (
            <li
              key={r.id}
              className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 px-3 py-2.5 sm:grid-cols-[2rem_1fr_5rem_4rem_1fr]"
            >
              <span className="timing text-sm font-bold tabular-nums text-muted-foreground">{i + 1}</span>
              <div className="flex min-w-0 items-center gap-2">
                <DriverAvatar
                  driverCode={r.code}
                  driverName={r.name}
                  teamColor={r.teamColor}
                  size="sm"
                  src={headshot(r.id)}
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    {r.nationality ? <CountryFlag country={r.nationality} size={13} className="shrink-0 rounded-[1px]" /> : null}
                    <span className="truncate">{r.name}</span>
                  </div>
                  <div className="truncate text-2xs text-muted-foreground">{r.team}</div>
                </div>
              </div>
              <span
                className={cn(
                  "readout hidden text-right font-mono text-sm tabular-nums sm:block",
                  r.finishRate >= 90 ? "text-gain" : r.finishRate < 70 ? "text-loss" : "text-foreground",
                )}
              >
                {r.finishRate}%
              </span>
              <span
                className={cn(
                  "readout text-right font-mono text-lg font-bold tabular-nums",
                  r.dnfs === 0 ? "text-muted-foreground" : "text-primary",
                )}
              >
                {r.dnfs}
              </span>
              {/* which races they retired in — flags */}
              <div className="col-span-3 flex flex-wrap gap-1 sm:col-span-1">
                {r.dnfRaces.length === 0 ? (
                  <span className="text-2xs text-muted-foreground">—</span>
                ) : (
                  r.dnfRaces.map((d) => (
                    <span
                      key={d.round}
                      title={`R${d.round} ${d.raceName ?? ""} — ${d.status ?? "DNF"}`}
                      className="inline-flex items-center gap-0.5 rounded bg-loss/10 px-1 py-0.5"
                    >
                      {d.country ? <CountryFlag country={d.country} size={12} className="rounded-[1px]" /> : null}
                      <span className="timing text-[9px] text-muted-foreground">R{d.round}</span>
                    </span>
                  ))
                )}
              </div>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">No data for this filter.</li>
          )}
        </ul>
        <F1CardContent className="border-t border-border py-2.5">
          <p className="text-2xs text-muted-foreground">
            DNF = retirement / did-not-start / disqualified. Lapped finishers count as finishes.
          </p>
        </F1CardContent>
      </F1Card>
    </div>
  );
}

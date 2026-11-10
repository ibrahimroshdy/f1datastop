import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TeamName } from "@/components/f1/TeamName";
import { driverHref, raceHref, teamHref } from "@/lib/links";
import { DriverAvatar, F1Skeleton } from "@/components/f1";
import CountryFlag from "@/components/common/CountryFlag";
import { useDriverResultsBySeason } from "@/hooks/f1";
import { TEAM_COLORS } from "@/constants/f1Colors";
import {
  buildF1DriverHeadshotUrl,
  getF1PortraitPathForErgastDriverId,
} from "@/constants/f1DriverPortraitMedia";
import { cn } from "@/lib/utils";
import DriverPositionChart from "./DriverPositionChart";
import type { DriverRaceResult } from "./driverCardTypes";

interface StandingRow {
  position: string;
  points: string;
  wins?: string;
  Driver: { driverId: string; givenName: string; familyName: string; code: string; nationality?: string };
  Constructors: Array<{ constructorId?: string; name: string }>;
}

interface DriverComparePanelProps {
  seasonYear: number;
  standings: StandingRow[];
  driverAId: string;
  driverAName: string;
  driverAColor: string;
  historyA: DriverRaceResult[];
}

const headshot = (id?: string) => {
  const p = id ? getF1PortraitPathForErgastDriverId(id) : undefined;
  return p ? buildF1DriverHeadshotUrl(p) : undefined;
};
const teamColorOf = (s?: StandingRow) => {
  const id = s?.Constructors?.[0]?.constructorId?.toLowerCase();
  return (id && TEAM_COLORS[id]) || TEAM_COLORS.default;
};
const shortName = (s?: StandingRow) =>
  s ? `${s.Driver.givenName[0]}. ${s.Driver.familyName}` : "";
const wins = (h: DriverRaceResult[]) => h.filter((r) => !r.isDNF && Number(r.position) === 1).length;
const podiums = (h: DriverRaceResult[]) => h.filter((r) => !r.isDNF && Number(r.position) <= 3).length;

/** A stat row comparing driver A (left) vs B (right); the leader's value is accented. */
function StatRow({
  label,
  a,
  b,
  aWins,
  bWins,
  aColor,
  bColor,
}: {
  label: string;
  a: string | number;
  b: string | number;
  aWins: boolean;
  bWins: boolean;
  aColor: string;
  bColor: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span
        className={cn("readout w-16 text-left text-sm tabular-nums", aWins ? "font-bold" : "text-muted-foreground")}
        style={aWins ? { color: aColor } : undefined}
      >
        {a}
      </span>
      <span className="flex-1 text-center text-[13px] text-muted-foreground">{label}</span>
      <span
        className={cn("readout w-16 text-right text-sm tabular-nums", bWins ? "font-bold" : "text-muted-foreground")}
        style={bWins ? { color: bColor } : undefined}
      >
        {b}
      </span>
    </div>
  );
}

export default function DriverComparePanel({
  seasonYear,
  standings,
  driverAId,
  driverAName,
  driverAColor,
  historyA,
}: DriverComparePanelProps) {
  // Rival selection lives in the URL (?vs=<driverId>) so a comparison is
  // shareable and survives reload; selecting a chip toggles, Clear removes it.
  const [searchParams, setSearchParams] = useSearchParams();
  const bId = searchParams.get("vs") ?? "";
  const setBId = (driverId: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (driverId) next.set("vs", driverId);
        else next.delete("vs");
        return next;
      },
      { replace: true },
    );
  };

  const aStanding = useMemo(
    () => standings.find((s) => s.Driver.driverId === driverAId),
    [standings, driverAId],
  );
  const bStanding = useMemo(() => standings.find((s) => s.Driver.driverId === bId), [standings, bId]);
  const bColor = teamColorOf(bStanding);

  const { data: bResp, isLoading } = useDriverResultsBySeason(seasonYear, bId, !!bId);
  const historyB: DriverRaceResult[] = (bResp?.data as DriverRaceResult[] | undefined) ?? [];

  const others = useMemo(
    () =>
      standings
        .filter((s) => s.Driver.driverId !== driverAId)
        .sort((x, y) => Number(x.position) - Number(y.position)),
    [standings, driverAId],
  );

  // round-by-round head-to-head over the rounds both drivers raced
  const h2h = useMemo(() => {
    const bByRound = new Map(historyB.map((r) => [String(r.round), r]));
    const rows = historyA
      .map((a) => ({ a, b: bByRound.get(String(a.round)) }))
      .filter((x): x is { a: DriverRaceResult; b: DriverRaceResult } => !!x.b);
    let aAhead = 0;
    let bAhead = 0;
    for (const { a, b } of rows) {
      const ap = a.isDNF ? 99 : Number(a.position);
      const bp = b.isDNF ? 99 : Number(b.position);
      if (ap < bp) aAhead += 1;
      else if (bp < ap) bAhead += 1;
    }
    return { rows, aAhead, bAhead };
  }, [historyA, historyB]);

  return (
    <div className="space-y-3">
      {/* rival picker — tactile chips; selection is URL-shareable (?vs=) and toggles off */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="text-[13px] font-semibold text-ink-2">
            {bStanding ? `Against ${bStanding.Driver.familyName}` : "Compare with"}
          </div>
          {bId ? (
            <button
              type="button"
              onClick={() => setBId("")}
              className="min-h-8 rounded-md px-2 text-[13px] font-medium text-ink-2 transition-colors hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Compare with a driver">
          {others.map((s) => {
            const col = teamColorOf(s);
            const selected = s.Driver.driverId === bId;
            return (
              <button
                key={s.Driver.driverId}
                type="button"
                onClick={() => setBId(selected ? "" : s.Driver.driverId)}
                aria-pressed={selected}
                title={`${s.Driver.givenName} ${s.Driver.familyName}`}
                className={cn(
                  "flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-colors",
                  selected
                    ? "border-transparent bg-act text-on-act"
                    : "border-border bg-card/40 text-ink-2 hover:text-foreground",
                )}
                style={{ borderLeft: `3px solid ${col}` }}
              >
                <CountryFlag country={s.Driver.nationality ?? ""} size={14} className="shrink-0 rounded-[1px]" />
                <span className="timing text-xs font-bold tabular-nums">{s.Driver.code}</span>
              </button>
            );
          })}
        </div>
      </div>

      {bId && bStanding && (
        <>
        <div className="overflow-hidden rounded-xl border border-border/70">
          {/* two-driver header */}
          <div className="flex items-stretch">
            <div className="flex flex-1 items-center gap-2.5 p-3" style={{ borderLeft: `3px solid ${driverAColor}` }}>
              <DriverAvatar
                driverCode={aStanding?.Driver.code ?? ""}
                driverName={driverAName}
                teamColor={driverAColor}
                size="md"
                src={headshot(driverAId)}
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight text-heading">{driverAName}</div>
                {aStanding?.Constructors?.[0]?.constructorId ? (
                  <TeamName
                    constructorId={aStanding.Constructors[0].constructorId}
                    name={aStanding.Constructors[0].name}
                    to={teamHref(aStanding.Constructors[0].constructorId, seasonYear)}
                    size={13}
                    className="text-[13px] text-muted-foreground"
                  />
                ) : null}
              </div>
            </div>
            <div className="flex w-10 items-center justify-center">
              <span className="text-xs text-muted-foreground">vs</span>
            </div>
            <div
              className="flex flex-1 items-center justify-end gap-2.5 p-3 text-right"
              style={{ borderRight: `3px solid ${bColor}` }}
            >
              <div className="flex min-w-0 flex-col items-end">
                <Link
                  to={driverHref(bId, seasonYear)}
                  className="text-sm font-semibold leading-tight text-heading hover:underline"
                >
                  {shortName(bStanding)}
                </Link>
                {bStanding.Constructors?.[0]?.constructorId ? (
                  <TeamName
                    constructorId={bStanding.Constructors[0].constructorId}
                    name={bStanding.Constructors[0].name}
                    to={teamHref(bStanding.Constructors[0].constructorId, seasonYear)}
                    size={13}
                    className="text-[13px] text-muted-foreground"
                  />
                ) : null}
              </div>
              <DriverAvatar
                driverCode={bStanding.Driver.code}
                driverName={shortName(bStanding)}
                teamColor={bColor}
                size="md"
                src={headshot(bId)}
              />
            </div>
          </div>

          {/* season stat comparison */}
          <div className="divide-y divide-border/60 border-t border-border/60">
            <StatRow
              label="Points"
              a={aStanding?.points ?? "—"}
              b={bStanding.points}
              aWins={Number(aStanding?.points) > Number(bStanding.points)}
              bWins={Number(bStanding.points) > Number(aStanding?.points)}
              aColor={driverAColor}
              bColor={bColor}
            />
            <StatRow
              label="Position"
              a={aStanding ? `P${aStanding.position}` : "—"}
              b={`P${bStanding.position}`}
              aWins={Number(aStanding?.position) < Number(bStanding.position)}
              bWins={Number(bStanding.position) < Number(aStanding?.position)}
              aColor={driverAColor}
              bColor={bColor}
            />
            <StatRow
              label="Wins"
              a={wins(historyA)}
              b={wins(historyB)}
              aWins={wins(historyA) > wins(historyB)}
              bWins={wins(historyB) > wins(historyA)}
              aColor={driverAColor}
              bColor={bColor}
            />
            <StatRow
              label="Podiums"
              a={podiums(historyA)}
              b={podiums(historyB)}
              aWins={podiums(historyA) > podiums(historyB)}
              bWins={podiums(historyB) > podiums(historyA)}
              aColor={driverAColor}
              bColor={bColor}
            />
          </div>

          {/* head-to-head tally + round-by-round finishes */}
          {h2h.rows.length > 0 && (
            <div className="border-t border-border/60">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[13px] text-muted-foreground">
                  Ahead at the finish in {h2h.aAhead} of {h2h.rows.length} races
                </span>
                <span className="readout text-base tabular-nums">
                  <span className="text-figure">{h2h.aAhead}</span>
                  <span className="mx-1.5 text-[13px] text-muted-foreground">to</span>
                  <span className="text-figure">{h2h.bAhead}</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1 px-3 pb-3">
                {h2h.rows.map(({ a, b }) => {
                  const ap = a.isDNF ? 99 : Number(a.position);
                  const bp = b.isDNF ? 99 : Number(b.position);
                  const aWon = ap < bp;
                  return (
                    <Link
                      key={a.round}
                      to={raceHref(seasonYear, a.round)}
                      className="flex min-w-[3.6rem] flex-col items-center gap-0.5 rounded-md border border-border/60 px-1.5 py-1 hover:border-foreground/30"
                      title={`${a.raceName ?? a.country ?? ""}: ${a.isDNF ? "DNF" : `P${a.position}`} against ${b.isDNF ? "DNF" : `P${b.position}`}`}
                    >
                      {a.country ? (
                        <CountryFlag country={a.country} size={16} className="shrink-0 rounded-[2px]" />
                      ) : null}
                      <span
                        className="timing text-xs font-semibold tabular-nums"
                        style={{ color: aWon ? driverAColor : bColor }}
                      >
                        {a.isDNF ? "DNF" : `P${a.position}`}
                        <span className="mx-0.5 text-muted-foreground">/</span>
                        {b.isDNF ? "DNF" : `P${b.position}`}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="px-3 py-4">
              <F1Skeleton variant="text" lines={3} />
            </div>
          )}
        </div>
        {historyB.length > 0 && (
          <DriverPositionChart
            history={historyA}
            teamColor={driverAColor}
            code={aStanding?.Driver.code}
            compare={{ history: historyB, teamColor: bColor, code: bStanding.Driver.code }}
          />
        )}
        </>
      )}
    </div>
  );
}

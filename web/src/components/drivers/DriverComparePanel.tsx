import { useMemo, useState } from "react";
import { DriverAvatar } from "@/components/f1";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CountryFlag from "@/components/common/CountryFlag";
import { Check, ChevronsUpDown } from "lucide-react";
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
  return (id && TEAM_COLORS[id]) || TEAM_COLORS.default || "#8A8F98";
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
      <span className="instrument-label flex-1 text-center text-muted-foreground">{label}</span>
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
  const [bId, setBId] = useState<string>("");
  const [open, setOpen] = useState(false);

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
      {/* rival picker — searchable, flag + code + team colour */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="h-10 w-full justify-between sm:max-w-xs">
            {bStanding ? (
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: bColor }} />
                <CountryFlag country={bStanding.Driver.nationality ?? ""} size={14} className="shrink-0" />
                <span className="truncate">{bStanding.Driver.givenName} {bStanding.Driver.familyName}</span>
                <span className="timing shrink-0 text-2xs text-muted-foreground">{bStanding.Driver.code}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Compare with a driver…</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search driver…" />
            <CommandList>
              <CommandEmpty>No driver found.</CommandEmpty>
              <CommandGroup>
                {others.map((s) => {
                  const col = teamColorOf(s);
                  const selected = s.Driver.driverId === bId;
                  return (
                    <CommandItem
                      key={s.Driver.driverId}
                      value={`${s.Driver.givenName} ${s.Driver.familyName} ${s.Driver.code} ${s.Driver.nationality ?? ""}`}
                      onSelect={() => {
                        setBId(s.Driver.driverId);
                        setOpen(false);
                      }}
                      className="gap-2"
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: col }} />
                      <CountryFlag country={s.Driver.nationality ?? ""} size={15} className="shrink-0" />
                      <span className="flex-1 truncate">{s.Driver.givenName} {s.Driver.familyName}</span>
                      <span className="timing text-2xs text-muted-foreground">{s.Driver.code}</span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

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
                <div className="truncate text-sm font-semibold leading-tight">{driverAName}</div>
                <div className="instrument-label truncate text-muted-foreground">
                  {aStanding?.Constructors?.[0]?.name}
                </div>
              </div>
            </div>
            <div className="flex w-10 items-center justify-center">
              <span className="instrument-label text-muted-foreground">vs</span>
            </div>
            <div
              className="flex flex-1 items-center justify-end gap-2.5 p-3 text-right"
              style={{ borderRight: `3px solid ${bColor}` }}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold leading-tight">{shortName(bStanding)}</div>
                <div className="instrument-label text-muted-foreground">
                  {bStanding.Constructors?.[0]?.name}
                </div>
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
                <span className="instrument-label text-muted-foreground">Head to head</span>
                <span className="readout text-xs tabular-nums">
                  <span style={{ color: driverAColor }}>{h2h.aAhead}</span>
                  <span className="mx-1 text-muted-foreground">–</span>
                  <span style={{ color: bColor }}>{h2h.bAhead}</span>
                  <span className="ml-1.5 text-2xs text-muted-foreground">ahead ({h2h.rows.length})</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1 px-3 pb-3">
                {h2h.rows.map(({ a, b }) => {
                  const ap = a.isDNF ? 99 : Number(a.position);
                  const bp = b.isDNF ? 99 : Number(b.position);
                  const aWon = ap < bp;
                  return (
                    <div
                      key={a.round}
                      className="flex min-w-[3.1rem] flex-col items-center rounded-md border border-border/60 px-1.5 py-1"
                      title={`Round ${a.round}: P${a.isDNF ? "DNF" : a.position} vs P${b.isDNF ? "DNF" : b.position}`}
                    >
                      <span className="timing text-2xs text-muted-foreground">R{a.round}</span>
                      <span
                        className="timing text-xs font-semibold tabular-nums"
                        style={{ color: aWon ? driverAColor : bColor }}
                      >
                        {a.isDNF ? "—" : `P${a.position}`}
                        <span className="mx-0.5 text-muted-foreground">·</span>
                        {b.isDNF ? "—" : `P${b.position}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">Loading rival…</div>
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

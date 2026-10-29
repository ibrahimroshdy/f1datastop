import React, { useMemo, useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { TEAM_COLORS } from '@/constants/f1Colors';
import { F1ChartContainer } from '@/components/f1';
import { cn } from '@/lib/utils';
import { getRaceResultsFromDb, getScheduleFromDb } from '@/services/f1Warehouse';
import { buildSeasonSankey } from '@/lib/f1/sankey';
import {
  Mode,
  SeasonSankeyChartProps,
  SankeyNodeData,
  SankeyLinkData,
  SeasonDriverResult,
  SeasonRoundResult,
  SeasonScheduleRace,
} from './SeasonSankeyTypes';
import SeasonSankeySurface from './SeasonSankeySurface';

// Semantic SVG color tokens (DESIGN.md: SVG fills/strokes route through hsl(var(--*)))
const TOKEN = {
  gain: 'hsl(var(--status-completed))',
  loss: 'hsl(var(--destructive))',
  neutral: 'hsl(var(--muted-foreground))',
} as const;

// Ensure a value is a finite number >= minVal (prevents NaN in the d3-sankey layout)
const toValidNumber = (v: unknown, minVal: number = 1): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < minVal) return minVal;
  return n;
};

// Get team color with fallback (same idiom as MuiSankeyChart)
const getTeamColor = (team: string): string => {
  let normalizedTeam = team.toLowerCase();
  if (normalizedTeam === 'alphatauri') normalizedTeam = 'rb';
  if (normalizedTeam === 'alfa') normalizedTeam = 'sauber';
  return TEAM_COLORS[normalizedTeam] || TEAM_COLORS.default;
};

// Keep only the results for the selected driver / team before aggregation.
const filterRaceResults = (
  results: SeasonDriverResult[],
  mode: Mode,
  selectedDriver: string | null,
  selectedTeam: string | null
): SeasonDriverResult[] => {
  if (mode === 'all') return results;
  if (mode === 'driver' && selectedDriver)
    return results.filter((r) => r.Driver?.code === selectedDriver);
  if (mode === 'team' && selectedTeam)
    return results.filter((r) => r.Constructor?.constructorId === selectedTeam);
  return [];
};

const SeasonSankeyChart: React.FC<SeasonSankeyChartProps> = ({ year }) => {
  const [mode, setMode] = useState<Mode>('all');
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [rawResults, setRawResults] = useState<SeasonRoundResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [drivers, setDrivers] = useState<Array<{
    code: string;
    name: string;
    team: string;
    teamName: string;
  }>>([]);
  const [teams, setTeams] = useState<string[]>([]);

  // Fetch the season schedule, then each round's results via the warehouse
  // (silent degradation: returns null when the DB-serving flag is off or a
  // round is missing, so the chart falls back to an empty state).
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const races = (await getScheduleFromDb(year)) as SeasonScheduleRace[] | null;
        if (!races || races.length === 0) {
          if (!cancelled) {
            setRawResults([]);
            setDrivers([]);
            setTeams([]);
            setIsLoading(false);
          }
          return;
        }

        const rounds = races
          .map((r) => Number(r.round))
          .filter((r) => Number.isFinite(r));
        const fetched = await Promise.all(rounds.map((r) => getRaceResultsFromDb(year, r)));
        const valid = fetched.filter(
          (r): r is Record<string, unknown> =>
            !!r && Array.isArray(r.Results) && (r.Results as unknown[]).length > 0
        ) as SeasonRoundResult[];

        // Build filter lists from the raw results.
        const driverMap = new Map<string, { name: string; team: string; teamName: string }>();
        const teamSet = new Set<string>();
        valid.forEach((race) => {
          (race.Results ?? []).forEach((r) => {
            const code = r.Driver?.code || "";
            const team = r.Constructor?.constructorId || "unknown";
            const teamName = r.Constructor?.name || "Unknown";
            if (code && !driverMap.has(code)) {
              const name =
                `${r.Driver?.givenName ?? ""} ${r.Driver?.familyName ?? ""}`.trim() || code;
              driverMap.set(code, { name, team, teamName });
            }
            if (team) teamSet.add(team);
          });
        });

        if (!cancelled) {
          setRawResults(valid);
          setDrivers(
            Array.from(driverMap.entries()).map(([code, info]) => ({ code, ...info }))
          );
          setTeams([...teamSet].sort());
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setRawResults([]);
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [year]);

  // Aggregate (filtered) results into the season Sankey. Filtering happens in
  // memory so switching filters doesn't re-fetch from the warehouse.
  const sankey = useMemo(() => {
    if (!rawResults) return null;
    const filtered = rawResults
      .map((race) => ({
        ...race,
        Results: filterRaceResults(
          race.Results ?? [],
          mode,
          selectedDriver,
          selectedTeam
        ),
      }))
      .filter((race) => (race.Results?.length ?? 0) > 0);
    if (filtered.length === 0) return null;
    const data = buildSeasonSankey(filtered);
    if (data.nodes.length === 0 || data.links.length === 0) return null;
    return data;
  }, [rawResults, mode, selectedDriver, selectedTeam]);

  // Transform into coloured d3-sankey nodes + links, mirroring MuiSankeyChart.
  const sankeyData = useMemo<{ nodes: SankeyNodeData[]; links: SankeyLinkData[] } | null>(
    () => {
      if (!sankey) return null;
      const { nodes: originalNodes, links: originalLinks } = sankey;

      const nodeMap = new Map<string, SankeyNodeData>();
      const gridNodes: SankeyNodeData[] = [];
      const finishNodes: SankeyNodeData[] = [];

      originalNodes.forEach((node) => {
        const position = toValidNumber(node.position, 0);
        const n: SankeyNodeData = {
          id: node.id,
          name: node.name,
          position,
          type: node.type as SankeyNodeData['type'],
          team: node.team,
          teamName: node.teamName,
          fullName: node.fullName,
          color: getTeamColor(node.team || ''),
        };
        nodeMap.set(node.id, n);
        if (node.type === 'grid' || node.type === 'pit-lane') gridNodes.push(n);
        else finishNodes.push(n);
      });

      gridNodes.sort((a, b) => a.position - b.position);
      finishNodes.sort((a, b) => a.position - b.position);
      const nivoNodes: SankeyNodeData[] = [...gridNodes, ...finishNodes];

      const nodeIds = new Set(nivoNodes.map((n) => n.id));
      const nivoLinks: SankeyLinkData[] = originalLinks
        .map((link): SankeyLinkData | null => {
          if (!nodeIds.has(link.source) || !nodeIds.has(link.target)) return null;
          const value = toValidNumber(link.value, 1);
          const sourceNode = nodeMap.get(link.source);
          const gp = link.gridPosition ?? null;
          const rp = link.racePosition ?? null;
          let color: string;
          if (gp != null && rp != null) {
            if (gp > rp) color = TOKEN.gain;
            else if (gp < rp) color = TOKEN.loss;
            else color = TOKEN.neutral;
          } else if (link.teams?.length === 1) {
            color = getTeamColor(link.teams[0]);
          } else {
            color = TEAM_COLORS.default;
          }
          const dimLine = link.isDNF === true || link.isPitLane === true;

          return {
            source: link.source,
            target: link.target,
            value,
            sourcePosition: Number.isFinite(Number(sourceNode?.position))
              ? Number(sourceNode?.position)
              : 0,
            color,
            dimLine,
            driverName: link.drivers?.[0]?.name || link.source,
            driverCode: link.drivers?.[0]?.code,
            team: link.teams?.length === 1 ? link.teams[0] : undefined,
            gridPosition: link.gridPosition ?? undefined,
            racePosition: link.racePosition ?? undefined,
            positionChange:
              gp != null && rp != null ? gp - rp : undefined,
            isDNF: link.isDNF,
            isPitLane: link.isPitLane,
            teams: link.teams,
          };
        })
        .filter((l): l is SankeyLinkData => l !== null)
        .sort((a, b) => (a.sourcePosition || 0) - (b.sourcePosition || 0));

      // Safety: remove orphan nodes (no links) to prevent d3-sankey NaN.
      const linkedNodeIds = new Set<string>();
      nivoLinks.forEach((l) => {
        linkedNodeIds.add(l.source);
        linkedNodeIds.add(l.target);
      });
      const connectedNodes = nivoNodes.filter((n) => linkedNodeIds.has(n.id));

      if (connectedNodes.length === 0 || nivoLinks.length === 0) return null;
      return { nodes: connectedNodes, links: nivoLinks };
    },
    [sankey]
  );

  return (
    <F1ChartContainer
      isLoading={isLoading}
      error={error}
      isEmpty={!sankeyData}
      useSkeleton
      minHeight={400}
      loadingMessage="Loading season Sankey…"
      emptyTitle="No season data"
      emptyDescription="No race results available for this season yet."
      className="flex flex-col"
    >
      {sankeyData && (
        <div className="flex h-full flex-col">
          {/* Filter bar */}
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2 px-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Filter
            </span>
            <div className="flex items-center gap-1 border border-input bg-input rounded-md p-1">
              <button
                role="button"
                aria-pressed={mode === 'all'}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  mode === 'all'
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
                onClick={() => {
                  setMode('all');
                  setSelectedDriver(null);
                  setSelectedTeam(null);
                }}
              >
                All drivers
              </button>
              <button
                role="button"
                aria-pressed={mode === 'driver'}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  mode === 'driver'
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
                onClick={() => {
                  setMode('driver');
                  setSelectedTeam(null);
                }}
              >
                Driver
              </button>
              <button
                role="button"
                aria-pressed={mode === 'team'}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  mode === 'team'
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
                onClick={() => {
                  setMode('team');
                  setSelectedDriver(null);
                }}
              >
                Team
              </button>
            </div>
            {mode === 'driver' && drivers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Driver:</span>
                <select
                  aria-label="Driver filter"
                  value={selectedDriver ?? ""}
                  onChange={(e) => setSelectedDriver(e.target.value || null)}
                  className="bg-input border border-input rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— select —</option>
                  {drivers.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.code} · {d.teamName}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {mode === 'team' && teams.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Team:</span>
                <select
                  aria-label="Team filter"
                  value={selectedTeam ?? ""}
                  onChange={(e) => setSelectedTeam(e.target.value || null)}
                  className="bg-input border border-input rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— select —</option>
                  {teams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mb-4 flex flex-wrap items-center justify-center gap-3 px-2 py-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Grid → Finish
            </span>
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="flex items-center gap-1 text-status-completed">
                <ArrowUp className="h-3 w-3" />
                Gain
              </span>
              <span className="flex items-center gap-1 text-destructive">
                <ArrowDown className="h-3 w-3" />
                Loss
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Minus className="h-3 w-3" />
                Hold
              </span>
            </div>
          </div>

          {/* Column headers */}
          <div className="mb-2 grid grid-cols-2 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <span>Grid</span>
            <span>Finish</span>
          </div>

          {/* Sankey Chart - only render when container has non-zero size to avoid NaN in d3-sankey layout */}
          <SeasonSankeySurface sankeyData={sankeyData} />

          <p className="mt-2 px-2 text-center text-xs text-muted-foreground">
            Pit lane = started from the pit lane.&nbsp;DNF = did not finish.&nbsp;Link width = number of
            races with that grid → finish.
          </p>
          <div className="pb-6" />
        </div>
      )}
    </F1ChartContainer>
  );
};

export default SeasonSankeyChart;

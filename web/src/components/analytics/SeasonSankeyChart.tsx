import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  sankey,
  sankeyLinkHorizontal,
  sankeyLeft,
  type SankeyNode,
  type SankeyLink,
  type SankeyGraph,
} from 'd3-sankey';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { TEAM_COLORS } from '@/constants/f1Colors';
import { F1ChartContainer } from '@/components/f1';
import { cn } from '@/lib/utils';
import { getRaceResultsFromDb, getScheduleFromDb } from '@/services/f1Warehouse';
import { buildSeasonSankey, type SeasonSankeyLink } from '@/lib/f1/sankey';

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

type Mode = 'all' | 'driver' | 'team';

interface SeasonSankeyChartProps {
  year: number;
}

// Node datum that feeds d3-sankey. d3-sankey mutates these in place, adding
// the computed layout fields (x0/x1/y0/y1/index/value/depth/...).
interface SankeyNodeData {
  id: string;
  name: string;
  position: number;
  type: 'grid' | 'finish' | 'pit-lane' | 'dnf';
  team?: string;
  teamName?: string;
  fullName?: string;
  color: string;
}

// Link datum that feeds d3-sankey. `source`/`target` start as node-id strings
// and are resolved to node objects by the sankey() layout.
interface SankeyLinkData {
  source: string;
  target: string;
  value: number;
  sourcePosition: number;
  color: string;
  dimLine: boolean;
  driverName?: string;
  driverCode?: string;
  team?: string;
  gridPosition?: number;
  racePosition?: number;
  positionChange?: number;
  isDNF?: boolean;
  isPitLane?: boolean;
  teams?: string[];
}

type LaidOutNode = SankeyNode<SankeyNodeData, SankeyLinkData>;
type LaidOutLink = SankeyLink<SankeyNodeData, SankeyLinkData>;

// Keep only the results for the selected driver / team before aggregation.
const filterRaceResults = (
  results: any[],
  mode: Mode,
  selectedDriver: string | null,
  selectedTeam: string | null
): any[] => {
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
  const [rawResults, setRawResults] = useState<Record<string, unknown>[] | null>(null);
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
        const races = await getScheduleFromDb(year);
        if (!races || !Array.isArray(races) || races.length === 0) {
          if (!cancelled) {
            setRawResults([]);
            setDrivers([]);
            setTeams([]);
            setIsLoading(false);
          }
          return;
        }

        const rounds = races
          .map((r) => Number((r as any).round))
          .filter((r) => Number.isFinite(r));
        const fetched = await Promise.all(rounds.map((r) => getRaceResultsFromDb(year, r)));
        const valid = fetched.filter(
          (r): r is Record<string, unknown> =>
            !!r && Array.isArray((r as any).Results) && (r as any).Results.length > 0
        );

        // Build filter lists from the raw results.
        const driverMap = new Map<string, { name: string; team: string; teamName: string }>();
        const teamSet = new Set<string>();
        valid.forEach((race) => {
          (race.Results as any[]).forEach((r: any) => {
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
          (race as any).Results,
          mode,
          selectedDriver,
          selectedTeam
        ),
      }))
      .filter((race) => (race as any).Results.length > 0);
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
        .map((link: SeasonSankeyLink): SankeyLinkData | null => {
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

  const isEmpty = !!sankeyData && sankeyData.nodes.length === 0;

  return (
    <F1ChartContainer
      isLoading={isLoading}
      error={error}
      isEmpty={!sankeyData || isEmpty}
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
                role="switch"
                aria-checked={mode === 'all'}
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
                role="switch"
                aria-checked={mode === 'driver'}
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
                role="switch"
                aria-checked={mode === 'team'}
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

// Layout constants matching the previous Nivo configuration / MuiSankeyChart idiom
const MARGIN = { top: 10, right: 100, bottom: 10, left: 100 };
const NODE_WIDTH = 12;
const NODE_PADDING = 4;
const NODE_RADIUS = 3;
const LABEL_PADDING = 12;

type HoverTarget =
  | { kind: 'node'; node: LaidOutNode; x: number; y: number }
  | { kind: 'link'; link: LaidOutLink; x: number; y: number }
  | null;

function SeasonSankeySurface({
  sankeyData,
}: {
  sankeyData: { nodes: SankeyNodeData[]; links: SankeyLinkData[] };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<HoverTarget>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setDimensions((prev) =>
        prev.width === w && prev.height === h ? prev : { width: w, height: h }
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasSize = dimensions.width >= 50 && dimensions.height >= 50;
  const isNarrow = dimensions.width > 0 && dimensions.width < 480;
  const leftM = isNarrow ? 48 : MARGIN.left;
  const rightM = isNarrow ? 48 : MARGIN.right;
  const x0 = leftM;
  const x1 = dimensions.width - rightM;
  const y0 = MARGIN.top;
  const y1 = dimensions.height - MARGIN.bottom;

  const graph = useMemo<SankeyGraph<SankeyNodeData, SankeyLinkData> | null>(() => {
    if (!hasSize || x1 <= x0 || y1 <= y0) return null;
    const layout = sankey<SankeyNodeData, SankeyLinkData>()
      .nodeId((d) => d.id)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(NODE_PADDING)
      .nodeAlign(sankeyLeft)
      .nodeSort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .extent([
        [x0, y0],
        [x1, y1],
      ]);
    try {
      return layout({
        nodes: sankeyData.nodes.map((n) => ({ ...n })),
        links: sankeyData.links.map((l) => ({ ...l })),
      });
    } catch {
      return null;
    }
  }, [sankeyData, dimensions.width, dimensions.height, hasSize, isNarrow]);

  const linkPath = useMemo(() => sankeyLinkHorizontal<SankeyNodeData, SankeyLinkData>(), []);
  const labelColor = 'hsl(var(--muted-foreground))';

  return (
    <div ref={containerRef} className="relative flex-1 min-h-[400px]" style={{ minHeight: 400 }}>
      {hasSize && graph ? (
        <svg
          width={dimensions.width}
          height={dimensions.height}
          onMouseLeave={() => setHover(null)}
          onPointerDown={() => setHover(null)}
        >
          {/* Links (drawn first so nodes sit on top) */}
          <g fill="none">
            {graph.links.map((link, i) => {
              const d = linkPath(link);
              if (!d) return null;
              const data = link as LaidOutLink & SankeyLinkData;
              const isHovered = hover?.kind === 'link' && hover.link === link;
              const isHold = data.color === TOKEN.neutral;
              const baseOpacity = data.dimLine ? 0.14 : isHold ? 0.09 : 0.5;
              return (
                <path
                  key={`link-${i}`}
                  d={d}
                  stroke={data.color || TEAM_COLORS.default}
                  strokeWidth={Math.max(isHold ? 1 : 2, link.width ?? 1)}
                  strokeOpacity={isHovered ? (isHold ? 0.5 : 0.85) : baseOpacity}
                  style={{ cursor: 'pointer' }}
                  onMouseMove={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    setHover({
                      kind: 'link',
                      link,
                      x: e.clientX - (rect?.left ?? 0),
                      y: e.clientY - (rect?.top ?? 0),
                    });
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const rect = containerRef.current?.getBoundingClientRect();
                    setHover({
                      kind: 'link',
                      link,
                      x: e.clientX - (rect?.left ?? 0),
                      y: e.clientY - (rect?.top ?? 0),
                    });
                  }}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {graph.nodes.map((node, i) => {
              const data = node as LaidOutNode & SankeyNodeData;
              const x0n = node.x0 ?? 0;
              const y0n = node.y0 ?? 0;
              const w = (node.x1 ?? 0) - x0n;
              const h = Math.max(0, (node.y1 ?? 0) - y0n);
              const isHovered = hover?.kind === 'node' && hover.node === node;
              const labelOnLeft = data.type === 'grid' || data.type === 'pit-lane';
              const labelPad = isNarrow ? 5 : LABEL_PADDING;
              const labelText = labelOnLeft ? `${data.name}` : `${data.name}`;
              return (
                <g key={`node-${i}`}>
                  <rect
                    x={x0n}
                    y={y0n}
                    width={w}
                    height={h}
                    rx={NODE_RADIUS}
                    ry={NODE_RADIUS}
                    fill={data.color || TEAM_COLORS.default}
                    fillOpacity={isHovered ? 1 : 0.9}
                    style={{ cursor: 'pointer' }}
                    onMouseMove={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      setHover({
                        kind: 'node',
                        node,
                        x: e.clientX - (rect?.left ?? 0),
                        y: e.clientY - (rect?.top ?? 0),
                      });
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const rect = containerRef.current?.getBoundingClientRect();
                      setHover({
                        kind: 'node',
                        node,
                        x: e.clientX - (rect?.left ?? 0),
                        y: e.clientY - (rect?.top ?? 0),
                      });
                    }}
                    onMouseLeave={() => setHover(null)}
                  />
                  <text
                    x={labelOnLeft ? x0n - labelPad : (node.x1 ?? 0) + labelPad}
                    y={(y0n + (node.y1 ?? 0)) / 2}
                    dy="0.35em"
                    textAnchor={labelOnLeft ? 'end' : 'start'}
                    fontSize={isNarrow ? 9 : 11}
                    fontWeight={600}
                    fontFamily="var(--font-mono, monospace)"
                    fill={isHovered ? 'hsl(var(--foreground))' : labelColor}
                    style={{ pointerEvents: 'none' }}
                  >
                    {labelText}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      ) : null}

      {/* Tooltip overlay */}
      {hover?.kind === 'node' && (
        <SankeyTooltip x={hover.x} y={hover.y}>
          <NodeTooltipContent node={hover.node as LaidOutNode & SankeyNodeData} />
        </SankeyTooltip>
      )}
      {hover?.kind === 'link' && (
        <SankeyTooltip x={hover.x} y={hover.y}>
          <LinkTooltipContent link={hover.link as LaidOutLink & SankeyLinkData} />
        </SankeyTooltip>
      )}
    </div>
  );
}

function SankeyTooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute z-50" style={{ left: x + 12, top: y + 12 }}>
      {children}
    </div>
  );
}

function NodeTooltipContent({ node }: { node: LaidOutNode & SankeyNodeData }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-foreground shadow-card">
      <div className="mb-1 font-bold">{node.fullName || node.name}</div>
      <div className="mb-2 text-muted-foreground">{node.teamName}</div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">
          {node.type === 'pit-lane' ? 'Pit lane' : node.type === 'dnf' ? 'DNF' : 'Grid'} Position
        </span>
        <span className="font-mono font-medium tabular-nums">{node.name}</span>
      </div>
    </div>
  );
}

function LinkTooltipContent({ link }: { link: LaidOutLink & SankeyLinkData }) {
  const sourceNode = link.source as LaidOutNode & SankeyNodeData;
  const targetNode = link.target as LaidOutNode & SankeyNodeData;
  let changeText = '—';
  let changeColor = 'text-muted-foreground';
  if (link.gridPosition != null && link.racePosition != null) {
    const change = link.gridPosition - link.racePosition;
    if (change > 0) {
      changeText = `+${change} positions`;
      changeColor = 'text-status-completed';
    } else if (change < 0) {
      changeText = `${change} positions`;
      changeColor = 'text-destructive';
    } else {
      changeText = 'No change';
    }
  }
  const teams = link.teams?.length
    ? link.teams.length === 1
      ? link.teams[0]
      : `${link.teams.length} teams`
    : '—';
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-foreground shadow-card">
      <div className="mb-1 font-bold">{link.driverName || sourceNode?.name}</div>
      <div className="mb-2 text-muted-foreground">{link.team || sourceNode?.teamName || teams}</div>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Grid</span>
          <span className="font-mono font-medium tabular-nums">
            {link.isPitLane ? 'Pit lane' : `P${sourceNode?.position}`}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Finish</span>
          <span className="font-mono font-medium tabular-nums">
            {link.isDNF ? 'DNF' : `P${targetNode?.position}`}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Change</span>
          <span className={cn('font-mono font-medium tabular-nums', changeColor)}>{changeText}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-border pt-1 mt-1">
          <span className="text-muted-foreground">Races</span>
          <span className="font-mono font-medium tabular-nums">{link.value}</span>
        </div>
        {link.isDNF && (
          <div className="mt-1 border-t border-border pt-1 font-medium text-destructive">
            Did not finish
          </div>
        )}
      </div>
    </div>
  );
}

export default SeasonSankeyChart;

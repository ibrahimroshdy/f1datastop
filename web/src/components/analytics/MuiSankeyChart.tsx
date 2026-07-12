import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  sankey,
  sankeyLinkHorizontal,
  sankeyLeft,
  type SankeyNode,
  type SankeyLink,
  type SankeyGraph,
} from 'd3-sankey';
import { useQualifyingToRaceDataByRound } from '@/hooks/useF1Data';
import { TEAM_COLORS } from '@/constants/f1Colors';
import { F1ChartContainer } from '@/components/f1';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface MuiSankeyChartProps {
  year: number;
  round: string;
}

// Node datum that feeds d3-sankey. d3-sankey mutates these in place, adding
// the computed layout fields (x0/x1/y0/y1/index/value/depth/...).
interface SankeyNodeData {
  id: string;
  originalId: string;
  name: string;
  position: number;
  type: 'qualifying' | 'grid' | 'race' | string;
  team?: string;
  teamName?: string;
  fullName?: string;
  status?: string;
  isDNF?: boolean;
  points?: number;
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
  qualifyingPosition?: number;
  gridPosition?: number;
  racePosition?: number;
  positionChange?: number;
  status?: string;
  isDNF?: boolean;
  points?: number;
}

type LaidOutNode = SankeyNode<SankeyNodeData, SankeyLinkData>;
type LaidOutLink = SankeyLink<SankeyNodeData, SankeyLinkData>;

// Get team color with fallback
const getTeamColor = (team: string): string => {
  let normalizedTeam = team.toLowerCase();
  if (normalizedTeam === 'alphatauri') normalizedTeam = 'rb';
  if (normalizedTeam === 'alfa') normalizedTeam = 'sauber';
  return TEAM_COLORS[normalizedTeam] || TEAM_COLORS.default;
};

// Determine link color based on position change (semantic tokens only)
const getLinkColor = (source: any, target: any): string => {
  const isQualiToGrid = source.type === 'qualifying' && target.type === 'grid';
  const isGridToRace = source.type === 'grid' && target.type === 'race';

  if (isQualiToGrid || isGridToRace) {
    if (source.position > target.position) return TOKEN.gain; // positions up
    if (source.position < target.position) return TOKEN.loss; // positions down
    return TOKEN.neutral; // no change
  }

  return getTeamColor(source.team || '');
};

const MuiSankeyChart: React.FC<MuiSankeyChartProps> = ({ year, round }) => {
  const { data, isLoading, error } = useQualifyingToRaceDataByRound(year, round);

  // Transform data into d3-sankey nodes + links
  const sankeyData = useMemo<{ nodes: SankeyNodeData[]; links: SankeyLinkData[] } | null>(() => {
    if (!data?.processedData) return null;

    const { nodes: originalNodes, links: originalLinks } = data.processedData;

    // Create node ID map for consistent referencing
    const nodeMap = new Map<string, SankeyNodeData>();

    // Group nodes by type and sort by position
    const qualifyingNodes: SankeyNodeData[] = [];
    const gridNodes: SankeyNodeData[] = [];
    const raceNodes: SankeyNodeData[] = [];

    originalNodes.forEach((node: any) => {
      const id = `${node.type}-${node.position}-${node.name}`;
      const position = toValidNumber(node.position, 0);
      const nivoNode: SankeyNodeData = {
        id,
        originalId: node.id,
        name: node.name,
        position,
        type: node.type,
        team: node.team,
        teamName: node.teamName,
        fullName: node.fullName,
        status: node.status,
        isDNF: node.isDNF,
        points: node.points,
        color: getTeamColor(node.team || ''),
      };
      nodeMap.set(node.id, nivoNode);
      
      // Group by type
      if (node.type === 'qualifying') {
        qualifyingNodes.push(nivoNode);
      } else if (node.type === 'grid') {
        gridNodes.push(nivoNode);
      } else if (node.type === 'race') {
        raceNodes.push(nivoNode);
      }
    });
    
    // Sort each group by position (P1 first, P20 last)
    qualifyingNodes.sort((a, b) => a.position - b.position);
    gridNodes.sort((a, b) => a.position - b.position);
    raceNodes.sort((a, b) => a.position - b.position);
    
    // Combine in order: qualifying, grid, race (column order for the layout)
    const nivoNodes: SankeyNodeData[] = [...qualifyingNodes, ...gridNodes, ...raceNodes];

    // Build links - sort by source position to help maintain visual order
    // Only include links where both source and target exist; ensure value is finite and >= 1 to avoid NaN in layout
    const nodeIds = new Set(nivoNodes.map((n) => n.id));
    const nivoLinks: SankeyLinkData[] = originalLinks
      .map((link: any): SankeyLinkData | null => {
        const sourceNode = nodeMap.get(link.source) || originalNodes.find((n: any) => n.id === link.source);
        const targetNode = nodeMap.get(link.target) || originalNodes.find((n: any) => n.id === link.target);

        const sourceId = nodeMap.get(link.source)?.id || link.source;
        const targetId = nodeMap.get(link.target)?.id || link.target;

        if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) return null;

        const value = toValidNumber(link.value, 1);

        const linkColor = getLinkColor(
          { type: sourceNode?.type, position: sourceNode?.position, team: sourceNode?.team },
          { type: targetNode?.type, position: targetNode?.position }
        );
        // Mark Grid→Race links for DNF/DNS/Retired so we can dim them
        const isGridToRace = sourceNode?.type === 'grid' && targetNode?.type === 'race';
        const statusStr = link.status ? String(link.status).toLowerCase() : '';
        const dimLine =
          isGridToRace &&
          (link.isDNF === true ||
            statusStr.includes('retired') ||
            statusStr.includes('did not start'));

        return {
          source: sourceId,
          target: targetId,
          value,
          sourcePosition: Number.isFinite(Number(sourceNode?.position)) ? Number(sourceNode?.position) : 0,
          color: linkColor,
          dimLine: !!dimLine,
          driverName: link.fullName || link.name,
          driverCode: link.code,
          team: link.teamName,
          qualifyingPosition: link.qualifyingPosition,
          gridPosition: link.gridPosition,
          racePosition: link.racePosition,
          positionChange: link.positionChange,
          status: link.status,
          isDNF: link.isDNF,
          points: link.points,
        };
      })
      .filter((l): l is SankeyLinkData => l !== null)
      .sort((a, b) => (a.sourcePosition || 0) - (b.sourcePosition || 0));

    // Safety: remove orphan nodes (no links) to prevent d3-sankey NaN
    const linkedNodeIds = new Set<string>();
    nivoLinks.forEach((l) => {
      linkedNodeIds.add(l.source);
      linkedNodeIds.add(l.target);
    });
    const connectedNodes = nivoNodes.filter((n) => linkedNodeIds.has(n.id));

    if (connectedNodes.length === 0 || nivoLinks.length === 0) return null;

    return { nodes: connectedNodes, links: nivoLinks };
  }, [data]);

  const isEmpty = !!sankeyData && sankeyData.nodes.length === 0;

  return (
    <F1ChartContainer
      isLoading={isLoading}
      error={error as Error | null}
      isEmpty={!sankeyData || isEmpty}
      useSkeleton
      minHeight={400}
      loadingMessage="Loading progression..."
      emptyTitle="No progression data"
      emptyDescription="No qualifying to race progression for this round."
      className="flex flex-col"
    >
      {sankeyData && (
        <div className="flex h-full flex-col">
          {/* Legend */}
          <div className="mb-4 flex flex-wrap items-center justify-center gap-3 px-2 py-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Position Change
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
          <div className="mb-2 grid grid-cols-3 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <span>Quali</span>
            <span>Grid</span>
            <span>Race</span>
          </div>

          {/* Sankey Chart - only render when container has non-zero size to avoid NaN in d3-sankey layout */}
          <SankeyWithDimensionGuard sankeyData={sankeyData} />

          <p className="mt-2 px-2 text-center text-xs text-muted-foreground">
            Drivers without a qualifying time (e.g. pit lane start) appear only in Grid and Race.
          </p>
          <div className="pb-6" />
        </div>
      )}
    </F1ChartContainer>
  );
};

// Layout constants matching the previous Nivo configuration
const MARGIN = { top: 10, right: 100, bottom: 10, left: 100 };
const NODE_WIDTH = 12; // was nodeThickness
const NODE_PADDING = 4; // was nodeSpacing
const NODE_RADIUS = 3; // was nodeBorderRadius
const LABEL_PADDING = 12;

type HoverTarget =
  | { kind: 'node'; node: LaidOutNode; x: number; y: number }
  | { kind: 'link'; link: LaidOutLink; x: number; y: number }
  | null;

function SankeyWithDimensionGuard({
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
      setDimensions((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasSize = dimensions.width >= 50 && dimensions.height >= 50;
  // Narrow (phone) layout: shrink side margins and drop the outside P{n} labels
  // (they clip past the SVG edge); tap tooltips carry the detail instead.
  const isNarrow = dimensions.width > 0 && dimensions.width < 480;

  // Compute the d3-sankey layout. Clone the data because d3-sankey mutates the
  // node/link objects in place (resolving source/target and adding x0/y0/...).
  const graph = useMemo<SankeyGraph<SankeyNodeData, SankeyLinkData> | null>(() => {
    if (!hasSize) return null;

    const side = isNarrow ? 34 : MARGIN.left;
    const x0 = side;
    const x1 = dimensions.width - side;
    const y0 = MARGIN.top;
    const y1 = dimensions.height - MARGIN.bottom;
    if (x1 <= x0 || y1 <= y0) return null;

    const layout = sankey<SankeyNodeData, SankeyLinkData>()
      .nodeId((d) => d.id)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(NODE_PADDING)
      .nodeAlign(sankeyLeft)
      // Keep nodes ordered top-to-bottom by F1 position (P1 at the top)
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
  // Token-driven label color adapts across all three themes.
  const labelColor = 'hsl(var(--muted-foreground))';

  // node id -> driver 3-letter code (reliable, from link data) so every node can
  // be labelled at any width instead of showing anonymous colour squares.
  const codeById = useMemo(() => {
    const m = new Map<string, string>();
    sankeyData.links.forEach((l) => {
      if (l.driverCode) {
        m.set(l.source, l.driverCode);
        m.set(l.target, l.driverCode);
      }
    });
    return m;
  }, [sankeyData.links]);

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
              // Holds (no position change — mostly the quali→grid stage) fade to
              // faint threads; gain/loss ribbons stay bold so movement reads first.
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
                    e.stopPropagation(); // don't let the svg clear it
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
              // Grid column stays unlabeled (it's the middle); quali codes sit on
              // the left, race codes on the right — shown at every width now
              // (short 3-letter codes fit; anonymous squares were unreadable).
              const showLabel = data.type !== 'grid';
              const labelOnLeft = data.type === 'qualifying';
              const labelPad = isNarrow ? 5 : LABEL_PADDING;
              const labelText = codeById.get(data.id) ?? `P${data.position}`;
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
                    fillOpacity={isHovered ? 1 : 0.95}
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
                  {showLabel && (
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
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      ) : null}

      {/* Tooltip overlay (replaces Nivo's built-in node/link tooltips) */}
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

// Positioned tooltip wrapper, follows the cursor inside the chart container.
function SankeyTooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{ left: x + 12, top: y + 12 }}
    >
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
          {node.type === 'qualifying' ? 'Quali' : node.type === 'grid' ? 'Grid' : 'Race'} Position
        </span>
        <span className="font-mono font-medium tabular-nums">P{node.position}</span>
      </div>
      {node.type === 'race' && node.points !== undefined && node.points > 0 && (
        <div className="mt-1 flex justify-between gap-4">
          <span className="text-muted-foreground">Points</span>
          <span className="font-mono font-medium tabular-nums text-primary">{node.points}</span>
        </div>
      )}
      {node.isDNF && node.status && (
        <div className="mt-1 border-t border-border pt-1 font-medium text-destructive">{node.status}</div>
      )}
    </div>
  );
}

function LinkTooltipContent({ link }: { link: LaidOutLink & SankeyLinkData }) {
  const sourceNode = link.source as LaidOutNode & SankeyNodeData;
  const targetNode = link.target as LaidOutNode & SankeyNodeData;
  const isQualiToGrid = sourceNode?.type === 'qualifying' && targetNode?.type === 'grid';
  const isGridToRace = sourceNode?.type === 'grid' && targetNode?.type === 'race';
  let change = 0;
  let changeText = 'No change';
  let changeColor = 'text-muted-foreground';
  if (isQualiToGrid) change = (sourceNode?.position ?? 0) - (targetNode?.position ?? 0);
  else if (isGridToRace) change = (sourceNode?.position ?? 0) - (targetNode?.position ?? 0);
  if (change > 0) {
    changeText = `+${change} positions`;
    changeColor = 'text-status-completed';
  } else if (change < 0) {
    changeText = `${change} positions`;
    changeColor = 'text-destructive';
  }
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-foreground shadow-card">
      <div className="mb-1 font-bold">{link.driverName || sourceNode?.name}</div>
      <div className="mb-2 text-muted-foreground">{link.team || sourceNode?.teamName}</div>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{isQualiToGrid ? 'Qualifying' : 'Grid'}</span>
          <span className="font-mono font-medium tabular-nums">P{sourceNode?.position}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{isQualiToGrid ? 'Grid' : 'Race'}</span>
          <span className="font-mono font-medium tabular-nums">P{targetNode?.position}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Change</span>
          <span className={cn('font-mono font-medium tabular-nums', changeColor)}>{changeText}</span>
        </div>
        {isGridToRace && link.points !== undefined && link.points > 0 && (
          <div className="mt-1 flex justify-between gap-4 border-t border-border pt-1">
            <span className="text-muted-foreground">Points</span>
            <span className="font-mono font-medium tabular-nums text-primary">{link.points}</span>
          </div>
        )}
      </div>
      {link.isDNF && link.status && (
        <div className="mt-1 border-t border-border pt-1 font-medium text-destructive">{link.status}</div>
      )}
    </div>
  );
}

export default MuiSankeyChart;


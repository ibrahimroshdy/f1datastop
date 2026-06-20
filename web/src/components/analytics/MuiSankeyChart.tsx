import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
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
import { useTheme } from '@/context/ThemeContext';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  return TEAM_COLORS[normalizedTeam] || '#666666';
};

// Determine link color based on position change
const getLinkColor = (source: any, target: any): string => {
  const isQualiToGrid = source.type === 'qualifying' && target.type === 'grid';
  const isGridToRace = source.type === 'grid' && target.type === 'race';

  if (isQualiToGrid) {
    if (source.position > target.position) return '#10b981'; // Gained - green
    if (source.position < target.position) return '#ef4444'; // Lost - red
    return '#3b82f6'; // Same - blue
  }
  
  if (isGridToRace) {
    if (source.position > target.position) return '#10b981'; // Gained - green
    if (source.position < target.position) return '#ef4444'; // Lost - red
    return '#3b82f6'; // Same - blue
  }

  return getTeamColor(source.team || '');
};

const MuiSankeyChart: React.FC<MuiSankeyChartProps> = ({ year, round }) => {
  const { data, isLoading, error, refetch } = useQualifyingToRaceDataByRound(year, round);
  const { baseTheme, isGlass } = useTheme();
  const isDark = baseTheme === 'dark';
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await refetch();
    setIsRetrying(false);
  }, [refetch]);

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
          sourcePosition: Number.isFinite(Number(sourceNode?.position)) ? Number(sourceNode.position) : 0,
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
        <p className="text-sm text-muted-foreground">Loading progression...</p>
      </div>
    );
  }

  // Error state
  if (error || !sankeyData) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load data</AlertTitle>
          <AlertDescription className="mt-2">
            Unable to load qualifying to race progression data.
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3 w-full"
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No data state
  if (sankeyData.nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No progression data available for this race.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Legend */}
      <div className="flex justify-center flex-wrap gap-4 mb-4 items-center text-xs px-2 py-2">
        <span className="text-muted-foreground font-medium">Position Change:</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-[3px] bg-emerald-500 rounded" />
            <span className="text-muted-foreground">Gained</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-[3px] bg-red-500 rounded" />
            <span className="text-muted-foreground">Lost</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-[3px] bg-blue-500 rounded" />
            <span className="text-muted-foreground">Same</span>
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 text-xs text-center mb-2">
        <span className="text-muted-foreground font-medium">Qualifying</span>
        <span className="text-muted-foreground font-medium">Grid</span>
        <span className="text-muted-foreground font-medium">Race</span>
      </div>

      {/* Sankey Chart - only render when container has non-zero size to avoid NaN in d3-sankey layout */}
      <SankeyWithDimensionGuard
        sankeyData={sankeyData}
        isDark={isDark}
      />
      <p className="text-[10px] text-muted-foreground text-center mt-2 px-2">
        Drivers without a qualifying time (e.g. pit lane start) appear only in Grid and Race.
      </p>
      <div className="pb-6" />
    </div>
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
  isDark,
}: {
  sankeyData: { nodes: SankeyNodeData[]; links: SankeyLinkData[] };
  isDark: boolean;
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

  // Compute the d3-sankey layout. Clone the data because d3-sankey mutates the
  // node/link objects in place (resolving source/target and adding x0/y0/...).
  const graph = useMemo<SankeyGraph<SankeyNodeData, SankeyLinkData> | null>(() => {
    if (!hasSize) return null;

    const x0 = MARGIN.left;
    const x1 = dimensions.width - MARGIN.right;
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
  }, [sankeyData, dimensions.width, dimensions.height, hasSize]);

  const linkPath = useMemo(() => sankeyLinkHorizontal<SankeyNodeData, SankeyLinkData>(), []);
  const labelColor = isDark ? '#a1a1aa' : '#666';

  return (
    <div ref={containerRef} className="relative flex-1 min-h-[400px]" style={{ minHeight: 400 }}>
      {hasSize && graph ? (
        <svg
          width={dimensions.width}
          height={dimensions.height}
          onMouseLeave={() => setHover(null)}
        >
          {/* Links (drawn first so nodes sit on top) */}
          <g fill="none">
            {graph.links.map((link, i) => {
              const d = linkPath(link);
              if (!d) return null;
              const data = link as LaidOutLink & SankeyLinkData;
              const isHovered = hover?.kind === 'link' && hover.link === link;
              const baseOpacity = data.dimLine ? 0.2 : 0.4;
              return (
                <path
                  key={`link-${i}`}
                  d={d}
                  stroke={data.color || '#666'}
                  strokeWidth={Math.max(1, link.width ?? 1)}
                  strokeOpacity={isHovered ? 0.7 : baseOpacity}
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
              // Grid column is unlabeled; quali labels left, race labels right
              const showLabel = data.type !== 'grid';
              const labelOnLeft = data.type === 'qualifying';
              return (
                <g key={`node-${i}`}>
                  <rect
                    x={x0n}
                    y={y0n}
                    width={w}
                    height={h}
                    rx={NODE_RADIUS}
                    ry={NODE_RADIUS}
                    fill={data.color || '#666'}
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
                    onMouseLeave={() => setHover(null)}
                  />
                  {showLabel && (
                    <text
                      x={labelOnLeft ? x0n - LABEL_PADDING : (node.x1 ?? 0) + LABEL_PADDING}
                      y={(y0n + (node.y1 ?? 0)) / 2}
                      dy="0.35em"
                      textAnchor={labelOnLeft ? 'end' : 'start'}
                      fontSize={10}
                      fill={labelColor}
                      style={{ pointerEvents: 'none' }}
                    >
                      {`P${data.position} ${data.name}`}
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
          <NodeTooltipContent node={hover.node as LaidOutNode & SankeyNodeData} isDark={isDark} />
        </SankeyTooltip>
      )}
      {hover?.kind === 'link' && (
        <SankeyTooltip x={hover.x} y={hover.y}>
          <LinkTooltipContent link={hover.link as LaidOutLink & SankeyLinkData} isDark={isDark} />
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

function NodeTooltipContent({
  node,
  isDark,
}: {
  node: LaidOutNode & SankeyNodeData;
  isDark: boolean;
}) {
  return (
    <div
      className={cn(
        'px-3 py-2 rounded-lg shadow-lg text-xs',
        isDark
          ? 'bg-zinc-900 text-white border border-zinc-800'
          : 'bg-white text-zinc-900 border border-zinc-200'
      )}
    >
      <div className="font-bold mb-1">{node.fullName || node.name}</div>
      <div className="text-muted-foreground mb-2">{node.teamName}</div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">
          {node.type === 'qualifying' ? 'Quali' : node.type === 'grid' ? 'Grid' : 'Race'} Position:
        </span>
        <span className="font-mono font-medium">P{node.position}</span>
      </div>
      {node.type === 'race' && node.points !== undefined && node.points > 0 && (
        <div className="flex justify-between gap-4 mt-1">
          <span className="text-muted-foreground">Points:</span>
          <span className="font-mono font-medium text-primary">{node.points}</span>
        </div>
      )}
      {node.isDNF && node.status && (
        <div className="mt-1 pt-1 border-t border-muted text-red-500 font-medium">{node.status}</div>
      )}
    </div>
  );
}

function LinkTooltipContent({
  link,
  isDark,
}: {
  link: LaidOutLink & SankeyLinkData;
  isDark: boolean;
}) {
  const sourceNode = link.source as LaidOutNode & SankeyNodeData;
  const targetNode = link.target as LaidOutNode & SankeyNodeData;
  const isQualiToGrid = sourceNode?.type === 'qualifying' && targetNode?.type === 'grid';
  const isGridToRace = sourceNode?.type === 'grid' && targetNode?.type === 'race';
  let change = 0;
  let changeText = 'No change';
  let changeColor = 'text-blue-500';
  if (isQualiToGrid) change = (sourceNode?.position ?? 0) - (targetNode?.position ?? 0);
  else if (isGridToRace) change = (sourceNode?.position ?? 0) - (targetNode?.position ?? 0);
  if (change > 0) {
    changeText = `+${change} positions`;
    changeColor = 'text-emerald-500';
  } else if (change < 0) {
    changeText = `${change} positions`;
    changeColor = 'text-red-500';
  }
  return (
    <div
      className={cn(
        'px-3 py-2 rounded-lg shadow-lg text-xs',
        isDark
          ? 'bg-zinc-900 text-white border border-zinc-800'
          : 'bg-white text-zinc-900 border border-zinc-200'
      )}
    >
      <div className="font-bold mb-1">{link.driverName || sourceNode?.name}</div>
      <div className="text-muted-foreground mb-2">{link.team || sourceNode?.teamName}</div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{isQualiToGrid ? 'Qualifying:' : 'Grid:'}</span>
          <span className="font-mono font-medium">P{sourceNode?.position}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{isQualiToGrid ? 'Grid:' : 'Race:'}</span>
          <span className="font-mono font-medium">P{targetNode?.position}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Change:</span>
          <span className={cn('font-mono font-medium', changeColor)}>{changeText}</span>
        </div>
        {isGridToRace && link.points !== undefined && link.points > 0 && (
          <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-muted">
            <span className="text-muted-foreground">Points:</span>
            <span className="font-mono font-medium text-primary">{link.points}</span>
          </div>
        )}
      </div>
      {link.isDNF && link.status && (
        <div className="mt-1 pt-1 border-t border-muted text-red-500 font-medium">{link.status}</div>
      )}
    </div>
  );
}

export default MuiSankeyChart;


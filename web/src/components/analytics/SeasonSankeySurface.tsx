import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  sankey as d3Sankey,
  sankeyLinkHorizontal as d3SankeyLinkHorizontal,
  sankeyLeft as d3SankeyLeft,
  type SankeyLink,
  type SankeyNode,
} from 'd3-sankey';
import {
  type SankeyGraph,
  type SankeyNodeData,
  type SankeyLinkData,
  type LaidOutNode,
  type LaidOutLink,
} from './SeasonSankeyTypes';
import { TEAM_COLORS } from '@/constants/f1Colors';
import { cn } from '@/lib/utils';

// Semantic SVG color tokens (DESIGN.md: SVG fills/strokes route through hsl(var(--*)))
const TOKEN = {
  gain: 'hsl(var(--status-completed))',
  loss: 'hsl(var(--destructive))',
  neutral: 'hsl(var(--muted-foreground))',
} as const;

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

  const graph = useMemo<SankeyGraph<SankeyNodeData, SankeyLinkData> | null>(() => {
    if (!hasSize) return null;

    // Left column carries "position + code" so it needs a wider margin than the
    // right (code only). Keep the generous margins on wide screens.
    const leftM = isNarrow ? 48 : MARGIN.left;
    const rightM = isNarrow ? 48 : MARGIN.right;
    const x0 = leftM;
    const x1 = dimensions.width - rightM;
    const y0 = MARGIN.top;
    const y1 = dimensions.height - MARGIN.bottom;
    if (x1 <= x0 || y1 <= y0) return null;

    const layout = d3Sankey<SankeyNodeData, SankeyLinkData>()
      .nodeId((d) => d.id)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(NODE_PADDING)
      .nodeAlign(d3SankeyLeft)
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

  const linkPath = useMemo(() => d3SankeyLinkHorizontal<SankeyNodeData, SankeyLinkData>(), []);
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
            {graph.links.map(
              (link: SankeyLink<SankeyNodeData, SankeyLinkData>, i: number) => {
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
              }
            )}
          </g>

          {/* Nodes */}
          <g>
            {graph.nodes.map(
              (node: SankeyNode<SankeyNodeData, SankeyLinkData>, i: number) => {
                const data = node as LaidOutNode & SankeyNodeData;
                const x0n = node.x0 ?? 0;
                const y0n = node.y0 ?? 0;
                const w = (node.x1 ?? 0) - x0n;
                const h = Math.max(0, (node.y1 ?? 0) - y0n);
                const isHovered = hover?.kind === 'node' && hover.node === node;
                const labelOnLeft = data.type === 'grid' || data.type === 'pit-lane';
                const labelPad = isNarrow ? 5 : LABEL_PADDING;
                const labelText = `${data.name}`;
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
              }
            )}
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

// Positioned tooltip wrapper, follows the cursor inside the chart container.
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

export default SeasonSankeySurface;

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Sankey } from '@nivo/sankey';
import { useQualifyingToRaceDataByRound } from '@/hooks/useF1Data';
import { TEAM_COLORS } from '@/constants/f1Colors';
import { useTheme } from '@/context/ThemeContext';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Ensure a value is a finite number >= minVal (prevents NaN in Nivo layout/animations)
const toValidNumber = (v: unknown, minVal: number = 1): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < minVal) return minVal;
  return n;
};

interface MuiSankeyChartProps {
  year: number;
  round: string;
}

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

  // Transform data for Nivo Sankey
  const sankeyData = useMemo(() => {
    if (!data?.processedData) return null;

    const { nodes: originalNodes, links: originalLinks } = data.processedData;

    // Create node ID map for consistent referencing
    const nodeMap = new Map<string, any>();
    
    // Group nodes by type and sort by position
    const qualifyingNodes: any[] = [];
    const gridNodes: any[] = [];
    const raceNodes: any[] = [];
    
    originalNodes.forEach((node: any) => {
      const id = `${node.type}-${node.position}-${node.name}`;
      const position = toValidNumber(node.position, 0);
      const nivoNode = {
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
    
    // Combine in order: qualifying, grid, race
    // This order is crucial for Nivo's "input" sort to work correctly
    const nivoNodes = [...qualifyingNodes, ...gridNodes, ...raceNodes];

    // Build Nivo links - sort by source position to help maintain visual order
    // Only include links where both source and target exist; ensure value is finite and >= 1 to avoid NaN in layout
    const nodeIds = new Set(nivoNodes.map((n: any) => n.id));
    const nivoLinks = originalLinks
      .map((link: any) => {
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
        // Mark Grid→Race links for DNF/DNS/Retired so we can dim them (Nivo overwrites link color, so we dim via DOM in useEffect)
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
      .filter(Boolean)
      .sort((a: any, b: any) => (a.sourcePosition || 0) - (b.sourcePosition || 0));

    // Safety: remove orphan nodes (no links) to prevent d3-sankey NaN
    const linkedNodeIds = new Set<string>();
    nivoLinks.forEach((l: any) => {
      linkedNodeIds.add(l.source);
      linkedNodeIds.add(l.target);
    });
    const connectedNodes = nivoNodes.filter((n: any) => linkedNodeIds.has(n.id));

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

      {/* Sankey Chart - only render when container has non-zero size to avoid NaN in Nivo layout */}
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

function SankeyWithDimensionGuard({
  sankeyData,
  isDark,
}: {
  sankeyData: { nodes: any[]; links: any[] };
  isDark: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

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

  // Dim Grid→Race lines for DNF/DNS/Retired by setting fill-opacity on the SVG paths (Nivo overwrites link color so we can't do it via data)
  useEffect(() => {
    if (!sankeyData?.links?.length || dimensions.width < 50) return;
    const wrapper = containerRef.current;
    if (!wrapper) return;
    const raf = requestAnimationFrame(() => {
      const svg = wrapper.querySelector('svg');
      if (!svg) return;
      const paths = Array.from(svg.querySelectorAll('path'));
      // One path per link in same order as sankeyData.links
      sankeyData.links.forEach((link: any, i: number) => {
        const path = paths[i];
        if (!path) return;
        if (link.dimLine) {
          path.style.fillOpacity = '0.2';
        } else {
          path.style.fillOpacity = '';
        }
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [sankeyData, dimensions.width]);

  const hasSize = dimensions.width >= 50 && dimensions.height >= 50;

  return (
    <div ref={containerRef} className="flex-1 min-h-[400px]" style={{ minHeight: 400 }}>
      {hasSize ? (
        <Sankey
          width={dimensions.width}
          height={dimensions.height}
          data={sankeyData}
          margin={{ top: 10, right: 100, bottom: 10, left: 100 }}
          align="justify"
          animate={false}
          sort={(a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)}
          nodeOpacity={0.9}
          nodeHoverOpacity={1}
          nodeThickness={12}
          nodeSpacing={4}
          nodeBorderWidth={0}
          nodeBorderRadius={3}
          linkOpacity={0.4}
          linkHoverOpacity={0.7}
          linkContract={2}
          linkBlendMode="normal"
          enableLinkGradient={false}
          colors={(node: any) => node.color || '#666'}
          labelPosition="outside"
          labelOrientation="horizontal"
          labelPadding={12}
          labelTextColor={isDark ? '#a1a1aa' : '#666'}
          label={(node: any) => (node.type === 'grid' ? '' : `P${node.position} ${node.name}`)}
          theme={{
            text: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
            tooltip: {
              container: {
                background: isDark ? 'hsl(222 47% 11%)' : '#fff',
                color: isDark ? '#fff' : '#333',
                fontSize: 12,
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                padding: '10px 14px',
              },
            },
          }}
          nodeTooltip={({ node }: any) => (
            <div className={cn(
              "px-3 py-2 rounded-lg shadow-lg text-xs",
              isDark ? "bg-zinc-900 text-white border border-zinc-800" : "bg-white text-zinc-900 border border-zinc-200"
            )}>
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
          )}
          linkTooltip={({ link }: any) => {
            const sourceNode = sankeyData.nodes.find((n: any) => n.id === link.source.id);
            const targetNode = sankeyData.nodes.find((n: any) => n.id === link.target.id);
            const isQualiToGrid = sourceNode?.type === 'qualifying' && targetNode?.type === 'grid';
            const isGridToRace = sourceNode?.type === 'grid' && targetNode?.type === 'race';
            let change = 0;
            let changeText = 'No change';
            let changeColor = 'text-blue-500';
            if (isQualiToGrid) change = (sourceNode?.position ?? 0) - (targetNode?.position ?? 0);
            else if (isGridToRace) change = (sourceNode?.position ?? 0) - (targetNode?.position ?? 0);
            if (change > 0) { changeText = `+${change} positions`; changeColor = 'text-emerald-500'; }
            else if (change < 0) { changeText = `${change} positions`; changeColor = 'text-red-500'; }
            return (
              <div className={cn(
                "px-3 py-2 rounded-lg shadow-lg text-xs",
                isDark ? "bg-zinc-900 text-white border border-zinc-800" : "bg-white text-zinc-900 border border-zinc-200"
              )}>
                <div className="font-bold mb-1">{link.driverName || link.source.name}</div>
                <div className="text-muted-foreground mb-2">{link.team || link.source.teamName}</div>
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
                    <span className={cn("font-mono font-medium", changeColor)}>{changeText}</span>
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
          }}
        />
      ) : null}
    </div>
  );
}

export default MuiSankeyChart;


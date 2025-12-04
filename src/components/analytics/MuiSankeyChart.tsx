import React, { useMemo, useState, useCallback } from 'react';
import { ResponsiveSankey } from '@nivo/sankey';
import { useQualifyingToRaceDataByRound } from '@/hooks/useF1Data';
import { TEAM_COLORS } from '@/constants/f1Colors';
import { useTheme } from '@/context/ThemeContext';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
      const nivoNode = {
        id,
        originalId: node.id,
        name: node.name,
        position: node.position,
        type: node.type,
        team: node.team,
        teamName: node.teamName,
        fullName: node.fullName,
        status: node.status,
        isDNF: node.isDNF,
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
    const nivoLinks = originalLinks
      .map((link: any) => {
        const sourceNode = nodeMap.get(link.source) || originalNodes.find((n: any) => n.id === link.source);
        const targetNode = nodeMap.get(link.target) || originalNodes.find((n: any) => n.id === link.target);
        
        const sourceId = nodeMap.get(link.source)?.id || link.source;
        const targetId = nodeMap.get(link.target)?.id || link.target;

        return {
          source: sourceId,
          target: targetId,
          value: link.value || 1,
          sourcePosition: sourceNode?.position || 0,
          color: getLinkColor(
            { type: sourceNode?.type, position: sourceNode?.position, team: sourceNode?.team },
            { type: targetNode?.type, position: targetNode?.position }
          ),
          // Store additional info for tooltips
          driverName: link.fullName || link.name,
          driverCode: link.code,
          team: link.teamName,
          qualifyingPosition: link.qualifyingPosition,
          gridPosition: link.gridPosition,
          racePosition: link.racePosition,
          positionChange: link.positionChange,
          status: link.status,
          isDNF: link.isDNF,
        };
      })
      // Sort links by source position to help maintain visual order
      .sort((a, b) => a.sourcePosition - b.sourcePosition);

    return { nodes: nivoNodes, links: nivoLinks };
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
      <div className="flex flex-wrap gap-3 mb-3 items-center text-xs">
        <span className="text-muted-foreground">Position Change:</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-emerald-500 rounded" />
          <span className="text-muted-foreground">Gained</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-red-500 rounded" />
          <span className="text-muted-foreground">Lost</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-blue-500 rounded" />
          <span className="text-muted-foreground">Same</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 text-xs text-center mb-2">
        <span className="text-muted-foreground font-medium">Qualifying</span>
        <span className="text-muted-foreground font-medium">Grid</span>
        <span className="text-muted-foreground font-medium">Race</span>
      </div>

      {/* Sankey Chart */}
      <div className="flex-1 min-h-[400px]">
        <ResponsiveSankey
          data={sankeyData}
          margin={{ top: 10, right: 100, bottom: 10, left: 100 }}
          align="justify"
          sort={(a: any, b: any) => {
            // Sort nodes by position within each layer (P1 at top, P20 at bottom)
            return (a.position || 0) - (b.position || 0);
          }}
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
          label={(node: any) => {
            // Only show labels for qualifying and race nodes
            if (node.type === 'grid') return '';
            return `P${node.position} ${node.name}`;
          }}
          theme={{
            text: {
              fontSize: 10,
              fill: isDark ? '#a1a1aa' : '#666',
            },
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
              {node.isDNF && node.status && (
                <div className="mt-1 pt-1 border-t border-muted text-red-500 font-medium">
                  {node.status}
                </div>
              )}
            </div>
          )}
          linkTooltip={({ link }: any) => {
            const sourceNode = sankeyData.nodes.find(n => n.id === link.source.id);
            const targetNode = sankeyData.nodes.find(n => n.id === link.target.id);
            
            const isQualiToGrid = sourceNode?.type === 'qualifying' && targetNode?.type === 'grid';
            const isGridToRace = sourceNode?.type === 'grid' && targetNode?.type === 'race';

            let change = 0;
            let changeText = 'No change';
            let changeColor = 'text-blue-500';

            if (isQualiToGrid) {
              change = (sourceNode?.position || 0) - (targetNode?.position || 0);
            } else if (isGridToRace) {
              change = (sourceNode?.position || 0) - (targetNode?.position || 0);
            }

            if (change > 0) {
              changeText = `+${change} positions`;
              changeColor = 'text-emerald-500';
            } else if (change < 0) {
              changeText = `${change} positions`;
              changeColor = 'text-red-500';
            }

            return (
              <div className={cn(
                "px-3 py-2 rounded-lg shadow-lg text-xs",
                isDark ? "bg-zinc-900 text-white border border-zinc-800" : "bg-white text-zinc-900 border border-zinc-200"
              )}>
                <div className="font-bold mb-1">{link.driverName || link.source.name}</div>
                <div className="text-muted-foreground mb-2">{link.team || link.source.teamName}</div>
                <div className="space-y-1">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      {isQualiToGrid ? 'Qualifying:' : 'Grid:'}
                    </span>
                    <span className="font-mono font-medium">P{sourceNode?.position}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      {isQualiToGrid ? 'Grid:' : 'Race:'}
                    </span>
                    <span className="font-mono font-medium">P{targetNode?.position}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Change:</span>
                    <span className={cn("font-mono font-medium", changeColor)}>{changeText}</span>
                  </div>
                </div>
                {link.isDNF && link.status && (
                  <div className="mt-1 pt-1 border-t border-muted text-red-500 font-medium">
                    {link.status}
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
};

export default MuiSankeyChart;


import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, Timer, Flag, Zap, ArrowUpDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TEAM_COLORS } from '@/constants/f1Colors';
import { getPitStops, getRaceResults } from '@/services/f1Service';
import { cn } from '@/lib/utils';
import TeamLogo from '@/components/common/TeamLogo';

interface MuiPitStopTableProps {
  year: number;
  round: string;
}

interface PitStopRow {
  id: string;
  driver: string;
  team: string;
  lap: number;
  duration: number;
  timeOfDay: string;
}

type SortField = 'driver' | 'lap' | 'duration';
type SortDir = 'asc' | 'desc';

// Format pit stop duration
const formatDuration = (seconds: number): string => {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3).padStart(6, '0');
    return `${mins}:${secs}`;
  }
  return seconds.toFixed(3);
};

// Get team color
const getTeamColor = (team: string): string => {
  let normalizedTeam = team.toLowerCase();
  if (normalizedTeam === 'alphatauri') normalizedTeam = 'rb';
  if (normalizedTeam === 'alfa') normalizedTeam = 'sauber';
  return TEAM_COLORS[normalizedTeam] || '#666666';
};

const MuiPitStopTable: React.FC<MuiPitStopTableProps> = ({ year, round }) => {
  const [pitStopData, setPitStopData] = useState<PitStopRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [circuitName, setCircuitName] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('duration');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Fetch pit stop data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Get race results for driver info
        const resultsResponse = await getRaceResults(year, round);
        if (!resultsResponse?.data?.Results) {
          throw new Error('No race results available');
        }

        setCircuitName(resultsResponse.data.Circuit?.circuitName || resultsResponse.data.raceName || '');

        // Create driver info map
        const driverInfo = new Map<string, { code: string; team: string }>(
          resultsResponse.data.Results.map((result: any) => [
            result.Driver.driverId,
            {
              code: result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase(),
              team: result.Constructor?.constructorId || 'unknown',
            },
          ])
        );

        // Get pit stop data
        const pitStopsResponse = await getPitStops(year, round);
        if (!pitStopsResponse?.data?.Races?.[0]?.PitStops) {
          throw new Error('No pit stop data available');
        }

        const pitStops = pitStopsResponse.data.Races[0].PitStops;
        const processedData: PitStopRow[] = pitStops.map((stop: any, index: number) => {
          const driver = driverInfo.get(stop.driverId);
          return {
            id: `${stop.driverId}-${stop.lap}-${index}`,
            driver: driver?.code || stop.driverId.substring(0, 3).toUpperCase(),
            team: driver?.team || 'unknown',
            lap: parseInt(stop.lap),
            duration: parseFloat(stop.duration),
            timeOfDay: stop.time,
          };
        });

        setPitStopData(processedData);
      } catch (err: any) {
        console.error('Error fetching pit stop data:', err);
        setError(err.message || 'Failed to load pit stop data');
      } finally {
        setIsLoading(false);
      }
    };

    if (year && round) {
      fetchData();
    }
  }, [year, round]);

  // Calculate statistics for the chart
  const chartData = useMemo(() => {
    if (pitStopData.length === 0) return [];

    // Get fastest stop per driver
    const driverBestStops = new Map<string, { duration: number; team: string }>();
    pitStopData.forEach(stop => {
      const existing = driverBestStops.get(stop.driver);
      if (!existing || stop.duration < existing.duration) {
        driverBestStops.set(stop.driver, { duration: stop.duration, team: stop.team });
      }
    });

    // Sort by fastest time and take top 10
    const sorted = Array.from(driverBestStops.entries())
      .sort((a, b) => a[1].duration - b[1].duration)
      .slice(0, 10);

    const minTime = sorted[0]?.[1].duration || 0;
    const maxTime = sorted[sorted.length - 1]?.[1].duration || 0;
    const range = maxTime - minTime;

    return sorted.map(([driver, data], index) => ({
      driver,
      duration: data.duration,
      team: data.team,
      color: getTeamColor(data.team),
      percentage: range > 0 ? ((data.duration - minTime) / range) * 100 : 100,
      rank: index + 1,
    }));
  }, [pitStopData]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'driver' ? 'asc' : 'asc');
    }
  };

  const sortedRows = useMemo(() => {
    const rows = [...pitStopData];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'driver') cmp = a.driver.localeCompare(b.driver);
      else cmp = a[sortField] - b[sortField];
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [pitStopData, sortField, sortDir]);

  const fastestStop = useMemo(
    () => (pitStopData.length ? Math.min(...pitStopData.map(d => d.duration)) : 0),
    [pitStopData],
  );
  const maxDuration = useMemo(
    () => (pitStopData.length ? Math.max(...pitStopData.map(d => d.duration)) : 0),
    [pitStopData],
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
        <p className="text-sm text-muted-foreground">Loading pit stops...</p>
      </div>
    );
  }

  // Error state
  if (error || pitStopData.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="font-medium mb-1">No pit stop data available</p>
        <p className="text-sm text-muted-foreground">{error || 'Try selecting a different race'}</p>
      </div>
    );
  }

  const SortHeader: React.FC<{ field: SortField; children: React.ReactNode; className?: string }> = ({
    field,
    children,
    className,
  }) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className={cn('inline-flex items-center gap-1 hover:text-foreground transition-colors', className)}
    >
      {children}
      <ArrowUpDown className={cn('h-3 w-3', sortField === field ? 'text-primary' : 'opacity-40')} />
    </button>
  );

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{pitStopData.length} pit stops</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <Flag className="h-3 w-3 mr-1" />
            {circuitName}
          </Badge>
          <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 text-xs">
            <Zap className="h-3 w-3 mr-0.5" fill="currentColor" />
            {formatDuration(fastestStop)}
          </Badge>
        </div>
      </div>

      {/* Custom Bar Chart - Top 10 Fastest Stops */}
      <div className="rounded-lg p-3 bg-muted/30 border border-border">
        <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">Top 10 Fastest Pit Stops</p>
        <div className="space-y-1">
          {chartData.map((item, i) => (
            <div key={item.driver} className="flex items-center gap-2 text-[10px]">
              {/* Rank */}
              <span className={cn(
                "w-4 text-right font-mono",
                i === 0 ? "text-purple-500 font-bold" : "text-muted-foreground"
              )}>
                {item.rank}
              </span>
              {/* Driver code */}
              <div className="flex items-center gap-1 w-10">
                <div
                  className="w-1 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-bold">{item.driver}</span>
              </div>
              {/* Bar */}
              <div className="flex-1 h-3 bg-muted/30 rounded overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded transition-all",
                    i === 0 ? "bg-purple-500" : ""
                  )}
                  style={{
                    width: `${100 - item.percentage * 0.5}%`,
                    backgroundColor: i === 0 ? undefined : item.color,
                    opacity: i === 0 ? 1 : 0.8
                  }}
                />
              </div>
              {/* Time */}
              <span className={cn(
                "font-mono w-14 text-right",
                i === 0 ? "text-purple-500 font-bold" : "text-muted-foreground"
              )}>
                {formatDuration(item.duration)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pit stop table */}
      <div className="flex-1 min-h-[300px] overflow-auto rounded-lg border border-border">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur">
            <TableRow>
              <TableHead className="text-xs"><SortHeader field="driver">Driver</SortHeader></TableHead>
              <TableHead className="text-xs">Team</TableHead>
              <TableHead className="text-xs text-center"><SortHeader field="lap" className="justify-center">Lap</SortHeader></TableHead>
              <TableHead className="text-xs text-right"><SortHeader field="duration" className="justify-end">Duration</SortHeader></TableHead>
              <TableHead className="text-xs">Time</TableHead>
              <TableHead className="text-xs w-[28%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map(row => {
              const isRecord = row.duration === fastestStop;
              const barPct = maxDuration > 0 ? (row.duration / maxDuration) * 100 : 0;
              return (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  <TableCell className="py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 rounded-full" style={{ backgroundColor: getTeamColor(row.team) }} />
                      <span className="font-bold text-xs">{row.driver}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <div className="flex items-center gap-2">
                      <TeamLogo constructorId={row.team} size="sm" />
                      <span className="text-xs text-muted-foreground capitalize">{row.team.replace(/_/g, ' ')}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5 text-center">
                    <Badge variant="outline" className="text-[10px] px-1.5">L{row.lap}</Badge>
                  </TableCell>
                  <TableCell className="py-1.5 text-right">
                    <span className={cn("font-mono text-xs inline-flex items-center justify-end gap-1", isRecord && "text-purple-500 font-bold")}>
                      {formatDuration(row.duration)}
                      {isRecord && <Zap className="h-3 w-3 shrink-0" fill="currentColor" />}
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <span className="font-mono text-xs text-muted-foreground">{row.timeOfDay}</span>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", isRecord ? "bg-purple-500" : "")}
                        style={{ width: `${barPct}%`, backgroundColor: isRecord ? undefined : getTeamColor(row.team) }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default MuiPitStopTable;

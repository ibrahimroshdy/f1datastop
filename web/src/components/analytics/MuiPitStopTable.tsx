import React, { useState, useEffect, useMemo } from 'react';
import { Timer, Flag, Zap, ArrowUpDown } from 'lucide-react';
import { getTeamHexColor } from '@/components/standings/standingsUtils';
import { getPitStops, getRaceResults } from '@/services/f1Service';
import { cn } from '@/lib/utils';
import TeamLogo from '@/components/common/TeamLogo';
import { F1Badge, F1Skeleton, F1EmptyState, F1ErrorState, PitIcon } from '@/components/f1';
import { ViewSwitcher } from '@/components/ui/view-switcher';

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
      color: getTeamHexColor(data.team),
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
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border py-2">
            <F1Skeleton className="h-3 w-1 shrink-0" />
            <F1Skeleton className="h-4 w-10 shrink-0" />
            <F1Skeleton className="h-4 w-8 shrink-0" />
            <F1Skeleton className="h-4 flex-1" />
            <F1Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  // Error / empty state
  if (error) {
    return <F1ErrorState type="server" variant="inline" className="py-8" message={error} />;
  }
  if (pitStopData.length === 0) {
    return <F1EmptyState type="no-data" className="py-10" description="Try selecting a different race" />;
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
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PitIcon icon={Timer} size="sm" className="text-primary" />
          <span className="text-sm font-medium">
            <span className="timing">{pitStopData.length}</span> pit stops
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {circuitName && (
            <F1Badge className="gap-1 border border-border bg-muted/40 text-xs font-normal text-muted-foreground">
              <Flag className="h-3 w-3" />
              {circuitName}
            </F1Badge>
          )}
          <F1Badge variant="time" className="text-fastest-lap">
            <Zap className="mr-0.5 h-3 w-3" fill="currentColor" />
            {formatDuration(fastestStop)}
          </F1Badge>
        </div>
      </div>

      {/* Top 10 fastest stops — leaderboard */}
      <div className="rounded-lg border border-border bg-card/40 p-3">
        <p className="instrument-label mb-2">
          Top 10 Fastest Pit Stops
        </p>
        <div className="flex flex-col">
          {chartData.map((item, i) => (
            <div
              key={item.driver}
              className="flex items-center gap-2 border-b border-border py-1.5 text-xs last:border-b-0"
            >
              {/* Rank */}
              <span
                className={cn(
                  'w-4 text-right timing',
                  i === 0 ? 'font-bold text-status-completed' : 'text-muted-foreground',
                )}
              >
                {item.rank}
              </span>
              {/* Driver code */}
              <div className="flex w-10 items-center gap-1">
                <span className="h-3 w-1 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="font-bold">{item.driver}</span>
              </div>
              {/* Bar */}
              <div className="h-3 flex-1 overflow-hidden rounded bg-muted/40">
                <div
                  className="h-full rounded transition-all"
                  style={{
                    width: `${100 - item.percentage * 0.5}%`,
                    backgroundColor: i === 0 ? 'hsl(var(--status-completed))' : item.color,
                    opacity: i === 0 ? 1 : 0.8,
                  }}
                />
              </div>
              {/* Time */}
              <span
                className={cn(
                  'timing w-14 text-right',
                  i === 0 ? 'font-bold text-status-completed' : 'text-muted-foreground',
                )}
              >
                {formatDuration(item.duration)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Mobile: sort control (desktop sorts via table headers) ─────────── */}
      <div className="mb-2 flex items-center gap-2 md:hidden">
        <span className="instrument-label shrink-0 text-muted-foreground">Sort</span>
        <ViewSwitcher
          stack
          compact
          cols={3}
          className="flex-1"
          value={sortField}
          onChange={(f) => toggleSort(f as SortField)}
          items={[
            { key: "driver", label: `Driver${sortField === "driver" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}` },
            { key: "lap", label: `Lap${sortField === "lap" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}` },
            { key: "duration", label: `Time${sortField === "duration" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}` },
          ]}
        />
      </div>

      {/* ── Mobile: compact stacked cards (no horizontal scroll) ───────────── */}
      <div className="flex flex-col gap-2 md:hidden">
        {sortedRows.map(row => {
          const isRecord = row.duration === fastestStop;
          const teamColor = getTeamHexColor(row.team);
          return (
            <div
              key={row.id}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-card/40 p-2.5"
            >
              <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: teamColor }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{row.driver}</span>
                  <span className="break-words text-xs capitalize text-muted-foreground">
                    {row.team.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="timing">Lap {row.lap}</span>
                  <span className="opacity-40">•</span>
                  <span className="timing">{row.timeOfDay}</span>
                </div>
              </div>
              <span
                className={cn(
                  'timing inline-flex shrink-0 items-center gap-1 text-sm',
                  isRecord && 'font-bold text-status-completed',
                )}
              >
                {formatDuration(row.duration)}
                {isRecord && <Zap className="h-3 w-3 shrink-0" fill="currentColor" />}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Desktop: dense timing table ────────────────────────────────────── */}
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="instrument-label px-3 py-2 text-left">
                <SortHeader field="driver">Driver</SortHeader>
              </th>
              <th className="instrument-label px-3 py-2 text-left">
                Team
              </th>
              <th className="instrument-label px-3 py-2 text-center">
                <SortHeader field="lap" className="justify-center">Lap</SortHeader>
              </th>
              <th className="instrument-label px-3 py-2 text-right">
                <SortHeader field="duration" className="justify-end">Duration</SortHeader>
              </th>
              <th className="instrument-label px-3 py-2 text-left">
                Time
              </th>
              <th className="w-[28%] px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(row => {
              const isRecord = row.duration === fastestStop;
              const teamColor = getTeamHexColor(row.team);
              const barPct = maxDuration > 0 ? (row.duration / maxDuration) * 100 : 0;
              return (
                <tr key={row.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-1 rounded-full" style={{ backgroundColor: teamColor }} />
                      <span className="text-xs font-bold">{row.driver}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <TeamLogo constructorId={row.team} size="sm" />
                      <span className="text-xs capitalize text-muted-foreground">
                        {row.team.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <span className="timing text-xs text-muted-foreground">L{row.lap}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <span
                      className={cn(
                        'timing inline-flex items-center justify-end gap-1 text-xs',
                        isRecord && 'font-bold text-status-completed',
                      )}
                    >
                      {formatDuration(row.duration)}
                      {isRecord && <Zap className="h-3 w-3 shrink-0" fill="currentColor" />}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="timing text-xs text-muted-foreground">{row.timeOfDay}</span>
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${barPct}%`,
                          backgroundColor: isRecord ? 'hsl(var(--status-completed))' : teamColor,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MuiPitStopTable;

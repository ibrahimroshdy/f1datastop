import { durationStats, parseDuration } from "@/lib/f1/pitStops";
import React, { useState, useEffect, useMemo } from 'react';
import { Timer, Flag, Zap, ArrowUpDown } from 'lucide-react';
import { getTeamHexColor } from '@/components/standings/standingsUtils';
import { getPitStops, getRaceResults } from '@/services/f1Service';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { F1Badge, F1Card, F1Skeleton, F1EmptyState, F1ErrorState, PitIcon, TeamName } from '@/components/f1';
import { driverHref, teamHref } from '@/lib/links';
import { useThemeVariant } from '@/hooks/useThemeVariant';
import { ViewSwitcher } from '@/components/ui/view-switcher';

interface MuiPitStopTableProps {
  year: number;
  round: string;
}

interface PitStopRow {
  id: string;
  /** Surname, shown as a link to the driver's page. */
  driver: string;
  driverId: string;
  /** constructorId (colour, emblem and link). */
  team: string;
  teamName: string;
  lap: number;
  /** null when the source has no duration (e.g. the car retired in the pit lane) */
  duration: number | null;
  timeOfDay: string;
}

type SortField = 'driver' | 'lap' | 'duration';
type SortDir = 'asc' | 'desc';

interface ErgastDriver {
  driverId: string;
  code: string;
  familyName: string;
  givenName?: string;
}
interface ErgastConstructor {
  name: string;
  constructorId?: string;
}
interface ErgastResult {
  number: string;
  position: string;
  laps: string;
  Driver: ErgastDriver;
  Constructor?: ErgastConstructor;
}

/** A single Ergast pit stop row (untyped at the service boundary). */
interface ErgastPitStop {
  driverId: string;
  lap: string;
  duration: string;
  stop: string;
  time: string;
}

// Format pit stop duration
const formatDuration = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3).padStart(6, '0');
    return `${mins}:${secs}`;
  }
  return seconds.toFixed(3);
};

const MuiPitStopTable: React.FC<MuiPitStopTableProps> = ({ year, round }) => {
  const { cardVariant, glassVariant } = useThemeVariant();
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
        const driverInfo = new Map<string, { name: string; team: string; teamName: string }>(
          resultsResponse.data.Results.map((result: ErgastResult) => [
            result.Driver.driverId,
            {
              name: result.Driver.familyName || result.Driver.code,
              team: result.Constructor?.constructorId || result.Constructor?.name || 'unknown',
              teamName: result.Constructor?.name || result.Constructor?.constructorId || 'Unknown',
            },
          ])
        );

        // Get pit stop data
        const pitStopsResponse = await getPitStops(year, round);
        if (!pitStopsResponse?.data?.Races?.[0]?.PitStops) {
          throw new Error('No pit stop data available');
        }

        const pitStops = pitStopsResponse.data.Races[0].PitStops;
        const processedData: PitStopRow[] = pitStops.map((stop: ErgastPitStop, index: number) => {
          const driver = driverInfo.get(stop.driverId);
          return {
            id: `${stop.driverId}-${stop.lap}-${index}`,
            driver: driver?.name || stop.driverId,
            driverId: stop.driverId,
            team: driver?.team || 'unknown',
            teamName: driver?.teamName || 'Unknown',
            lap: parseInt(stop.lap),
            duration: parseDuration(stop.duration),
            timeOfDay: stop.time,
          };
        });

        setPitStopData(processedData);
      } catch (err) {
        console.error('Error fetching pit stop data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load pit stop data');
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
    const driverBestStops = new Map<string, { duration: number; team: string; driverId: string }>();
    pitStopData.forEach(stop => {
      if (stop.duration === null) return;
      const existing = driverBestStops.get(stop.driver);
      if (!existing || stop.duration! < existing.duration) {
        driverBestStops.set(stop.driver, { duration: stop.duration!, team: stop.team, driverId: stop.driverId });
      }
    });

    // Sort by fastest time and take top 10
    const sorted = Array.from(driverBestStops.entries())
      .sort((a, b) => a[1].duration - b[1].duration)
      .slice(0, 10);

    const minTime = sorted[0]?.[1].duration || 0;

    return sorted.map(([driver, data], index) => ({
      driver,
      driverId: data.driverId,
      duration: data.duration,
      team: data.team,
      color: getTeamHexColor(data.team),
      /** Seconds slower than the quickest stop, said in words instead of a bar. */
      slower: data.duration - minTime,
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
      else if (sortField === 'lap') cmp = a.lap - b.lap;
      else cmp = (a.duration ?? Infinity) - (b.duration ?? Infinity); // no duration sorts last
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [pitStopData, sortField, sortDir]);

  const { min: fastestStop } = useMemo(
    () => durationStats(pitStopData.map((d) => d.duration)),
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
      <F1Card variant={cardVariant} glassVariant={glassVariant} size="sm" className="rounded-lg p-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">
          Ten quickest stops
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
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="h-3 w-1 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <Link to={driverHref(item.driverId)} viewTransition className="font-semibold text-heading hover:underline">
                  {item.driver}
                </Link>
              </span>
              <span className="text-muted-foreground">
                {i === 0 ? 'Quickest' : `${item.slower.toFixed(3)} s slower`}
              </span>
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
      </F1Card>

      {/* ── Mobile: sort control (desktop sorts via table headers) ─────────── */}
      <div className="mb-2 flex items-center gap-2 md:hidden">
        <span className="text-xs font-semibold shrink-0 text-muted-foreground">Sort</span>
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
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Link to={driverHref(row.driverId)} viewTransition className="font-semibold text-heading hover:underline">
                    {row.driver}
                  </Link>
                  <TeamName constructorId={row.team} name={row.teamName} to={teamHref(row.team)} size={13} className="text-xs text-muted-foreground" />
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  <span className="timing">Lap {row.lap}</span>, <span className="timing">{row.timeOfDay}</span>
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
              <th className="text-xs font-semibold text-muted-foreground px-3 py-2 text-left">
                <SortHeader field="driver">Driver</SortHeader>
              </th>
              <th className="text-xs font-semibold text-muted-foreground px-3 py-2 text-left">
                Team
              </th>
              <th className="text-xs font-semibold text-muted-foreground px-3 py-2 text-center">
                <SortHeader field="lap" className="justify-center">Lap</SortHeader>
              </th>
              <th className="text-xs font-semibold text-muted-foreground px-3 py-2 text-right">
                <SortHeader field="duration" className="justify-end">Duration</SortHeader>
              </th>
              <th className="text-xs font-semibold text-muted-foreground px-3 py-2 text-left">
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(row => {
              const isRecord = row.duration === fastestStop;
              const teamColor = getTeamHexColor(row.team);
              return (
                <tr key={row.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-1 rounded-full" style={{ backgroundColor: teamColor }} />
                      <Link to={driverHref(row.driverId)} viewTransition className="text-sm font-semibold text-heading hover:underline">
                        {row.driver}
                      </Link>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <TeamName constructorId={row.team} name={row.teamName} to={teamHref(row.team)} size={14} className="text-sm text-muted-foreground" />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <span className="timing text-xs text-muted-foreground">{row.lap}</span>
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

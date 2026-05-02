import React, { useState, useEffect, useMemo } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, Timer, Flag, Zap } from 'lucide-react';
import { TEAM_COLORS } from '@/constants/f1Colors';
import { getPitStops, getRaceResults } from '@/services/f1Service';
import { useTheme } from '@/context/ThemeContext';
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
  const { baseTheme } = useTheme();
  const isDark = baseTheme === 'dark';

  // Create MUI theme
  const muiTheme = useMemo(() => createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      primary: { main: '#e10600' },
      background: {
        default: isDark ? 'hsl(222 47% 8%)' : '#fff',
        paper: isDark ? 'hsl(222 47% 11%)' : '#fff',
      },
    },
    typography: {
      fontFamily: 'inherit',
    },
    components: ({
      MuiDataGrid: {
        styleOverrides: {
          root: {
            border: 'none',
            '& .MuiDataGrid-cell': {
              borderColor: isDark ? 'hsl(222 20% 18%)' : 'hsl(214.3 31.8% 91.4%)',
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: isDark ? 'hsl(222 47% 11%)' : 'hsl(210 40% 96.1%)',
              borderColor: isDark ? 'hsl(222 20% 18%)' : 'hsl(214.3 31.8% 91.4%)',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: isDark ? 'hsl(222 47% 15%)' : 'hsl(210 40% 96.1%)',
            },
          },
        },
      },
    },
  }), [isDark]);

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

  // DataGrid columns
  const columns: GridColDef[] = [
    {
      field: 'driver',
      headerName: 'Driver',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <div className="flex items-center gap-2">
          <div 
            className="w-1 h-4 rounded-full" 
            style={{ backgroundColor: getTeamColor(params.row.team) }} 
          />
          <span className="font-bold text-xs">{params.value}</span>
        </div>
      ),
    },
    {
      field: 'team',
      headerName: 'Team',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const teamValue = params.value || 'unknown';
        return (
          <div className="flex items-center gap-2">
            <TeamLogo constructorId={teamValue} size="sm" />
            <span className="text-xs text-muted-foreground capitalize">
              {teamValue.replace(/_/g, ' ')}
            </span>
          </div>
        );
      },
    },
    {
      field: 'lap',
      headerName: 'Lap',
      width: 70,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Badge variant="outline" className="text-[10px] px-1.5">
          L{params.value}
        </Badge>
      ),
    },
    {
      field: 'duration',
      headerName: 'Duration',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => {
        const isRecord = params.value === Math.min(...pitStopData.map(d => d.duration));
        return (
          <span className={cn(
            "font-mono text-xs",
            isRecord && "text-purple-500 font-bold"
          )}>
            {formatDuration(params.value)}
            {isRecord && ' ⚡'}
          </span>
        );
      },
    },
    {
      field: 'timeOfDay',
      headerName: 'Time',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <span className="font-mono text-xs text-muted-foreground">{params.value}</span>
      ),
    },
    {
      field: 'bar',
      headerName: '',
      flex: 1,
      minWidth: 100,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => {
        const maxDuration = Math.max(...pitStopData.map(d => d.duration));
        const percentage = (params.row.duration / maxDuration) * 100;
        const isRecord = params.row.duration === Math.min(...pitStopData.map(d => d.duration));
        return (
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all",
                isRecord ? "bg-purple-500" : ""
              )}
              style={{ 
                width: `${percentage}%`,
                backgroundColor: isRecord ? undefined : getTeamColor(params.row.team)
              }}
            />
          </div>
        );
      },
    },
  ];

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

  const fastestStop = Math.min(...pitStopData.map(d => d.duration));

  return (
    <ThemeProvider theme={muiTheme}>
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
        <div className={cn(
          "rounded-lg p-3",
          isDark ? "bg-zinc-900/30 border border-zinc-800/50" : "bg-zinc-50/50 border border-zinc-200"
        )}>
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

        {/* DataGrid */}
        <div className="flex-1 min-h-[300px]">
          <DataGrid
            rows={pitStopData}
            columns={columns}
            initialState={{
              sorting: { sortModel: [{ field: 'duration', sort: 'asc' }] },
              pagination: { paginationModel: { pageSize: 25 } },
            }}
            pageSizeOptions={[10, 25, 50]}
            disableRowSelectionOnClick
            density="compact"
            sx={{
              fontSize: 12,
              '& .MuiDataGrid-cell': {
                py: 0.5,
              },
            }}
          />
        </div>
      </div>
    </ThemeProvider>
  );
};

export default MuiPitStopTable;

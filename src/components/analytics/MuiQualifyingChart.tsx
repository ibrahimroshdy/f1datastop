import React, { useState, useEffect, useMemo } from "react";
import { BarChart } from '@mui/x-charts/BarChart';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Loader2, Flag, LayoutGrid, List } from "lucide-react";
import { useQualifyingData } from "@/hooks/useQualifyingData";
import MuiThemeWrapper from "./MuiThemeWrapper";
import { useTheme } from "@/context/ThemeContext";
import { F1ChartEmpty } from "@/components/charts/F1ChartEmpty";
import { F1ErrorState } from "@/components/f1/F1ErrorState";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface MuiQualifyingChartProps {
  year: number;
  round: string;
}

type SessionType = 'Q1' | 'Q2' | 'Q3' | 'ALL';

const MuiQualifyingChart: React.FC<MuiQualifyingChartProps> = ({ year, round }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionType>('Q3');
  const { baseTheme, isGlass } = useTheme();
  const isDark = baseTheme === 'dark';

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const {
    chartData,
    availableDrivers,
    selectedDrivers,
    isLoading,
    isError,
    fastestLapTime,
    handleDriverToggle,
  } = useQualifyingData(year, round);
  const loadingProgress: number = isLoading ? 50 : 100;
  const fastestTime = fastestLapTime?.time;

  // Get data for a specific session
  const getSessionData = (session: 'Q1' | 'Q2' | 'Q3') => {
    const sessionKey = session === 'Q1' ? 'q1Time' :
                       session === 'Q2' ? 'q2Time' : 'q3Time';

    const driversWithTimes = availableDrivers
      .filter(d => d[sessionKey] !== undefined && d[sessionKey] !== null)
      .sort((a, b) => (a[sessionKey] || 999) - (b[sessionKey] || 999));

    const labels = driversWithTimes.map(d => d.code);
    const rawTimes = driversWithTimes.map(d => d[sessionKey] as number);
    // Sanitize to finite numbers to avoid NaN in SVG/animation
    const times = rawTimes.map(t => (typeof t === 'number' && Number.isFinite(t) ? t : 0));
    const colors = driversWithTimes.map(d => TEAM_COLORS[d.team] || DRIVER_COLORS[d.code] || "#666");
    const fastestSessionTime = times.length > 0 ? Math.min(...times) : 0;
    const gaps = times.map(t => {
      const gap = t - fastestSessionTime;
      return Number.isFinite(gap) ? gap : 0;
    });

    return { labels, times, gaps, colors, fastestSessionTime, driversWithTimes };
  };

  // Transform data for MUI X Charts - horizontal bar chart
  const muiChartData = useMemo(() => {
    if (!availableDrivers.length) return { labels: [], series: [], colors: [], fastestSessionTime: 0, driversWithTimes: [] };

    if (selectedSession === 'ALL') {
      return {
        q1: getSessionData('Q1'),
        q2: getSessionData('Q2'),
        q3: getSessionData('Q3'),
      };
    }

    return getSessionData(selectedSession);
  }, [availableDrivers, selectedSession]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center justify-center space-y-3 max-w-xs">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <div className="w-full space-y-2 text-center">
            <span className="text-sm text-muted-foreground">Loading qualifying...</span>
            <Progress value={loadingProgress} className="h-1.5 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (isError && availableDrivers.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <F1ErrorState
          type="rate-limit"
          title="Unable to Load Qualifying Data"
          message="The F1 API rate limit was reached. Please wait a moment and try again."
          variant="card"
        />
      </div>
    );
  }

  // Handle no data state
  if (availableDrivers.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <F1ChartEmpty
          chartType="bar"
          title="No Qualifying Data"
          message="Qualifying data is not available for this race."
          icon={<Flag className="h-12 w-12 text-muted-foreground" />}
        />
      </div>
    );
  }

  // Render a single session chart
  const renderSessionChart = (sessionData: ReturnType<typeof getSessionData>, session: string, compact: boolean = false) => {
    const chartHeight = compact 
      ? Math.max(180, sessionData.labels.length * 20)
      : Math.max(300, sessionData.labels.length * 28);

    if (sessionData.labels.length === 0) {
      return (
        <div className={cn(
          "flex items-center justify-center text-muted-foreground text-sm",
          compact ? "h-[180px]" : "h-[300px]"
        )}>
          No data for {session}
        </div>
      );
    }

    return (
      <BarChart
        layout="horizontal"
        yAxis={[{ 
          data: sessionData.labels,
          scaleType: 'band',
          tickLabelStyle: {
            fontSize: compact ? 9 : (isMobile ? 10 : 11),
            fill: isDark ? '#a1a1aa' : '#666',
          },
        }]}
        xAxis={[{
          label: compact ? '' : 'Gap to Pole (s)',
          min: 0,
          tickLabelStyle: {
            fontSize: compact ? 8 : (isMobile ? 10 : 11),
            fill: isDark ? '#a1a1aa' : '#666',
          },
        }]}
        series={[{
          data: sessionData.gaps,
          color: '#e10600',
          valueFormatter: (value) => value !== null ? `+${value.toFixed(3)}s` : 'N/A',
        }]}
        height={chartHeight}
        margin={{ 
          top: compact ? 5 : 10, 
          right: compact ? 60 : 80, 
          bottom: compact ? 20 : 35, 
          left: compact ? 35 : (isMobile ? 45 : 50)
        }}
        barLabel={compact ? undefined : (item) => {
          const idx = item.dataIndex;
          if (idx === undefined || idx < 0) return '';
          return formatTime(sessionData.times[idx]);
        }}
        sx={{
          '.MuiBarElement-root': {
            rx: 2,
            ry: 2,
          },
          '.MuiChartsAxis-tickLabel': {
            fill: isDark ? '#a1a1aa' : '#666',
          },
          '.MuiChartsAxis-label': {
            fill: isDark ? '#a1a1aa' : '#666',
            fontSize: 11,
          },
          '.MuiChartsGrid-line': {
            stroke: isDark ? '#333' : '#e5e5e5',
            strokeDasharray: '3 3',
          },
          '.MuiBarLabel-root': {
            fill: isDark ? '#fff' : '#333',
            fontSize: compact ? 8 : (isMobile ? 9 : 10),
            fontFamily: 'monospace',
          },
        }}
        grid={{ vertical: true, horizontal: false }}
        slotProps={({
          legend: {
            hidden: true,
          },
        } as any)}
        slots={{
          bar: (props) => {
            const idx = props.ownerState?.dataIndex;
            const color = idx !== undefined && idx >= 0 ? sessionData.colors[idx] : '#e10600';
            // Sanitize rect geometry so SVG never receives NaN (avoids "Expected length, NaN" and animation NaN)
            const x = Number(props.x);
            const y = Number(props.y);
            const w = Number(props.width);
            const h = Number(props.height);
            const { transform, ...restProps } = props as unknown as { transform?: string; [k: string]: unknown };
            const safeTransform =
              transform && typeof transform === 'string' && !transform.includes('NaN')
                ? transform
                : undefined;
            return (
              <rect
                {...restProps}
                x={Number.isFinite(x) ? x : 0}
                y={Number.isFinite(y) ? y : 0}
                width={Number.isFinite(w) && w >= 0 ? w : 0}
                height={Number.isFinite(h) && h >= 0 ? h : 0}
                {...(safeTransform ? { transform: safeTransform } : {})}
                fill={color}
                rx={2}
                ry={2}
              />
            );
          },
        }}
      />
    );
  };

  // Render "ALL" view with three sessions side by side
  const renderAllSessions = () => {
    const q1Data = getSessionData('Q1');
    const q2Data = getSessionData('Q2');
    const q3Data = getSessionData('Q3');

    return (
      <div className="flex flex-col lg:flex-row gap-2 h-full">
        {/* Q1 Section */}
        <div className={cn(
          "flex-1 flex flex-col rounded-lg p-3",
          isDark ? "bg-zinc-900/50 border border-zinc-800" : "bg-zinc-50 border border-zinc-200"
        )}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-500 border-amber-500/30">
                Q1
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {q1Data.labels.length} drivers
              </span>
            </div>
            {q1Data.fastestSessionTime > 0 && (
              <span className="font-mono text-[10px] text-amber-500">
                {formatTime(q1Data.fastestSessionTime)}
              </span>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {renderSessionChart(q1Data, 'Q1', true)}
          </div>
        </div>

        {/* Vertical Separator */}
        <Separator orientation="vertical" className="hidden lg:block h-auto" />
        <Separator orientation="horizontal" className="lg:hidden" />

        {/* Q2 Section */}
        <div className={cn(
          "flex-1 flex flex-col rounded-lg p-3",
          isDark ? "bg-zinc-900/50 border border-zinc-800" : "bg-zinc-50 border border-zinc-200"
        )}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-500 border-blue-500/30">
                Q2
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {q2Data.labels.length} drivers
              </span>
            </div>
            {q2Data.fastestSessionTime > 0 && (
              <span className="font-mono text-[10px] text-blue-500">
                {formatTime(q2Data.fastestSessionTime)}
              </span>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {renderSessionChart(q2Data, 'Q2', true)}
          </div>
        </div>

        {/* Vertical Separator */}
        <Separator orientation="vertical" className="hidden lg:block h-auto" />
        <Separator orientation="horizontal" className="lg:hidden" />

        {/* Q3 Section */}
        <div className={cn(
          "flex-1 flex flex-col rounded-lg p-3",
          isDark ? "bg-zinc-900/50 border border-zinc-800" : "bg-zinc-50 border border-zinc-200"
        )}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-500 border-purple-500/30">
                Q3
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {q3Data.labels.length} drivers
              </span>
            </div>
            {q3Data.fastestSessionTime > 0 && (
              <span className="font-mono text-[10px] text-purple-500">
                {formatTime(q3Data.fastestSessionTime)}
              </span>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {renderSessionChart(q3Data, 'Q3', true)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <MuiThemeWrapper>
      <div className="h-full flex flex-col">
        {/* Session selector */}
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          {/* Individual session badges */}
          {(['Q1', 'Q2', 'Q3'] as const).map((session) => (
            <Badge
              key={session}
              variant={selectedSession === session ? "default" : "outline"}
              className={cn(
                "cursor-pointer px-3 py-1 text-xs transition-all",
                selectedSession === session 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-accent"
              )}
              onClick={() => setSelectedSession(session)}
            >
              {session}
            </Badge>
          ))}
          
          {/* View All Button */}
          <Button
            variant={selectedSession === 'ALL' ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-6 px-2 text-xs gap-1",
              selectedSession === 'ALL' && "bg-primary text-primary-foreground"
            )}
            onClick={() => setSelectedSession('ALL')}
          >
            <LayoutGrid size={12} />
            All Sectors
          </Button>

          {/* Pole time (only show for single session) */}
          {selectedSession !== 'ALL' && 'fastestSessionTime' in muiChartData && muiChartData.fastestSessionTime > 0 && (
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span>Pole:</span>
              <span className="font-mono text-primary font-medium">
                {formatTime(muiChartData.fastestSessionTime)}
              </span>
            </div>
          )}
        </div>

        {/* Chart content */}
        <div className="flex-1 min-h-0 overflow-auto">
          {selectedSession === 'ALL' ? (
            renderAllSessions()
          ) : (
            'labels' in muiChartData && muiChartData.labels.length > 0 && (
              renderSessionChart(muiChartData as ReturnType<typeof getSessionData>, selectedSession)
            )
          )}
        </div>
      </div>
    </MuiThemeWrapper>
  );
};

export default MuiQualifyingChart;

import React, { useState, useEffect, useMemo } from "react";
import { BarChart } from '@mui/x-charts/BarChart';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Loader2, Flag } from "lucide-react";
import { useQualifyingData } from "@/hooks/useQualifyingData";
import MuiThemeWrapper from "./MuiThemeWrapper";
import { useTheme } from "@/context/ThemeContext";
import { F1ChartEmpty } from "@/components/charts/F1ChartEmpty";
import { F1ErrorState } from "@/components/f1/F1ErrorState";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MuiQualifyingChartProps {
  year: number;
  round: string;
}

const MuiQualifyingChart: React.FC<MuiQualifyingChartProps> = ({ year, round }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [selectedSession, setSelectedSession] = useState<'Q1' | 'Q2' | 'Q3'>('Q3');
  const { baseTheme, isGlass } = useTheme();

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
    loadingProgress,
    fastestTime,
    handleDriverToggle,
  } = useQualifyingData(year, round);

  // Transform data for MUI X Charts - horizontal bar chart
  const muiChartData = useMemo(() => {
    if (!availableDrivers.length) return { labels: [], series: [] };

    // Get the session data key
    const sessionKey = selectedSession === 'Q1' ? 'q1Time' : 
                       selectedSession === 'Q2' ? 'q2Time' : 'q3Time';

    // Filter drivers who have times for this session and sort by time
    const driversWithTimes = availableDrivers
      .filter(d => d[sessionKey] !== undefined && d[sessionKey] !== null)
      .sort((a, b) => (a[sessionKey] || 999) - (b[sessionKey] || 999));

    const labels = driversWithTimes.map(d => d.code);
    const times = driversWithTimes.map(d => d[sessionKey] as number);
    const colors = driversWithTimes.map(d => TEAM_COLORS[d.team] || DRIVER_COLORS[d.code] || "#666");

    // Calculate gap to pole
    const fastestSessionTime = Math.min(...times);
    const gaps = times.map(t => t - fastestSessionTime);

    return { 
      labels, 
      times,
      gaps,
      colors,
      fastestSessionTime,
      driversWithTimes,
    };
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
      <div className="h-full flex flex-col items-center justify-center space-y-4 relative">
        <Skeleton className="h-full w-full opacity-30" />
        <div className="absolute flex flex-col items-center justify-center space-y-6 w-3/4 max-w-md p-6 rounded-lg bg-card border shadow-lg">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="w-full space-y-2">
            <Progress 
              value={loadingProgress} 
              className="h-2 w-full" 
            />
            <p className="text-sm text-muted-foreground text-center">
              Loading qualifying data...
            </p>
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

  return (
    <MuiThemeWrapper>
      <div className="h-full flex flex-col">
        {/* Session selector */}
        <div className="flex gap-2 mb-4">
          {(['Q1', 'Q2', 'Q3'] as const).map((session) => (
            <Badge
              key={session}
              variant={selectedSession === session ? "default" : "outline"}
              className={cn(
                "cursor-pointer px-4 py-1.5 text-sm",
                selectedSession === session 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-accent"
              )}
              onClick={() => setSelectedSession(session)}
            >
              {session}
            </Badge>
          ))}
          {muiChartData.fastestSessionTime && (
            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <span>Fastest:</span>
              <span className="font-mono text-primary font-medium">
                {formatTime(muiChartData.fastestSessionTime)}
              </span>
            </div>
          )}
        </div>

        <div className="flex-grow" style={{ minHeight: isMobile ? 400 : 500 }}>
          {muiChartData.labels.length > 0 && (
            <BarChart
              layout="horizontal"
              yAxis={[{ 
                data: muiChartData.labels,
                scaleType: 'band',
                tickLabelStyle: {
                  fontSize: isMobile ? 10 : 12,
                  fill: baseTheme === 'light' ? '#666' : '#a1a1aa',
                },
              }]}
              xAxis={[{
                label: 'Gap to Pole (seconds)',
                min: 0,
                tickLabelStyle: {
                  fontSize: isMobile ? 10 : 12,
                  fill: baseTheme === 'light' ? '#666' : '#a1a1aa',
                },
              }]}
              series={[{
                data: muiChartData.gaps,
                color: '#e10600',
                valueFormatter: (value) => value !== null ? `+${value.toFixed(3)}s` : 'N/A',
              }]}
              height={isMobile ? 400 : 500}
              margin={{ 
                top: 20, 
                right: 30, 
                bottom: 40, 
                left: isMobile ? 50 : 60 
              }}
              barLabel={(item) => {
                const idx = item.dataIndex;
                const driver = muiChartData.driversWithTimes[idx];
                if (!driver) return '';
                return formatTime(muiChartData.times[idx]);
              }}
              sx={{
                '.MuiBarElement-root': {
                  rx: 4,
                  ry: 4,
                },
                '.MuiChartsAxis-tickLabel': {
                  fill: baseTheme === 'light' ? '#666' : '#a1a1aa',
                },
                '.MuiChartsAxis-label': {
                  fill: baseTheme === 'light' ? '#666' : '#a1a1aa',
                  fontSize: 12,
                },
                '.MuiChartsGrid-line': {
                  stroke: baseTheme === 'light' ? '#e5e5e5' : '#333',
                  strokeDasharray: '3 3',
                },
                '.MuiBarLabel-root': {
                  fill: baseTheme === 'light' ? '#333' : '#fff',
                  fontSize: isMobile ? 9 : 11,
                  fontFamily: 'monospace',
                },
              }}
              grid={{ vertical: true, horizontal: false }}
              tooltip={{
                trigger: 'item',
              }}
              slots={{
                bar: (props) => {
                  const idx = props.ownerState.dataIndex;
                  const color = muiChartData.colors[idx] || '#e10600';
                  return (
                    <rect
                      {...props}
                      fill={color}
                      rx={4}
                      ry={4}
                    />
                  );
                },
              }}
            />
          )}
        </div>
      </div>
    </MuiThemeWrapper>
  );
};

export default MuiQualifyingChart;


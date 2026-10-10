import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { chartTheme, ScopeDefs, SCOPE_GLOW } from "@/lib/chartTheme";
import { useQualifyingData } from "@/hooks/useQualifyingData";
import { F1ChartContainer, F1EmptyState } from "@/components/f1";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface MuiQualifyingChartProps {
  year: number;
  round: string;
}

type SessionType = 'Q1' | 'Q2' | 'Q3' | 'ALL';

// Qualifying-phase encodings — progression of rounds via sanctioned position
// tokens (bronze → silver → gold), never raw palette hues. Legend swatch and
// any chart accent read from this single source so they can't drift.
const PHASE_TOKEN: Record<'Q1' | 'Q2' | 'Q3', string> = {
  Q1: 'hsl(var(--position-bronze))',
  Q2: 'hsl(var(--position-silver))',
  Q3: 'hsl(var(--position-gold))',
};

const MuiQualifyingChart: React.FC<MuiQualifyingChartProps> = ({ year, round }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionType>('Q3');

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const {
    availableDrivers,
    isLoading,
    isError,
  } = useQualifyingData(year, round);

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
    const colors = driversWithTimes.map(d => TEAM_COLORS[d.team] || DRIVER_COLORS[d.code] || TEAM_COLORS.default);
    const fastestSessionTime = times.length > 0 ? Math.min(...times) : 0;
    const gaps = times.map(t => {
      const gap = t - fastestSessionTime;
      return Number.isFinite(gap) ? gap : 0;
    });

    return { labels, times, gaps, colors, fastestSessionTime, driversWithTimes };
  };

  // Transform data for the bar chart (horizontal: drivers on Y, gap on X)
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

  // Loading / error / empty all routed through F1ChartContainer
  if (isLoading || (isError && availableDrivers.length === 0) || availableDrivers.length === 0) {
    return (
      <F1ChartContainer
        minHeight={300}
        useSkeleton
        isLoading={isLoading}
        error={isError && availableDrivers.length === 0 ? "F1 API rate limit reached. Please wait a moment and try again." : null}
        isEmpty={!isLoading && availableDrivers.length === 0}
        emptyTitle="No Qualifying Data"
        emptyDescription="Qualifying data is not available for this race."
      />
    );
  }

  // Custom tooltip mirroring the old hover (gap + absolute formatted time)
  const QualifyingTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload;
    if (!row) return null;
    return (
      <div className="rounded-lg border border-border bg-card px-2 py-1.5 font-mono text-xs shadow-card">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: row.color }} />
          <span className="w-9 font-bold">{row.code}</span>
          <span className="timing">{formatTime(row.time)}</span>
        </div>
        <div className="timing mt-0.5 text-muted-foreground">
          {`+${(row.gap ?? 0).toFixed(3)}s`}
        </div>
      </div>
    );
  };

  // Render a single session chart
  const renderSessionChart = (sessionData: ReturnType<typeof getSessionData>, session: string, compact: boolean = false) => {
    const chartHeight = compact
      ? Math.max(180, sessionData.labels.length * 20)
      : Math.max(300, sessionData.labels.length * 28);

    if (sessionData.labels.length === 0) {
      return (
        <F1EmptyState
          type="no-chart-data"
          size="sm"
          showDecoration={false}
          title={`No Data for ${session}`}
          description="No qualifying times were recorded for this phase."
          className={cn(compact ? "h-[180px]" : "h-[300px]")}
        />
      );
    }

    // Recharts data = row objects keyed by series name
    const rows = sessionData.labels.map((code, idx) => ({
      code,
      gap: sessionData.gaps[idx],
      time: sessionData.times[idx],
      color: sessionData.colors[idx],
    }));

    const labelFill = 'hsl(var(--foreground))';
    const axisFontSize = compact ? 9 : (isMobile ? 10 : 11);

    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{
            top: compact ? 5 : 10,
            right: compact ? 60 : 80,
            bottom: compact ? 20 : 35,
            left: compact ? 35 : (isMobile ? 45 : 50),
          }}
          barCategoryGap={compact ? '20%' : '25%'}
        >
          <defs>
            <ScopeDefs id="quali" color={chartTheme.primary} />
          </defs>
          <CartesianGrid
            horizontal={false}
            stroke={chartTheme.grid}
            strokeDasharray="3 3"
          />
          <XAxis
            type="number"
            domain={[0, 'auto']}
            stroke={chartTheme.axis}
            tickLine={false}
            tickFormatter={(value) => (value !== null ? `+${Number(value).toFixed(3)}s` : 'N/A')}
            tick={{ ...chartTheme.tick, fontSize: axisFontSize }}
            label={compact ? undefined : {
              value: 'Gap to Pole (s)',
              position: 'insideBottom',
              offset: -10,
              fontSize: 11,
              fill: chartTheme.tick.fill,
            }}
          />
          <YAxis
            type="category"
            dataKey="code"
            stroke={chartTheme.axis}
            tickLine={false}
            tick={{ ...chartTheme.tick, fontSize: axisFontSize }}
            width={compact ? 30 : (isMobile ? 40 : 45)}
          />
          <Tooltip content={<QualifyingTooltip />} cursor={chartTheme.cursor} />
          <Bar dataKey="gap" radius={[0, 2, 2, 0]} isAnimationActive={false} filter={compact ? undefined : SCOPE_GLOW}>
            {rows.map((row, idx) => (
              <Cell key={`cell-${idx}`} fill={row.color} />
            ))}
            {!compact && (
              <LabelList
                dataKey="time"
                position="right"
                formatter={(value: number) => formatTime(value)}
                style={{
                  fill: labelFill,
                  fontSize: isMobile ? 9 : 10,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  // Compact column header for a qualifying phase (eyebrow + count + pole)
  const PhaseHeader = ({ phase, count, pole }: { phase: 'Q1' | 'Q2' | 'Q3'; count: number; pole: number }) => (
    <div className="mb-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span
          className="instrument-label inline-flex items-center gap-1.5"
          style={{ color: PHASE_TOKEN[phase] }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: PHASE_TOKEN[phase] }} />
          {phase}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{count} drivers</span>
      </div>
      {pole > 0 && (
        <span className="timing text-xs" style={{ color: PHASE_TOKEN[phase] }}>
          {formatTime(pole)}
        </span>
      )}
    </div>
  );

  // Render "ALL" view with three sessions side by side
  const renderAllSessions = () => {
    const q1Data = getSessionData('Q1');
    const q2Data = getSessionData('Q2');
    const q3Data = getSessionData('Q3');
    const columns: Array<{ phase: 'Q1' | 'Q2' | 'Q3'; data: ReturnType<typeof getSessionData> }> = [
      { phase: 'Q1', data: q1Data },
      { phase: 'Q2', data: q2Data },
      { phase: 'Q3', data: q3Data },
    ];

    return (
      <div className="flex h-full flex-col gap-2 lg:flex-row">
        {columns.map(({ phase, data }, idx) => (
          <React.Fragment key={phase}>
            {idx > 0 && (
              <>
                <Separator orientation="vertical" className="hidden h-auto lg:block" />
                <Separator orientation="horizontal" className="lg:hidden" />
              </>
            )}
            <div className="flex flex-1 flex-col rounded-lg border border-border bg-card/40 p-3">
              <PhaseHeader phase={phase} count={data.labels.length} pole={data.fastestSessionTime} />
              <div className="min-h-0 flex-1 overflow-auto">
                <F1ChartContainer
                  minHeight={180}
                  isEmpty={data.labels.length === 0}
                  emptyTitle={`No Data for ${phase}`}
                  emptyDescription="No qualifying times were recorded for this phase."
                >
                  {renderSessionChart(data, phase, true)}
                </F1ChartContainer>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Session selector — underline-style phase toggles + view-all */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(['Q1', 'Q2', 'Q3'] as const).map((session) => (
          <button
            key={session}
            type="button"
            onClick={() => setSelectedSession(session)}
            className={cn(
              "rounded-none border-b-2 px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-widest transition-fast",
              selectedSession === session
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {session}
          </button>
        ))}

        {/* View All Button — same underline-tab grammar as the phase toggles */}
        <button
          type="button"
          onClick={() => setSelectedSession('ALL')}
          aria-pressed={selectedSession === 'ALL'}
          className={cn(
            "rounded-none border-b-2 px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-widest transition-fast",
            selectedSession === 'ALL'
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          All Sectors
        </button>

        {/* Pole time (only show for single session) */}
        {selectedSession !== 'ALL' && 'fastestSessionTime' in muiChartData && (muiChartData.fastestSessionTime ?? 0) > 0 && (
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className="instrument-label">Pole</span>
            <span className="opacity-40">•</span>
            <span className="timing font-medium text-primary">
              {formatTime(muiChartData.fastestSessionTime!)}
            </span>
          </div>
        )}
      </div>

      {/* Chart content */}
      <div className="min-h-0 flex-1 overflow-auto">
        {selectedSession === 'ALL' ? (
          renderAllSessions()
        ) : (
          'labels' in muiChartData && (muiChartData.labels?.length ?? 0) > 0 && (
            <F1ChartContainer minHeight={300}>
              {renderSessionChart(muiChartData as ReturnType<typeof getSessionData>, selectedSession)}
            </F1ChartContainer>
          )
        )}
      </div>
    </div>
  );
};

export default MuiQualifyingChart;

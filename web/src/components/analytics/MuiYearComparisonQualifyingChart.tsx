import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useRaceQualifying } from '@/hooks/useF1Data';
import { TEAM_COLORS } from '@/constants/f1Colors';
import { convertLapTimeToSeconds, formatTime } from '@/utils/lapTimeUtils';
import { useTheme } from '@/context/ThemeContext';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, Clock, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MuiYearComparisonQualifyingChartProps {
  baseYear: number;
  baseRound: string;
  comparisonYear: number;
  comparisonRound: string;
}

interface QualifyingData {
  driver: string;
  team: string;
  color: string;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  bestTime: number | null;
  position: number;
  year: number;
}

const getTeamColor = (team: string): string => {
  let normalizedTeam = team?.toLowerCase() || '';
  if (normalizedTeam === 'alphatauri') normalizedTeam = 'rb';
  if (normalizedTeam === 'alfa') normalizedTeam = 'sauber';
  return TEAM_COLORS[normalizedTeam] || '#666666';
};

const MuiYearComparisonQualifyingChart: React.FC<MuiYearComparisonQualifyingChartProps> = ({
  baseYear,
  baseRound,
  comparisonYear,
  comparisonRound,
}) => {
  const { baseTheme } = useTheme();
  const isDark = baseTheme === 'dark';
  const [session, setSession] = useState<'q1' | 'q2' | 'q3'>('q3');

  // Data hooks
  const { data: baseQualifying, isLoading: baseLoading } = useRaceQualifying(baseYear, baseRound);
  const { data: comparisonQualifying, isLoading: comparisonLoading } = useRaceQualifying(comparisonYear, comparisonRound);

  // Process qualifying data
  const processedData = useMemo(() => {
    const result: QualifyingData[] = [];

    // Process base year
    if (baseQualifying?.data?.QualifyingResults) {
      baseQualifying.data.QualifyingResults.forEach((r: any, idx: number) => {
        const q1 = r.Q1 ? convertLapTimeToSeconds(r.Q1) : null;
        const q2 = r.Q2 ? convertLapTimeToSeconds(r.Q2) : null;
        const q3 = r.Q3 ? convertLapTimeToSeconds(r.Q3) : null;

        result.push({
          driver: r.Driver.code || r.Driver.familyName.substring(0, 3).toUpperCase(),
          team: r.Constructor?.constructorId || 'unknown',
          color: getTeamColor(r.Constructor?.constructorId),
          q1,
          q2,
          q3,
          bestTime: q3 || q2 || q1,
          position: parseInt(r.position) || idx + 1,
          year: baseYear,
        });
      });
    }

    // Process comparison year
    if (comparisonQualifying?.data?.QualifyingResults) {
      comparisonQualifying.data.QualifyingResults.forEach((r: any, idx: number) => {
        const q1 = r.Q1 ? convertLapTimeToSeconds(r.Q1) : null;
        const q2 = r.Q2 ? convertLapTimeToSeconds(r.Q2) : null;
        const q3 = r.Q3 ? convertLapTimeToSeconds(r.Q3) : null;

        result.push({
          driver: r.Driver.code || r.Driver.familyName.substring(0, 3).toUpperCase(),
          team: r.Constructor?.constructorId || 'unknown',
          color: getTeamColor(r.Constructor?.constructorId),
          q1,
          q2,
          q3,
          bestTime: q3 || q2 || q1,
          position: parseInt(r.position) || idx + 1,
          year: comparisonYear,
        });
      });
    }

    return result;
  }, [baseQualifying, comparisonQualifying, baseYear, comparisonYear]);

  // Get chart data for current session
  const chartData = useMemo(() => {
    // Get pole times for each year
    const basePole = processedData.find(d => d.year === baseYear && d.position === 1)?.[session];
    const compPole = processedData.find(d => d.year === comparisonYear && d.position === 1)?.[session];

    // Build grouped data
    const drivers = [...new Set(processedData.map(d => d.driver))].slice(0, 15);

    return drivers.map(driver => {
      const baseData = processedData.find(d => d.driver === driver && d.year === baseYear);
      const compData = processedData.find(d => d.driver === driver && d.year === comparisonYear);

      const baseTime = baseData?.[session];
      const compTime = compData?.[session];

      return {
        driver,
        [`${baseYear}`]: baseTime && basePole ? baseTime - basePole : null,
        [`${comparisonYear}`]: compTime && compPole ? compTime - compPole : null,
        baseColor: baseData?.color || '#666',
        compColor: compData?.color || '#666',
        basePosition: baseData?.position,
        compPosition: compData?.position,
      };
    }).filter(d => d[`${baseYear}`] !== null || d[`${comparisonYear}`] !== null);
  }, [processedData, session, baseYear, comparisonYear]);

  // Get circuit names
  const baseCircuit = baseQualifying?.data?.Circuit?.circuitName || '';
  const compCircuit = comparisonQualifying?.data?.Circuit?.circuitName || '';

  const isLoading = baseLoading || comparisonLoading;

  // Format gap-to-pole value (seconds) for tooltip/axis
  const formatGap = (value: number | null) =>
    value !== null && value !== undefined ? `+${value.toFixed(3)}s` : 'N/A';

  // Custom tooltip showing both seasons' gap-to-pole for the hovered driver
  const QualifyingTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const rows = payload.filter((p: any) => p.value != null);
    if (!rows.length) return null;
    return (
      <div className="rounded-md border border-border bg-background/95 px-2 py-1.5 text-[11px] shadow-md">
        <div className="font-mono text-muted-foreground mb-1">{label}</div>
        {rows.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
            <span className="font-bold w-12">{p.name}</span>
            <span className="font-mono">{formatGap(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Loading qualifying data...</p>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No qualifying data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with circuit info */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs gap-1">
            <Flag className="h-3 w-3" />
            {baseYear}: {baseCircuit}
          </Badge>
          <span className="text-muted-foreground text-xs">vs</span>
          <Badge variant="outline" className="text-xs gap-1">
            <Flag className="h-3 w-3" />
            {comparisonYear}: {compCircuit}
          </Badge>
        </div>
      </div>

      {/* Session Tabs */}
      <Tabs value={session} onValueChange={(v) => setSession(v as 'q1' | 'q2' | 'q3')}>
        <TabsList className="grid grid-cols-3 w-full max-w-[300px]">
          <TabsTrigger value="q1" className="text-xs gap-1">
            <Clock className="h-3 w-3" />
            Q1
          </TabsTrigger>
          <TabsTrigger value="q2" className="text-xs gap-1">
            <Clock className="h-3 w-3" />
            Q2
          </TabsTrigger>
          <TabsTrigger value="q3" className="text-xs gap-1">
            <Clock className="h-3 w-3" />
            Q3
          </TabsTrigger>
        </TabsList>

        <TabsContent value={session} className="mt-4">
          {/* Chart */}
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 20, right: 20, bottom: 50, left: 50 }}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke={isDark ? '#333' : '#e5e5e5'}
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `+${v.toFixed(3)}`}
                  tick={{ fontSize: 9, fill: isDark ? '#a1a1aa' : '#666' }}
                  label={{
                    value: 'Gap to Pole (s)',
                    position: 'insideBottom',
                    offset: -10,
                    fontSize: 10,
                    fill: isDark ? '#a1a1aa' : '#666',
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="driver"
                  tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' }}
                  width={40}
                />
                <Tooltip content={<QualifyingTooltip />} cursor={{ fill: isDark ? '#ffffff10' : '#00000008' }} />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: isDark ? '#a1a1aa' : '#666', paddingTop: 20 }}
                />
                <Bar dataKey={`${baseYear}`} name={`${baseYear}`} fill="#e10600" isAnimationActive={false}>
                  {chartData.map((entry, index) => (
                    <Cell key={`base-${index}`} fill={entry.baseColor || '#e10600'} />
                  ))}
                </Bar>
                <Bar dataKey={`${comparisonYear}`} name={`${comparisonYear}`} fill="#3b82f6" isAnimationActive={false}>
                  {chartData.map((entry, index) => (
                    <Cell key={`comp-${index}`} fill={entry.compColor || '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>

      {/* Statistics */}
      <div className={cn(
        "grid grid-cols-2 gap-4 p-3 rounded-lg text-xs",
        isDark ? "bg-zinc-900/50 border border-zinc-800" : "bg-zinc-50 border border-zinc-200"
      )}>
        <div>
          <p className="text-muted-foreground mb-1">{baseYear} Pole</p>
          <p className="font-mono font-medium">
            {processedData.find(d => d.year === baseYear && d.position === 1)?.[session]
              ? formatTime(processedData.find(d => d.year === baseYear && d.position === 1)?.[session] || 0)
              : 'N/A'
            }
          </p>
        </div>
        <div>
          <p className="text-muted-foreground mb-1">{comparisonYear} Pole</p>
          <p className="font-mono font-medium">
            {processedData.find(d => d.year === comparisonYear && d.position === 1)?.[session]
              ? formatTime(processedData.find(d => d.year === comparisonYear && d.position === 1)?.[session] || 0)
              : 'N/A'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default MuiYearComparisonQualifyingChart;

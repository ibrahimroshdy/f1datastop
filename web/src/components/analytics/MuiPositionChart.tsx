import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { chartTheme, ScopeDefs, SCOPE_GLOW } from "@/lib/chartTheme";
import { Wrench } from "lucide-react";
import { usePositionChangeData } from "@/hooks/usePositionChangeData";
import DriverSelectionGrid from "./charts/DriverSelectionGrid";
import { F1ChartContainer } from "@/components/f1";
import { getPitStops } from "@/services/f1Service";
import { cn } from "@/lib/utils";
import { useDbRaceControl } from "@/hooks/useWarehouse";
import { deriveSafetyPeriods } from "@/lib/f1/safetyPeriods";
import { safetyBands, SafetyLegend } from "@/components/analytics/SafetyCarBands";

interface MuiPositionChartProps {
  year: number;
  round: string;
}

interface PitStopData {
  driver: string;
  lap: number;
  duration: string;
  stop?: number;
}

const MuiPositionChart: React.FC<MuiPositionChartProps> = ({ year, round }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [showPitStops, setShowPitStops] = useState(true);
  const [pitStops, setPitStops] = useState<PitStopData[]>([]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch pit stop data
  useEffect(() => {
    const fetchPitStops = async () => {
      try {
        const response = await getPitStops(year, round);
        if (response?.data?.Races?.[0]?.PitStops) {
          const stopsByDriver: { [driver: string]: number } = {};
          const pitStopData = response.data.Races[0].PitStops.map((ps: any) => {
            const driverId = ps.driverId;
            stopsByDriver[driverId] = (stopsByDriver[driverId] || 0) + 1;
            return {
              driver: driverId,
              lap: parseInt(ps.lap, 10),
              duration: ps.duration,
              stop: stopsByDriver[driverId],
            };
          });
          setPitStops(pitStopData);
        } else {
          setPitStops([]);
        }
      } catch (error) {
        setPitStops([]);
      }
    };

    if (year && round) {
      fetchPitStops();
    }
  }, [year, round]);

  const {
    chartData,
    availableDrivers,
    selectedDrivers,
    visibleDrivers,
    isLoading,
    isError,
    loadingProgress,
    maxLap,
    handleDriverToggle,
    handleDriverHover,
    getPositionChangeSummary,
  } = usePositionChangeData(year, round);

  // Safety-car / VSC / red-flag lap-range bands from race-control messages.
  const { data: raceControl } = useDbRaceControl(year, parseInt(round, 10), "R");
  const safety = useMemo(() => deriveSafetyPeriods(raceControl), [raceControl]);

  // Map driver IDs to codes and team colors for matching
  const driverIdToInfo = useMemo(() => {
    const map: { [id: string]: { code: string; team: string } } = {};
    availableDrivers.forEach(d => {
      map[d.driverId.toLowerCase()] = { code: d.code, team: d.team };
      map[d.code.toLowerCase()] = { code: d.code, team: d.team };
    });
    return map;
  }, [availableDrivers]);

  // Recharts line descriptors: one per visible driver, second teammate dashed.
  const lines = useMemo(() => {
    const visibleDriversData = availableDrivers.filter(d => visibleDrivers.includes(d.code));
    const teamCounts: { [team: string]: number } = {};
    return visibleDriversData.map(driver => {
      const teamCount = teamCounts[driver.team] || 0;
      teamCounts[driver.team] = teamCount + 1;
      return {
        code: driver.code,
        color: TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || TEAM_COLORS.default,
        dashed: teamCount > 0,
      };
    });
  }, [availableDrivers, visibleDrivers]);

  // Max position for Y-axis upper bound (positions are inverted: P1 at top).
  const maxPosition = useMemo(() => {
    let max = 1;
    const visibleCodes = availableDrivers
      .filter(d => visibleDrivers.includes(d.code))
      .map(d => d.code);
    chartData.forEach(d => {
      visibleCodes.forEach(code => {
        const val = d[code] as number | null | undefined;
        if (val != null && !isNaN(val as number) && (val as number) > max) {
          max = val as number;
        }
      });
    });
    return Math.max(max, 20);
  }, [chartData, availableDrivers, visibleDrivers]);

  // Get pit stops for visible drivers only with enriched data
  const visiblePitStops = useMemo(() => {
    if (!showPitStops || pitStops.length === 0) return [];

    const visibleCodes = visibleDrivers.map(code => code.toLowerCase());

    return pitStops.filter(ps => {
      const info = driverIdToInfo[ps.driver.toLowerCase()];
      return info && visibleCodes.includes(info.code.toLowerCase());
    }).map(ps => {
      const info = driverIdToInfo[ps.driver.toLowerCase()];
      return {
        ...ps,
        driverCode: info?.code || ps.driver,
        team: info?.team || '',
      };
    });
  }, [pitStops, visibleDrivers, driverIdToInfo, showPitStops]);

  // Group pit stops by lap with driver info
  const pitStopsByLap = useMemo(() => {
    const lapsMap = new Map<number, {
      drivers: string[];
      teams: string[];
      stops: number[];
      durations: string[];
    }>();

    visiblePitStops.forEach(ps => {
      const existing = lapsMap.get(ps.lap) || { drivers: [], teams: [], stops: [], durations: [] };
      existing.drivers.push(ps.driverCode);
      existing.teams.push(ps.team);
      existing.stops.push(ps.stop || 1);
      existing.durations.push(ps.duration);
      lapsMap.set(ps.lap, existing);
    });

    return Array.from(lapsMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([lap, info]) => ({ lap, ...info }));
  }, [visiblePitStops]);

  const chartHeight = isMobile ? 220 : 280;

  // Custom tooltip mirroring the old MUI hover (sorted by position, P1 first).
  const PositionTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const rows = payload
      .filter((p: any) => p.value != null)
      .sort((a: any, b: any) => a.value - b.value);
    if (!rows.length) return null;
    return (
      <div className="rounded-lg border border-border bg-card px-2 py-1.5 font-mono text-xs shadow-card">
        <div className="mb-1 font-mono tabular-nums text-muted-foreground">Lap {label}</div>
        {rows.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.stroke }} />
            <span className="w-9 font-bold">{p.dataKey}</span>
            <span className="font-mono tabular-nums">P{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Pit stop toggle */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Position by Lap
        </span>
        <button
          onClick={() => setShowPitStops(!showPitStops)}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-all",
            showPitStops
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <Wrench className="h-3.5 w-3.5" />
          Pit Stops
          {visiblePitStops.length > 0 && (
            <span className="ml-0.5 font-mono tabular-nums opacity-80">
              {visiblePitStops.length}
            </span>
          )}
        </button>
      </div>

      {/* Pit stops summary for visible drivers */}
      {showPitStops && visiblePitStops.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1 rounded-md border border-border bg-muted/30 p-1.5 text-xs">
          {Object.entries(
            visiblePitStops.reduce((acc, ps) => {
              if (!acc[ps.driverCode]) acc[ps.driverCode] = [];
              acc[ps.driverCode].push(ps);
              return acc;
            }, {} as { [driver: string]: typeof visiblePitStops })
          ).map(([driver, stops]) => {
            const team = stops[0]?.team || '';
            const teamColor = TEAM_COLORS[team] || TEAM_COLORS.default;
            return (
              <div
                key={driver}
                className="flex items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5"
                style={{ borderLeft: `2px solid ${teamColor}` }}
              >
                <span className="font-bold">{driver}</span>
                <span className="text-muted-foreground">•</span>
                {stops.sort((a, b) => (a.stop || 1) - (b.stop || 1)).map((stop, i) => (
                  <span key={i} className="flex items-center gap-0.5">
                    <span className="text-muted-foreground">P{stop.stop || i + 1}</span>
                    <span className="font-mono tabular-nums text-primary">L{stop.lap}</span>
                    <span className="font-mono tabular-nums text-status-completed">{stop.duration}s</span>
                    {i < stops.length - 1 && <span className="mx-0.5 text-muted-foreground">•</span>}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Driver selection grid */}
      <DriverSelectionGrid
        availableDrivers={availableDrivers}
        selectedDrivers={selectedDrivers}
        onDriverToggle={handleDriverToggle}
        onDriverHover={handleDriverHover}
        getPositionChangeSummary={getPositionChangeSummary}
      />

      <div className="mt-2 min-h-0 flex-1">
        <F1ChartContainer
          isLoading={isLoading}
          loadingMessage={`Loading positions ${loadingProgress}%`}
          useSkeleton
          error={isError && chartData.length === 0 ? "The F1 API rate limit was reached. Please wait a moment and try again." : null}
          isEmpty={chartData.length === 0 || lines.length === 0}
          emptyTitle="No Position Data"
          emptyDescription="Position data is not available for this race."
          minHeight={chartHeight}
        >
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart
              data={chartData}
              margin={{
                top: 10,
                right: isMobile ? 10 : 20,
                bottom: 35,
                left: isMobile ? 35 : 45,
              }}
            >
              <defs>
                <ScopeDefs id="pos" color={chartTheme.primary} />
              </defs>
              <CartesianGrid
                vertical={false}
                stroke={chartTheme.grid}
                strokeDasharray="3 3"
              />
              {safetyBands(safety)}
              <XAxis
                dataKey="lap"
                type="number"
                domain={[0, maxLap]}
                allowDecimals={false}
                tickLine={false}
                stroke={chartTheme.axis}
                tick={chartTheme.tick}
              />
              <YAxis
                reversed
                domain={[1, maxPosition]}
                allowDecimals={false}
                tickCount={10}
                width={isMobile ? 35 : 45}
                tickLine={false}
                stroke={chartTheme.axis}
                tick={chartTheme.tick}
              />
              <Tooltip content={<PositionTooltip />} cursor={chartTheme.cursor} />
              {showPitStops && pitStopsByLap.map((ps) => {
                const color = ps.teams[0] ? (TEAM_COLORS[ps.teams[0]] || TEAM_COLORS.default) : TEAM_COLORS.default;
                const label = ps.drivers.map((d, i) => `${d}:P${ps.stops[i]}`).join(' ');
                return (
                  <ReferenceLine
                    key={`pit-${ps.lap}`}
                    x={ps.lap}
                    stroke={color}
                    strokeDasharray="2 4"
                    strokeWidth={1.5}
                    strokeOpacity={0.7}
                    label={{
                      value: label,
                      position: 'insideBottomLeft',
                      angle: -90,
                      fontSize: 11,
                      fontWeight: 600,
                      fill: color,
                    }}
                  />
                );
              })}
              {lines.map((ln) => (
                <Line
                  key={ln.code}
                  type="stepAfter"
                  dataKey={ln.code}
                  stroke={ln.color}
                  strokeWidth={2}
                  strokeDasharray={ln.dashed ? '5 3' : undefined}
                  filter={SCOPE_GLOW}
                  dot={false}
                  activeDot={{ r: 3 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <SafetyLegend periods={safety} className="mt-2 justify-center" />
        </F1ChartContainer>
      </div>
    </div>
  );
};

export default MuiPositionChart;

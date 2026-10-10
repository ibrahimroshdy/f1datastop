import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RotateCcw, ZoomIn } from "lucide-react";
import { chartTheme } from "@/lib/chartTheme";
import { F1ChartContainer } from "@/components/f1";
import { cn } from "@/lib/utils";
import type { RaceReplayBlob } from "@/services/raceReplayService";
import { tyreColor } from "../pitwall.config";

interface Props {
  blob?: RaceReplayBlob;
  selected: string[];
  activeLap: number | null;
  /** The race player's current lap — drawn as a moving marker. */
  currentLap?: number;
  onSelectLap: (lap: number) => void;
}

interface LapPoint {
  t: number;
  tyre?: string | null;
  pit: boolean;
}

const fmtTime = (s?: number | null) => {
  if (s == null) return "";
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(3).padStart(6, "0")}`;
};
const fmtAxis = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s - m * 60)).padStart(2, "0")}`;
};
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const OUTLIER_FACTOR = 1.07; // laps slower than median × this are hidden by default

export function LapTimePanel({ blob, selected, activeLap, currentLap, onSelectLap }: Props) {
  const [showOutliers, setShowOutliers] = useState(false);
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  const [dragL, setDragL] = useState<number | null>(null);
  const [dragR, setDragR] = useState<number | null>(null);

  const model = useMemo(() => {
    if (!blob?.drivers) return null;
    const codes = selected.filter((c) => blob.drivers.some((d) => d.code === c));
    // Team colour + teammate index → dashed lines for the 2nd car of a team.
    const colorOf: Record<string, string> = {};
    const dashOf: Record<string, string | undefined> = {};
    const seenTeam = new Map<string, number>();
    const byCode: Record<string, Map<number, LapPoint>> = {};
    let maxLap = 0;
    const allTimes: number[] = [];

    for (const code of codes) {
      const d = blob.drivers.find((x) => x.code === code)!;
      const color = d.team_color || "#9ca3af";
      colorOf[code] = color;
      const idx = seenTeam.get(color) ?? 0;
      seenTeam.set(color, idx + 1);
      dashOf[code] = idx === 0 ? undefined : idx === 1 ? "5 4" : "2 3";
      const m = new Map<number, LapPoint>();
      for (const lap of d.laps ?? []) {
        if (lap.last == null) continue;
        const t = lap.last; // ReplayLap.last is already seconds (see race_replay_export.py)
        m.set(lap.n, { t, tyre: lap.tyre, pit: !!lap.pit });
        maxLap = Math.max(maxLap, lap.n);
        if (!lap.pit) allTimes.push(t);
      }
      byCode[code] = m;
    }

    const med = median(allTimes);
    const fastest = allTimes.length ? Math.min(...allTimes) : null;
    const rows: Record<string, number | null>[] = [];
    for (let lap = 1; lap <= maxLap; lap++) {
      const row: Record<string, number | null> = { lap };
      for (const code of codes) {
        const p = byCode[code].get(lap);
        if (!p) {
          row[code] = null;
          continue;
        }
        const isOutlier = p.pit || (med > 0 && p.t > med * OUTLIER_FACTOR);
        row[code] = !showOutliers && isOutlier ? null : p.t;
      }
      rows.push(row);
    }
    return { codes, colorOf, dashOf, byCode, rows, maxLap, fastest };
  }, [blob, selected, showOutliers]);

  if (!model || !model.codes.length) {
    return (
      <F1ChartContainer
        minHeight={224}
        isEmpty
        emptyTitle="No Lap Time Data"
        emptyDescription={blob ? "Select drivers to plot lap times." : "No session data."}
      />
    );
  }

  const { codes, colorOf, dashOf, byCode, rows, maxLap, fastest } = model;
  const domain: [number, number] = zoom ?? [1, Math.max(2, maxLap)];

  const commitZoom = () => {
    if (dragL != null && dragR != null && dragL !== dragR) {
      setZoom([Math.min(dragL, dragR), Math.max(dragL, dragR)]);
    }
    setDragL(null);
    setDragR(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <ZoomIn className="h-3 w-3" /> Drag to zoom · click a lap for telemetry
        </span>
        <div className="flex items-center gap-2">
          {zoom && (
            <button
              type="button"
              onClick={() => setZoom(null)}
              className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-2xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
          <label className="flex cursor-pointer select-none items-center gap-1.5 text-2xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showOutliers}
              onChange={(e) => setShowOutliers(e.target.checked)}
              className="h-3 w-3 accent-primary"
            />
            Outliers
          </label>
        </div>
      </div>

      <F1ChartContainer minHeight={260}>
        <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={rows}
          margin={{ top: 18, right: 10, left: 4, bottom: 4 }}
          onMouseDown={(e: { activeLabel?: string | number }) => {
            if (e?.activeLabel != null) setDragL(Number(e.activeLabel));
          }}
          onMouseMove={(e: { activeLabel?: string | number }) => {
            if (dragL != null && e?.activeLabel != null) setDragR(Number(e.activeLabel));
          }}
          onMouseUp={commitZoom}
          onClick={(e: { activeLabel?: string | number }) => {
            if (dragL == null && e?.activeLabel != null) onSelectLap(Number(e.activeLabel));
          }}
        >
          <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="lap"
            type="number"
            domain={domain}
            allowDataOverflow
            stroke={chartTheme.axis}
            tick={chartTheme.tick}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
          />
          <YAxis
            stroke={chartTheme.axis}
            tick={chartTheme.tick}
            tickLine={false}
            axisLine={false}
            width={46}
            domain={["dataMin - 0.4", "dataMax + 0.4"]}
            tickFormatter={fmtAxis}
            allowDecimals
          />
          <Tooltip
            contentStyle={chartTheme.tooltipContentStyle}
            labelStyle={chartTheme.tooltipLabelStyle}
            labelFormatter={(l) => `Lap ${l}`}
            formatter={(v: number, name: string) => [fmtTime(v), name]}
          />
          {currentLap != null && currentLap >= 1 && (
            <ReferenceLine
              x={currentLap}
              stroke={chartTheme.primary}
              strokeWidth={1.6}
              label={{ value: `L${Math.round(currentLap)}`, position: "top", fill: chartTheme.primary, fontSize: 9 }}
            />
          )}
          {activeLap != null && (
            <ReferenceLine x={activeLap} stroke={chartTheme.primary} strokeDasharray="2 2" label={{ value: "pinned", position: "top", fill: chartTheme.primary, fontSize: 9 }} />
          )}
          {fastest != null && (
            <ReferenceLine
              y={fastest}
              stroke="#a855f7"
              strokeDasharray="4 3"
              label={{ value: "Fastest", position: "insideBottomRight", fill: "#a855f7", fontSize: 9 }}
            />
          )}
          {codes.map((code) => (
            <Line
              key={code}
              dataKey={code}
              type="monotone"
              stroke={colorOf[code]}
              strokeWidth={1.8}
              strokeDasharray={dashOf[code]}
              connectNulls
              isAnimationActive={false}
              dot={(dp: { cx?: number; cy?: number; payload?: { lap?: number }; key?: string }) => {
                const { cx, cy, payload, key } = dp;
                if (cx == null || cy == null || payload?.lap == null) return <g key={key} />;
                const p = byCode[code].get(payload.lap);
                if (!p) return <g key={key} />;
                return (
                  <circle
                    key={key}
                    cx={cx}
                    cy={cy}
                    r={p.pit ? 3.2 : 2.4}
                    fill={tyreColor(p.tyre)}
                    stroke={p.pit ? "#fff" : colorOf[code]}
                    strokeWidth={p.pit ? 1.4 : 0.5}
                  />
                );
              }}
              activeDot={{ r: 4, fill: colorOf[code], stroke: "hsl(var(--card))", strokeWidth: 2 }}
            />
          ))}
          {dragL != null && dragR != null && (
            <ReferenceArea x1={Math.min(dragL, dragR)} x2={Math.max(dragL, dragR)} strokeOpacity={0.25} fill={chartTheme.primary} fillOpacity={0.08} />
          )}
        </LineChart>
      </ResponsiveContainer>
      </F1ChartContainer>

      {/* Tyre legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
        {[
          ["S", "Soft"],
          ["M", "Medium"],
          ["H", "Hard"],
          ["I", "Inter"],
          ["W", "Wet"],
        ].map(([k, label]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tyreColor(k) }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className={cn("h-2 w-2 rounded-full ring-1 ring-white")} style={{ backgroundColor: "#9ca3af" }} />
          Pit lap
        </span>
      </div>
    </div>
  );
}

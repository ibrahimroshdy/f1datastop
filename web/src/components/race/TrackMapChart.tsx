import { useEffect, useMemo, useState } from "react";
import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardHeader,
  F1CardTitle,
  F1Skeleton,
} from "@/components/f1";
import { cn } from "@/lib/utils";
import { ScopeDefs, SCOPE_GLOW } from "@/lib/chartTheme";
import {
  useTelemetryIndex,
  useTelemetryLaps,
} from "@/hooks/useFastF1Telemetry";

interface Props {
  year: number;
  round: number | string;
  session?: string;
}

const W = 680;
const H = 420;
const PAD = 24;

/** Speed → colour: slow = blue (hue 210), fast = red (hue 0). */
function speedColor(t: number): string {
  const hue = 210 * (1 - Math.max(0, Math.min(1, t)));
  return `hsl(${hue}, 90%, 55%)`;
}

/** Track map: the racing line (X/Y) of one driver's fastest lap, coloured by
 *  speed at each point. Pure SVG — every blob already carries X/Y + speed. */
const TrackMapChart = ({ year, round, session = "R" }: Props) => {
  const { data: index, isLoading: indexLoading } = useTelemetryIndex(year, Number(round), session);
  const [code, setCode] = useState<string>("");

  useEffect(() => {
    if (index && index.length && !code) setCode(index[0].driver_code);
  }, [index, code]);

  const { laps, isLoading } = useTelemetryLaps(index, code ? [code] : []);
  const lap = laps[0];

  const geom = useMemo(() => {
    if (!lap) return null;
    const xs = lap.channels.x ?? [];
    const ys = lap.channels.y ?? [];
    const spd = lap.channels.speed ?? [];
    if (xs.length < 2) return null;
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const minS = Math.min(...spd), maxS = Math.max(...spd);
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const scale = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY);
    // centre within the viewBox
    const offX = (W - spanX * scale) / 2;
    const offY = (H - spanY * scale) / 2;
    const px = (x: number) => offX + (x - minX) * scale;
    const py = (y: number) => H - (offY + (y - minY) * scale); // flip Y
    const segs = [];
    for (let i = 1; i < xs.length; i++) {
      const t = (spd[i] - minS) / (maxS - minS || 1);
      segs.push({
        x1: px(xs[i - 1]), y1: py(ys[i - 1]),
        x2: px(xs[i]), y2: py(ys[i]),
        color: speedColor(t),
      });
    }
    return { segs, minS, maxS };
  }, [lap]);

  if (!indexLoading && (!index || index.length === 0)) {
    return (
      <div className="flex h-[260px] items-center justify-center text-center text-sm text-muted-foreground">
        No telemetry exported for this session yet.
      </div>
    );
  }

  return (
    <F1Card variant="default" className="scope-frame border-0 bg-transparent p-0 shadow-none">
      <F1CardHeader className="px-0 pt-0">
        <F1CardTitle className="text-base">Track map · speed</F1CardTitle>
        <F1CardDescription className="text-xs">
          Racing line coloured by speed — fastest lap
        </F1CardDescription>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(index ?? []).map((r) => (
            <button
              key={r.driver_code}
              onClick={() => setCode(r.driver_code)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                code === r.driver_code
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {r.driver_code}
            </button>
          ))}
        </div>
      </F1CardHeader>

      <F1CardContent className="px-0 pb-0">
        {indexLoading || isLoading ? (
          <F1Skeleton className="h-[340px] w-full" />
        ) : !geom ? (
          <div className="flex h-[340px] items-center justify-center text-muted-foreground">
            Select a driver.
          </div>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-auto w-full"
              style={{ maxHeight: 440 }}
            >
              <defs>
                <ScopeDefs id="track" color="hsl(var(--primary))" />
              </defs>
              <g filter={SCOPE_GLOW}>
                {geom.segs.map((s, i) => (
                  <line
                    key={i}
                    x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                    stroke={s.color}
                    strokeWidth={5}
                    strokeLinecap="round"
                  />
                ))}
              </g>
            </svg>
            {/* speed legend */}
            <div className="mt-2 flex items-center justify-center gap-2 text-xs tabular-nums text-muted-foreground">
              <span>{Math.round(geom.minS)} km/h</span>
              <span
                className="h-2 w-40 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, hsl(210,90%,55%), hsl(140,90%,55%), hsl(60,90%,55%), hsl(0,90%,55%))",
                }}
              />
              <span>{Math.round(geom.maxS)} km/h</span>
            </div>
          </>
        )}
      </F1CardContent>
    </F1Card>
  );
};

export default TrackMapChart;

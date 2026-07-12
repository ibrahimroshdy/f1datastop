import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Pause, RotateCcw, SkipBack, SkipForward, Flag, ArrowRight } from "lucide-react";
import { useDbLaps, useDbOvertakes, useDbPitLaps } from "@/hooks/useWarehouse";
import { useRaceResults } from "@/hooks/f1";
import { getTeamColorById } from "@/constants/f1Colors";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle, F1Skeleton, F1EmptyState } from "@/components/f1";
import { cn } from "@/lib/utils";

interface Props {
  year: number;
  round: string;
  session?: string;
}

const SPEEDS = [1, 2, 4, 8] as const;

/** Playable race replay — an animated position board driven by per-lap warehouse
 *  positions. Scrub or play through the race; rows reorder as drivers swap places,
 *  with pit-stop and overtake markers on each lap. */
export default function RaceReplay({ year, round }: Props) {
  const roundNum = parseInt(round, 10);
  const { data: laps, isLoading: lapsLoading } = useDbLaps(year, roundNum, "R");
  const { data: overtakes } = useDbOvertakes(year, roundNum, "R");
  const { data: pitRows } = useDbPitLaps(year, roundNum);
  const race = useRaceResults(year, round);

  // driver_id -> { code, color }
  const meta = useMemo(() => {
    const map: Record<string, { code: string; color: string }> = {};
    const results: any[] = (race.data as any)?.data?.Results ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
    results.forEach((r) => {
      const id = r.Driver?.driverId;
      if (!id) return;
      map[id] = {
        code: r.Driver?.code || id.slice(0, 3).toUpperCase(),
        color: getTeamColorById(r.Constructor?.constructorId || r.Constructor?.name || ""),
      };
    });
    return map;
  }, [race.data]);
  const code = (id: string) => meta[id]?.code || id.slice(0, 3).toUpperCase();
  const color = (id: string) => meta[id]?.color || "hsl(var(--muted-foreground))";

  // Per-lap running order + bounds.
  const { posByLap, firstLap, lastLap } = useMemo(() => {
    const byLap = new Map<number, Map<string, number>>();
    let lo = Infinity;
    let hi = -Infinity;
    (laps ?? []).forEach((l) => {
      if (l.position == null) return;
      lo = Math.min(lo, l.lap_number);
      hi = Math.max(hi, l.lap_number);
      if (!byLap.has(l.lap_number)) byLap.set(l.lap_number, new Map());
      byLap.get(l.lap_number)!.set(l.driver_id, l.position);
    });
    return { posByLap: byLap, firstLap: Number.isFinite(lo) ? lo : 1, lastLap: Number.isFinite(hi) ? hi : 1 };
  }, [laps]);

  // lap -> set of drivers who pitted that lap.
  const pitsByLap = useMemo(() => {
    const m = new Map<number, Set<string>>();
    (pitRows ?? []).forEach((p) => {
      if (!m.has(p.lap_number)) m.set(p.lap_number, new Set());
      m.get(p.lap_number)!.add(p.driver_id);
    });
    return m;
  }, [pitRows]);

  // driver -> sorted pit laps (for the running stop count) + all distinct pit laps
  // (for the scrubber tick marks).
  const pitLapsByDriver = useMemo(() => {
    const m = new Map<string, number[]>();
    (pitRows ?? []).forEach((p) => {
      if (!m.has(p.driver_id)) m.set(p.driver_id, []);
      m.get(p.driver_id)!.push(p.lap_number);
    });
    m.forEach((a) => a.sort((x, y) => x - y));
    return m;
  }, [pitRows]);
  const allPitLaps = useMemo(
    () => [...new Set((pitRows ?? []).map((p) => p.lap_number))].sort((a, b) => a - b),
    [pitRows],
  );

  // lap -> overtakes made on that lap.
  const otByLap = useMemo(() => {
    const m = new Map<number, typeof overtakes>();
    (overtakes ?? []).forEach((o) => {
      if (!m.has(o.lap_number)) m.set(o.lap_number, []);
      m.get(o.lap_number)!.push(o);
    });
    return m;
  }, [overtakes]);

  const [lap, setLap] = useState(firstLap);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const tick = useRef<number>();

  // Snap to the start whenever the race (bounds) changes.
  useEffect(() => {
    setLap(firstLap);
    setPlaying(false);
  }, [firstLap, lastLap]);

  // Playback loop.
  useEffect(() => {
    if (!playing) return;
    tick.current = window.setInterval(() => {
      setLap((prev) => {
        if (prev >= lastLap) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 900 / speed);
    return () => window.clearInterval(tick.current);
  }, [playing, speed, lastLap]);

  const board = useMemo(() => {
    const cur = posByLap.get(lap);
    if (!cur) return [];
    const prev = posByLap.get(lap - 1);
    return [...cur.entries()]
      .map(([id, pos]) => ({ id, pos, delta: prev?.has(id) ? (prev.get(id)! - pos) : 0 }))
      .sort((a, b) => a.pos - b.pos);
  }, [posByLap, lap]);

  const lapPits = pitsByLap.get(lap);
  const lapOts = otByLap.get(lap) ?? [];
  const otMovers = useMemo(() => new Set(lapOts.map((o) => o.overtaking_driver_id)), [lapOts]);

  if (lapsLoading || race.isLoading) {
    return <F1Skeleton variant="card" className="h-[560px]" />;
  }
  if (posByLap.size === 0) {
    return (
      <F1Card>
        <F1CardContent className="py-8">
          <F1EmptyState
            type="no-data"
            size="sm"
            showDecoration={false}
            title="No race replay for this session"
            description="The replay is built from FastF1 lap positions. This race hasn't been ingested yet, or has no racing laps."
          />
        </F1CardContent>
      </F1Card>
    );
  }

  const atEnd = lap >= lastLap;
  const step = (d: number) => {
    setPlaying(false);
    setLap((p) => Math.min(lastLap, Math.max(firstLap, p + d)));
  };

  return (
    <F1Card>
      <F1CardHeader className="flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" />
          <F1CardTitle className="text-base">Race Replay</F1CardTitle>
        </div>
        <div className="instrument-label flex items-baseline gap-1 text-muted-foreground">
          Lap <span className="readout text-lg text-primary">{lap}</span>
          <span className="text-muted-foreground/60">/ {lastLap}</span>
        </div>
      </F1CardHeader>

      <F1CardContent className="flex flex-col gap-3">
        {/* Transport controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (atEnd ? (setLap(firstLap), setPlaying(true)) : setPlaying((p) => !p))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
          </button>
          <button type="button" onClick={() => step(-1)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-accent" aria-label="Previous lap">
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => step(1)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-accent" aria-label="Next lap">
            <SkipForward className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => { setPlaying(false); setLap(firstLap); }} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-accent" aria-label="Restart">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* speed */}
          <div className="ml-auto flex items-center gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={cn(
                  "min-h-8 rounded px-2 py-1 text-xs font-medium tabular-nums transition-colors",
                  speed === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Scrubber with pit-lap ticks */}
        <div className="relative pt-2.5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-2.5">
            {allPitLaps.map((l) => {
              const pct = lastLap > firstLap ? ((l - firstLap) / (lastLap - firstLap)) * 100 : 0;
              return (
                <span
                  key={l}
                  className="absolute top-0 h-2 w-px bg-position-gold/70"
                  style={{ left: `${pct}%` }}
                />
              );
            })}
          </div>
          <input
            type="range"
            min={firstLap}
            max={lastLap}
            value={lap}
            onChange={(e) => { setPlaying(false); setLap(Number(e.target.value)); }}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            aria-label="Lap scrubber"
          />
          {allPitLaps.length > 0 && (
            <div className="mt-1 flex items-center gap-1.5 text-2xs text-muted-foreground">
              <span className="h-2 w-px bg-position-gold/70" /> pit stops
            </div>
          )}
        </div>

        {/* Overtake ticker for this lap */}
        <div className="min-h-5">
          {lapOts.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="instrument-label text-primary">Passes</span>
              {lapOts.map((o, i) => (
                <span key={i} className="inline-flex items-center gap-1 tabular-nums">
                  <span className="font-bold" style={{ color: color(o.overtaking_driver_id) }}>{code(o.overtaking_driver_id)}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-bold" style={{ color: color(o.overtaken_driver_id) }}>{code(o.overtaken_driver_id)}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Position board */}
        <div className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {board.map((d) => {
              const pitting = lapPits?.has(d.id);
              const passing = otMovers.has(d.id);
              const stops = (pitLapsByDriver.get(d.id) ?? []).filter((l) => l <= lap).length;
              return (
                <motion.div
                  key={d.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ layout: { type: "spring", stiffness: 600, damping: 42 }, opacity: { duration: 0.2 } }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md border px-2.5 py-1.5",
                    passing ? "border-primary/50 bg-primary/[0.06]" : "border-border/50 bg-card",
                  )}
                >
                  <span className="timing w-6 shrink-0 text-right text-sm font-bold tabular-nums text-muted-foreground">
                    {d.pos}
                  </span>
                  <span className="h-4 w-1 shrink-0 rounded-full" style={{ backgroundColor: color(d.id) }} />
                  <span className="w-10 shrink-0 font-bold" style={{ color: color(d.id) }}>{code(d.id)}</span>

                  {/* delta vs previous lap */}
                  <span className="w-10 shrink-0 text-xs tabular-nums">
                    {d.delta > 0 ? (
                      <span className="text-status-completed">▲{d.delta}</span>
                    ) : d.delta < 0 ? (
                      <span className="text-destructive">▼{-d.delta}</span>
                    ) : (
                      <span className="text-muted-foreground/40">–</span>
                    )}
                  </span>

                  <div className="ml-auto flex items-center gap-1.5">
                    {/* running stop count — one gold lollipop per completed stop */}
                    {stops > 0 && (
                      <span
                        className="flex items-center gap-0.5"
                        title={`${stops} pit stop${stops > 1 ? "s" : ""}`}
                        aria-label={`${stops} pit stops`}
                      >
                        {Array.from({ length: stops }).map((_, i) => (
                          <span key={i} className="h-1.5 w-1.5 rounded-full bg-position-gold/70" />
                        ))}
                      </span>
                    )}
                    {pitting && (
                      <span className="rounded bg-position-gold/20 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wide text-position-gold">
                        In Pit
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </F1CardContent>
    </F1Card>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";

export interface LapPlayhead {
  /** Current playhead time in seconds. */
  t: number;
  playing: boolean;
  speed: number;
  /** Lap duration (seconds) — set by whichever panel knows the telemetry. */
  duration: number;
  /** Scrub to a time (pauses playback). */
  setT: (t: number) => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  restart: () => void;
  setSpeed: (s: number) => void;
  setDuration: (d: number) => void;
}

/**
 * One shared lap playhead for the whole Pit Wall — the track replay and every
 * telemetry trace read the same `t`, so pressing play moves the track dot AND a
 * synced crosshair across all charts, and hovering a chart scrubs the track.
 */
export function useLapPlayhead(): LapPlayhead {
  const [t, setTRaw] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [duration, setDurationRaw] = useState(0);
  const raf = useRef<number>();
  const last = useRef<number | null>(null);

  const setT = useCallback((v: number) => {
    setPlaying(false);
    setTRaw(Math.max(0, v));
  }, []);
  const setDuration = useCallback((d: number) => setDurationRaw(d), []);
  const toggle = useCallback(() => setPlaying((p) => !p), []);
  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const restart = useCallback(() => {
    setTRaw(0);
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (!playing || duration <= 0) return;
    const loop = (ts: number) => {
      if (last.current == null) last.current = ts;
      const dt = (ts - last.current) / 1000;
      last.current = ts;
      setTRaw((prev) => Math.min(duration, prev + dt * speed));
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      last.current = null;
    };
  }, [playing, speed, duration]);

  useEffect(() => {
    if (duration > 0 && t >= duration) setPlaying(false);
  }, [t, duration]);

  return { t, playing, speed, duration, setT, toggle, play, pause, restart, setSpeed, setDuration };
}

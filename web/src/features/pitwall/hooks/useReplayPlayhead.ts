import { useEffect, useRef, useState } from "react";
import { REPLAY_FPS, REPLAY_SPEEDS } from "@/components/common/ReplaySpeedControl";


export interface ReplayPlayhead {
  frame: number;
  setFrame: (n: number) => void;
  playing: boolean;
  setPlaying: (b: boolean) => void;
  speed: number;
  setSpeed: (s: number) => void;
  lastFrame: number;
}

/** Frame-based playhead over a race-replay blob (whole session). */
export function useReplayPlayhead(frames: number): ReplayPlayhead {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Start on the slowest step — the closest this ladder gets to real time.
  const [speed, setSpeed] = useState<number>(REPLAY_SPEEDS[0]);
  const raf = useRef<number>();
  const last = useRef(0);
  const lastFrame = Math.max(0, frames - 1);

  useEffect(() => {
    if (!playing) return;
    const step = (ts: number) => {
      if (!last.current) last.current = ts;
      const dt = (ts - last.current) / 1000;
      last.current = ts;
      setFrame((f) => {
        const n = f + REPLAY_FPS * speed * dt;
        if (n >= lastFrame) {
          setPlaying(false);
          return lastFrame;
        }
        return n;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      last.current = 0;
    };
  }, [playing, speed, lastFrame]);

  return { frame, setFrame, playing, setPlaying, speed, setSpeed, lastFrame };
}

import { useEffect, useRef, useState } from "react";

/** Animate a number from 0 to `target` on mount (easeOutCubic). Respects
 *  prefers-reduced-motion. Used for hero/instrument readouts. */
export function useCountUp(target: number, duration = 850): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setValue(target);
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      return;
    }
    let start: number | null = null;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);

  return value;
}

interface CountUpProps {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
}

/** Count-up display for a numeric readout. */
export function CountUp({ value, decimals = 0, duration, className }: CountUpProps) {
  const v = useCountUp(value, duration);
  return (
    <span className={className}>
      {v.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}

export default CountUp;

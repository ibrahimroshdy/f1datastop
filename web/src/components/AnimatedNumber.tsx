import NumberFlow, { type Format } from "@number-flow/react";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  /** NumberFlow format options (Intl.NumberFormat subset — decimals, %, unit). */
  format?: Format;
  /** Text prepended/appended inside the flow (e.g. "+", "s", "×"). */
  prefix?: string;
  suffix?: string;
  className?: string;
  /** Use the mono readout face (timing/telemetry numbers). */
  mono?: boolean;
}

/**
 * Rolling animated number — digits tween on change instead of hard-swapping.
 * The premium "made not generated" touch for points, standings, timing, counts.
 * Always tabular so columns stay aligned; NumberFlow honours prefers-reduced-motion.
 */
export function AnimatedNumber({ value, format, prefix, suffix, className, mono }: AnimatedNumberProps) {
  return (
    <NumberFlow
      value={value}
      format={format}
      prefix={prefix}
      suffix={suffix}
      className={cn("tabular-nums", mono && "font-mono", className)}
      willChange
    />
  );
}

export default AnimatedNumber;

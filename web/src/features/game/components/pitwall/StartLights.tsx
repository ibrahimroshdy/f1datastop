import { cn } from "@/lib/utils";
import { Countdown } from "../Countdown";

/**
 * The Pit Wall signature: an F1 start-light gantry (five red columns) sitting
 * above a live mono countdown to a deadline. The lights stagger their pulse so
 * the gantry reads as "armed"; the clock self-hides once the deadline passes.
 */
export function StartLights({
  to,
  label = "LIGHTS OUT IN",
  fallback = "—",
  className,
}: {
  to: string | null | undefined;
  label?: string;
  fallback?: string;
  className?: string;
}) {
  const live = !!to && new Date(to).getTime() > Date.now();
  return (
    <div className={cn("inline-flex flex-col items-center gap-3", className)}>
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/90 px-4 py-3 shadow-[0_0_28px_-8px_hsl(var(--primary))]">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="flex flex-col gap-1.5">
            {[0, 1].map((row) => (
              <span
                key={row}
                className={cn(
                  "h-3.5 w-3.5 rounded-full",
                  live
                    ? "bg-primary shadow-[0_0_10px_hsl(var(--primary))] animate-live-pulse"
                    : "bg-white/15",
                )}
                style={live ? { animationDelay: `${i * 110}ms` } : undefined}
              />
            ))}
          </span>
        ))}
      </div>
      <div className="text-center">
        <div className="instrument-label text-muted-foreground">{label}</div>
        {live ? (
          <Countdown
            to={to}
            className="readout font-mono text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          />
        ) : (
          <div className="readout font-mono text-2xl font-bold tracking-tight text-muted-foreground sm:text-3xl">
            {fallback}
          </div>
        )}
      </div>
    </div>
  );
}

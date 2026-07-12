import { cn } from "@/lib/utils";

interface F1LoaderProps {
  className?: string;
  label?: string;
  /** sm = inline (16px bars), md = block (default), lg = full-height hero. */
  size?: "sm" | "md" | "lg";
}

const BAR = {
  sm: "h-1 w-5",
  md: "h-1.5 w-8",
  lg: "h-2 w-12",
} as const;

/**
 * Branded loading indicator — three "sector" segments sweeping in sequence,
 * evoking an F1 timing screen. Replaces generic spinners for a made-not-generated
 * feel. Collapses to a static filled state under prefers-reduced-motion.
 */
export function F1Loader({ className, label, size = "md" }: F1LoaderProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-label={label ?? "Loading"}
    >
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("overflow-hidden rounded-full bg-muted", BAR[size])}>
            <span
              className="block h-full w-full origin-left animate-sector-sweep rounded-full bg-primary motion-reduce:scale-x-100 motion-reduce:animate-none"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          </span>
        ))}
      </div>
      {label && <span className="instrument-label text-muted-foreground">{label}</span>}
    </div>
  );
}

export default F1Loader;

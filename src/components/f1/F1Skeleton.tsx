import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface F1SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Skeleton variant */
  variant?: "text" | "circular" | "rectangular" | "card" | "chart" | "table-row" | "avatar" | "badge";
  /** Width (can be number for px or string for any CSS value) */
  width?: number | string;
  /** Height (can be number for px or string for any CSS value) */
  height?: number | string;
  /** Number of lines (for text variant) */
  lines?: number;
  /** Whether to animate */
  animate?: boolean;
}

const F1Skeleton = React.forwardRef<HTMLDivElement, F1SkeletonProps>(
  ({ 
    className, 
    variant = "rectangular", 
    width, 
    height,
    lines = 1,
    animate = true,
    ...props 
  }, ref) => {
    const style: React.CSSProperties = {
      width: typeof width === "number" ? `${width}px` : width,
      height: typeof height === "number" ? `${height}px` : height,
    };

    // Text skeleton with multiple lines
    if (variant === "text") {
      return (
        <div ref={ref} className={cn("space-y-2", className)} {...props}>
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton 
              key={i}
              className={cn(
                "h-4",
                i === lines - 1 && lines > 1 && "w-3/4",
                !animate && "animate-none"
              )}
              style={i === 0 ? style : undefined}
            />
          ))}
        </div>
      );
    }

    // Circular skeleton (for avatars)
    if (variant === "circular" || variant === "avatar") {
      return (
        <Skeleton 
          ref={ref}
          className={cn(
            "rounded-full",
            variant === "avatar" && "h-10 w-10",
            !animate && "animate-none",
            className
          )}
          style={style}
          {...props}
        />
      );
    }

    // Badge skeleton
    if (variant === "badge") {
      return (
        <Skeleton 
          ref={ref}
          className={cn(
            "h-5 w-16 rounded-full",
            !animate && "animate-none",
            className
          )}
          style={style}
          {...props}
        />
      );
    }

    // Card skeleton
    if (variant === "card") {
      return (
        <div 
          ref={ref}
          className={cn(
            "rounded-lg border border-border bg-card p-4 space-y-4",
            className
          )}
          style={style}
          {...props}
        >
          <div className="flex items-center gap-3">
            <Skeleton className={cn("h-10 w-10 rounded-full", !animate && "animate-none")} />
            <div className="space-y-2 flex-1">
              <Skeleton className={cn("h-4 w-1/2", !animate && "animate-none")} />
              <Skeleton className={cn("h-3 w-1/3", !animate && "animate-none")} />
            </div>
          </div>
          <Skeleton className={cn("h-20 w-full", !animate && "animate-none")} />
          <div className="flex gap-2">
            <Skeleton className={cn("h-8 w-20", !animate && "animate-none")} />
            <Skeleton className={cn("h-8 w-20", !animate && "animate-none")} />
          </div>
        </div>
      );
    }

    // Chart skeleton
    if (variant === "chart") {
      return (
        <div 
          ref={ref}
          className={cn(
            "rounded-lg border border-border bg-card p-4",
            className
          )}
          style={style}
          {...props}
        >
          <div className="flex items-center justify-between mb-4">
            <Skeleton className={cn("h-5 w-32", !animate && "animate-none")} />
            <Skeleton className={cn("h-8 w-24", !animate && "animate-none")} />
          </div>
          <div className="relative h-[200px] flex items-end gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton 
                key={i}
                className={cn("flex-1 rounded-t", !animate && "animate-none")}
                style={{ height: `${30 + Math.random() * 60}%` }}
              />
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className={cn("h-3 w-3 rounded-full", !animate && "animate-none")} />
                <Skeleton className={cn("h-3 w-16", !animate && "animate-none")} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Table row skeleton
    if (variant === "table-row") {
      return (
        <div 
          ref={ref}
          className={cn(
            "flex items-center gap-4 py-3 border-b border-border",
            className
          )}
          style={style}
          {...props}
        >
          <Skeleton className={cn("h-4 w-8", !animate && "animate-none")} />
          <Skeleton className={cn("h-8 w-8 rounded-full", !animate && "animate-none")} />
          <Skeleton className={cn("h-4 flex-1", !animate && "animate-none")} />
          <Skeleton className={cn("h-4 w-16", !animate && "animate-none")} />
          <Skeleton className={cn("h-4 w-12", !animate && "animate-none")} />
        </div>
      );
    }

    // Default rectangular skeleton
    return (
      <Skeleton 
        ref={ref}
        className={cn(!animate && "animate-none", className)}
        style={style}
        {...props}
      />
    );
  }
);
F1Skeleton.displayName = "F1Skeleton";

// Standings skeleton
const StandingsSkeleton = ({ rows = 10, className }: { rows?: number; className?: string }) => (
  <div className={cn("space-y-1", className)}>
    {Array.from({ length: rows }).map((_, i) => (
      <F1Skeleton key={i} variant="table-row" />
    ))}
  </div>
);

// Driver card skeleton
const DriverCardSkeleton = ({ className }: { className?: string }) => (
  <F1Skeleton variant="card" className={className} />
);

// Chart skeleton with title
const ChartSkeleton = ({ className, height = 300 }: { className?: string; height?: number }) => (
  <F1Skeleton variant="chart" className={className} height={height} />
);

export { 
  F1Skeleton, 
  StandingsSkeleton, 
  DriverCardSkeleton, 
  ChartSkeleton 
};


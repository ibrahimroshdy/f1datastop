import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

type ChartType = "bar" | "line" | "pie" | "area" | "table" | "sankey" | "custom";

interface F1ChartLoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Type of chart (affects the skeleton shape) */
  chartType?: ChartType;
  /** Height of the loading area */
  height?: number | string;
  /** Whether to show a spinner overlay */
  showSpinner?: boolean;
  /** Loading message */
  message?: string;
  /** Number of bars/lines to show in skeleton */
  itemCount?: number;
}

const F1ChartLoading = React.forwardRef<HTMLDivElement, F1ChartLoadingProps>(
  ({ 
    className, 
    chartType = "bar",
    height = 300,
    showSpinner = false,
    message,
    itemCount = 8,
    ...props 
  }, ref) => {
    const chartHeight = typeof height === "number" ? `${height}px` : height;

    // Bar chart skeleton
    if (chartType === "bar") {
      return (
        <div
          ref={ref}
          className={cn("relative w-full", className)}
          style={{ height: chartHeight }}
          {...props}
        >
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between py-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-3 w-8" />
            ))}
          </div>

          {/* Chart area */}
          <div className="absolute left-12 right-4 top-2 bottom-8 flex items-end gap-2">
            {[...Array(itemCount)].map((_, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-t animate-pulse"
                style={{ 
                  height: `${30 + Math.random() * 60}%`,
                  animationDelay: `${i * 100}ms`
                }}
              />
            ))}
          </div>

          {/* X-axis labels */}
          <div className="absolute left-12 right-4 bottom-0 h-6 flex justify-between">
            {[...Array(itemCount)].map((_, i) => (
              <Skeleton key={i} className="h-3 w-6" />
            ))}
          </div>

          {showSpinner && <LoadingOverlay message={message} />}
        </div>
      );
    }

    // Line chart skeleton
    if (chartType === "line" || chartType === "area") {
      return (
        <div
          ref={ref}
          className={cn("relative w-full", className)}
          style={{ height: chartHeight }}
          {...props}
        >
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between py-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-3 w-8" />
            ))}
          </div>

          {/* Chart area with wave pattern */}
          <div className="absolute left-12 right-4 top-2 bottom-8 overflow-hidden">
            <svg className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="0.3">
                    <animate attributeName="offset" values="-1;1" dur="2s" repeatCount="indefinite" />
                  </stop>
                  <stop offset="50%" stopColor="hsl(var(--muted))" stopOpacity="0.6">
                    <animate attributeName="offset" values="-0.5;1.5" dur="2s" repeatCount="indefinite" />
                  </stop>
                  <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity="0.3">
                    <animate attributeName="offset" values="0;2" dur="2s" repeatCount="indefinite" />
                  </stop>
                </linearGradient>
              </defs>
              <path
                d="M 0 70 Q 50 30 100 50 T 200 40 T 300 60 T 400 35 T 500 55 T 600 45 T 700 65 T 800 40"
                fill="none"
                stroke="url(#shimmer)"
                strokeWidth="3"
                className="animate-pulse"
              />
              {chartType === "area" && (
                <path
                  d="M 0 70 Q 50 30 100 50 T 200 40 T 300 60 T 400 35 T 500 55 T 600 45 T 700 65 T 800 40 V 100 H 0 Z"
                  fill="url(#shimmer)"
                  opacity="0.3"
                />
              )}
            </svg>
          </div>

          {/* X-axis labels */}
          <div className="absolute left-12 right-4 bottom-0 h-6 flex justify-between">
            {[...Array(itemCount)].map((_, i) => (
              <Skeleton key={i} className="h-3 w-6" />
            ))}
          </div>

          {showSpinner && <LoadingOverlay message={message} />}
        </div>
      );
    }

    // Pie chart skeleton
    if (chartType === "pie") {
      return (
        <div
          ref={ref}
          className={cn("relative w-full flex items-center justify-center", className)}
          style={{ height: chartHeight }}
          {...props}
        >
          <div className="relative">
            <Skeleton className="w-48 h-48 rounded-full" />
            <div className="absolute inset-8 bg-background rounded-full" />
          </div>

          {/* Legend */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="w-3 h-3 rounded-full" />
                <Skeleton className="w-16 h-3" />
              </div>
            ))}
          </div>

          {showSpinner && <LoadingOverlay message={message} />}
        </div>
      );
    }

    // Table skeleton
    if (chartType === "table") {
      return (
        <div
          ref={ref}
          className={cn("w-full space-y-2", className)}
          style={{ height: chartHeight }}
          {...props}
        >
          {/* Header */}
          <div className="flex gap-4 pb-2 border-b border-border">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>

          {/* Rows */}
          {[...Array(itemCount)].map((_, i) => (
            <div 
              key={i} 
              className="flex items-center gap-4 py-2"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}

          {showSpinner && <LoadingOverlay message={message} />}
        </div>
      );
    }

    // Sankey chart skeleton
    if (chartType === "sankey") {
      return (
        <div
          ref={ref}
          className={cn("relative w-full", className)}
          style={{ height: chartHeight }}
          {...props}
        >
          <div className="absolute inset-4 flex justify-between">
            {/* Left column */}
            <div className="flex flex-col justify-between h-full w-16">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-4 w-full rounded" />
              ))}
            </div>

            {/* Middle area with connecting lines */}
            <div className="flex-1 mx-4 relative">
              <svg className="w-full h-full" preserveAspectRatio="none">
                {[...Array(10)].map((_, i) => (
                  <path
                    key={i}
                    d={`M 0 ${10 + i * 10}% C 50% ${10 + i * 10}%, 50% ${5 + i * 10}%, 100% ${5 + i * 10}%`}
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="4"
                    opacity="0.3"
                    className="animate-pulse"
                    style={{ animationDelay: `${i * 100}ms` }}
                  />
                ))}
              </svg>
            </div>

            {/* Right column */}
            <div className="flex flex-col justify-between h-full w-16">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-4 w-full rounded" />
              ))}
            </div>
          </div>

          {showSpinner && <LoadingOverlay message={message} />}
        </div>
      );
    }

    // Default/custom skeleton
    return (
      <div
        ref={ref}
        className={cn("relative w-full flex items-center justify-center", className)}
        style={{ height: chartHeight }}
        {...props}
      >
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {message || "Loading chart data..."}
          </p>
        </div>
      </div>
    );
  }
);
F1ChartLoading.displayName = "F1ChartLoading";

// Loading overlay component
const LoadingOverlay = ({ message }: { message?: string }) => (
  <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">
        {message || "Loading..."}
      </p>
    </div>
  </div>
);

export { F1ChartLoading, LoadingOverlay };


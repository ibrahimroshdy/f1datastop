import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { F1EmptyState } from "./F1EmptyState";
import { F1ErrorState } from "./F1ErrorState";
import { ChartSkeleton } from "./F1Skeleton";

export interface F1ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  isLoading?: boolean;
  error?: Error | string | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  minHeight?: number | string;
  /** Use chart skeleton instead of spinner when loading */
  useSkeleton?: boolean;
  loadingMessage?: string;
  children?: React.ReactNode;
}

const F1ChartContainer = React.forwardRef<HTMLDivElement, F1ChartContainerProps>(
  (
    {
      className,
      isLoading = false,
      error = null,
      isEmpty = false,
      emptyTitle,
      emptyDescription,
      minHeight = 400,
      useSkeleton = false,
      loadingMessage = "Loading...",
      children,
      ...props
    },
    ref,
  ) => {
    const minHeightStyle =
      typeof minHeight === "number" ? `${minHeight}px` : minHeight;

    if (isLoading) {
      if (useSkeleton) {
        return (
          <div ref={ref} className={cn("w-full", className)} style={{ minHeight: minHeightStyle }} {...props}>
            <ChartSkeleton height={typeof minHeight === "number" ? minHeight : 400} className="h-full w-full" />
          </div>
        );
      }

      return (
        <div
          ref={ref}
          className={cn(
            "flex flex-col items-center justify-center gap-3 w-full",
            className,
          )}
          style={{ minHeight: minHeightStyle }}
          {...props}
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">{loadingMessage}</p>
        </div>
      );
    }

    if (error) {
      const message = typeof error === "string" ? error : error.message;
      return (
        <div
          ref={ref}
          className={cn("flex items-center justify-center w-full", className)}
          style={{ minHeight: minHeightStyle }}
          {...props}
        >
          <F1ErrorState type="generic" message={message} variant="inline" className="w-full max-w-lg" />
        </div>
      );
    }

    if (isEmpty) {
      return (
        <div
          ref={ref}
          className={cn("relative flex items-center justify-center w-full", className)}
          style={{ minHeight: minHeightStyle }}
          {...props}
        >
          <F1EmptyState
            type="no-chart-data"
            title={emptyTitle}
            description={emptyDescription}
            size="sm"
            showDecoration={false}
          />
        </div>
      );
    }

    return (
      <div ref={ref} className={cn("w-full", className)} style={{ minHeight: minHeightStyle }} {...props}>
        {children}
      </div>
    );
  },
);
F1ChartContainer.displayName = "F1ChartContainer";

export { F1ChartContainer };

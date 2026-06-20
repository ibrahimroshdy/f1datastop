import * as React from "react";
import { cn } from "@/lib/utils";
import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardHeader,
  F1CardTitle,
} from "@/components/f1";
import { Button } from "@/components/ui/button";
import { 
  Maximize2, 
  Download, 
  Settings, 
  RefreshCw,
  MoreVertical 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { F1Skeleton, ChartSkeleton } from "@/components/f1/F1Skeleton";
import { NoChartDataEmpty } from "@/components/f1/F1EmptyState";
import { DataLoadError } from "@/components/f1/F1ErrorState";
import { useTheme } from "@/context/ThemeContext";

interface F1ChartCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Chart title */
  title: string;
  /** Chart subtitle/description */
  subtitle?: string;
  /** Icon to display next to title */
  icon?: React.ReactNode;
  /** Whether data is loading */
  loading?: boolean;
  /** Whether data is empty */
  empty?: boolean;
  /** Custom empty message */
  emptyMessage?: string;
  /** Error object or message */
  error?: Error | string | null;
  /** Retry callback for error state */
  onRetry?: () => void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
  /** Custom actions to render in header */
  actions?: React.ReactNode;
  /** Fullscreen callback */
  onFullscreen?: () => void;
  /** Download callback */
  onDownload?: () => void;
  /** Settings callback */
  onSettings?: () => void;
  /** Chart height */
  height?: number | string;
  /** Whether to show the default action buttons */
  showActions?: boolean;
  /** Footer content */
  footer?: React.ReactNode;
  /** Whether the card is compact (reduced padding) */
  compact?: boolean;
}

const F1ChartCard = React.forwardRef<HTMLDivElement, F1ChartCardProps>(
  ({ 
    className, 
    title,
    subtitle,
    icon,
    loading = false,
    empty = false,
    emptyMessage,
    error,
    onRetry,
    isRetrying = false,
    actions,
    onFullscreen,
    onDownload,
    onSettings,
    height = 400,
    showActions = true,
    footer,
    compact = false,
    children,
    ...props 
  }, ref) => {
    const { isGlass } = useTheme();
    const surfaceVariant = isGlass ? ("glass" as const) : ("default" as const);
    const surfaceGlass = isGlass ? ("panel" as const) : ("default" as const);
    const hasDefaultActions = onFullscreen || onDownload || onSettings;
    const chartHeight = typeof height === "number" ? `${height}px` : height;
    const cardShell = cn("overflow-hidden", isGlass && "border-white/10", className);

    if (loading) {
      return (
        <F1Card
          ref={ref}
          variant={surfaceVariant}
          glassVariant={surfaceGlass}
          className={cardShell}
          {...props}
        >
          <F1CardHeader className={cn(compact && "pb-2")}>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <F1Skeleton width={200} height={24} />
                {subtitle && <F1Skeleton width={150} height={16} />}
              </div>
              {showActions && <F1Skeleton width={100} height={32} />}
            </div>
          </F1CardHeader>
          <F1CardContent className={cn(compact && "pt-0")}>
            <div style={{ height: chartHeight }}>
              <ChartSkeleton height={typeof height === "number" ? height - 50 : 350} />
            </div>
          </F1CardContent>
        </F1Card>
      );
    }

    if (error) {
      return (
        <F1Card
          ref={ref}
          variant={surfaceVariant}
          glassVariant={surfaceGlass}
          className={cardShell}
          {...props}
        >
          <F1CardHeader className={cn(compact && "pb-2")}>
            <div className="flex items-center gap-2">
              {icon && <span className="text-primary">{icon}</span>}
              <F1CardTitle className="text-lg">{title}</F1CardTitle>
            </div>
            {subtitle && <F1CardDescription>{subtitle}</F1CardDescription>}
          </F1CardHeader>
          <F1CardContent className={cn(compact && "pt-0")}>
            <div 
              className="flex items-center justify-center"
              style={{ height: chartHeight }}
            >
              <DataLoadError 
                dataType={title}
                onRetry={onRetry}
                isRetrying={isRetrying}
              />
            </div>
          </F1CardContent>
        </F1Card>
      );
    }

    if (empty) {
      return (
        <F1Card
          ref={ref}
          variant={surfaceVariant}
          glassVariant={surfaceGlass}
          className={cardShell}
          {...props}
        >
          <F1CardHeader className={cn(compact && "pb-2")}>
            <div className="flex items-center gap-2">
              {icon && <span className="text-primary">{icon}</span>}
              <F1CardTitle className="text-lg">{title}</F1CardTitle>
            </div>
            {subtitle && <F1CardDescription>{subtitle}</F1CardDescription>}
          </F1CardHeader>
          <F1CardContent className={cn(compact && "pt-0")}>
            <div 
              className="flex items-center justify-center"
              style={{ height: chartHeight }}
            >
              <NoChartDataEmpty chartType={title} />
            </div>
          </F1CardContent>
        </F1Card>
      );
    }

    return (
      <F1Card
        ref={ref}
        variant={surfaceVariant}
        glassVariant={surfaceGlass}
        className={cardShell}
        {...props}
      >
        <F1CardHeader className={cn("flex flex-row items-start justify-between space-y-0", compact && "pb-2")}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {icon && <span className="text-primary">{icon}</span>}
              <F1CardTitle className="text-lg">{title}</F1CardTitle>
            </div>
            {subtitle && <F1CardDescription>{subtitle}</F1CardDescription>}
          </div>

          <div className="flex items-center gap-2">
            {actions}
            
            {showActions && hasDefaultActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Chart options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onFullscreen && (
                    <DropdownMenuItem onClick={onFullscreen}>
                      <Maximize2 className="mr-2 h-4 w-4" />
                      Fullscreen
                    </DropdownMenuItem>
                  )}
                  {onDownload && (
                    <DropdownMenuItem onClick={onDownload}>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </DropdownMenuItem>
                  )}
                  {(onFullscreen || onDownload) && onSettings && <DropdownMenuSeparator />}
                  {onSettings && (
                    <DropdownMenuItem onClick={onSettings}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                  )}
                  {onRetry && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onRetry} disabled={isRetrying}>
                        <RefreshCw className={cn("mr-2 h-4 w-4", isRetrying && "animate-spin")} />
                        Refresh
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </F1CardHeader>

        <F1CardContent className={cn(compact && "pt-0")}>
          <div style={{ height: chartHeight }}>
            {children}
          </div>
        </F1CardContent>

        {footer && (
          <div className="border-t border-border px-6 pb-4 pt-2">
            {footer}
          </div>
        )}
      </F1Card>
    );
  }
);
F1ChartCard.displayName = "F1ChartCard";

export { F1ChartCard };

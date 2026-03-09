import * as React from "react";
import MuiThemeWrapper from "@/components/analytics/MuiThemeWrapper";
import { F1ChartCard } from "./F1ChartCard";

export interface F1ChartProps {
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
  /** Chart height (number in px or CSS string) */
  height?: number | string;
  /** Whether to show the default action buttons */
  showActions?: boolean;
  /** Footer content */
  footer?: React.ReactNode;
  /** Whether the card is compact */
  compact?: boolean;
  /** Chart content (MUI X Charts or other chart). Wrapped in MuiThemeWrapper for theme consistency. */
  children: React.ReactNode;
  /** Additional class name for the card container */
  className?: string;
}

/**
 * Unified chart wrapper: F1ChartCard + MuiThemeWrapper.
 * Use for all MUI X Charts and other chart components that should follow
 * the design system (loading, error, empty, height, theming).
 */
const F1Chart = React.forwardRef<HTMLDivElement, F1ChartProps>(
  (
    {
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
      className,
    },
    ref
  ) => {
    return (
      <F1ChartCard
        ref={ref}
        className={className}
        title={title}
        subtitle={subtitle}
        icon={icon}
        loading={loading}
        empty={empty}
        emptyMessage={emptyMessage}
        error={error}
        onRetry={onRetry}
        isRetrying={isRetrying}
        actions={actions}
        onFullscreen={onFullscreen}
        onDownload={onDownload}
        onSettings={onSettings}
        height={height}
        showActions={showActions}
        footer={footer}
        compact={compact}
      >
        <MuiThemeWrapper>{children}</MuiThemeWrapper>
      </F1ChartCard>
    );
  }
);
F1Chart.displayName = "F1Chart";

export { F1Chart };

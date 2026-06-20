import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipItem {
  /** Label for the data point */
  label: string;
  /** Value to display */
  value: string | number;
  /** Color for the indicator */
  color?: string;
  /** Optional secondary value */
  secondaryValue?: string | number;
  /** Whether this is the highlighted/active item */
  active?: boolean;
}

interface F1ChartTooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tooltip title (e.g., "Lap 15" or "Monaco GP") */
  title?: string;
  /** Subtitle (e.g., date or additional context) */
  subtitle?: string;
  /** Items to display in the tooltip */
  items?: TooltipItem[];
  /** Whether the tooltip is visible */
  visible?: boolean;
  /** Custom content instead of items */
  children?: React.ReactNode;
}

const F1ChartTooltip = React.forwardRef<HTMLDivElement, F1ChartTooltipProps>(
  ({ 
    className, 
    title,
    subtitle,
    items = [],
    visible = true,
    children,
    ...props 
  }, ref) => {
    if (!visible) return null;

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border border-border bg-popover/95 backdrop-blur-sm",
          "p-3 shadow-xl",
          "text-popover-foreground",
          "min-w-[150px] max-w-[300px]",
          className
        )}
        {...props}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div className="mb-2 pb-2 border-b border-border">
            {title && (
              <div className="font-semibold text-sm">{title}</div>
            )}
            {subtitle && (
              <div className="text-xs text-muted-foreground">{subtitle}</div>
            )}
          </div>
        )}

        {/* Items */}
        {items.length > 0 ? (
          <div className="space-y-1.5">
            {items.map((item, index) => (
              <div 
                key={index}
                className={cn(
                  "flex items-center justify-between gap-4",
                  item.active && "font-medium"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.color && (
                    <div 
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                  <span className="text-sm truncate">{item.label}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-mono tabular-nums">
                    {item.value}
                  </span>
                  {item.secondaryValue && (
                    <span className="text-xs text-muted-foreground">
                      ({item.secondaryValue})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : children}
      </div>
    );
  }
);
F1ChartTooltip.displayName = "F1ChartTooltip";

// Recharts-compatible tooltip wrapper
interface RechartsTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number | string;
    color?: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string;
  /** Format function for values */
  valueFormatter?: (value: number | string, name: string) => string;
  /** Format function for label */
  labelFormatter?: (label: string) => string;
  /** Custom title */
  title?: string;
}

const F1RechartsTooltip: React.FC<RechartsTooltipProps> = ({
  active,
  payload,
  label,
  valueFormatter,
  labelFormatter,
  title,
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const formattedLabel = labelFormatter ? labelFormatter(label || "") : label;
  const items: TooltipItem[] = payload.map((entry) => ({
    label: entry.name,
    value: valueFormatter 
      ? valueFormatter(entry.value, entry.name) 
      : entry.value,
    color: entry.color,
  }));

  return (
    <F1ChartTooltip
      title={title || formattedLabel}
      items={items}
    />
  );
};

// Time-formatted tooltip for lap times
interface LapTimeTooltipProps extends RechartsTooltipProps {
  /** Whether to show gap to leader */
  showGap?: boolean;
}

const F1LapTimeTooltip: React.FC<LapTimeTooltipProps> = ({
  active,
  payload,
  label = false,
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const formatTime = (seconds: number | string): string => {
    if (typeof seconds === "string") return seconds;
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, "0")}`;
  };

  const items: TooltipItem[] = payload.map((entry) => ({
    label: entry.name,
    value: formatTime(entry.value as number),
    color: entry.color,
  }));

  return (
    <F1ChartTooltip
      title={`Lap ${label}`}
      items={items}
    />
  );
};

export { F1ChartTooltip, F1RechartsTooltip, F1LapTimeTooltip };


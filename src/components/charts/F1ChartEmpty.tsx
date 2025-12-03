import * as React from "react";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  TrendingUp,
  Activity,
  Clock,
  Flag,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";

type ChartType = "bar" | "line" | "pie" | "area" | "scatter" | "sankey" | "custom";

interface F1ChartEmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Type of chart (affects the icon shown) */
  chartType?: ChartType;
  /** Custom title */
  title?: string;
  /** Custom message */
  message?: string;
  /** Action button text */
  actionText?: string;
  /** Action callback */
  onAction?: () => void;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Custom icon */
  icon?: React.ReactNode;
}

const chartIcons: Record<ChartType, React.ComponentType<{ className?: string }>> = {
  bar: BarChart3,
  line: LineChart,
  pie: PieChart,
  area: TrendingUp,
  scatter: Activity,
  sankey: Users,
  custom: BarChart3,
};

const sizeClasses = {
  sm: {
    container: "py-6",
    icon: "h-8 w-8",
    title: "text-sm",
    message: "text-xs",
  },
  md: {
    container: "py-10",
    icon: "h-12 w-12",
    title: "text-base",
    message: "text-sm",
  },
  lg: {
    container: "py-16",
    icon: "h-16 w-16",
    title: "text-lg",
    message: "text-base",
  },
};

const F1ChartEmpty = React.forwardRef<HTMLDivElement, F1ChartEmptyProps>(
  ({ 
    className, 
    chartType = "bar",
    title = "No Data Available",
    message = "There's no data to display in this chart. Try selecting different options or check back later.",
    actionText,
    onAction,
    size = "md",
    icon,
    ...props 
  }, ref) => {
    const IconComponent = chartIcons[chartType];
    const sizes = sizeClasses[size];

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center text-center h-full",
          sizes.container,
          className
        )}
        {...props}
      >
        {/* Decorative chart placeholder */}
        <div className="relative mb-4">
          {/* Background decoration */}
          <div className="absolute inset-0 flex items-end justify-center gap-1 opacity-10">
            {[40, 65, 45, 80, 55, 70, 50].map((height, i) => (
              <div
                key={i}
                className="w-3 bg-muted-foreground rounded-t"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          
          {/* Icon */}
          <div className="relative p-4 bg-muted/50 rounded-full">
            {icon || <IconComponent className={cn(sizes.icon, "text-muted-foreground")} />}
          </div>
        </div>

        {/* Title */}
        <h4 className={cn("font-semibold text-foreground mb-1", sizes.title)}>
          {title}
        </h4>

        {/* Message */}
        <p className={cn("text-muted-foreground max-w-xs", sizes.message)}>
          {message}
        </p>

        {/* Action button */}
        {actionText && onAction && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onAction}
            className="mt-4"
          >
            {actionText}
          </Button>
        )}
      </div>
    );
  }
);
F1ChartEmpty.displayName = "F1ChartEmpty";

// Pre-configured empty states for specific chart types
const LapTimeChartEmpty = ({ onSelectDrivers }: { onSelectDrivers?: () => void }) => (
  <F1ChartEmpty
    chartType="line"
    title="No Lap Times"
    message="Select drivers to compare their lap times throughout the race."
    actionText={onSelectDrivers ? "Select Drivers" : undefined}
    onAction={onSelectDrivers}
    icon={<Clock className="h-12 w-12 text-muted-foreground" />}
  />
);

const PositionChartEmpty = () => (
  <F1ChartEmpty
    chartType="line"
    title="No Position Data"
    message="Position data will be available once the race starts."
    icon={<TrendingUp className="h-12 w-12 text-muted-foreground" />}
  />
);

const QualifyingChartEmpty = () => (
  <F1ChartEmpty
    chartType="bar"
    title="No Qualifying Data"
    message="Qualifying results will appear here after the session is completed."
    icon={<Flag className="h-12 w-12 text-muted-foreground" />}
  />
);

const StandingsChartEmpty = () => (
  <F1ChartEmpty
    chartType="bar"
    title="Season Starting Soon"
    message="Championship standings will update after the first race of the season."
    icon={<Users className="h-12 w-12 text-muted-foreground" />}
  />
);

export { 
  F1ChartEmpty, 
  LapTimeChartEmpty, 
  PositionChartEmpty, 
  QualifyingChartEmpty,
  StandingsChartEmpty 
};


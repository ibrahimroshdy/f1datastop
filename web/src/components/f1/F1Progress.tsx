import * as React from "react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface F1ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current value (0-100 or actual points) */
  value: number;
  /** Maximum value (for calculating percentage) */
  max?: number;
  /** Team color for the progress bar */
  teamColor?: string;
  /** Size variant */
  size?: "xs" | "sm" | "md" | "lg";
  /** Whether to show the value label */
  showLabel?: boolean;
  /** Label format */
  labelFormat?: "percentage" | "value" | "fraction";
  /** Whether to animate the progress */
  animated?: boolean;
  /** Whether to show a gradient effect */
  gradient?: boolean;
  /** Secondary color for gradient */
  secondaryColor?: string;
}

const sizeClasses = {
  xs: "h-1",
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
};

const F1Progress = React.forwardRef<HTMLDivElement, F1ProgressProps>(
  ({ 
    className, 
    value, 
    max = 100,
    teamColor,
    size = "md",
    showLabel = false,
    labelFormat = "percentage",
    animated = true,
    gradient = false,
    secondaryColor,
    ...props 
  }, ref) => {
    const percentage = max > 0 ? Math.min(100, (value / max) * 100) : 0;

    const formatLabel = () => {
      switch (labelFormat) {
        case "percentage":
          return `${Math.round(percentage)}%`;
        case "value":
          return value.toString();
        case "fraction":
          return `${value}/${max}`;
        default:
          return `${Math.round(percentage)}%`;
      }
    };

    const indicatorStyle: React.CSSProperties = {
      backgroundColor: teamColor,
      ...(gradient && secondaryColor && {
        background: `linear-gradient(90deg, ${teamColor} 0%, ${secondaryColor} 100%)`,
      }),
      ...(animated && {
        transition: "width 0.5s ease-out",
      }),
    };

    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        {showLabel && (
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-muted-foreground">Progress</span>
            <span className="text-xs font-medium tabular-nums">{formatLabel()}</span>
          </div>
        )}
        <Progress 
          value={percentage} 
          className={cn(sizeClasses[size], "bg-muted")}
          indicatorStyle={indicatorStyle}
        />
      </div>
    );
  }
);
F1Progress.displayName = "F1Progress";

// Points progress bar specifically for standings
interface PointsProgressProps extends Omit<F1ProgressProps, "value" | "max" | "labelFormat"> {
  points: number;
  maxPoints: number;
  /** Whether to show points label */
  showPoints?: boolean;
}

const PointsProgress = React.forwardRef<HTMLDivElement, PointsProgressProps>(
  ({ points, maxPoints, showPoints = true, showLabel, ...props }, ref) => (
    <F1Progress 
      ref={ref}
      value={points}
      max={maxPoints}
      showLabel={showLabel || showPoints}
      labelFormat="value"
      {...props}
    />
  )
);
PointsProgress.displayName = "PointsProgress";

// Comparison progress bar showing two values
interface ComparisonProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** First value */
  value1: number;
  /** Second value */
  value2: number;
  /** First team color */
  color1?: string;
  /** Second team color */
  color2?: string;
  /** First label */
  label1?: string;
  /** Second label */
  label2?: string;
  /** Size variant */
  size?: "xs" | "sm" | "md" | "lg";
}

const ComparisonProgress = React.forwardRef<HTMLDivElement, ComparisonProgressProps>(
  ({ 
    className, 
    value1, 
    value2, 
    color1 = "hsl(var(--primary))",
    color2 = "hsl(var(--muted-foreground))",
    label1,
    label2,
    size = "md",
    ...props 
  }, ref) => {
    const total = value1 + value2;
    const percentage1 = total > 0 ? (value1 / total) * 100 : 50;

    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        {(label1 || label2) && (
          <div className="flex justify-between items-center mb-1 text-xs">
            <span style={{ color: color1 }}>{label1} ({value1})</span>
            <span style={{ color: color2 }}>{label2} ({value2})</span>
          </div>
        )}
        <div className={cn("w-full rounded-full overflow-hidden flex", sizeClasses[size])}>
          <div 
            className="h-full transition-all duration-500"
            style={{ 
              width: `${percentage1}%`,
              backgroundColor: color1,
            }}
          />
          <div 
            className="h-full transition-all duration-500"
            style={{ 
              width: `${100 - percentage1}%`,
              backgroundColor: color2,
            }}
          />
        </div>
      </div>
    );
  }
);
ComparisonProgress.displayName = "ComparisonProgress";

export { F1Progress, PointsProgress, ComparisonProgress };


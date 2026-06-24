import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { Trophy, Medal, AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react';

interface F1BadgeProps extends Omit<BadgeProps, "variant"> {
  /** Badge variant */
  variant?: "default" | "position" | "status" | "team" | "points" | "time";
  /** Position number (for position variant) */
  position?: number;
  /** Team color (for team variant) */
  teamColor?: string;
  /** Status type (for status variant) */
  status?: "completed" | "upcoming" | "live" | "cancelled" | "delayed";
  /** Whether to show an icon */
  showIcon?: boolean;
}

const F1Badge = React.forwardRef<HTMLDivElement, F1BadgeProps>(
  ({ 
    className, 
    variant = "default", 
    position, 
    teamColor, 
    status,
    showIcon = true,
    children, 
    ...props 
  }, ref) => {
    // Position badge styling
    if (variant === "position" && position !== undefined) {
      const positionStyles = {
        1: "bg-position-gold text-background border-position-gold",
        2: "bg-position-silver text-background border-position-silver",
        3: "bg-position-bronze text-foreground border-position-bronze",
      }[position] || "bg-secondary text-secondary-foreground border-border";

      const PositionIcon = position === 1 ? Trophy : position <= 3 ? Medal : null;

      return (
        <Badge
          ref={ref}
          className={cn(
            "font-bold tabular-nums border",
            positionStyles,
            className
          )}
          {...props}
        >
          {showIcon && PositionIcon && <PositionIcon className="w-3 h-3 mr-1" />}
          P{position}
        </Badge>
      );
    }

    // Status badge styling
    if (variant === "status" && status) {
      const statusConfig = {
        completed: {
          classes: "bg-status-completed/20 text-status-completed border-status-completed/30",
          icon: CheckCircle,
          label: "Completed"
        },
        upcoming: {
          classes: "bg-status-upcoming/20 text-status-upcoming border-status-upcoming/30",
          icon: Clock,
          label: "Upcoming"
        },
        live: {
          classes: "bg-status-live/20 text-status-live border-status-live/30 animate-pulse",
          icon: Zap,
          label: "LIVE"
        },
        cancelled: {
          classes: "bg-status-cancelled/20 text-status-cancelled border-status-cancelled/30",
          icon: AlertTriangle,
          label: "Cancelled"
        },
        delayed: {
          classes: "bg-status-upcoming/20 text-status-upcoming border-status-upcoming/30",
          icon: Clock,
          label: "Delayed"
        },
      }[status];

      const StatusIcon = statusConfig.icon;

      return (
        <Badge
          ref={ref}
          className={cn(
            "font-medium border",
            statusConfig.classes,
            className
          )}
          {...props}
        >
          {showIcon && <StatusIcon className="w-3 h-3 mr-1" />}
          {children || statusConfig.label}
        </Badge>
      );
    }

    // Team badge styling
    if (variant === "team" && teamColor) {
      return (
        <Badge
          ref={ref}
          className={cn(
            "font-medium border",
            className
          )}
          style={{
            backgroundColor: `${teamColor}20`,
            color: teamColor,
            borderColor: `${teamColor}40`,
          }}
          {...props}
        >
          {children}
        </Badge>
      );
    }

    // Points badge styling
    if (variant === "points") {
      return (
        <Badge
          ref={ref}
          className={cn(
            "font-bold tabular-nums bg-primary/10 text-primary border border-primary/20",
            className
          )}
          {...props}
        >
          {children} PTS
        </Badge>
      );
    }

    // Time badge styling
    if (variant === "time") {
      return (
        <Badge
          ref={ref}
          className={cn(
            "font-mono tabular-nums bg-muted text-muted-foreground border border-border",
            className
          )}
          {...props}
        >
          {children}
        </Badge>
      );
    }

    // Default badge
    return (
      <Badge
        ref={ref}
        className={cn("font-medium", className)}
        {...props}
      >
        {children}
      </Badge>
    );
  }
);
F1Badge.displayName = "F1Badge";

// Specialized position badge component
interface PositionBadgeProps extends Omit<F1BadgeProps, "variant" | "position"> {
  position: number;
}

const PositionBadge = React.forwardRef<HTMLDivElement, PositionBadgeProps>(
  ({ position, ...props }, ref) => (
    <F1Badge ref={ref} variant="position" position={position} {...props} />
  )
);
PositionBadge.displayName = "PositionBadge";

// Specialized status badge component
interface StatusBadgeProps extends Omit<F1BadgeProps, "variant" | "status"> {
  status: "completed" | "upcoming" | "live" | "cancelled" | "delayed";
}

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ status, ...props }, ref) => (
    <F1Badge ref={ref} variant="status" status={status} {...props} />
  )
);
StatusBadge.displayName = "StatusBadge";

export { F1Badge, PositionBadge, StatusBadge };


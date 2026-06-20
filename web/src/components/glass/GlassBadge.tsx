import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const glassBadgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "glass-badge text-foreground",
        primary:
          "bg-primary/90 text-primary-foreground border-primary/50 backdrop-blur-sm",
        secondary:
          "glass-badge bg-secondary/50 text-secondary-foreground border-secondary/50",
        destructive:
          "bg-destructive/90 text-destructive-foreground border-destructive/50 backdrop-blur-sm",
        success:
          "bg-green-500/90 text-white border-green-500/50 backdrop-blur-sm",
        warning:
          "bg-yellow-500/90 text-yellow-950 border-yellow-500/50 backdrop-blur-sm",
        info: "bg-blue-500/90 text-white border-blue-500/50 backdrop-blur-sm",
        outline: "text-foreground border-border bg-transparent",
        // Position badges
        gold: "bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-950 border-yellow-500/50 shadow-[0_0_12px_rgba(234,179,8,0.4)]",
        silver:
          "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800 border-gray-300/50 shadow-[0_0_12px_rgba(156,163,175,0.4)]",
        bronze:
          "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-950 border-amber-500/50 shadow-[0_0_12px_rgba(217,119,6,0.4)]",
        // Status badges
        live: "bg-red-500/90 text-white border-red-500/50 backdrop-blur-sm animate-pulse",
        upcoming:
          "bg-blue-500/90 text-white border-blue-500/50 backdrop-blur-sm",
        completed:
          "bg-green-500/90 text-white border-green-500/50 backdrop-blur-sm",
        cancelled:
          "bg-gray-500/90 text-white border-gray-500/50 backdrop-blur-sm",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        default: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface GlassBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassBadgeVariants> {
  /** Icon to display before text */
  icon?: React.ReactNode;
  /** Whether to show a dot indicator */
  dot?: boolean;
  /** Dot color */
  dotColor?: string;
}

const GlassBadge = React.forwardRef<HTMLDivElement, GlassBadgeProps>(
  (
    { className, variant, size, icon, dot, dotColor, children, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(glassBadgeVariants({ variant, size }), className)}
        {...props}
      >
        {dot && (
          <span
            className="mr-1.5 h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: dotColor || "currentColor" }}
          />
        )}
        {icon && <span className="mr-1">{icon}</span>}
        {children}
      </div>
    );
  }
);
GlassBadge.displayName = "GlassBadge";

// Position Badge - specifically for race positions
const PositionBadge = React.forwardRef<
  HTMLDivElement,
  Omit<GlassBadgeProps, "variant"> & { position: number }
>(({ position, className, ...props }, ref) => {
  const variant =
    position === 1
      ? "gold"
      : position === 2
      ? "silver"
      : position === 3
      ? "bronze"
      : "default";

  return (
    <GlassBadge
      ref={ref}
      variant={variant}
      className={cn("min-w-[2rem] justify-center", className)}
      {...props}
    >
      P{position}
    </GlassBadge>
  );
});
PositionBadge.displayName = "PositionBadge";

// Status Badge - for race/session status
const StatusBadge = React.forwardRef<
  HTMLDivElement,
  Omit<GlassBadgeProps, "variant"> & {
    status: "live" | "upcoming" | "completed" | "cancelled";
  }
>(({ status, className, children, ...props }, ref) => {
  const statusLabels = {
    live: "LIVE",
    upcoming: "Upcoming",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return (
    <GlassBadge
      ref={ref}
      variant={status}
      dot={status === "live"}
      className={className}
      {...props}
    >
      {children || statusLabels[status]}
    </GlassBadge>
  );
});
StatusBadge.displayName = "StatusBadge";

// Team Badge - with team color
const TeamBadge = React.forwardRef<
  HTMLDivElement,
  Omit<GlassBadgeProps, "variant"> & {
    teamColor: string;
    teamName: string;
  }
>(({ teamColor, teamName, className, ...props }, ref) => {
  return (
    <GlassBadge
      ref={ref}
      variant="default"
      className={cn("border-l-2", className)}
      style={{ borderLeftColor: teamColor }}
      {...props}
    >
      {teamName}
    </GlassBadge>
  );
});
TeamBadge.displayName = "TeamBadge";

export {
  GlassBadge,
  PositionBadge,
  StatusBadge,
  TeamBadge,
  glassBadgeVariants,
};


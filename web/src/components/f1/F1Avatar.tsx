import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";

interface F1AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Image source URL */
  src?: string;
  /** Alt text for the image */
  alt?: string;
  /** Fallback text (usually initials) */
  fallback?: string;
  /** Team color for border/accent */
  teamColor?: string;
  /** Size variant */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Whether to show team color ring */
  showRing?: boolean;
  /** Driver number to display */
  driverNumber?: number | string;
  /** Whether this is a team logo avatar */
  isTeam?: boolean;
}

const sizeClasses = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-xl",
};

const ringClasses = {
  xs: "ring-1 ring-offset-1",
  sm: "ring-2 ring-offset-1",
  md: "ring-2 ring-offset-2",
  lg: "ring-2 ring-offset-2",
  xl: "ring-3 ring-offset-2",
};

const F1Avatar = React.forwardRef<HTMLDivElement, F1AvatarProps>(
  ({ 
    className, 
    src, 
    alt = "Avatar", 
    fallback, 
    teamColor,
    size = "md",
    showRing = false,
    driverNumber,
    isTeam = false,
    ...props 
  }, ref) => {
    const ringStyle = showRing && teamColor ? {
      "--tw-ring-color": teamColor,
    } as React.CSSProperties : {};

    return (
      <div ref={ref} className={cn("relative inline-flex", className)} {...props}>
        <Avatar 
          className={cn(
            sizeClasses[size],
            showRing && ringClasses[size],
            showRing && "ring-offset-background",
            isTeam && "rounded-md",
          )}
          style={ringStyle}
        >
          <AvatarImage 
            src={src} 
            alt={alt}
            className={cn(isTeam && "object-contain p-1")}
          />
          <AvatarFallback 
            className={cn(
              "font-bold",
              isTeam && "rounded-md",
              teamColor ? "text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
            style={teamColor ? { backgroundColor: teamColor } : undefined}
          >
            {fallback || (isTeam ? alt?.charAt(0) : <User className="w-1/2 h-1/2" />)}
          </AvatarFallback>
        </Avatar>

        {/* Driver number badge */}
        {driverNumber && (
          <span 
            className={cn(
              "absolute -bottom-1 -right-1 flex items-center justify-center",
              "rounded-full text-primary-foreground font-bold shadow-premium-sm",
              size === "xs" && "h-3 w-3 text-2xs",
              size === "sm" && "h-4 w-4 text-2xs",
              size === "md" && "h-5 w-5 text-xs",
              size === "lg" && "h-6 w-6 text-xs",
              size === "xl" && "h-8 w-8 text-sm",
            )}
            style={{ backgroundColor: teamColor || "hsl(var(--primary))" }}
          >
            {driverNumber}
          </span>
        )}
      </div>
    );
  }
);
F1Avatar.displayName = "F1Avatar";

// Driver avatar with team styling
interface DriverAvatarProps extends Omit<F1AvatarProps, "isTeam"> {
  driverCode?: string;
  driverName?: string;
}

const DriverAvatar = React.forwardRef<HTMLDivElement, DriverAvatarProps>(
  ({ driverCode, driverName, fallback, alt, ...props }, ref) => (
    <F1Avatar 
      ref={ref}
      fallback={fallback || driverCode?.substring(0, 2) || driverName?.charAt(0)}
      alt={alt || driverName || driverCode || "Driver"}
      showRing
      {...props}
    />
  )
);
DriverAvatar.displayName = "DriverAvatar";

// Team logo avatar
interface TeamAvatarProps extends Omit<F1AvatarProps, "isTeam" | "driverNumber" | "showRing"> {
  teamName?: string;
}

const TeamAvatar = React.forwardRef<HTMLDivElement, TeamAvatarProps>(
  ({ teamName, fallback, alt, ...props }, ref) => (
    <F1Avatar 
      ref={ref}
      isTeam
      fallback={fallback || teamName?.charAt(0)}
      alt={alt || teamName || "Team"}
      {...props}
    />
  )
);
TeamAvatar.displayName = "TeamAvatar";

export { F1Avatar, DriverAvatar, TeamAvatar };


import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface F1CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Team color for accent styling */
  teamColor?: string;
  /** Whether to show the team color accent bar */
  showAccent?: boolean;
  /** Accent position */
  accentPosition?: "top" | "left" | "bottom";
  /** Whether the card is in a loading state */
  loading?: boolean;
  /** Whether the card is interactive (hoverable) */
  interactive?: boolean;
  /** Gradient background variant */
  variant?: "default" | "gradient" | "glass";
}

const F1Card = React.forwardRef<HTMLDivElement, F1CardProps>(
  ({ 
    className, 
    teamColor, 
    showAccent = false, 
    accentPosition = "top",
    loading = false,
    interactive = false,
    variant = "default",
    children, 
    ...props 
  }, ref) => {
    const accentStyles = showAccent && teamColor ? {
      borderTopColor: accentPosition === "top" ? teamColor : undefined,
      borderLeftColor: accentPosition === "left" ? teamColor : undefined,
      borderBottomColor: accentPosition === "bottom" ? teamColor : undefined,
    } : {};

    const accentClasses = showAccent ? {
      top: "border-t-4",
      left: "border-l-4",
      bottom: "border-b-4",
    }[accentPosition] : "";

    const variantClasses = {
      default: "bg-card",
      gradient: "bg-gradient-to-br from-card to-card/80",
      glass: "bg-card/80 backdrop-blur-sm",
    }[variant];

    return (
      <Card
        ref={ref}
        className={cn(
          "overflow-hidden transition-all duration-300",
          variantClasses,
          accentClasses,
          interactive && "hover:shadow-lg hover:shadow-primary/10 cursor-pointer hover:scale-[1.01]",
          loading && "animate-pulse",
          className
        )}
        style={accentStyles}
        {...props}
      >
        {children}
      </Card>
    );
  }
);
F1Card.displayName = "F1Card";

const F1CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { teamColor?: string }
>(({ className, teamColor, children, ...props }, ref) => (
  <CardHeader
    ref={ref}
    className={cn("space-y-1.5", className)}
    {...props}
  >
    {teamColor && (
      <div 
        className="absolute top-0 left-0 right-0 h-1 opacity-80"
        style={{ backgroundColor: teamColor }}
      />
    )}
    {children}
  </CardHeader>
));
F1CardHeader.displayName = "F1CardHeader";

const F1CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement> & { 
    icon?: React.ReactNode;
    badge?: React.ReactNode;
  }
>(({ className, icon, badge, children, ...props }, ref) => (
  <CardTitle
    ref={ref}
    className={cn("flex items-center gap-2 text-lg font-bold", className)}
    {...props}
  >
    {icon && <span className="text-primary">{icon}</span>}
    <span className="flex-1">{children}</span>
    {badge}
  </CardTitle>
));
F1CardTitle.displayName = "F1CardTitle";

const F1CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <CardDescription
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
F1CardDescription.displayName = "F1CardDescription";

const F1CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <CardContent ref={ref} className={cn("", className)} {...props} />
));
F1CardContent.displayName = "F1CardContent";

const F1CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <CardFooter
    ref={ref}
    className={cn("flex items-center pt-4 border-t border-border", className)}
    {...props}
  />
));
F1CardFooter.displayName = "F1CardFooter";

export { 
  F1Card, 
  F1CardHeader, 
  F1CardTitle, 
  F1CardDescription, 
  F1CardContent, 
  F1CardFooter 
};


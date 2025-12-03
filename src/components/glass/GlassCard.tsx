import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const glassCardVariants = cva(
  "relative rounded-xl overflow-hidden transition-all duration-300",
  {
    variants: {
      variant: {
        default: "glass",
        glow: "glass-glow",
        panel: "glass-panel",
        subtle: "bg-card/50 backdrop-blur-sm border border-border/50",
      },
      size: {
        sm: "p-3",
        default: "p-4",
        lg: "p-6",
        xl: "p-8",
      },
      hover: {
        true: "hover:scale-[1.02] hover:shadow-lg cursor-pointer",
        false: "",
        lift: "hover:-translate-y-1 hover:shadow-lg cursor-pointer",
        glow: "hover:shadow-glow cursor-pointer",
      },
      accent: {
        none: "",
        red: "border-l-4 border-l-primary",
        team: "border-l-4",
        top: "border-t-4 border-t-primary",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      hover: false,
      accent: "none",
    },
  }
);

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {
  /** Team color for accent (when accent="team") */
  teamColor?: string;
  /** Whether to show the glass highlight effect */
  showHighlight?: boolean;
  /** Loading state */
  loading?: boolean;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      className,
      variant,
      size,
      hover,
      accent,
      teamColor,
      showHighlight = false,
      loading = false,
      children,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          glassCardVariants({ variant, size, hover, accent }),
          showHighlight && "glass-highlight",
          loading && "animate-pulse",
          className
        )}
        style={{
          ...style,
          ...(accent === "team" && teamColor
            ? { borderLeftColor: teamColor }
            : {}),
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
GlassCard.displayName = "GlassCard";

// Glass Card Header
const GlassCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-4", className)}
    {...props}
  />
));
GlassCardHeader.displayName = "GlassCardHeader";

// Glass Card Title
const GlassCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
GlassCardTitle.displayName = "GlassCardTitle";

// Glass Card Description
const GlassCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
GlassCardDescription.displayName = "GlassCardDescription";

// Glass Card Content
const GlassCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
));
GlassCardContent.displayName = "GlassCardContent";

// Glass Card Footer
const GlassCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4", className)}
    {...props}
  />
));
GlassCardFooter.displayName = "GlassCardFooter";

export {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
  GlassCardFooter,
  glassCardVariants,
};


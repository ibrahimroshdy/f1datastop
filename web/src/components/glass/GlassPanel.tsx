import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const glassPanelVariants = cva(
  "relative overflow-hidden transition-all duration-300",
  {
    variants: {
      variant: {
        default: "glass-panel",
        sidebar: "glass-sidebar",
        topbar: "glass-topbar",
        modal: "glass-modal",
      },
      rounded: {
        none: "rounded-none",
        sm: "rounded-lg",
        default: "rounded-xl",
        lg: "rounded-2xl",
        full: "rounded-full",
      },
      padding: {
        none: "p-0",
        sm: "p-3",
        default: "p-4 md:p-6",
        lg: "p-6 md:p-8",
        xl: "p-8 md:p-10",
      },
    },
    defaultVariants: {
      variant: "default",
      rounded: "default",
      padding: "default",
    },
  }
);

export interface GlassPanelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassPanelVariants> {
  /** Whether to show the glass highlight effect */
  showHighlight?: boolean;
}

const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  (
    {
      className,
      variant,
      rounded,
      padding,
      showHighlight = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          glassPanelVariants({ variant, rounded, padding }),
          showHighlight && "glass-highlight",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
GlassPanel.displayName = "GlassPanel";

// Glass Section - for content sections within panels
const GlassSection = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    title?: string;
    description?: string;
  }
>(({ className, title, description, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("space-y-4", className)}
    {...props}
  >
    {(title || description) && (
      <div className="space-y-1">
        {title && (
          <h4 className="text-sm font-medium leading-none">{title}</h4>
        )}
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    )}
    {children}
  </div>
));
GlassSection.displayName = "GlassSection";

// Glass Divider
const GlassDivider = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    orientation?: "horizontal" | "vertical";
  }
>(({ className, orientation = "horizontal", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "shrink-0 bg-border/50",
      orientation === "horizontal" ? "h-px w-full my-4" : "h-full w-px mx-4",
      className
    )}
    {...props}
  />
));
GlassDivider.displayName = "GlassDivider";

export { GlassPanel, GlassSection, GlassDivider, glassPanelVariants };


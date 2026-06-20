import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/** Card size for padding (used by F1CardHeader, F1CardContent when inside F1Card) */
export type F1CardSize = "sm" | "default" | "lg" | "xl";

/** Hover behavior for interactive cards */
export type F1CardHover = false | true | "lift" | "glow";

/** Accent position for team/brand accent bar */
export type F1CardAccent = "none" | "red" | "team" | "top";

/** Glass sub-variant when variant is "glass" */
export type F1CardGlassVariant = "default" | "glow" | "panel" | "subtle";

const f1CardVariants = cva(
  "relative rounded-xl overflow-hidden transition-all duration-300 border",
  {
    variants: {
      variant: {
        default: "bg-card border-border shadow-sm",
        gradient: "bg-gradient-to-br from-card to-card/80 border-border shadow-sm",
        glass: "border-border/50",
        "team-accent": "bg-card border-border shadow-sm",
      },
      glassVariant: {
        default: "glass",
        glow: "glass-glow",
        panel: "glass-panel",
        subtle: "bg-card/50 backdrop-blur-sm border-border/50",
      },
      size: {
        sm: "",
        default: "",
        lg: "",
        xl: "",
      },
      hover: {
        false: "",
        true: "hover:scale-[1.02] hover:shadow-lg cursor-pointer",
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
    compoundVariants: [
      { variant: "glass", glassVariant: "default", class: "glass" },
      { variant: "glass", glassVariant: "glow", class: "glass-glow" },
      { variant: "glass", glassVariant: "panel", class: "glass-panel" },
      { variant: "glass", glassVariant: "subtle", class: "bg-card/50 backdrop-blur-sm border-border/50" },
    ],
    defaultVariants: {
      variant: "default",
      glassVariant: "default",
      size: "default",
      hover: false,
      accent: "none",
    },
  }
);

const sizePaddingMap: Record<F1CardSize, string> = {
  sm: "p-3",
  default: "p-4",
  lg: "p-6",
  xl: "p-8",
};

// When variant is glass, root has padding; header/content should not double it
const headerPaddingMap: Record<F1CardSize, Record<string, string>> = {
  sm: { default: "p-0 pb-0", glass: "p-0 pb-0" },
  default: { default: "p-4 space-y-1.5", glass: "pb-4 space-y-1.5" },
  lg: { default: "p-6 space-y-1.5", glass: "p-6 space-y-1.5" },
  xl: { default: "p-8 space-y-1.5", glass: "p-8 space-y-1.5" },
};

const contentPaddingMap: Record<F1CardSize, Record<string, string>> = {
  sm: { default: "p-0 pt-0", glass: "p-0 pt-0" },
  default: { default: "pt-0 p-4", glass: "pt-0" },
  lg: { default: "p-6 pt-0", glass: "p-6 pt-0" },
  xl: { default: "p-8 pt-0", glass: "p-8 pt-0" },
};

interface F1CardContextValue {
  size: F1CardSize;
  variant: "default" | "gradient" | "glass" | "team-accent";
}

const F1CardContext = React.createContext<F1CardContextValue>({ size: "default", variant: "default" });

export interface F1CardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "color">,
    Omit<VariantProps<typeof f1CardVariants>, "glassVariant"> {
  /** Team color for accent styling (accent bar or when accent="team") */
  teamColor?: string;
  /** Whether to show the team color accent bar (for variant="team-accent" or accent="team") */
  showAccent?: boolean;
  /** Accent position */
  accentPosition?: "top" | "left" | "bottom";
  /** Whether the card is in a loading state */
  loading?: boolean;
  /** Whether the card is interactive (hoverable) - alias for hover={true} */
  interactive?: boolean;
  /** Glass sub-variant when variant="glass" */
  glassVariant?: F1CardGlassVariant;
}

const F1Card = React.forwardRef<HTMLDivElement, F1CardProps>(
  (
    {
      className,
      teamColor,
      showAccent = false,
      accentPosition = "top",
      loading = false,
      interactive = false,
      variant = "default",
      glassVariant = "default",
      size = "default",
      hover = false,
      accent = "none",
      children,
      style,
      ...props
    },
    ref
  ) => {
    const effectiveHover = interactive ? true : hover;
    const effectiveAccent =
      accent !== "none"
        ? accent
        : showAccent && teamColor
          ? accentPosition === "left"
            ? "team"
            : accentPosition === "top"
              ? "top"
              : "team"
          : "none";

    const accentStyles =
      effectiveAccent === "team" && teamColor ? { borderLeftColor: teamColor } : {};

    const variantClasses = f1CardVariants({
      variant,
      glassVariant: variant === "glass" ? glassVariant : undefined,
      size,
      hover: effectiveHover,
      accent: variant === "team-accent" && showAccent && teamColor ? (accentPosition === "top" ? "top" : "team") : effectiveAccent,
    });

    const resolvedSize: F1CardSize = size ?? "default";
    const resolvedVariant = variant ?? "default";

    const sizePadding = sizePaddingMap[resolvedSize];

    const contextValue: F1CardContextValue = React.useMemo(
      () => ({ size: resolvedSize, variant: resolvedVariant }),
      [resolvedSize, resolvedVariant]
    );

    const sharedClassName = cn(
      variantClasses,
      sizePadding,
      loading && "animate-pulse",
      className
    );

    const content =
      variant === "glass" ? (
        <div
          ref={ref}
          className={sharedClassName}
          style={{ ...accentStyles, ...style }}
          {...props}
        >
          <F1CardContext.Provider value={contextValue}>
            {children}
          </F1CardContext.Provider>
        </div>
      ) : (
        <Card
          ref={ref}
          className={sharedClassName}
          style={accentStyles}
          {...props}
        >
          <F1CardContext.Provider value={contextValue}>
            {children}
          </F1CardContext.Provider>
        </Card>
      );

    return content;
  }
);
F1Card.displayName = "F1Card";

const F1CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { teamColor?: string }
>(({ className, teamColor, children, ...props }, ref) => {
  const { size, variant } = React.useContext(F1CardContext);
  const paddingClass = headerPaddingMap[size][variant === "glass" ? "glass" : "default"];
  return (
    <CardHeader
      ref={ref}
      className={cn(paddingClass, className)}
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
  );
});
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
>(({ className, ...props }, ref) => {
  const { size, variant } = React.useContext(F1CardContext);
  const paddingClass = contentPaddingMap[size][variant === "glass" ? "glass" : "default"];
  return (
    <CardContent
      ref={ref}
      className={cn(paddingClass, className)}
      {...props}
    />
  );
});
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
  F1CardFooter,
  f1CardVariants,
};

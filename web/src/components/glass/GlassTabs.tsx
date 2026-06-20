import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const GlassTabs = TabsPrimitive.Root;

const glassTabsListVariants = cva(
  "inline-flex items-center justify-center",
  {
    variants: {
      variant: {
        default: "glass-tabs h-10 p-1 text-muted-foreground",
        pills: "gap-2 bg-transparent",
        underline: "border-b border-border bg-transparent gap-4",
      },
      size: {
        sm: "h-9 text-sm",
        default: "h-10",
        lg: "h-12 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface GlassTabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof glassTabsListVariants> {}

const GlassTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  GlassTabsListProps
>(({ className, variant, size, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(glassTabsListVariants({ variant, size }), className)}
    {...props}
  />
));
GlassTabsList.displayName = TabsPrimitive.List.displayName;

const glassTabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "glass-tab rounded-md px-3 py-1.5 text-sm data-[state=active]:glass-tab-active data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        pills:
          "glass-button rounded-full px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
        underline:
          "border-b-2 border-transparent pb-3 pt-2 text-sm data-[state=active]:border-primary data-[state=active]:text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface GlassTabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof glassTabsTriggerVariants> {
  /** Icon to display before text */
  icon?: React.ReactNode;
  /** Badge/count to display after text */
  badge?: React.ReactNode;
}

const GlassTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  GlassTabsTriggerProps
>(({ className, variant, icon, badge, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(glassTabsTriggerVariants({ variant }), className)}
    {...props}
  >
    {icon && <span className="mr-2">{icon}</span>}
    {children}
    {badge && <span className="ml-2">{badge}</span>}
  </TabsPrimitive.Trigger>
));
GlassTabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const GlassTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content> & {
    /** Whether to animate content changes */
    animate?: boolean;
  }
>(({ className, animate = true, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      animate && "data-[state=active]:animate-fade-in",
      className
    )}
    {...props}
  />
));
GlassTabsContent.displayName = TabsPrimitive.Content.displayName;

// Preset: Session Tabs (Q1, Q2, Q3, Race, etc.)
interface SessionTabsProps {
  sessions: Array<{
    id: string;
    label: string;
    disabled?: boolean;
    badge?: React.ReactNode;
  }>;
  value: string;
  onValueChange: (value: string) => void;
  variant?: "default" | "pills" | "underline";
  className?: string;
}

const SessionTabs = ({
  sessions,
  value,
  onValueChange,
  variant = "default",
  className,
}: SessionTabsProps) => (
  <GlassTabs value={value} onValueChange={onValueChange} className={className}>
    <GlassTabsList variant={variant}>
      {sessions.map((session) => (
        <GlassTabsTrigger
          key={session.id}
          value={session.id}
          variant={variant}
          disabled={session.disabled}
          badge={session.badge}
        >
          {session.label}
        </GlassTabsTrigger>
      ))}
    </GlassTabsList>
  </GlassTabs>
);

export {
  GlassTabs,
  GlassTabsList,
  GlassTabsTrigger,
  GlassTabsContent,
  SessionTabs,
  glassTabsListVariants,
  glassTabsTriggerVariants,
};


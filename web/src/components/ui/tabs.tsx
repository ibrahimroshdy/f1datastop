import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"
import { SlidingPill } from "@/components/ui/sliding-pill"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const inner = React.useRef<HTMLDivElement>(null)
  React.useImperativeHandle(ref, () => inner.current as HTMLDivElement)
  // A pill track with the sliding act pill (D7). Items wrap rather than scroll or truncate.
  return (
    <TabsPrimitive.List
      ref={inner}
      className={cn(
        "group/tabs relative inline-flex h-auto max-w-full flex-wrap items-center gap-1 rounded-[22px] bg-muted p-1 text-ink-2 ring-1 ring-border",
        className
      )}
      {...props}
    >
      <SlidingPill containerRef={inner} activeSelector="[role=tab][data-state=active]" />
      {children}
    </TabsPrimitive.List>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "press relative z-10 inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:bg-act data-[state=active]:text-on-act group-data-[pill=ready]/tabs:data-[state=active]:bg-transparent",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }

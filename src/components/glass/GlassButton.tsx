import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

const glassButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "glass-button text-foreground",
        primary:
          "bg-primary/90 text-primary-foreground hover:bg-primary backdrop-blur-sm shadow-md hover:shadow-lg",
        secondary:
          "glass-button bg-secondary/50 text-secondary-foreground hover:bg-secondary/70",
        ghost:
          "hover:bg-accent/50 hover:text-accent-foreground backdrop-blur-sm",
        outline:
          "border border-input bg-transparent hover:bg-accent/50 hover:text-accent-foreground backdrop-blur-sm",
        destructive:
          "bg-destructive/90 text-destructive-foreground hover:bg-destructive backdrop-blur-sm",
        glow: "glass-button hover:shadow-glow",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-lg px-8",
        xl: "h-12 rounded-xl px-10 text-base",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    
    return (
      <Comp
        className={cn(glassButtonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {children}
          </>
        ) : (
          <>
            {leftIcon && <span className="mr-2">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="ml-2">{rightIcon}</span>}
          </>
        )}
      </Comp>
    );
  }
);
GlassButton.displayName = "GlassButton";

// Icon Button variant
const GlassIconButton = React.forwardRef<
  HTMLButtonElement,
  Omit<GlassButtonProps, "leftIcon" | "rightIcon"> & {
    icon: React.ReactNode;
    "aria-label": string;
  }
>(({ className, icon, size = "icon", ...props }, ref) => (
  <GlassButton
    ref={ref}
    size={size}
    className={cn("p-0", className)}
    {...props}
  >
    {icon}
  </GlassButton>
));
GlassIconButton.displayName = "GlassIconButton";

export { GlassButton, GlassIconButton, glassButtonVariants };


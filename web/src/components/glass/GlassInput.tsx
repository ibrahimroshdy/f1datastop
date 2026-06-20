import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Search, X, Eye, EyeOff } from "lucide-react";

const glassInputVariants = cva(
  "flex w-full rounded-lg border bg-transparent text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
  {
    variants: {
      variant: {
        default: "glass-input",
        outline: "border-input bg-transparent focus:border-primary",
        filled: "bg-muted/50 border-transparent focus:bg-muted/70",
      },
      inputSize: {
        sm: "h-9 px-3 text-xs",
        default: "h-10 px-4",
        lg: "h-12 px-5 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
);

export interface GlassInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof glassInputVariants> {
  /** Left icon or element */
  leftElement?: React.ReactNode;
  /** Right icon or element */
  rightElement?: React.ReactNode;
  /** Error state */
  error?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Show clear button */
  clearable?: boolean;
  /** Clear callback */
  onClear?: () => void;
}

const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  (
    {
      className,
      type,
      variant,
      inputSize,
      leftElement,
      rightElement,
      error,
      errorMessage,
      clearable,
      onClear,
      value,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const isPassword = type === "password";
    const inputType = isPassword && showPassword ? "text" : type;
    const hasValue = value !== undefined && value !== "";

    return (
      <div className="relative w-full">
        <div className="relative">
          {leftElement && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {leftElement}
            </div>
          )}
          <input
            type={inputType}
            className={cn(
              glassInputVariants({ variant, inputSize }),
              leftElement && "pl-10",
              (rightElement || clearable || isPassword) && "pr-10",
              error && "border-destructive focus:border-destructive",
              className
            )}
            ref={ref}
            value={value}
            {...props}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {clearable && hasValue && (
              <button
                type="button"
                onClick={onClear}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            )}
            {rightElement && !isPassword && !clearable && rightElement}
          </div>
        </div>
        {error && errorMessage && (
          <p className="mt-1.5 text-xs text-destructive">{errorMessage}</p>
        )}
      </div>
    );
  }
);
GlassInput.displayName = "GlassInput";

// Search Input variant
const GlassSearchInput = React.forwardRef<
  HTMLInputElement,
  Omit<GlassInputProps, "type" | "leftElement">
>(({ className, ...props }, ref) => (
  <GlassInput
    ref={ref}
    type="search"
    leftElement={<Search className="h-4 w-4" />}
    clearable
    className={className}
    {...props}
  />
));
GlassSearchInput.displayName = "GlassSearchInput";

// Textarea variant
export interface GlassTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof glassInputVariants> {
  error?: boolean;
  errorMessage?: string;
}

const GlassTextarea = React.forwardRef<HTMLTextAreaElement, GlassTextareaProps>(
  ({ className, variant, error, errorMessage, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-lg border bg-transparent px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
            variant === "default" && "glass-input",
            variant === "outline" && "border-input focus:border-primary",
            variant === "filled" && "bg-muted/50 border-transparent focus:bg-muted/70",
            error && "border-destructive focus:border-destructive",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && errorMessage && (
          <p className="mt-1.5 text-xs text-destructive">{errorMessage}</p>
        )}
      </div>
    );
  }
);
GlassTextarea.displayName = "GlassTextarea";

export { GlassInput, GlassSearchInput, GlassTextarea, glassInputVariants };


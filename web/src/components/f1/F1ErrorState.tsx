import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  RefreshCw,
  WifiOff,
  ServerCrash,
  Clock,
  Info,
  HelpCircle
} from "lucide-react";

type ErrorType =
  | "generic"
  | "network"
  | "server"
  | "timeout"
  | "not-found"
  | "rate-limit"
  | "custom";

interface F1ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Type of error */
  type?: ErrorType;
  /** Custom error title */
  title?: string;
  /** Custom error message */
  message?: string;
  /** Technical error details (shown in expandable section) */
  details?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
  /** Variant style */
  variant?: "inline" | "card" | "fullscreen";
  /** Size */
  size?: "sm" | "md" | "lg";
  /** Whether to show technical details */
  showDetails?: boolean;
}

const errorConfig: Record<ErrorType, {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
  variant: "default" | "destructive";
}> = {
  generic: {
    icon: AlertTriangle,
    title: "Something Went Wrong",
    message: "An unexpected error occurred. Please try again.",
    variant: "destructive",
  },
  network: {
    icon: WifiOff,
    title: "Connection Error",
    message: "Unable to connect to the server. Please check your internet connection.",
    variant: "destructive",
  },
  server: {
    icon: ServerCrash,
    title: "Server Error",
    message: "The server encountered an error. Our team has been notified.",
    variant: "destructive",
  },
  timeout: {
    icon: Clock,
    title: "Request Timeout",
    message: "The request took too long to complete. Please try again.",
    variant: "destructive",
  },
  "not-found": {
    icon: HelpCircle,
    title: "Not Found",
    message: "The requested data could not be found.",
    variant: "default",
  },
  "rate-limit": {
    icon: Clock,
    title: "Too Many Requests",
    message: "Please wait a moment before trying again.",
    variant: "default",
  },
  custom: {
    icon: Info,
    title: "Error",
    message: "An error occurred.",
    variant: "default",
  },
};

const F1ErrorState = React.forwardRef<HTMLDivElement, F1ErrorStateProps>(
  ({ 
    className, 
    type = "generic",
    title,
    message,
    details,
    onRetry,
    isRetrying = false,
    variant = "card",
    size = "md",
    showDetails = false,
    ...props 
  }, ref) => {
    const [showTechnicalDetails, setShowTechnicalDetails] = React.useState(false);
    const config = errorConfig[type];
    const IconComponent = config.icon;

    const sizeClasses = {
      sm: "p-3 text-sm",
      md: "p-4",
      lg: "p-6 text-lg",
    };

    // Inline variant using Alert
    if (variant === "inline") {
      return (
        <Alert
          ref={ref}
          variant={config.variant}
          className={cn(sizeClasses[size], className)}
          {...props}
        >
          <IconComponent className="h-4 w-4" />
          <AlertTitle>{title || config.title}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{message || config.message}</span>
            {onRetry && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onRetry}
                disabled={isRetrying}
                className="w-fit"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Try Again
                  </>
                )}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      );
    }

    // Fullscreen variant
    if (variant === "fullscreen") {
      return (
        <div
          ref={ref}
          className={cn(
            "flex flex-col items-center justify-center min-h-[400px] text-center p-8",
            className
          )}
          {...props}
        >
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-destructive/20 rounded-full blur-xl" />
            <div className="relative p-6 bg-destructive/10 rounded-full">
              <IconComponent className="h-16 w-16 text-destructive" />
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-2">{title || config.title}</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            {message || config.message}
          </p>

          {onRetry && (
            <Button 
              onClick={onRetry}
              disabled={isRetrying}
              className="mb-4"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </>
              )}
            </Button>
          )}

          {details && showDetails && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="text-muted-foreground"
              >
                {showTechnicalDetails ? "Hide" : "Show"} Technical Details
              </Button>
              {showTechnicalDetails && (
                <pre className="mt-2 p-4 bg-muted rounded-lg text-left text-xs overflow-auto max-w-lg">
                  {details}
                </pre>
              )}
            </div>
          )}
        </div>
      );
    }

    // Card variant (default)
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border border-destructive/20 bg-destructive/5",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-destructive/10 rounded-full">
            <IconComponent className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-destructive">
              {title || config.title}
            </h4>
            <p className="text-sm text-muted-foreground mt-1">
              {message || config.message}
            </p>
            
            {onRetry && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onRetry}
                disabled={isRetrying}
                className="mt-3"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Try Again
                  </>
                )}
              </Button>
            )}

            {details && showDetails && (
              <details className="mt-3">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  Technical Details
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                  {details}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  }
);
F1ErrorState.displayName = "F1ErrorState";

// Pre-configured error states
const NetworkError = ({ onRetry, isRetrying }: { onRetry?: () => void; isRetrying?: boolean }) => (
  <F1ErrorState type="network" onRetry={onRetry} isRetrying={isRetrying} />
);

const ServerError = ({ onRetry, isRetrying }: { onRetry?: () => void; isRetrying?: boolean }) => (
  <F1ErrorState type="server" onRetry={onRetry} isRetrying={isRetrying} />
);

const RateLimitError = ({ onRetry, isRetrying }: { onRetry?: () => void; isRetrying?: boolean }) => (
  <F1ErrorState 
    type="rate-limit" 
    message="The API rate limit has been reached. Please wait a moment before retrying."
    onRetry={onRetry} 
    isRetrying={isRetrying} 
  />
);

const DataLoadError = ({ 
  dataType, 
  onRetry, 
  isRetrying 
}: { 
  dataType?: string; 
  onRetry?: () => void; 
  isRetrying?: boolean 
}) => (
  <F1ErrorState 
    type="generic"
    title={`Failed to Load ${dataType || "Data"}`}
    message={`We couldn't load the ${dataType?.toLowerCase() || "data"}. Please try again.`}
    onRetry={onRetry} 
    isRetrying={isRetrying}
    variant="inline"
    size="sm"
  />
);

export { 
  F1ErrorState, 
  NetworkError, 
  ServerError, 
  RateLimitError,
  DataLoadError 
};


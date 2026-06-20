import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Flag, 
  Calendar, 
  Trophy, 
  Clock, 
  BarChart3, 
  Users,
  Car,
  Timer,
  RefreshCw,
  Search,
  FileQuestion
} from "lucide-react";

type EmptyStateType = 
  | "no-data" 
  | "no-races" 
  | "no-results" 
  | "season-start" 
  | "no-drivers"
  | "no-teams"
  | "no-chart-data"
  | "no-search-results"
  | "loading-failed"
  | "coming-soon"
  | "custom";

interface F1EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Type of empty state */
  type?: EmptyStateType;
  /** Custom title */
  title?: string;
  /** Custom description */
  description?: string;
  /** Custom icon */
  icon?: React.ReactNode;
  /** Action button text */
  actionText?: string;
  /** Action button callback */
  onAction?: () => void;
  /** Secondary action text */
  secondaryActionText?: string;
  /** Secondary action callback */
  onSecondaryAction?: () => void;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to show the F1-themed decorative elements */
  showDecoration?: boolean;
}

const emptyStateConfig: Record<EmptyStateType, {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}> = {
  "no-data": {
    icon: FileQuestion,
    title: "No Data Available",
    description: "We couldn't find any data to display. This might be temporary.",
  },
  "no-races": {
    icon: Flag,
    title: "No Races Yet",
    description: "The race calendar is empty. Check back when the season schedule is released.",
  },
  "no-results": {
    icon: Trophy,
    title: "No Results Yet",
    description: "Race results will appear here once the race is completed.",
  },
  "season-start": {
    icon: Calendar,
    title: "Season Starting Soon",
    description: "The new F1 season hasn't started yet. Get ready for the action!",
  },
  "no-drivers": {
    icon: Users,
    title: "No Drivers Found",
    description: "Driver information is not available at the moment.",
  },
  "no-teams": {
    icon: Car,
    title: "No Teams Found",
    description: "Team information is not available at the moment.",
  },
  "no-chart-data": {
    icon: BarChart3,
    title: "No Chart Data",
    description: "There's no data available to display in this chart.",
  },
  "no-search-results": {
    icon: Search,
    title: "No Results Found",
    description: "Try adjusting your search or filters to find what you're looking for.",
  },
  "loading-failed": {
    icon: RefreshCw,
    title: "Failed to Load",
    description: "Something went wrong while loading the data. Please try again.",
  },
  "coming-soon": {
    icon: Clock,
    title: "Coming Soon",
    description: "This feature or data will be available soon.",
  },
  "custom": {
    icon: FileQuestion,
    title: "No Content",
    description: "There's nothing to display here.",
  },
};

const sizeClasses = {
  sm: {
    container: "py-6",
    icon: "h-10 w-10",
    title: "text-base",
    description: "text-sm",
  },
  md: {
    container: "py-10",
    icon: "h-14 w-14",
    title: "text-lg",
    description: "text-sm",
  },
  lg: {
    container: "py-16",
    icon: "h-20 w-20",
    title: "text-xl",
    description: "text-base",
  },
};

const F1EmptyState = React.forwardRef<HTMLDivElement, F1EmptyStateProps>(
  ({ 
    className, 
    type = "no-data",
    title,
    description,
    icon,
    actionText,
    onAction,
    secondaryActionText,
    onSecondaryAction,
    size = "md",
    showDecoration = true,
    ...props 
  }, ref) => {
    const config = emptyStateConfig[type];
    const IconComponent = config.icon;
    const sizes = sizeClasses[size];

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center text-center",
          sizes.container,
          className
        )}
        {...props}
      >
        {/* Decorative background */}
        {showDecoration && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-5">
            <div className="absolute top-1/4 left-1/4 w-32 h-32 border-2 border-primary rounded-full" />
            <div className="absolute bottom-1/4 right-1/4 w-24 h-24 border-2 border-primary rounded-full" />
            <div className="absolute top-1/2 right-1/3 w-16 h-16 border border-primary rotate-45" />
          </div>
        )}

        {/* Icon */}
        <div className="relative mb-4">
          <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl" />
          <div className="relative p-4 bg-muted/50 rounded-full">
            {icon || <IconComponent className={cn(sizes.icon, "text-muted-foreground")} />}
          </div>
        </div>

        {/* Title */}
        <h3 className={cn("font-bold text-foreground mb-2", sizes.title)}>
          {title || config.title}
        </h3>

        {/* Description */}
        <p className={cn("text-muted-foreground max-w-md mb-6", sizes.description)}>
          {description || config.description}
        </p>

        {/* Actions */}
        {(actionText || secondaryActionText) && (
          <div className="flex flex-wrap gap-3 justify-center">
            {actionText && onAction && (
              <Button onClick={onAction} className="bg-primary hover:bg-primary/90">
                {type === "loading-failed" && <RefreshCw className="mr-2 h-4 w-4" />}
                {actionText}
              </Button>
            )}
            {secondaryActionText && onSecondaryAction && (
              <Button variant="outline" onClick={onSecondaryAction}>
                {secondaryActionText}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }
);
F1EmptyState.displayName = "F1EmptyState";

// Pre-configured empty states for common use cases
const SeasonStartEmpty = ({ onViewCalendar }: { onViewCalendar?: () => void }) => (
  <F1EmptyState 
    type="season-start"
    title="Season Starting Soon"
    description="All drivers are currently at 0 points. The championship battle begins with the first race!"
    actionText={onViewCalendar ? "View Calendar" : undefined}
    onAction={onViewCalendar}
  />
);

const NoRaceResultsEmpty = ({ raceName, onRefresh }: { raceName?: string; onRefresh?: () => void }) => (
  <F1EmptyState 
    type="no-results"
    title={raceName ? `${raceName} Results Pending` : "Results Pending"}
    description="Race results will be available once the session is completed."
    actionText={onRefresh ? "Refresh" : undefined}
    onAction={onRefresh}
  />
);

const NoChartDataEmpty = ({ chartType, onSelectDifferent }: { chartType?: string; onSelectDifferent?: () => void }) => (
  <F1EmptyState 
    type="no-chart-data"
    size="sm"
    title={chartType ? `No ${chartType} Data` : "No Data"}
    description="Select different options or wait for data to become available."
    actionText={onSelectDifferent ? "Change Selection" : undefined}
    onAction={onSelectDifferent}
    showDecoration={false}
  />
);

const LoadingFailedEmpty = ({ onRetry }: { onRetry: () => void }) => (
  <F1EmptyState 
    type="loading-failed"
    actionText="Try Again"
    onAction={onRetry}
  />
);

const ComingSoonEmpty = ({ title, description }: { title?: string; description?: string }) => (
  <F1EmptyState 
    type="coming-soon"
    title={title}
    description={description}
  />
);

export type { EmptyStateType };

export { 
  F1EmptyState, 
  SeasonStartEmpty, 
  NoRaceResultsEmpty, 
  NoChartDataEmpty,
  LoadingFailedEmpty,
  ComingSoonEmpty
};


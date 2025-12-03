import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface LegendItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Color for the legend indicator */
  color: string;
  /** Whether this item is currently visible/selected */
  active?: boolean;
  /** Optional secondary label (e.g., team name) */
  secondaryLabel?: string;
  /** Line style indicator */
  lineStyle?: "solid" | "dashed" | "dotted";
}

interface F1ChartLegendProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Legend items */
  items: LegendItem[];
  /** Callback when an item is clicked */
  onItemClick?: (id: string) => void;
  /** Callback when an item is hovered */
  onItemHover?: (id: string | null) => void;
  /** Layout direction */
  direction?: "horizontal" | "vertical";
  /** Whether items are interactive */
  interactive?: boolean;
  /** Maximum items to show before collapsing */
  maxVisible?: number;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to show line style indicators */
  showLineStyle?: boolean;
}

const sizeClasses = {
  sm: {
    container: "gap-2",
    item: "text-xs px-2 py-0.5",
    indicator: "w-2 h-2",
    line: "w-4 h-0.5",
  },
  md: {
    container: "gap-3",
    item: "text-sm px-2.5 py-1",
    indicator: "w-2.5 h-2.5",
    line: "w-5 h-0.5",
  },
  lg: {
    container: "gap-4",
    item: "text-base px-3 py-1.5",
    indicator: "w-3 h-3",
    line: "w-6 h-1",
  },
};

const F1ChartLegend = React.forwardRef<HTMLDivElement, F1ChartLegendProps>(
  ({ 
    className, 
    items,
    onItemClick,
    onItemHover,
    direction = "horizontal",
    interactive = true,
    maxVisible,
    size = "md",
    showLineStyle = false,
    ...props 
  }, ref) => {
    const [expanded, setExpanded] = React.useState(false);
    const sizes = sizeClasses[size];

    const visibleItems = maxVisible && !expanded 
      ? items.slice(0, maxVisible) 
      : items;
    const hiddenCount = maxVisible ? items.length - maxVisible : 0;

    const renderIndicator = (item: LegendItem) => {
      if (showLineStyle && item.lineStyle) {
        const lineStyles = {
          solid: "",
          dashed: "border-dashed border-t-2 h-0",
          dotted: "border-dotted border-t-2 h-0",
        };

        return (
          <div 
            className={cn(sizes.line, "rounded-full")}
            style={{ 
              backgroundColor: item.lineStyle === "solid" ? item.color : "transparent",
              borderColor: item.color,
            }}
          />
        );
      }

      return (
        <div 
          className={cn(sizes.indicator, "rounded-full flex-shrink-0")}
          style={{ backgroundColor: item.color }}
        />
      );
    };

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-wrap items-center",
          direction === "vertical" && "flex-col items-start",
          sizes.container,
          className
        )}
        {...props}
      >
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "flex items-center gap-1.5 rounded-md transition-all",
              sizes.item,
              interactive && "hover:bg-muted cursor-pointer",
              !interactive && "cursor-default",
              item.active === false && "opacity-40"
            )}
            onClick={() => interactive && onItemClick?.(item.id)}
            onMouseEnter={() => onItemHover?.(item.id)}
            onMouseLeave={() => onItemHover?.(null)}
            disabled={!interactive}
          >
            {renderIndicator(item)}
            <span className="truncate max-w-[100px]">{item.label}</span>
            {item.secondaryLabel && (
              <span className="text-muted-foreground text-xs truncate">
                ({item.secondaryLabel})
              </span>
            )}
          </button>
        ))}

        {/* Expand/Collapse button */}
        {maxVisible && hiddenCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-1 px-2 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                +{hiddenCount} more
              </>
            )}
          </Button>
        )}
      </div>
    );
  }
);
F1ChartLegend.displayName = "F1ChartLegend";

// Driver legend with team colors
interface DriverLegendItem extends Omit<LegendItem, "id" | "label" | "color"> {
  driverCode: string;
  driverName: string;
  teamColor: string;
  teamName?: string;
}

interface F1DriverLegendProps extends Omit<F1ChartLegendProps, "items"> {
  drivers: DriverLegendItem[];
}

const F1DriverLegend = React.forwardRef<HTMLDivElement, F1DriverLegendProps>(
  ({ drivers, ...props }, ref) => {
    const items: LegendItem[] = drivers.map((driver) => ({
      id: driver.driverCode,
      label: driver.driverCode,
      color: driver.teamColor,
      secondaryLabel: driver.teamName,
      active: driver.active,
      lineStyle: driver.lineStyle,
    }));

    return <F1ChartLegend ref={ref} items={items} {...props} />;
  }
);
F1DriverLegend.displayName = "F1DriverLegend";

// Team legend
interface TeamLegendItem extends Omit<LegendItem, "id" | "label" | "color"> {
  teamId: string;
  teamName: string;
  teamColor: string;
}

interface F1TeamLegendProps extends Omit<F1ChartLegendProps, "items"> {
  teams: TeamLegendItem[];
}

const F1TeamLegend = React.forwardRef<HTMLDivElement, F1TeamLegendProps>(
  ({ teams, ...props }, ref) => {
    const items: LegendItem[] = teams.map((team) => ({
      id: team.teamId,
      label: team.teamName,
      color: team.teamColor,
      active: team.active,
    }));

    return <F1ChartLegend ref={ref} items={items} {...props} />;
  }
);
F1TeamLegend.displayName = "F1TeamLegend";

export { F1ChartLegend, F1DriverLegend, F1TeamLegend };
export type { LegendItem, DriverLegendItem, TeamLegendItem };


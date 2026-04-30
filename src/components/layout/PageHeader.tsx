import * as React from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/ThemeContext";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Page title — rendered as the page's single H1. */
  title: React.ReactNode;
  /** Optional supporting copy under the title. */
  description?: React.ReactNode;
  /** Optional leading icon shown next to the title. */
  icon?: React.ReactNode;
  /** Optional right-aligned actions (filters, selectors, buttons). */
  actions?: React.ReactNode;
  /** Title size. Default: "lg". */
  size?: "md" | "lg";
}

const titleSize = {
  md: "text-2xl",
  lg: "text-2xl md:text-3xl",
} as const;

/**
 * Standardized page header with title, description, optional icon and actions.
 * Use as the first child of <PageContainer> on every top-level page.
 */
const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, description, icon, actions, size = "lg", ...props }, ref) => {
    const { isGlass } = useTheme();
    return (
      <header
        ref={ref}
        className={cn(
          "flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div
              className={cn(
                "p-2 rounded-lg shrink-0",
                isGlass ? "bg-primary/10 border border-white/10" : "bg-primary/10"
              )}
            >
              <span className="block text-primary [&>svg]:h-5 [&>svg]:w-5 md:[&>svg]:h-6 md:[&>svg]:w-6">
                {icon}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className={cn("font-bold tracking-tight", titleSize[size])}>{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">{actions}</div>
        )}
      </header>
    );
  }
);
PageHeader.displayName = "PageHeader";

export { PageHeader };
export default PageHeader;

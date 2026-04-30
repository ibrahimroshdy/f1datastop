import * as React from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Vertical spacing between sections. Default: "md". */
  spacing?: "sm" | "md" | "lg";
  /** Optional max-width constraint. Default: "none" (fills MainLayout). */
  maxWidth?: "none" | "lg" | "xl" | "2xl" | "7xl";
}

const spacingMap = {
  sm: "space-y-4",
  md: "space-y-6",
  lg: "space-y-8",
} as const;

const maxWidthMap = {
  none: "",
  lg: "max-w-screen-lg mx-auto",
  xl: "max-w-screen-xl mx-auto",
  "2xl": "max-w-screen-2xl mx-auto",
  "7xl": "max-w-7xl mx-auto",
} as const;

/**
 * Standard page wrapper providing consistent vertical rhythm and optional
 * max-width. Sits inside MainLayout's <main>.
 */
const PageContainer = React.forwardRef<HTMLDivElement, PageContainerProps>(
  ({ className, spacing = "md", maxWidth = "none", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(spacingMap[spacing], maxWidthMap[maxWidth], "w-full", className)}
      {...props}
    />
  )
);
PageContainer.displayName = "PageContainer";

export { PageContainer };
export default PageContainer;

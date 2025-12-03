import * as React from "react";
import { cn } from "@/lib/utils";

// Glass Table Root
const GlassTable = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto glass-table">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
));
GlassTable.displayName = "GlassTable";

// Glass Table Header
const GlassTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("glass-table-header [&_tr]:border-b", className)}
    {...props}
  />
));
GlassTableHeader.displayName = "GlassTableHeader";

// Glass Table Body
const GlassTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
GlassTableBody.displayName = "GlassTableBody";

// Glass Table Footer
const GlassTableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/30 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
));
GlassTableFooter.displayName = "GlassTableFooter";

// Glass Table Row
const GlassTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & {
    /** Highlight color for team accent */
    teamColor?: string;
    /** Whether this row is selected */
    selected?: boolean;
    /** Whether this row is clickable */
    clickable?: boolean;
  }
>(({ className, teamColor, selected, clickable, style, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "glass-table-row transition-colors",
      clickable && "cursor-pointer",
      selected && "bg-accent/50",
      className
    )}
    style={{
      ...style,
      ...(teamColor ? { borderLeftColor: teamColor, borderLeftWidth: '3px' } : {}),
    }}
    {...props}
  />
));
GlassTableRow.displayName = "GlassTableRow";

// Glass Table Head Cell
const GlassTableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & {
    /** Whether this column is sortable */
    sortable?: boolean;
    /** Sort direction */
    sortDirection?: "asc" | "desc" | null;
  }
>(({ className, sortable, sortDirection, children, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      sortable && "cursor-pointer select-none hover:text-foreground transition-colors",
      className
    )}
    {...props}
  >
    <div className="flex items-center gap-2">
      {children}
      {sortable && sortDirection && (
        <span className="text-xs">
          {sortDirection === "asc" ? "↑" : "↓"}
        </span>
      )}
    </div>
  </th>
));
GlassTableHead.displayName = "GlassTableHead";

// Glass Table Cell
const GlassTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-4 align-middle [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
));
GlassTableCell.displayName = "GlassTableCell";

// Glass Table Caption
const GlassTableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
GlassTableCaption.displayName = "GlassTableCaption";

// Glass Table Empty State
const GlassTableEmpty = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & {
    colSpan: number;
    icon?: React.ReactNode;
    title?: string;
    description?: string;
  }
>(({ className, colSpan, icon, title, description, children, ...props }, ref) => (
  <tr ref={ref} className={className} {...props}>
    <td colSpan={colSpan} className="h-32 text-center">
      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
        {icon && <div className="text-muted-foreground/50">{icon}</div>}
        {title && <p className="font-medium">{title}</p>}
        {description && <p className="text-sm">{description}</p>}
        {children}
      </div>
    </td>
  </tr>
));
GlassTableEmpty.displayName = "GlassTableEmpty";

export {
  GlassTable,
  GlassTableHeader,
  GlassTableBody,
  GlassTableFooter,
  GlassTableHead,
  GlassTableRow,
  GlassTableCell,
  GlassTableCaption,
  GlassTableEmpty,
};


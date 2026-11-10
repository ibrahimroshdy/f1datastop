import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one compact row of the Home cards (docs/design/decisions.md D29): position, who, and one
 * figure at the end with an optional plain-words line under it. Every row has the same height.
 */
export function CompactRow({
  pos,
  children,
  figure,
  note,
  className,
}: {
  pos: number | string;
  children: ReactNode;
  figure: ReactNode;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <li className={cn("flex min-h-14 items-center gap-3 py-2", className)}>
      <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">{pos}</span>
      <div className="min-w-0 flex-1">{children}</div>
      <span className="flex shrink-0 flex-col items-end text-right">
        <b className="font-mono text-base font-semibold tabular-nums text-figure">{figure}</b>
        {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
      </span>
    </li>
  );
}


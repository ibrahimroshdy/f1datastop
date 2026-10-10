import { useState, type ReactNode } from "react";
import { ChevronDown, EyeOff, type LucideIcon } from "lucide-react";
import { F1Card } from "@/components/f1";
import { cn } from "@/lib/utils";
import { useThemeVariant } from "@/hooks/useThemeVariant";

interface Props {
  title: string;
  icon: LucideIcon;
  onHide?: () => void;
  right?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Card chrome for one Pit Wall panel: title, collapse (minimise) + hide controls. */
export function PanelShell({ title, icon: Icon, onHide, right, className, bodyClassName, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { cardVariant, glassVariant, isGlass } = useThemeVariant();
  return (
    <F1Card
      variant={cardVariant}
      glassVariant={glassVariant}
      className={cn("flex min-w-0 flex-col overflow-hidden p-0", isGlass && "border-white/10", className)}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="instrument-label truncate text-foreground">{title}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {right}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={collapsed ? "Expand panel" : "Collapse panel"}
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", collapsed && "-rotate-90")} />
          </button>
          {onHide && (
            <button
              type="button"
              onClick={onHide}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Hide panel"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {!collapsed && <div className={cn("min-w-0 flex-1 p-3", bodyClassName)}>{children}</div>}
    </F1Card>
  );
}

import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { isNavActive, moreItems } from "@/config/navigation";
import { ThemeSelector } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";
import { useSeason } from "@/hooks/useSeason";
import { seasonSearch } from "@/lib/links";

interface MorePanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The phone's More panel (D22): a solid card rising from the dock with the pages that are
 * not in the dock, and the theme. Escape, a tap outside and navigation close it; focus moves
 * into it on open and back to the More tab on close.
 */
const MorePanel = ({ open, onClose }: MorePanelProps) => {
  const { pathname } = useLocation();
  const [season] = useSeason();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      const el = t as HTMLElement;
      // The theme menu renders in a portal; a tap inside it is not "outside".
      if (ref.current?.contains(t) || el.closest?.("[aria-controls='more-panel'],[data-radix-popper-content-wrapper]")) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      trigger?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const row =
    "press flex min-h-[52px] items-center gap-3 rounded-2xl px-3 text-base font-medium " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div id="more-panel" ref={ref} role="dialog" aria-label="More" className="shell-more md:hidden">
      <ul>
        {moreItems.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item, pathname);
          return (
            <li key={item.href}>
              {item.external ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer" className={cn(row, "text-foreground hover:bg-accent")}>
                  <Icon className="h-5 w-5 text-ink-2" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" aria-label="Opens in a new tab" />
                </a>
              ) : (
                <Link
                  to={item.href + seasonSearch(season)}
                  viewTransition
                  aria-current={active ? "page" : undefined}
                  className={cn(row, active ? "bg-act text-on-act" : "text-foreground hover:bg-accent")}
                >
                  <Icon className={cn("h-5 w-5", !active && "text-ink-2")} aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-1 flex min-h-[52px] items-center justify-between border-t px-3 pt-1">
        <span className="text-base font-medium">Theme</span>
        <ThemeSelector />
      </div>
    </div>
  );
};

export default MorePanel;

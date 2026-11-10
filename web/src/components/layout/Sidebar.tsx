import { Link, useLocation } from "react-router-dom";
import { ExternalLink, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { isNavActive, navGroups, type NavItem } from "@/config/navigation";
import f1Logo from "@/assets/f1-logo.svg";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AdSenseUnit } from "@/components/ads/AdSenseUnit";
import { adsenseSlots } from "@/config/adsense";
import { cn } from "@/lib/utils";

interface SidebarProps {
  /** Folded to the icon rail. Always folded from 768 to 1023 px. */
  rail: boolean;
  /** Only offered from 1024 px, where the full column fits. */
  canExpand: boolean;
  onToggle: () => void;
}

/**
 * The floating sidebar for tablet and desktop (docs/design/decisions.md D7, D22), after
 * Mondar PR #41: a solid column 12 px from the edges. The page you are on is a filled act
 * capsule, like the dock's tab. On the rail every item keeps a tooltip with its name.
 */
const Sidebar = ({ rail, canExpand, onToggle }: SidebarProps) => {
  const { pathname } = useLocation();

  const item = (it: NavItem) => {
    const Icon = it.icon;
    const active = isNavActive(it, pathname);
    const cls = cn(
      "press flex h-11 items-center gap-3 rounded-2xl text-[15px] font-medium transition-colors duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      rail ? "w-11 justify-center self-center" : "px-3",
      active ? "bg-act text-on-act" : "text-ink-2 hover:bg-accent hover:text-foreground",
    );
    const inner = (
      <>
        <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
        {!rail && <span className="flex-1">{it.label}</span>}
        {!rail && it.external && <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-label="Opens in a new tab" />}
      </>
    );
    const link = it.external ? (
      <a href={it.href} target="_blank" rel="noopener noreferrer" className={cls} aria-label={rail ? it.label : undefined}>
        {inner}
      </a>
    ) : (
      <Link
        to={it.href}
        viewTransition
        className={cls}
        aria-current={active ? "page" : undefined}
        aria-label={rail ? it.label : undefined}
      >
        {inner}
      </Link>
    );
    if (!rail) return <li key={it.href}>{link}</li>;
    return (
      <li key={it.href} className="flex justify-center">
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{it.label}</TooltipContent>
        </Tooltip>
      </li>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <aside className={cn("shell-side", rail && "is-rail")} aria-label="Sidebar">
        <Link
          to="/"
          viewTransition
          className={cn("press mb-3 flex items-center gap-2.5 rounded-2xl py-1", rail ? "justify-center" : "px-2")}
          aria-label="F1 DataStop, home"
        >
          <img src={f1Logo} alt="" className="h-9 w-9 shrink-0" />
          {!rail && (
            <span className="font-display text-[22px] font-bold uppercase leading-none tracking-[0.005em]">
              <span className="text-primary">F1</span> DataStop
            </span>
          )}
        </Link>

        <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto" aria-label="Main">
          {navGroups.map((group) => (
            <div key={group.id}>
              {group.label && !rail && (
                <p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">{group.label}</p>
              )}
              <ul className="flex flex-col gap-1">{group.items.map(item)}</ul>
            </div>
          ))}
        </nav>

        {!rail && adsenseSlots.sidebar ? (
          <div className="shrink-0 border-t py-3">
            <AdSenseUnit
              adSlot={adsenseSlots.sidebar}
              className="mx-auto w-full max-w-[200px]"
              minHeight={250}
              format="vertical"
              fullWidthResponsive={false}
              style={{ width: "160px", minWidth: "160px" }}
            />
          </div>
        ) : null}

        {canExpand && (
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "press mt-2 flex h-10 items-center gap-2 rounded-2xl text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              rail ? "w-11 justify-center self-center" : "px-3",
            )}
            aria-label={rail ? "Expand the sidebar" : "Fold the sidebar"}
            title="Fold or expand (⌘\\)"
          >
            {rail ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!rail && "Fold"}
          </button>
        )}
      </aside>
    </TooltipProvider>
  );
};

export default Sidebar;

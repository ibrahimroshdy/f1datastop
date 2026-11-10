import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { dockItems, isNavActive, moreItems } from "@/config/navigation";
import MorePanel from "./MorePanel";
import { cn } from "@/lib/utils";
import { useSeason } from "@/hooks/useSeason";
import { seasonSearch } from "@/lib/links";

/**
 * The phone's floating dock (docs/design/decisions.md D7, D22), after Mondar PR #41:
 * a solid bar 16 px from the sides and 12 px above the home indicator. Every tab has the
 * same footprint, a rounded box 6 px inside the dock; the one you are on is filled with the
 * act colour. Labels stay at 12 px. More opens a solid panel above the dock.
 */
const Dock = () => {
  const { pathname } = useLocation();
  const [season] = useSeason();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreItems.some((i) => isNavActive(i, pathname));

  useEffect(() => setMoreOpen(false), [pathname]);

  const tab =
    "press flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[18px] text-xs font-medium " +
    "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <>
      <div className="dock-scrim md:hidden" aria-hidden="true" />
      <MorePanel open={moreOpen} onClose={() => setMoreOpen(false)} />
      <nav className="shell-dock md:hidden" aria-label="Main">
        {dockItems.map((item) => {
          const active = isNavActive(item, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href + seasonSearch(season)}
              viewTransition
              aria-current={active ? "page" : undefined}
              className={cn(tab, active ? "bg-act text-on-act" : "text-ink-2 hover:text-foreground")}
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          aria-controls="more-panel"
          className={cn(tab, moreActive || moreOpen ? "bg-act text-on-act" : "text-ink-2 hover:text-foreground")}
        >
          <MoreHorizontal className="h-[22px] w-[22px]" aria-hidden="true" />
          More
        </button>
      </nav>
    </>
  );
};

export default Dock;

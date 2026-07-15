import { Link, useLocation } from "react-router-dom";
import { Calendar, GitCompare, Home, ListOrdered, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

// Five direct destinations — the most-used pages. The League is a headline
// destination now, so it gets a thumb-reachable slot (Drivers stays in the
// sidebar). Shown to everyone — guests land on the public League page.
const tabs = [
  { label: "Home", href: "/", icon: Home, match: (p: string) => p === "/" },
  {
    label: "Calendar",
    href: "/calendar",
    icon: Calendar,
    match: (p: string) => p.startsWith("/calendar"),
  },
  {
    label: "Standings",
    href: "/standings",
    icon: ListOrdered,
    match: (p: string) => p.startsWith("/standings"),
  },
  {
    label: "Analysis",
    href: "/race-analysis",
    icon: GitCompare,
    match: (p: string) => p.startsWith("/race-analysis"),
  },
  {
    label: "League",
    href: "/game",
    icon: Trophy,
    match: (p: string) => p.startsWith("/game"),
  },
];

const BottomNav = () => {
  const { pathname } = useLocation();

  return (
    <nav
      className="nav-stable safe-bottom fixed bottom-0 left-0 right-0 z-40 border-t bg-background md:hidden"
      aria-label="Primary mobile navigation"
    >
      <ul className="flex h-14 items-stretch justify-around">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex flex-1">
              <Link
                to={tab.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default BottomNav;

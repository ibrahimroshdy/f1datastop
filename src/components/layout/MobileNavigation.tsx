import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NavItem } from "@/types";
import { LucideIcon } from "lucide-react";

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface MobileNavigationProps {
  items: NavigationItem[];
  onNavClick: () => void;
}

const MobileNavigation = ({ items, onNavClick }: MobileNavigationProps) => {
  const { pathname } = useLocation();

  return (
    <div className="space-y-1 pt-0">
      <div className="px-3">
        <div className="space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={onNavClick}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-accent text-accent-foreground border-l-2 border-primary"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <item.icon className={cn("mr-2 h-4 w-4", isActive ? "text-accent-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                {item.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MobileNavigation; 